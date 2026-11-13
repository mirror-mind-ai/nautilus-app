import { COMPOSER_DRAFT_MAX_CHARS, COMPOSER_QUEUE_MAX_ITEMS } from "./composerDrafts";

/**
 * CR259: messages written while a compaction runs wait for it, and reach the agent as one turn
 * when the conversation can send again. They were written without any answer in between, so they
 * are one intention; separate turns would answer the first without knowing the second.
 *
 * A queue belongs to a conversation, keyed like its Composer draft. `waiting` leaves on its own;
 * `held` waits for the Navigator, because the compaction failed, the send failed, or the app
 * restarted; `sending` has been handed to a turn and leaves the store once the agent has it.
 */
export const COMPACTION_QUEUE_MAX_ITEMS = COMPOSER_QUEUE_MAX_ITEMS;
export const COMPACTION_QUEUE_SEPARATOR = "\n\n";
export const QUEUE_RESTORED_REASON = "Kept from before Nautilus closed.";

export type CompactionQueue = {
  items: string[];
  state: "waiting" | "held" | "sending";
  heldReason?: string;
};

export type CompactionQueueMap = Record<string, CompactionQueue>;

export function queueContent(queue: CompactionQueue): string {
  return queue.items.join(COMPACTION_QUEUE_SEPARATOR);
}

export function enqueueMessage(
  queues: CompactionQueueMap,
  key: string,
  text: string,
): { queues: CompactionQueueMap; refused?: string } {
  const message = text.trim();
  if (!message) return { queues };
  const items = queues[key]?.items ?? [];
  if (items.length >= COMPACTION_QUEUE_MAX_ITEMS) {
    return { queues, refused: `Up to ${COMPACTION_QUEUE_MAX_ITEMS} messages can wait for the compaction.` };
  }
  const next = [...items, message];
  if (next.join(COMPACTION_QUEUE_SEPARATOR).length > COMPOSER_DRAFT_MAX_CHARS) {
    return { queues, refused: "The waiting messages would be too long to send as one message." };
  }
  return { queues: { ...queues, [key]: { items: next, state: "waiting" } } };
}

export function queueReadyToRelease(
  queue: CompactionQueue | undefined,
  conditions: { canSend: boolean; compacting: boolean },
): boolean {
  return queue?.state === "waiting" && conditions.canSend && !conditions.compacting;
}

export function markQueueSending(queues: CompactionQueueMap, key: string): CompactionQueueMap {
  const queue = queues[key];
  return queue ? { ...queues, [key]: { items: queue.items, state: "sending" } } : queues;
}

export function holdQueue(queues: CompactionQueueMap, key: string, reason: string): CompactionQueueMap {
  const queue = queues[key];
  return queue ? { ...queues, [key]: { items: queue.items, state: "held", heldReason: reason } } : queues;
}

function keyInJourney(key: string, journeyId: string): boolean {
  return key === journeyId || key.startsWith(`${journeyId}__conversation_`);
}

/** A compaction is the Journey's, so its failure holds the waiting queue of every conversation in it. */
export function holdJourneyQueues(queues: CompactionQueueMap, journeyId: string, reason: string): CompactionQueueMap {
  let next = queues;
  for (const [key, queue] of Object.entries(queues)) {
    if (keyInJourney(key, journeyId) && queue.state === "waiting") next = holdQueue(next, key, reason);
  }
  return next;
}

export function waitingMessageCount(queues: CompactionQueueMap, journeyId: string): number {
  return Object.entries(queues)
    .filter(([key]) => keyInJourney(key, journeyId))
    .reduce((count, [, queue]) => count + queue.items.length, 0);
}

export function removeQueuedItem(queues: CompactionQueueMap, key: string, index: number): CompactionQueueMap {
  const queue = queues[key];
  if (!queue || index < 0 || index >= queue.items.length) return queues;
  const items = queue.items.filter((_, position) => position !== index);
  return items.length ? { ...queues, [key]: { ...queue, items } } : removeQueue(queues, key);
}

export function removeQueue(queues: CompactionQueueMap, key: string): CompactionQueueMap {
  if (!(key in queues)) return queues;
  const next = { ...queues };
  delete next[key];
  return next;
}

/** What the draft store keeps: the words, not the state, which a restart decides anew. */
export function queuedItemsForStorage(queues: CompactionQueueMap): Record<string, string[]> {
  return Object.fromEntries(Object.entries(queues).map(([key, queue]) => [key, queue.items]));
}

/** Nothing compacts across a restart, so a queue comes back held and leaves only when asked. */
export function queuesRestoredAfterRestart(stored: Record<string, string[]>): CompactionQueueMap {
  return Object.fromEntries(Object.entries(stored).map(([key, items]) => [
    key,
    { items, state: "held" as const, heldReason: QUEUE_RESTORED_REASON },
  ]));
}
