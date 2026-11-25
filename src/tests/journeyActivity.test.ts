import { describe, expect, it } from "vitest";
import {
  activityAgoLabel,
  activityElapsedLabel,
  activityGroupOf,
  activityLine,
  describeRunningOperation,
  groupJourneyActivity,
  type JourneyActivityInput,
} from "../domain/journeyActivity";

// The Activity view: the sidebar ordered by what each Journey's agent is doing, so several
// Journeys at work can be followed without opening each one. It groups states the app already
// knows; it invents none.

const journey = (id: string, patch: Partial<JourneyActivityInput> = {}): JourneyActivityInput => ({
  id, name: id, status: "idle", waitingCount: 0, pinned: false, ...patch,
});

describe("the Activity view of the Journey sidebar", () => {
  it("puts live work in Working, whether running or finishing", () => {
    expect(activityGroupOf(journey("a", { status: "working" }))).toBe("working");
    expect(activityGroupOf(journey("a", { status: "finishing" }))).toBe("working");
    // A queue on a Journey at work is not a reason to interrupt the reader: it is sent when the turn ends.
    expect(activityGroupOf(journey("a", { status: "working", waitingCount: 2 }))).toBe("working");
  });

  it("puts in Need you every Journey whose next step is the person's", () => {
    expect(activityGroupOf(journey("a", { status: "failed" }))).toBe("needs_you");
    expect(activityGroupOf(journey("a", { status: "interrupted" }))).toBe("needs_you");
    expect(activityGroupOf(journey("a", { status: "finished" }))).toBe("needs_you");
    expect(activityGroupOf(journey("a", { status: "idle", waitingCount: 1 }))).toBe("needs_you");
    expect(activityGroupOf(journey("a", { status: "idle" }))).toBe("idle");
  });

  it("lets go of an answer once the person has opened it, though the Ready mark still shows for a moment", () => {
    const seen = journey("a", { status: "finished", answerSeen: true, context: "Azure" });
    expect(activityGroupOf(seen)).toBe("idle");
    expect(activityLine(seen)).toBe("Azure");
    // A message held on it is still the person's to send.
    expect(activityGroupOf({ ...seen, waitingCount: 1 })).toBe("needs_you");
    expect(activityLine({ ...seen, waitingCount: 1 })).toBe("1 message waiting to be sent");
  });

  it("orders Need you by what is most urgent, then by the most recent", () => {
    const groups = groupJourneyActivity([
      journey("read-me", { status: "finished", lastWorkedAt: "2026-11-18T12:00:00Z" }),
      journey("held", { waitingCount: 1, lastWorkedAt: "2026-11-18T11:00:00Z" }),
      journey("stopped-old", { status: "interrupted", lastWorkedAt: "2026-11-18T08:00:00Z" }),
      journey("stopped-new", { status: "interrupted", lastWorkedAt: "2026-11-18T10:00:00Z" }),
      journey("broke", { status: "failed", lastWorkedAt: "2026-11-17T10:00:00Z" }),
    ]);
    expect(groups.map((group) => group.id)).toEqual(["needs_you"]);
    expect(groups[0].rows.map((row) => row.id)).toEqual(["broke", "stopped-new", "stopped-old", "held", "read-me"]);
  });

  it("keeps Working rows where they are as others start: the longest-running first", () => {
    const groups = groupJourneyActivity([
      journey("second", { status: "working", startedAt: "2026-11-18T12:05:00Z" }),
      journey("first", { status: "working", startedAt: "2026-11-18T12:00:00Z" }),
      journey("unknown-start", { status: "finishing" }),
    ]);
    expect(groups[0].rows.map((row) => row.id)).toEqual(["first", "second", "unknown-start"]);
  });

  it("orders Idle by the last work, the never-worked last and by name", () => {
    const groups = groupJourneyActivity([
      journey("zeta"), journey("alfa"),
      journey("yesterday", { lastWorkedAt: "2026-11-17T09:00:00Z" }),
      journey("today", { lastWorkedAt: "2026-11-18T09:00:00Z" }),
    ]);
    expect(groups[0].rows.map((row) => row.id)).toEqual(["today", "yesterday", "alfa", "zeta"]);
  });

  it("lists the groups in the order Need you, Working, Idle and leaves out an empty one", () => {
    const groups = groupJourneyActivity([journey("idle"), journey("busy", { status: "working" }), journey("mine", { status: "failed" })]);
    expect(groups.map((group) => [group.id, group.label, group.rows.length])).toEqual([["needs_you", "Need you", 1], ["working", "Working", 1], ["idle", "Idle", 1]]);
    expect(groupJourneyActivity([journey("idle")]).map((group) => group.id)).toEqual(["idle"]);
    expect(groupJourneyActivity([])).toEqual([]);
  });

  it("says in one line what a Journey waits for or does", () => {
    expect(activityLine(journey("a", { status: "working", doing: "bash npm test" }))).toBe("bash npm test");
    expect(activityLine(journey("a", { status: "working" }))).toBe("Working");
    expect(activityLine(journey("a", { status: "finishing" }))).toBe("Finishing the turn");
    expect(activityLine(journey("a", { status: "failed" }))).toBe("The last turn failed");
    expect(activityLine(journey("a", { status: "interrupted" }))).toBe("The last turn was interrupted");
    expect(activityLine(journey("a", { status: "finished" }))).toBe("Finished. Open it to read the answer");
    expect(activityLine(journey("a", { waitingCount: 1 }))).toBe("1 message waiting to be sent");
    expect(activityLine(journey("a", { status: "interrupted", waitingCount: 3 }))).toBe("The last turn was interrupted · 3 messages waiting to be sent");
    expect(activityLine(journey("a", { context: "Azure / Phidelis" }))).toBe("Azure / Phidelis");
    expect(activityLine(journey("a"))).toBeUndefined();
  });

  it("names the conversation when the live work is inside the Journey, not in the Journey's own", () => {
    const owner = { journeyId: "a", threadId: "thread-child", generation: 1, mirrorConversationId: "mirror-conv-1" };
    const inside = { ...owner, title: "Release notes" };
    expect(activityLine(journey("a", { status: "working", doing: "bash npm test", inside }))).toBe("Release notes · bash npm test");
    expect(activityLine(journey("a", { status: "working", inside }))).toBe("Release notes · Working");
    expect(activityLine(journey("a", { status: "finishing", inside }))).toBe("Release notes · Finishing the turn");
    // The catalog may not hold the title yet: the row still says the work is not the Journey's own.
    expect(activityLine(journey("a", { status: "working", doing: "read plan.md", inside: owner }))).toBe("A conversation · read plan.md");
  });

  it("names the conversation of a turn that ended there, so its answer or its failure is not looked for in the Journey's own", () => {
    const inside = { journeyId: "a", threadId: "thread-child", generation: 1, mirrorConversationId: "mirror-conv-1", title: "Release notes" };
    expect(activityLine(journey("a", { status: "finished", inside }))).toBe("Release notes · Finished. Open it to read the answer");
    expect(activityLine(journey("a", { status: "failed", inside }))).toBe("Release notes · The last turn failed");
    expect(activityLine(journey("a", { status: "interrupted", inside, waitingCount: 2 }))).toBe("Release notes · The last turn was interrupted · 2 messages waiting to be sent");
    // Once the answer was opened the row says where the Journey sits again.
    expect(activityLine(journey("a", { status: "finished", answerSeen: true, inside, context: "Azure" }))).toBe("Azure");
  });

  it("names the operation running now from its tool and its target, on one bounded line", () => {
    expect(describeRunningOperation([
      { name: "read", status: "completed", arguments: { path: "docs/a.md" } },
      { name: "bash", status: "running", arguments: { command: "npm run tauri:build:dev\n  --bundles nsis" } },
    ])).toBe("bash npm run tauri:build:dev --bundles nsis");
    expect(describeRunningOperation([{ name: "read", status: "running", arguments: { path: "C:\\VSCode\\nautilus-app\\src\\app\\App.tsx" } }])).toBe("read C:\\VSCode\\nautilus-app\\src\\app\\App.tsx");
    expect(describeRunningOperation([{ name: "edit", status: "preparing", arguments: { file_path: "src/a.ts" } }])).toBe("edit src/a.ts");
    expect(describeRunningOperation([{ name: "mirror", status: "running", arguments: { anything: 1 } }])).toBe("mirror");
    expect(describeRunningOperation([{ name: "bash", status: "running", arguments: "not an object" }])).toBe("bash");
    const long = describeRunningOperation([{ name: "bash", status: "running", arguments: { command: "x".repeat(400) } }])!;
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith("…")).toBe(true);
    // Nothing running: the agent is between tools.
    expect(describeRunningOperation([{ name: "read", status: "completed", arguments: { path: "a" } }])).toBeUndefined();
    expect(describeRunningOperation([])).toBeUndefined();
  });

  it("says how long ago a Journey was worked in few characters, so the name keeps the room", () => {
    const now = Date.parse("2026-11-18T12:00:00Z"); const ago = (ms: number) => new Date(now - ms).toISOString();
    const minute = 60_000, hour = 60 * minute, day = 24 * hour;
    expect(activityAgoLabel(ago(20_000), now)).toBe("now");
    expect(activityAgoLabel(ago(11 * minute), now)).toBe("11 min");
    expect(activityAgoLabel(ago(2 * hour + 10 * minute), now)).toBe("2 h");
    expect(activityAgoLabel(ago(26 * hour), now)).toBe("1 d");
    expect(activityAgoLabel(ago(45 * day), now)).toBe("45 d");
    expect(activityAgoLabel(ago(200 * day), now)).toBe("6 mo");
    expect(activityAgoLabel(ago(-5 * minute), now)).toBe("now");
    expect(activityAgoLabel(undefined, now)).toBeUndefined();
    expect(activityAgoLabel("not a date", now)).toBeUndefined();
  });

  it("counts a run's time as a clock", () => {
    const start = "2026-11-18T12:00:00.000Z"; const at = (seconds: number) => Date.parse(start) + seconds * 1000;
    expect(activityElapsedLabel(start, at(0))).toBe("0:00");
    expect(activityElapsedLabel(start, at(48))).toBe("0:48");
    expect(activityElapsedLabel(start, at(134))).toBe("2:14");
    expect(activityElapsedLabel(start, at(3730))).toBe("1:02:10");
    expect(activityElapsedLabel(start, at(-5))).toBe("0:00");
    expect(activityElapsedLabel(undefined, at(5))).toBeUndefined();
    expect(activityElapsedLabel("not a date", at(5))).toBeUndefined();
  });
});
