import { describe, expect, it } from "vitest";
import {
  COMPACTION_QUEUE_MAX_ITEMS,
  enqueueMessage,
  holdJourneyQueues,
  holdQueue,
  markQueueSending,
  queueContent,
  queueReadyToRelease,
  queuesRestoredAfterRestart,
  removeQueue,
  removeQueuedItem,
  waitingMessageCount,
  type CompactionQueueMap,
} from "../domain/compactionQueue";
import {
  COMPOSER_DRAFT_MAX_CHARS,
  createPersistedComposerDrafts,
  parsePersistedComposerDrafts,
} from "../domain/composerDrafts";

const child = "journey-a__conversation_6162";

describe("CR259: messages wait for the compaction", () => {
  it("queues trimmed messages in the order they were written", () => {
    let queues: CompactionQueueMap = {};
    queues = enqueueMessage(queues, "journey-a", "  first  ").queues;
    queues = enqueueMessage(queues, "journey-a", "second\n").queues;
    expect(queues["journey-a"]).toEqual({ items: ["first", "second"], state: "waiting" });
    expect(queueContent(queues["journey-a"]!)).toBe("first\n\nsecond");
  });

  it("ignores a blank message and keeps each conversation's queue apart", () => {
    let queues: CompactionQueueMap = enqueueMessage({}, "journey-a", "   ").queues;
    expect(queues).toEqual({});
    queues = enqueueMessage(queues, "journey-a", "root").queues;
    queues = enqueueMessage(queues, child, "child").queues;
    expect(queues["journey-a"]?.items).toEqual(["root"]);
    expect(queues[child]?.items).toEqual(["child"]);
  });

  it("refuses a message past the item limit or past one message's length", () => {
    let queues: CompactionQueueMap = {};
    for (let index = 0; index < COMPACTION_QUEUE_MAX_ITEMS; index += 1) {
      queues = enqueueMessage(queues, "journey-a", `m${index}`).queues;
    }
    const full = enqueueMessage(queues, "journey-a", "one more");
    expect(full.queues).toBe(queues);
    expect(full.refused).toMatch(/20 messages/);

    const long = enqueueMessage({}, "journey-a", "x".repeat(COMPOSER_DRAFT_MAX_CHARS - 10));
    const over = enqueueMessage(long.queues, "journey-a", "y".repeat(20));
    expect(over.refused).toMatch(/too long/);
    expect(over.queues).toBe(long.queues);
  });

  it("a message added to a held queue sets it waiting again", () => {
    const held = holdQueue(enqueueMessage({}, "journey-a", "first").queues, "journey-a", "The compaction failed.");
    expect(held["journey-a"]).toEqual({ items: ["first"], state: "held", heldReason: "The compaction failed." });
    expect(enqueueMessage(held, "journey-a", "second").queues["journey-a"])
      .toEqual({ items: ["first", "second"], state: "waiting" });
  });

  it("leaves on its own only while waiting, once the conversation can send and no compaction runs", () => {
    const waiting = enqueueMessage({}, "journey-a", "go").queues["journey-a"];
    expect(queueReadyToRelease(waiting, { canSend: true, compacting: false })).toBe(true);
    expect(queueReadyToRelease(waiting, { canSend: false, compacting: false })).toBe(false);
    expect(queueReadyToRelease(waiting, { canSend: true, compacting: true })).toBe(false);
    expect(queueReadyToRelease(undefined, { canSend: true, compacting: false })).toBe(false);
    const queues = { "journey-a": waiting! };
    expect(queueReadyToRelease(holdQueue(queues, "journey-a", "x")["journey-a"], { canSend: true, compacting: false })).toBe(false);
    expect(queueReadyToRelease(markQueueSending(queues, "journey-a")["journey-a"], { canSend: true, compacting: false })).toBe(false);
  });

  it("a failed compaction holds every waiting queue of its Journey and no other", () => {
    let queues: CompactionQueueMap = enqueueMessage({}, "journey-a", "root").queues;
    queues = enqueueMessage(queues, child, "child").queues;
    queues = enqueueMessage(queues, "journey-ab", "other journey").queues;
    queues = markQueueSending(enqueueMessage(queues, "journey-c", "sending").queues, "journey-c");
    const held = holdJourneyQueues(queues, "journey-a", "The compaction failed: boom");
    expect(held["journey-a"]?.state).toBe("held");
    expect(held[child]?.state).toBe("held");
    expect(held["journey-ab"]?.state).toBe("waiting");
    expect(held["journey-c"]?.state).toBe("sending");
    expect(holdJourneyQueues(held, "journey-z", "nothing")).toBe(held);
  });

  it("removes one item, and the queue with its last item", () => {
    let queues: CompactionQueueMap = enqueueMessage({}, "journey-a", "a").queues;
    queues = enqueueMessage(queues, "journey-a", "b").queues;
    queues = removeQueuedItem(queues, "journey-a", 0);
    expect(queues["journey-a"]?.items).toEqual(["b"]);
    expect(removeQueuedItem(queues, "journey-a", 0)).toEqual({});
    expect(removeQueue(queues, "journey-a")).toEqual({});
  });

  it("counts a Journey's waiting messages across its conversations", () => {
    let queues: CompactionQueueMap = enqueueMessage({}, "journey-a", "a").queues;
    queues = enqueueMessage(queues, child, "b").queues;
    queues = enqueueMessage(queues, child, "c").queues;
    queues = enqueueMessage(queues, "journey-ab", "d").queues;
    expect(waitingMessageCount(queues, "journey-a")).toBe(3);
    expect(waitingMessageCount(queues, "journey-ab")).toBe(1);
    expect(waitingMessageCount(queues, "journey-z")).toBe(0);
  });

  it("comes back from a restart held, never sending on its own", () => {
    const restored = queuesRestoredAfterRestart({ "journey-a": ["a", "b"] });
    expect(restored["journey-a"]).toEqual({
      items: ["a", "b"],
      state: "held",
      heldReason: "Kept from before Nautilus closed.",
    });
  });
});

describe("CR259: the queue is kept with the drafts", () => {
  const savedAt = "2026-11-13T12:00:00.000Z";

  it("writes 1.0.0 without a queue and 1.1.0 only while one waits", () => {
    expect(createPersistedComposerDrafts({ "journey-a": "draft" }, new Date(savedAt))).toEqual({
      schemaVersion: "1.0.0",
      drafts: { "journey-a": "draft" },
      savedAt,
    });
    expect(createPersistedComposerDrafts({}, new Date(savedAt), { "journey-a": ["a", "b"] })).toEqual({
      schemaVersion: "1.1.0",
      drafts: {},
      queued: { "journey-a": ["a", "b"] },
      savedAt,
    });
  });

  it("reads both shapes and refuses a queue where its version has none", () => {
    expect(parsePersistedComposerDrafts({
      schemaVersion: "1.1.0", drafts: {}, queued: { [child]: ["a"] }, savedAt,
    })?.queued).toEqual({ [child]: ["a"] });
    expect(parsePersistedComposerDrafts({ schemaVersion: "1.0.0", drafts: {}, savedAt })?.queued).toEqual({});
    expect(parsePersistedComposerDrafts({
      schemaVersion: "1.0.0", drafts: {}, queued: { "journey-a": ["a"] }, savedAt,
    })).toBeUndefined();
    expect(parsePersistedComposerDrafts({ schemaVersion: "1.1.0", drafts: {}, savedAt })).toBeUndefined();
  });

  it("refuses an empty, blank, oversized or overlong queue", () => {
    const parse = (queued: unknown) => parsePersistedComposerDrafts({ schemaVersion: "1.1.0", drafts: {}, queued, savedAt });
    expect(parse({ "journey-a": [] })).toBeUndefined();
    expect(parse({ "journey-a": [""] })).toBeUndefined();
    expect(parse({ "journey-a": [1] })).toBeUndefined();
    expect(parse({ "bad key": ["a"] })).toBeUndefined();
    expect(parse({ "journey-a": Array.from({ length: COMPACTION_QUEUE_MAX_ITEMS + 1 }, () => "a") })).toBeUndefined();
    expect(parse({ "journey-a": ["x".repeat(COMPOSER_DRAFT_MAX_CHARS), "y"] })).toBeUndefined();
  });
});
