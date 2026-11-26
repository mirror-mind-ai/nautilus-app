import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { JourneyActivityList } from "../app/JourneyActivityList";
import { deriveJourneyActivityInputs } from "../app/journeyActivityInputs";
import { createInitialJourneyRuntimeState } from "../app/journeyRuntimeState";
import { createUnknownPiInvocationOccupancy, type PiInvocationLeaseInspection, type PiInvocationOccupancyState } from "../app/piInvocationOccupancy";
import {
  loadApplicationLayout,
  loadJourneyActivityView,
  parseApplicationLayout,
  saveApplicationLayout,
  saveJourneyActivityView,
} from "../app/sidebarPresentationStorage";
import type { JourneyActivityInput } from "../domain/journeyActivity";
import type { FlattenedJourney } from "../domain/journeyRegistry";
import appSource from "../app/App.tsx?raw";
import listSource from "../app/JourneyActivityList.tsx?raw";
import storageSource from "../app/sidebarPresentationStorage.ts?raw";
import preferencesSource from "../domain/journeyPreferencePersistence.ts?raw";
import registrySource from "../domain/journeyRegistry.ts?raw";

const css: string = readFileSync(new URL("../styles/presentation.css", import.meta.url), "utf8");

const owner = { journeyId: "a", threadId: "thread-child", generation: 1, mirrorConversationId: "mirror-conv-1" };
const row = (id: string, patch: Partial<JourneyActivityInput> = {}): JourneyActivityInput => ({
  id, name: id, status: "idle", waitingCount: 0, pinned: false, ...patch,
});

function render(journeys: JourneyActivityInput[], selected = ""): string {
  return renderToStaticMarkup(
    <JourneyActivityList
      journeys={journeys}
      selectedJourneyId={selected}
      relativeTimeNow={Date.parse("2026-11-18T12:00:00Z")}
      renderVisual={(journeyId) => <i data-visual={journeyId} />}
      accentOf={() => "teal"}
      renderStatus={(journey) => <i data-status={journey.status} />}
      onSelect={vi.fn()}
      onOpenMenu={vi.fn()}
      emptyTitle="No Journeys yet"
      emptyHint="Create a Journey from the Tree view."
    />,
  );
}

describe("the Activity view, drawn", () => {
  it("draws the three groups in order, each with its count", () => {
    const html = render([
      row("Idle one", { lastWorkedAt: "2026-11-18T10:00:00Z" }),
      row("Busy one", { status: "working", doing: "bash npm test", startedAt: "2026-11-18T12:00:00Z" }),
      row("Mine", { status: "interrupted" }),
    ]);
    const order = ["Need you", "Working", "Idle"].map((label) => html.indexOf(`<span>${label}</span>`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/journey-activity-count">1</g)).toHaveLength(3);
  });

  it("gives a row its Journey, its group, the shared status glyph and its line", () => {
    const html = render([row("nova-escola", { name: "Nova Escola", status: "working", doing: "read comparativo.md" })], "nova-escola");
    expect(html).toContain('data-journey-id="nova-escola"');
    expect(html).toContain('data-activity-group="working"');
    expect(html).toContain('data-status="working"');
    expect(html).toContain('data-visual="nova-escola"');
    expect(html).toContain("read comparativo.md");
    expect(html).toContain('aria-current="true"');
    expect(html).toMatch(/class="journey-activity-row is-working accent-teal selected/);
    expect(html).toContain("journey-activity-progress");
    // A row is operable as the Journey rows are: a button that opens the Journey's menu.
    expect(html).toMatch(/role="button"[^>]*tabindex="0"|tabindex="0"[^>]*role="button"/);
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("names what a Need you row waits for, and shows a held message's count", () => {
    const html = render([row("a", { name: "Investimentos", waitingCount: 2 })]);
    expect(html).toContain("2 messages waiting to be sent");
    expect(html).toContain('class="journey-activity-waiting"');
    expect(html).toContain('aria-label="Investimentos, Need you, 2 messages waiting to be sent"');
  });

  it("shows when an idle Journey was last worked, and says so when there is nothing to list", () => {
    expect(render([row("a", { lastWorkedAt: "2026-11-18T10:00:00Z" })])).toContain('journey-activity-when">2 h<');
    expect(render([])).toContain("No Journeys yet");
  });
});

describe("what the Activity view is derived from", () => {
  const journey = (id: string, breadcrumb: string[] = [id]): FlattenedJourney => ({ id, name: id, breadcrumb, depth: breadcrumb.length - 1 });
  const derive = (patch: Partial<Parameters<typeof deriveJourneyActivityInputs>[0]> = {}) => deriveJourneyActivityInputs({
    journeys: [journey("a"), journey("b", ["Azure", "b"])],
    runtimeState: createInitialJourneyRuntimeState(),
    occupancy: createUnknownPiInvocationOccupancy(),
    rootThreadIdOf: () => undefined,
    finishedAttention: {},
    compactingJourneyId: undefined,
    turnOutcomes: {},
    turnOutcomeOwners: {},
    waitingCountOf: () => 0,
    pinnedJourneyIds: [],
    lastWorkedAtByJourneyId: {},
    conversationTitleOf: () => undefined,
    ...patch,
  });
  const lease = (journeyId: string, threadId: string): PiInvocationLeaseInspection => ({
    authority: {
      schemaVersion: "0.1.0", journeyId, runId: "run-1", turnId: "turn-1", threadId, generation: 1, piSessionId: "pi-session-1",
      mirrorConversationId: "mirror-conv-1", harnessUserMessageId: "harness-user-1", harnessAssistantMessageId: "harness-assistant-1",
    },
    leasePhase: "running", processCapacityState: "running", cancellationState: "none", terminalState: "open",
  });
  const working = (entries: PiInvocationLeaseInspection[]): PiInvocationOccupancyState => ({
    status: "known", requestId: 1, limit: 4, journeyWorkspaceShare: 3, processCapacityInUse: entries.length, entries, diagnostic: null,
  });

  it("is idle for a Journey nothing is known about, with its parents as context", () => {
    expect(derive()).toEqual([
      { id: "a", name: "a", status: "idle", answerSeen: false, waitingCount: 0, pinned: false, lastWorkedAt: undefined, startedAt: undefined, doing: undefined, context: undefined },
      { id: "b", name: "b", status: "idle", answerSeen: false, waitingCount: 0, pinned: false, lastWorkedAt: undefined, startedAt: undefined, doing: undefined, context: "Azure" },
    ]);
  });

  it("carries the outcome, the unread answer, the queue, the pin and the last work a Journey row carries", () => {
    const [a, b] = derive({
      turnOutcomes: { a: "interrupted" },
      finishedAttention: { b: { finishedAt: 1 } },
      waitingCountOf: (id) => (id === "a" ? 2 : 0),
      pinnedJourneyIds: ["b"],
      lastWorkedAtByJourneyId: { a: "2026-11-18T10:00:00Z" },
    });
    expect([a.status, a.waitingCount, a.pinned, a.lastWorkedAt]).toEqual(["interrupted", 2, false, "2026-11-18T10:00:00Z"]);
    expect([b.status, b.pinned, b.answerSeen]).toEqual(["finished", true, false]);
    const [, opened] = derive({ finishedAttention: { b: { finishedAt: 1, acknowledgedAt: 2 } } });
    expect([opened.status, opened.answerSeen]).toEqual(["finished", true]);
  });

  // CR134 tells the Journey's own work from work in a conversation inside it. The Activity view
  // dropped that: a conversation at work showed as the Journey's, and the row led to the Journey.
  it("says the work is inside a conversation, and which, when it is not the Journey's own", () => {
    const titles = (journeyId: string, threadId: string) => (journeyId === "a" && threadId === "thread-child" ? "Release notes" : undefined);
    const [inside] = derive({ occupancy: working([lease("a", "thread-child")]), rootThreadIdOf: () => "thread-root", conversationTitleOf: titles });
    expect([inside.status, inside.inside]).toEqual(["working", { ...owner, title: "Release notes" }]);
    const [own] = derive({ occupancy: working([lease("a", "thread-root")]), rootThreadIdOf: () => "thread-root", conversationTitleOf: titles });
    expect([own.status, own.inside]).toEqual(["working", undefined]);
    // With the Journey's own thread unknown, the owner is not claimed to be a conversation.
    const [unresolved] = derive({ occupancy: working([lease("a", "thread-child")]), conversationTitleOf: titles });
    expect([unresolved.status, unresolved.inside]).toEqual(["working", undefined]);
    // The Journey's own work wins over a conversation's, as on a Journey row (CR140).
    const [both] = derive({ occupancy: working([lease("a", "thread-child"), lease("a", "thread-root")]), rootThreadIdOf: () => "thread-root", conversationTitleOf: titles });
    expect(both.inside).toBeUndefined();
  });

  // The row followed live work into a conversation and let go of it when the turn ended: the
  // answer was then looked for in the Journey's own conversation, where it is not.
  it("keeps saying which conversation it is about after the turn ends there", () => {
    const titles = (journeyId: string, threadId: string) => (journeyId === "a" && threadId === "thread-child" ? "Release notes" : undefined);
    const known = { rootThreadIdOf: () => "thread-root", conversationTitleOf: titles };
    const [answered] = derive({ ...known, finishedAttention: { a: { finishedAt: 1, owner } } });
    expect([answered.status, answered.answerSeen, answered.inside]).toEqual(["finished", false, { ...owner, title: "Release notes" }]);
    const [failed] = derive({ ...known, turnOutcomes: { a: "failed" }, turnOutcomeOwners: { a: owner } });
    expect([failed.status, failed.inside]).toEqual(["failed", { ...owner, title: "Release notes" }]);
    // A turn of the Journey's own conversation, or one whose conversation cannot be told from it, leads to the Journey.
    const [own] = derive({ ...known, finishedAttention: { a: { finishedAt: 1, owner: { ...owner, threadId: "thread-root" } } } });
    expect([own.status, own.inside]).toEqual(["finished", undefined]);
    const [unresolved] = derive({ conversationTitleOf: titles, finishedAttention: { a: { finishedAt: 1, owner } } });
    expect([unresolved.status, unresolved.inside]).toEqual(["finished", undefined]);
    // Each state reads its own source: an answer is not placed by an older failure's conversation.
    const elsewhere = { ...owner, threadId: "thread-other" };
    const [answeredLater] = derive({ ...known, finishedAttention: { a: { finishedAt: 1 } }, turnOutcomes: { a: "failed" }, turnOutcomeOwners: { a: elsewhere } });
    expect([answeredLater.status, answeredLater.inside]).toEqual(["finished", undefined]);
    // Live work is newer news than either, and is placed by its own owner.
    const [live] = derive({ ...known, occupancy: working([lease("a", "thread-root")]), finishedAttention: { a: { finishedAt: 1, owner } } });
    expect([live.status, live.inside]).toEqual(["working", undefined]);
  });

  it("reads a compaction as work, as the Journey row does", () => {
    const [a] = derive({ compactingJourneyId: "a" });
    expect([a.status, a.doing]).toEqual(["working", "Compacting the conversation"]);
  });
});

describe("where the two choices are kept", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) } });
    return store;
  };

  it("defaults to the app as it was: the list views and the Classic layout", () => {
    stubStorage();
    expect(loadJourneyActivityView("user")).toBe(false);
    expect(loadApplicationLayout("user")).toBe("classic");
    expect(parseApplicationLayout("something else")).toBe("classic");
    expect(parseApplicationLayout(null)).toBe("classic");
  });

  it("remembers each choice per runtime channel", () => {
    const store = stubStorage();
    saveJourneyActivityView("development", true);
    saveApplicationLayout("development", "compact");
    expect(loadJourneyActivityView("development")).toBe(true);
    expect(loadApplicationLayout("development")).toBe("compact");
    expect(loadJourneyActivityView("user")).toBe(false);
    expect(loadApplicationLayout("user")).toBe("classic");
    expect([...store.keys()].sort()).toEqual(["mirror-desktop:application-layout:v1:development", "mirror-desktop:journey-activity-view:v1:development"]);
  });

  it("stays usable when the storage is not there", () => {
    vi.stubGlobal("window", { get localStorage(): never { throw new Error("denied"); } });
    expect(loadJourneyActivityView("user")).toBe(false);
    expect(loadApplicationLayout("user")).toBe("classic");
    expect(() => { saveJourneyActivityView("user", true); saveApplicationLayout("user", "compact"); }).not.toThrow();
  });

  // The Journey preferences file is discarded whole when a field it knows holds a value it does
  // not. A build without these choices must therefore never find them there: that would reset the
  // Navigator's pins, recents, theme and Journey icons.
  it("never puts them in the Journey preferences file, nor widens the list order it validates", () => {
    expect(storageSource).not.toMatch(/journeyPreference|invoke\(/);
    expect(preferencesSource).not.toMatch(/applicationLayout|activityView/);
    expect(registrySource).toContain('export type JourneyListOrder = "recent" | "tree";');
    expect(appSource).not.toMatch(/setJourneyListOrder\("activity"\)/);
  });
});

describe("how the app is wired to them", () => {
  it("offers Activity beside Recent, Pinned and Tree, and leaving it is choosing one of those", () => {
    expect(appSource).toContain('aria-label="Show Journey activity"');
    expect(appSource).toContain("const activityShown = activityView && !sidebarCompact;");
    for (const view of ["setPinnedOnly(false);", "setPinnedOnly(true);"]) {
      expect(appSource).toContain(`chooseActivityView(false);\n              ${view}`);
    }
    expect(appSource).toMatch(/const next = activateJourneyTree\(\);\s+chooseActivityView\(false\);/);
  });

  it("leads to the conversation at work, as a Journey row's status mark does", () => {
    expect(appSource).toContain('locus={inside ? "inside" : undefined}');
    expect(appSource).toContain("onNavigateToOwner={inside ? () => void navigateToJourneyWorkOwner(inside) : undefined}");
    expect(appSource).toMatch(/onSelect=\{\(journey, intent\) => \{\s+if \(journey\.inside\) \{\s+void navigateToJourneyWorkOwner\(journey\.inside\);/);
    expect(render([row("a", { status: "working", doing: "bash npm test", inside: { ...owner, title: "Release notes" } })])).toContain('journey-activity-line">Release notes · bash npm test<');
  });

  it("tells the list which conversation a turn ended in: the run's own, and the journal's for one that did not complete", () => {
    const settled = appSource.slice(appSource.indexOf("// A completed answer is ready for attention even when Mirror synchronization remains debt."));
    expect(settled.slice(0, settled.indexOf("// CR259:"))).toContain("owner: runAuthority ? journeyWorkOwnerOf(runAuthority) : undefined,");
    expect(appSource).toContain("deriveJourneyTurnOutcomeOwner(journal.records, journeyId)");
    expect(appSource).toContain("turnOutcomeOwners: journeyTurnOutcomeOwners,");
    expect(render([row("a", { status: "finished", inside: { ...owner, title: "Release notes" } })])).toContain('journey-activity-line">Release notes · Finished. Open it to read the answer<');
  });

  it("keeps the Journey list mounted and only replaces it on screen", () => {
    expect(appSource).toContain('${activityShown ? "is-replaced-by-activity" : ""}');
    expect(css).toMatch(/\.journey-list\.is-replaced-by-activity \{\s+display: none;/);
  });

  it("puts the layout on the shell and offers it in Settings, under Appearance", () => {
    expect(appSource).toContain("data-application-layout={applicationLayout}");
    expect(appSource).toContain('aria-label="Application layout"');
    expect(appSource).toContain("chooseApplicationLayout(layout.id)");
  });
});

describe("the Compact layout cannot reach what it should not", () => {
  // The section opens with a ruled comment; everything after it is the Compact layout.
  const compact = css.slice(css.indexOf("= Compact layout")).replace(/^[^\n]*\n/, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[\s\S]*?\*\//, "");
  // A @container, @media or @supports wrapper is opened and forgotten: the rules inside it are what is checked.
  const rules = compact.replace(/@(?:container|media|supports)[^{]*\{/g, "");
  const selectors = [...rules.matchAll(/(^|\})\s*([^{}]+?)\s*\{/g)].map((match) => match[2].trim()).filter(Boolean);

  it("holds every rule inside the layout attribute", () => {
    expect(selectors.length).toBeGreaterThan(30);
    // A list of selectors is split at its own commas, not at those inside :is(…).
    const parts = (selector: string) => { const out: string[] = []; let depth = 0, from = 0; [...selector].forEach((ch, at) => { if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === "," && depth === 0) { out.push(selector.slice(from, at)); from = at + 1; } }); out.push(selector.slice(from)); return out.map((part) => part.trim()); };
    for (const selector of selectors) {
      for (const part of parts(selector)) {
        expect(part.startsWith('.app-shell[data-application-layout="compact"]'), part).toBe(true);
      }
    }
  });

  it("names nothing of Settings, dialogs or menus", () => {
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/settings|dialog|-menu\b|modal|onboarding|persona-screen|theme-choice/);
    }
  });

  it("leaves the icon-only sidebar to its own drawing", () => {
    const sidebarRules = selectors.filter((selector) => /\.journey-item|\.journey-list|focused-conversation/.test(selector));
    expect(sidebarRules.length).toBeGreaterThan(8);
    for (const selector of sidebarRules) expect(selector, selector).toContain(":not(.sidebar-compact)");
  });
});

describe("CR289: the Activity list holds its order after a click", () => {
  it("holds the layout the person saw, for a few seconds, and lets go on its own", () => {
    expect(listSource).toContain("holdActivityLayout(");
    expect(listSource).toContain("layoutOfActivity(");
    expect(listSource).toContain("ACTIVITY_HOLD_MS");
    expect(listSource).toContain("window.clearTimeout(");
    // Every way to choose a row holds, the keyboard as the pointer does.
    expect(listSource).toContain("onSelect(journey, intent)");
  });

  it("reads the elapsed clock from the row's own state, not from the group it is held in", () => {
    expect(listSource).toContain('activityGroupOf(journey) === "working"');
  });
});

describe("CR290: sending a turn shows the Activity view", () => {
  it("switches to Activity when a live turn starts from the composer, without saving the choice", () => {
    const start = appSource.indexOf("const run = startAgentRun({ content, mode });");
    expect(start).toBeGreaterThan(-1);
    const after = appSource.slice(start, start + 600);
    expect(after).toContain('if (mode === "live" && !queued) setActivityView(true);');
    expect(after).not.toContain("chooseActivityView(true)");
  });
});
