import { describe, expect, it } from "vitest";
import {
  describeJourneyMemoryCounts,
  formatMemoryDate,
  groupJourneyMemories,
  memoryConversationTarget,
  memoryExcerpt,
  memoryKindOf,
  sanitizeJourneyMemoryRead,
  type JourneyMemory,
} from "../domain/journeyMemory";
import type { ConversationCatalogEntry } from "../domain/conversationSpaces";

// What Mirror kept from a Journey, as the person reads it: by kind, newest first, leading to the
// conversation it came from. The panel reads; it changes nothing.

const memory = (id: string, patch: Partial<JourneyMemory> = {}): JourneyMemory => ({
  id, memoryType: "decision", layer: "ego", title: `Title ${id}`, content: `Content ${id}`, persona: null, conversationId: null,
  createdAt: "2026-11-20T10:00:00Z", readinessState: null, ...patch,
});

describe("what Mirror kept, read from the host", () => {
  it("keeps well-formed memories once each and the host's order, and fills what is absent with null", () => {
    const read = sanitizeJourneyMemoryRead({
      journeyId: "j",
      truncated: true,
      memories: [
        { id: "m-1", memoryType: "decision", layer: "ego", title: "A", content: "a", persona: "coach", conversationId: "c-1", createdAt: "2026-11-20T10:00:00Z", readinessState: "observed" },
        { id: "m-2", memoryType: "insight", title: "B", content: "b", createdAt: "2026-11-19T10:00:00Z", persona: "", conversationId: null },
        { id: "m-1", memoryType: "decision", title: "dup", content: "x", createdAt: "t" },
        { id: "", memoryType: "decision", title: "no id", content: "x", createdAt: "t" },
        { id: "m-3", memoryType: "decision", title: 7, content: "x", createdAt: "t" },
        "text",
      ],
    });
    expect(read).toEqual({
      journeyId: "j",
      truncated: true,
      memories: [
        { id: "m-1", memoryType: "decision", layer: "ego", title: "A", content: "a", persona: "coach", conversationId: "c-1", createdAt: "2026-11-20T10:00:00Z", readinessState: "observed" },
        { id: "m-2", memoryType: "insight", layer: "", title: "B", content: "b", persona: null, conversationId: null, createdAt: "2026-11-19T10:00:00Z", readinessState: null },
      ],
    });
    expect(sanitizeJourneyMemoryRead({ journeyId: "j", memories: [] })?.truncated).toBe(false);
  });

  it("refuses an answer that is not a Journey's list", () => {
    for (const bad of [null, "x", [], { memories: [] }, { journeyId: "", memories: [] }, { journeyId: "j" }, { journeyId: "j", memories: {} }]) {
      expect(sanitizeJourneyMemoryRead(bad)).toBeUndefined();
    }
  });
});

describe("the memories as the person reads them", () => {
  it("groups by kind in the order a person acts on them, newest first, and leaves an empty kind out", () => {
    const groups = groupJourneyMemories([
      memory("d-old", { createdAt: "2026-11-01T10:00:00Z" }),
      memory("l-1", { memoryType: "learning" }),
      memory("c-1", { memoryType: "commitment" }),
      memory("d-new", { createdAt: "2026-11-21T10:00:00Z" }),
      memory("p-1", { memoryType: "pattern" }),
      memory("i-1", { memoryType: "insight" }),
    ]);
    expect(groups.map((group) => [group.kind, group.label, group.memories.map((item) => item.id)])).toEqual([
      ["commitment", "Commitments", ["c-1"]],
      ["decision", "Decisions", ["d-new", "d-old"]],
      ["learning", "Learnings", ["l-1"]],
      ["insight", "Insights", ["i-1"]],
      ["other", "Other memories", ["p-1"]],
    ]);
    expect(memoryKindOf("journal")).toBe("other");
    expect(groupJourneyMemories([])).toEqual([]);
  });

  it("counts them for the header in the same order, singular and plural", () => {
    expect(describeJourneyMemoryCounts([memory("a", { memoryType: "commitment" }), memory("b"), memory("c"), memory("d", { memoryType: "idea" })]))
      .toBe("1 commitment · 2 decisions · 1 other");
    expect(describeJourneyMemoryCounts([])).toBe("Nothing kept yet");
  });

  it("shows a long content by its first sentences and the whole on request", () => {
    expect(memoryExcerpt("Short.")).toEqual({ text: "Short.", cut: false });
    const long = `${"A sentence that goes on. ".repeat(20)}The end.`;
    const excerpt = memoryExcerpt(long);
    expect(excerpt.cut).toBe(true);
    expect(excerpt.text.length).toBeLessThanOrEqual(282);
    expect(excerpt.text.endsWith(".…")).toBe(true);
  });

  it("reads the date in the person's locale and leaves a non-date as it is", () => {
    expect(formatMemoryDate("2026-11-20T10:00:00Z", "en-US")).toBe("Nov 20, 2026");
    expect(formatMemoryDate("2026-11-20T10:00:00Z", "pt-BR")).toBe("20 de nov. de 2026");
    expect(formatMemoryDate("yesterday", "en-US")).toBe("yesterday");
  });
});

describe("where a memory's conversation is opened", () => {
  const desktop = (conversationId: string, mirrorConversationIds: string[]): ConversationCatalogEntry => ({
    kind: "desktop_conversation", conversationId, threadId: `thread-${conversationId}`, title: conversationId, updatedAt: "t", messageCount: 1, availability: "ready",
    authority: {
      activeGeneration: 1, runtimeChannel: "development",
      generations: mirrorConversationIds.map((mirrorConversationId, index) => ({
        generation: index + 1, status: index === 0 ? "ready" : "inactive", piSessionId: `pi-${index}`, piSessionFile: "f", mirrorConversationId, createdAt: "t", activatedAt: "t",
        activationReceipt: { schemaVersion: "1.0.0", journeyId: "j", threadId: `thread-${conversationId}`, generation: index + 1, piSessionId: `pi-${index}`, mirrorConversationId, activatedAt: "t" },
      })) as ConversationCatalogEntry extends { authority: { generations: infer G } } ? G : never,
    },
  });
  const mirror = (conversationId: string, availability: "available_in_mirror" | "needs_attention" = "available_in_mirror"): ConversationCatalogEntry => ({
    kind: "mirror_history", conversationId, title: conversationId, updatedAt: "t", messageCount: 1, availability,
  });

  it("leads to the Desktop conversation whose generation the memory came from, else the Mirror history entry, else nowhere", () => {
    const entries = [desktop("desk-1", ["mirror-a", "mirror-b"]), mirror("mirror-b"), mirror("mirror-c"), mirror("mirror-d", "needs_attention")];
    expect(memoryConversationTarget({ conversationId: "mirror-b" }, entries)).toEqual({ kind: "desktop_conversation", conversationId: "desk-1" });
    expect(memoryConversationTarget({ conversationId: "mirror-c" }, entries)).toEqual({ kind: "mirror_history", conversationId: "mirror-c" });
    expect(memoryConversationTarget({ conversationId: "mirror-d" }, entries)).toBeUndefined();
    expect(memoryConversationTarget({ conversationId: "unknown" }, entries)).toBeUndefined();
    expect(memoryConversationTarget({ conversationId: null }, entries)).toBeUndefined();
  });
});
