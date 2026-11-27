import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyActivityList } from "../app/JourneyActivityList";
import { deriveJourneyActivityInputs } from "../app/journeyActivityInputs";
import { createInitialJourneyRuntimeState } from "../app/journeyRuntimeState";
import { createUnknownPiInvocationOccupancy, type PiInvocationLeaseInspection, type PiInvocationOccupancyState } from "../app/piInvocationOccupancy";
import {
  ACTIVITY_CONVERSATION_WINDOW_MS,
  activityConversationsOf,
  activityLine,
  conversationActivityLine,
  type JourneyActivityConversationLine,
  type JourneyActivityInput,
} from "../domain/journeyActivity";
import {
  createPersistedJourneyPreferences,
  defaultJourneyPreferenceState,
  parsePersistedJourneyPreferences,
  sanitizeJourneyPreferenceState,
} from "../domain/journeyPreferencePersistence";
import type { FlattenedJourney } from "../domain/journeyRegistry";
import {
  MAX_WORKED_CONVERSATIONS,
  parseWorkedConversations,
  recordWorkedConversation,
  type WorkedConversation,
} from "../domain/workedConversations";
import { fixtureJourneyRegistry } from "../fixtures/journeyRegistry";
import appSource from "../app/App.tsx?raw";

// CR301: the Activity view led to one conversation of a Journey at most, the one at work, and a
// conversation being worked between turns could only be reached from Recents. The Navigator chose
// the rule: under a Journey's row, what is in motion in its conversations, and every conversation a
// turn was sent in during the last day. The Journey's row leads to the Journey's own conversation.

const NOW = Date.parse("2026-11-27T12:00:00Z");
const HOUR = 60 * 60_000;
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString();
const worked = (threadId: string, hoursAgo: number, title?: string): WorkedConversation => ({
  journeyId: "a", threadId, ...(title ? { title } : {}), lastWorkedAt: at(hoursAgo),
});
const moving = (threadId: string, patch: Partial<JourneyActivityConversationLine> = {}): JourneyActivityConversationLine => ({
  journeyId: "a", threadId, status: "working", ...patch,
});

describe("which conversations the Activity view shows under a Journey", () => {
  it("keeps a conversation a turn was sent in for a day, and lets it go after", () => {
    expect(ACTIVITY_CONVERSATION_WINDOW_MS).toBe(24 * HOUR);
    const lines = activityConversationsOf({
      journeyId: "a",
      inMotion: [],
      worked: [worked("hour", 1, "Linux"), worked("almost-a-day", 23.5), worked("a-day", 24), worked("older", 30)],
      rootThreadId: "root",
      nowMs: NOW,
    });
    expect(lines).toEqual([
      { journeyId: "a", threadId: "hour", title: "Linux", status: "idle", lastWorkedAt: at(1) },
      { journeyId: "a", threadId: "almost-a-day", title: undefined, status: "idle", lastWorkedAt: at(23.5) },
    ]);
  });

  it("always shows what is in motion, however long ago its last turn was sent", () => {
    const lines = activityConversationsOf({
      journeyId: "a", inMotion: [moving("failed", { status: "failed" })], worked: [worked("failed", 40)], rootThreadId: "root", nowMs: NOW,
    });
    expect(lines.map((line) => [line.threadId, line.status, line.lastWorkedAt])).toEqual([["failed", "failed", at(40)]]);
  });

  it("never shows the Journey's own conversation: its row leads there", () => {
    const lines = activityConversationsOf({
      journeyId: "a", inMotion: [moving("root")], worked: [worked("root", 1)], rootThreadId: "root", nowMs: NOW,
    });
    expect(lines).toEqual([]);
  });

  it("puts what is in motion first, then the most recently worked, each conversation once", () => {
    const lines = activityConversationsOf({
      journeyId: "a",
      inMotion: [moving("b", { doing: "bash npm test" })],
      worked: [worked("c", 5), worked("b", 2, "Release"), worked("d", 1)],
      rootThreadId: "root",
      nowMs: NOW,
    });
    expect(lines.map((line) => [line.threadId, line.status])).toEqual([["b", "working"], ["d", "idle"], ["c", "idle"]]);
    // The line in motion keeps its own state and gains when it was last worked and its recorded title.
    expect(lines[0]).toEqual({ journeyId: "a", threadId: "b", status: "working", doing: "bash npm test", title: "Release", lastWorkedAt: at(2) });
  });
});

describe("what a conversation's line says, and what its Journey's row stops repeating", () => {
  it("says what the conversation does or waits for, and nothing when it is quiet", () => {
    expect(conversationActivityLine(moving("b", { doing: "bash npm test" }))).toBe("bash npm test");
    expect(conversationActivityLine(moving("b"))).toBe("Working");
    expect(conversationActivityLine(moving("b", { status: "finishing" }))).toBe("Finishing the turn");
    expect(conversationActivityLine(moving("b", { status: "failed" }))).toBe("The last turn failed");
    expect(conversationActivityLine(moving("b", { status: "interrupted" }))).toBe("The last turn was interrupted");
    expect(conversationActivityLine(moving("b", { status: "finished" }))).toBe("Finished. Open it to read the answer");
    expect(conversationActivityLine(moving("b", { status: "finished", answerSeen: true }))).toBeUndefined();
    expect(conversationActivityLine(moving("b", { status: "idle" }))).toBeUndefined();
  });

  it("leaves to the conversation's line what happens in it", () => {
    const inside = { journeyId: "a", threadId: "b", generation: 1, mirrorConversationId: "m", title: "Release" };
    const journey = (patch: Partial<JourneyActivityInput>): JourneyActivityInput => ({ id: "a", name: "a", status: "idle", waitingCount: 0, pinned: false, ...patch });
    expect(activityLine(journey({ status: "working", doing: "bash npm test", inside, context: "Azure" }))).toBe("Azure");
    expect(activityLine(journey({ status: "finished", inside }))).toBeUndefined();
    expect(activityLine(journey({ status: "interrupted", inside, waitingCount: 2 }))).toBe("2 messages waiting to be sent");
    // The Journey's own work is still said on its row.
    expect(activityLine(journey({ status: "working", doing: "bash npm test" }))).toBe("bash npm test");
  });
});

describe("the record of the conversations a turn was sent in", () => {
  it("keeps the newest first, each conversation once, and a bounded number of them", () => {
    let list: readonly WorkedConversation[] = [];
    list = recordWorkedConversation(list, { journeyId: "a", threadId: "x", title: "X" }, at(3));
    list = recordWorkedConversation(list, { journeyId: "a", threadId: "y", title: "Y" }, at(2));
    list = recordWorkedConversation(list, { journeyId: "a", threadId: "x", title: "X renamed" }, at(1));
    expect(list).toEqual([
      { journeyId: "a", threadId: "x", title: "X renamed", lastWorkedAt: at(1) },
      { journeyId: "a", threadId: "y", title: "Y", lastWorkedAt: at(2) },
    ]);
    for (let index = 0; index < MAX_WORKED_CONVERSATIONS + 5; index += 1) {
      list = recordWorkedConversation(list, { journeyId: "a", threadId: `t${index}` }, at(0));
    }
    expect(list).toHaveLength(MAX_WORKED_CONVERSATIONS);
    expect(list[0].threadId).toBe(`t${MAX_WORKED_CONVERSATIONS + 4}`);
  });

  it("ignores what cannot be placed or dated, and a blank title", () => {
    const list = [worked("x", 1)];
    expect(recordWorkedConversation(list, { journeyId: " ", threadId: "y" }, at(0))).toBe(list);
    expect(recordWorkedConversation(list, { journeyId: "a", threadId: "" }, at(0))).toBe(list);
    expect(recordWorkedConversation(list, { journeyId: "a", threadId: "y" }, "not a time")).toBe(list);
    expect(recordWorkedConversation([], { journeyId: "a", threadId: "y", title: "  " }, at(0))).toEqual([{ journeyId: "a", threadId: "y", lastWorkedAt: at(0) }]);
  });

  it("reads back only a well formed list", () => {
    expect(parseWorkedConversations([worked("x", 1, "X")])).toEqual([worked("x", 1, "X")]);
    expect(parseWorkedConversations({})).toBeUndefined();
    expect(parseWorkedConversations([{ journeyId: "a", threadId: "x", lastWorkedAt: "yesterday" }])).toBeUndefined();
    expect(parseWorkedConversations([{ journeyId: "a", threadId: "x", title: 3, lastWorkedAt: at(1) }])).toBeUndefined();
    expect(parseWorkedConversations(Array.from({ length: MAX_WORKED_CONVERSATIONS + 1 }, (_, index) => worked(`t${index}`, 1)))).toBeUndefined();
  });

  // The preferences file is discarded whole when a field it knows is invalid. This one is
  // navigation state, so a bad value costs only itself, as CR133's and CR137's do.
  it("survives a relaunch in the preferences file, and a bad value costs nothing else", () => {
    const list = [{ ...worked("x", 1, "X"), journeyId: "amplia" }];
    const saved = JSON.parse(JSON.stringify(createPersistedJourneyPreferences({ ...defaultJourneyPreferenceState, workedConversations: list, applicationTheme: "ember" })));
    expect(parsePersistedJourneyPreferences(saved)?.preferences.workedConversations).toEqual(list);
    const bad = parsePersistedJourneyPreferences({ ...saved, preferences: { ...saved.preferences, workedConversations: "x" } });
    expect([bad?.preferences.workedConversations, bad?.preferences.applicationTheme]).toEqual([[], "ember"]);
    const older = { ...saved, preferences: { ...saved.preferences } };
    delete older.preferences.workedConversations;
    expect(parsePersistedJourneyPreferences(older)?.preferences.workedConversations).toEqual([]);
    const sanitized = sanitizeJourneyPreferenceState({ ...defaultJourneyPreferenceState, workedConversations: [...list, worked("y", 1)] }, fixtureJourneyRegistry);
    expect(sanitized.workedConversations).toEqual(list);
  });
});

describe("the lines, derived for each Journey", () => {
  const journey = (id: string): FlattenedJourney => ({ id, name: id, breadcrumb: [id], depth: 0 });
  const lease = (threadId: string, leasePhase: "running" | "finalizing" = "running"): PiInvocationLeaseInspection => ({
    authority: {
      schemaVersion: "0.1.0", journeyId: "a", runId: `run-${threadId}`, turnId: "turn-1", threadId, generation: 1, piSessionId: "pi-session-1",
      mirrorConversationId: "mirror-conv-1", harnessUserMessageId: "harness-user-1", harnessAssistantMessageId: "harness-assistant-1",
    },
    leasePhase, processCapacityState: leasePhase === "running" ? "running" : "released", cancellationState: "none", terminalState: "open",
  } as PiInvocationLeaseInspection);
  const occupied = (entries: PiInvocationLeaseInspection[]): PiInvocationOccupancyState => ({
    status: "known", requestId: 1, limit: 4, journeyWorkspaceShare: 3, processCapacityInUse: entries.length, entries, diagnostic: null,
  });
  const derive = (patch: Partial<Parameters<typeof deriveJourneyActivityInputs>[0]> = {}) => deriveJourneyActivityInputs({
    journeys: [journey("a"), journey("b")],
    runtimeState: createInitialJourneyRuntimeState(),
    occupancy: createUnknownPiInvocationOccupancy(),
    rootThreadIdOf: () => "root",
    finishedAttention: {},
    compactingJourneyId: undefined,
    turnOutcomes: {},
    turnOutcomeOwners: {},
    waitingCountOf: () => 0,
    pinnedJourneyIds: [],
    lastWorkedAtByJourneyId: {},
    conversationTitleOf: () => undefined,
    workedConversations: [],
    nowMs: NOW,
    ...patch,
  });

  it("gives a Journey the conversations worked in it today, under their current title", () => {
    const [a, b] = derive({
      workedConversations: [worked("linux", 1, "Linux"), worked("notes", 2, "Notes")],
      conversationTitleOf: (journeyId, threadId) => (threadId === "linux" ? "Nautilus for Linux" : undefined),
    });
    expect(a.conversations).toEqual([
      { journeyId: "a", threadId: "linux", title: "Nautilus for Linux", status: "idle", lastWorkedAt: at(1) },
      { journeyId: "a", threadId: "notes", title: "Notes", status: "idle", lastWorkedAt: at(2) },
    ]);
    expect([a.status, b.conversations]).toEqual(["idle", []]);
  });

  it("shows every conversation at work, beside the Journey's own work too", () => {
    const [a] = derive({ occupancy: occupied([lease("root"), lease("linux"), lease("notes", "finalizing")]) });
    expect(a.status).toBe("working");
    expect((a.conversations ?? []).map((line) => [line.threadId, line.status])).toEqual([["linux", "working"], ["notes", "finishing"]]);
  });

  it("places a turn that ended in a conversation on that conversation's line", () => {
    const owner = { journeyId: "a", threadId: "linux", generation: 1, mirrorConversationId: "mirror-conv-1" };
    const [a] = derive({ finishedAttention: { a: { finishedAt: 1, owner } }, workedConversations: [worked("linux", 1, "Linux")] });
    expect(a.conversations).toEqual([{ journeyId: "a", threadId: "linux", title: "Linux", status: "finished", answerSeen: false, lastWorkedAt: at(1) }]);
  });
});

describe("the lines, drawn", () => {
  const conversations: JourneyActivityConversationLine[] = [
    { journeyId: "a", threadId: "linux", title: "Nautilus for Linux", status: "idle", lastWorkedAt: at(1) },
    // The clock of a Working line ticks from the real time, so the run starts now.
    { journeyId: "a", threadId: "notes", status: "working", doing: "bash npm test", startedAt: new Date().toISOString() },
  ];
  const render = (selectedThreadId?: string) => renderToStaticMarkup(
    <JourneyActivityList
      journeys={[{ id: "a", name: "Nautilus App", status: "working", waitingCount: 0, pinned: false, conversations, inside: { journeyId: "a", threadId: "notes", generation: 1, mirrorConversationId: "m" } }]}
      selectedJourneyId="a"
      selectedThreadId={selectedThreadId}
      relativeTimeNow={NOW}
      renderVisual={() => null}
      accentOf={() => "teal"}
      renderStatus={(journey) => <i data-status={journey.status} />}
      renderConversationStatus={(line) => <i data-conversation-status={line.status} />}
      onSelect={vi.fn()}
      onSelectConversation={vi.fn()}
      onOpenMenu={vi.fn()}
      emptyTitle="No Journeys yet"
      emptyHint="Create a Journey from the Tree view."
    />,
  );

  it("draws each conversation as its own line under its Journey, operable on its own", () => {
    const html = render();
    const row = html.indexOf('data-journey-id="a"');
    const linux = html.indexOf('data-thread-id="linux"');
    expect(row).toBeGreaterThanOrEqual(0);
    expect(linux).toBeGreaterThan(row);
    expect(html).toContain(">Nautilus for Linux<");
    // A conversation whose catalog has not been read yet is still a conversation.
    expect(html).toContain(">A conversation<");
    expect(html).toContain('journey-activity-conversation-line">bash npm test<');
    expect(html).toContain('data-conversation-status="working"');
    expect(html).toContain('aria-label="Nautilus for Linux, in Nautilus App, 1 h"');
    expect(html.match(/class="journey-activity-conversation[ "][^>]*role="button"[^>]*tabindex="0"/g)).toHaveLength(2);
    // The row says its state is in a conversation, so its own line is not styled as the work.
    expect(html).toMatch(/class="journey-activity-row is-working[^"]* has-conversation-state"/);
    // The clock of the work is on the conversation's line, not repeated on its Journey's row.
    expect(html.match(/journey-activity-when">0:00</g)).toHaveLength(1);
  });

  it("marks the conversation the person is in", () => {
    expect(render("linux")).toMatch(/class="journey-activity-conversation is-idle selected"[^>]*data-thread-id="linux"/);
    expect(render()).not.toContain("journey-activity-conversation is-idle selected");
  });
});

describe("how the app is wired to them", () => {
  it("leads a Journey's row to the Journey's own conversation and a conversation's line to that conversation", () => {
    expect(appSource).not.toMatch(/if \(journey\.inside\) \{\s+void navigateToJourneyWorkOwner/);
    expect(appSource).toMatch(/onSelect=\{\(journey, intent\) => \{\s+dispatchConversationSelection\(\{ type: "select_root", journeyId: journey\.id \}\);\s+selectJourney\(journey\.id, intent\);/);
    expect(appSource).toMatch(/onSelectConversation=\{\(line, intent\) => \{\s+void navigateToJourneyWorkOwner\(line\);/);
    expect(appSource).toContain("async function navigateToJourneyWorkOwner(owner: Pick<JourneyWorkOwner, \"journeyId\" | \"threadId\">)");
  });

  it("records the conversation a turn is sent in, when it is not the Journey's own", () => {
    expect(appSource).toContain("setWorkedConversations((current) => recordWorkedConversation(current, { journeyId: ownerJourneyId, ...conversation }, admittedAt));");
    expect(appSource).toMatch(/recordAdmittedJourneyActivity\(ownerJourneyId, admittedAt\);[\s\S]{0,400}if \(runAuthority\s+&& selectedConversationEntry\?\.kind === "desktop_conversation"\s+&& selectedConversationEntry\.threadId === runAuthority\.threadId\) \{/);
  });

  it("keeps the record across a relaunch and gives the view the time it reads the day from", () => {
    expect(appSource).toContain("setWorkedConversations(sanitizedPreferences.workedConversations ?? []);");
    expect(appSource).toContain("workedConversations: [...workedConversations],");
    expect(appSource).toMatch(/deriveJourneyActivityInputs\(\{[\s\S]*?workedConversations,\s+nowMs: relativeTimeNow,/);
    expect(appSource).toContain("selectedThreadId={selectedThreadId}");
  });
});
