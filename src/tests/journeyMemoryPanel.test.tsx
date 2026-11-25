import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyMemoryPanel } from "../app/JourneyMemoryPanel";
import type { JourneyMemory } from "../domain/journeyMemory";
import appSource from "../app/App.tsx?raw";
import hostSource from "../../mirror-host/host.mjs?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

// "View Journey Memory…" in the ⋯ menu beside the avatar, as the Navigator placed it: what Mirror
// kept from the Journey, read on request, leading to the conversation each memory came from.

const memory = (id: string, patch: Partial<JourneyMemory> = {}): JourneyMemory => ({
  id, memoryType: "decision", layer: "ego", title: `Title ${id}`, content: `Content ${id}`, persona: null, conversationId: null,
  createdAt: "2026-11-20T10:00:00Z", readinessState: null, ...patch,
});

function render(overrides: Partial<Parameters<typeof JourneyMemoryPanel>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyMemoryPanel
      journeyName="Nautilus"
      status="ready"
      memories={[]}
      conversationTargetOf={() => undefined}
      onOpenConversation={vi.fn()}
      onReload={vi.fn()}
      onClose={vi.fn()}
      locale="en-US"
      {...overrides}
    />,
  );
}

describe("the Journey memory panel, drawn", () => {
  it("names the Journey, counts what was kept, and lists it by kind with the date and the kind of an unusual one", () => {
    const html = render({ memories: [memory("c-1", { memoryType: "commitment", persona: "coach" }), memory("d-1"), memory("p-1", { memoryType: "pattern" })] });
    expect(html).toContain('aria-label="Memory of Nautilus"');
    expect(html).toContain("1 commitment · 1 decision · 1 other");
    expect(html).toMatch(/Commitments[\s\S]*Title c-1[\s\S]*Decisions[\s\S]*Title d-1[\s\S]*Other memories[\s\S]*Title p-1/);
    expect(html).toContain("Nov 20, 2026");
    expect(html).toContain('<span class="journey-memory-tag">coach</span>');
    expect(html).toContain('<span class="journey-memory-tag">pattern</span>');
    expect(html).not.toContain('<span class="journey-memory-tag">decision</span>');
    expect(html).toContain("These are the memories Mirror hands to the agent");
  });

  it("offers the conversation only when the app knows where it is, and the whole text only when it was cut", () => {
    const long = memory("l-1", { content: `${"A sentence that goes on. ".repeat(20)}The end.`, conversationId: "mirror-1" });
    const html = render({
      memories: [long, memory("s-1")],
      conversationTargetOf: (item) => (item.conversationId ? { kind: "mirror_history", conversationId: item.conversationId } : undefined),
    });
    expect(html.match(/Open the conversation/g)).toHaveLength(1);
    expect(html.match(/Whole text/g)).toHaveLength(1);
  });

  it("says what it is doing while it reads, what went wrong, and when there is nothing yet", () => {
    expect(render({ status: "loading" })).toContain("Reading what Mirror kept…");
    expect(render({ status: "failed", error: "The host is not running." })).toMatch(/Could not be read[\s\S]*The host is not running\.[\s\S]*Try again/);
    expect(render({ status: "ready" })).toContain("Mirror has kept nothing from this Journey yet.");
    expect(render({ status: "ready", memories: [memory("a")], truncated: true })).toContain("The newest are shown; the counts above include the rest.");
  });
});

describe("how the app is wired to it", () => {
  it("offers View Journey Memory… in the ⋯ menu, after Chapters and before the separator", () => {
    const menu = appSource.slice(appSource.indexOf("CR190: Chapters moved here"), appSource.indexOf("Reset agent context…"));
    expect(menu).toMatch(/Chapters…[\s\S]*View Journey Memory…[\s\S]*<div className="journey-menu-separator" role="separator" \/>/);
    expect(menu).toContain('aria-label="View Journey memory"');
    expect(menu).toContain("setJourneyMemoryOpen((open) => !open)");
  });

  it("reads only while the panel is open, draws the panel in the conversation column, and leads to the conversation of origin", () => {
    expect(appSource).toContain("if (!runtimeBindingReady || !selectedJourney || !registryLoaded || !journeyMemoryOpen) return;");
    expect(appSource).toContain("void readJourneyMemories(journeyId)");
    expect(appSource).toMatch(/className="chat-stream"[\s\S]*\{journeyMemoryOpen \? \(\s*<JourneyMemoryPanel/);
    expect(appSource).toContain("conversationTargetOf={(memory) => memoryConversationTarget(memory, journeyCatalogState(conversationCatalogs, selectedJourney).entries)}");
    const route = appSource.slice(appSource.indexOf("function openJourneyMemoryConversation"), appSource.indexOf("function focusComposer"));
    expect(route).toContain('{ type: "select_desktop", journeyId: selectedJourney, conversationId: target.conversationId }');
    expect(route).toContain('{ type: "select_mirror", journeyId: selectedJourney, conversationId: target.conversationId }');
  });

  it("reads through the host, read-only, from the home's own table; the native command checks the Journey id first", () => {
    expect(hostSource).toContain("listJourneyMemories: (d, p) => listJourneyMemories(p.dbPath, p.request),");
    const read = hostSource.slice(hostSource.indexOf("export function listJourneyMemories"), hostSource.indexOf("const REFUSALS = ["));
    expect(read).toContain('new DatabaseSync(dbPath, { readOnly: true })');
    expect(read).toContain("FROM memories WHERE journey = ? ORDER BY created_at DESC LIMIT ?");
    expect(read).not.toMatch(/INSERT|UPDATE|DELETE/);
    expect(mainSource).toContain("journey_memory::list_journey_memories,");
  });
});
