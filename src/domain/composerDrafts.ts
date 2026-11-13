export const COMPOSER_DRAFT_MAX_CHARS = 51_200;
export const COMPOSER_DRAFT_MAX_JOURNEYS = 256;
/** CR259: how many messages may wait for a compaction in one conversation. */
export const COMPOSER_QUEUE_MAX_ITEMS = 20;

export type ComposerDraftMap = Record<string, string>;
/** CR259: messages waiting for a compaction, by the same key as the conversation's draft. */
export type ComposerQueuedMap = Record<string, string[]>;

/**
 * CR259: the file says 1.1.0 only while a message waits, so a store without a queue keeps the
 * shape an earlier app reads.
 */
export type PersistedComposerDrafts = {
  schemaVersion: "1.0.0" | "1.1.0";
  drafts: ComposerDraftMap;
  queued?: ComposerQueuedMap;
  savedAt: string;
};

const journeyIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function createPersistedComposerDrafts(
  drafts: ComposerDraftMap,
  now: Date = new Date(),
  queued: ComposerQueuedMap = {},
): PersistedComposerDrafts {
  if (Object.keys(queued).length === 0) {
    return { schemaVersion: "1.0.0", drafts, savedAt: now.toISOString() };
  }
  return { schemaVersion: "1.1.0", drafts, queued, savedAt: now.toISOString() };
}

export function parsePersistedComposerDrafts(
  value: unknown,
): (PersistedComposerDrafts & { queued: ComposerQueuedMap }) | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const withQueue = record.schemaVersion === "1.1.0";
  if ((record.schemaVersion !== "1.0.0" && !withQueue) || !record.drafts || typeof record.drafts !== "object") {
    return undefined;
  }
  if (withQueue !== ("queued" in record)) return undefined;
  const queued = withQueue ? parseQueued(record.queued) : {};
  if (!queued) return undefined;
  if (typeof record.savedAt !== "string" || Number.isNaN(Date.parse(record.savedAt))) {
    return undefined;
  }

  const entries = Object.entries(record.drafts as Record<string, unknown>);
  if (entries.length > COMPOSER_DRAFT_MAX_JOURNEYS) return undefined;
  const drafts: ComposerDraftMap = {};
  for (const [journeyId, text] of entries) {
    if (!journeyIdPattern.test(journeyId)
      || typeof text !== "string"
      || text.length === 0
      || text.length > COMPOSER_DRAFT_MAX_CHARS) {
      return undefined;
    }
    drafts[journeyId] = text;
  }

  return { schemaVersion: withQueue ? "1.1.0" : "1.0.0", drafts, queued, savedAt: record.savedAt };
}

function parseQueued(value: unknown): ComposerQueuedMap | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.length > COMPOSER_DRAFT_MAX_JOURNEYS) return undefined;
  const queued: ComposerQueuedMap = {};
  for (const [key, items] of entries) {
    if (!journeyIdPattern.test(key)
      || !Array.isArray(items)
      || items.length === 0
      || items.length > COMPOSER_QUEUE_MAX_ITEMS
      || items.some((item) => typeof item !== "string" || item.trim().length === 0)
      || (items as string[]).join("\n\n").length > COMPOSER_DRAFT_MAX_CHARS) {
      return undefined;
    }
    queued[key] = items as string[];
  }
  return queued;
}

export function updateComposerDraft(
  current: ComposerDraftMap,
  journeyId: string,
  text: string,
): ComposerDraftMap {
  const next = { ...current };
  if (text.length === 0) {
    delete next[journeyId];
  } else {
    next[journeyId] = text;
  }
  return next;
}
