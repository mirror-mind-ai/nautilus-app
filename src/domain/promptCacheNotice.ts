/**
 * Prompt cache notices: when the next message is likely to re-read the whole conversation.
 *
 * A model re-reads the conversation on every message. For about five minutes after a call, the
 * provider answers that re-read from a cache of the prompt, which costs a fraction of reading it
 * anew; after a pause the cache is gone and the next message re-processes everything. In a session
 * of this app's own development, seven returns after pauses were a third of two days' consumption.
 *
 * The notice is for a long conversation only, and only when the reading is measured: it says what
 * the next message will do, offers to compact before the pause, and after a turn says what the
 * turn did (read from the cache, or re-processed the whole), from the usage the model reported.
 * It is an advanced reading, off by default. It never compacts by itself.
 */

/** What the providers this app meets keep a prompt cache for: Anthropic's five minutes. */
export const PROMPT_CACHE_LIFETIME_MS = 5 * 60_000;

/** Below this the re-read is cheap whatever happens, and a notice would be noise. */
export const PROMPT_CACHE_NOTICE_MIN_TOKENS = 50_000;

export type PromptCacheNotice =
  | { kind: "warm"; tokens: number; remainingMs: number }
  | { kind: "expired"; tokens: number; expiredForMs: number };

/** What one turn's first call did with the conversation, from the usage the model reported. */
export type PromptCacheReceipt = {
  conversationId: string;
  at: string;
  tokens: number;
  cacheRead: number;
  cacheWrite: number;
  /** The pause before the turn, from the previous answer; absent for a conversation's first turn. */
  pauseMs: number | null;
};

export function promptCacheNoticeFor(input: {
  enabled: boolean;
  tokens: number | null;
  /** The reading was reported by the model, not estimated after a compaction. */
  measured: boolean;
  /** When the model was last called for this conversation, which is when its answer arrived. */
  lastModelCallAt: string | undefined;
  /** A turn or a compaction is running: the notice waits, the model is being called now. */
  busy: boolean;
  now: number;
}): PromptCacheNotice | undefined {
  if (!input.enabled || input.busy || !input.measured) return undefined;
  if (input.tokens === null || input.tokens < PROMPT_CACHE_NOTICE_MIN_TOKENS) return undefined;
  const lastCall = input.lastModelCallAt === undefined ? Number.NaN : Date.parse(input.lastModelCallAt);
  if (Number.isNaN(lastCall)) return undefined;
  const elapsed = input.now - lastCall;
  if (elapsed < 0) return undefined;
  return elapsed < PROMPT_CACHE_LIFETIME_MS
    ? { kind: "warm", tokens: input.tokens, remainingMs: PROMPT_CACHE_LIFETIME_MS - elapsed }
    : { kind: "expired", tokens: input.tokens, expiredForMs: elapsed - PROMPT_CACHE_LIFETIME_MS };
}

/** The last answer is the last call: the model was called to produce it. */
export function lastModelCallAtOf(messages: readonly { role: string; createdAt: string }[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") return messages[index].createdAt;
  }
  return undefined;
}

/**
 * The receipt of a turn's first call, when the usage says clearly what happened. A call that read
 * most of the context from the cache read it; one that wrote most of it re-processed it. Anything
 * in between (a partial cache hit, an unknown provider's accounting) gets no claim.
 */
export function promptCacheReceiptOf(input: {
  conversationId: string;
  at: string;
  usage: { tokens: number | null; cacheRead?: number; cacheWrite?: number };
  previousCallAt: string | undefined;
}): PromptCacheReceipt | undefined {
  const { tokens, cacheRead, cacheWrite } = input.usage;
  if (tokens === null || tokens < PROMPT_CACHE_NOTICE_MIN_TOKENS || cacheRead === undefined || cacheWrite === undefined) return undefined;
  const previous = input.previousCallAt === undefined ? Number.NaN : Date.parse(input.previousCallAt);
  const at = Date.parse(input.at);
  const pauseMs = Number.isNaN(previous) || Number.isNaN(at) || at < previous ? null : at - previous;
  return { conversationId: input.conversationId, at: input.at, tokens, cacheRead, cacheWrite, pauseMs };
}

export type PromptCacheReceiptReading = { kind: "re-processed" | "read-from-cache"; text: string };

export function describePromptCacheReceipt(receipt: PromptCacheReceipt): PromptCacheReceiptReading | undefined {
  const reProcessed = receipt.cacheWrite >= receipt.tokens * 0.5 && receipt.cacheRead <= receipt.tokens * 0.2;
  const readFromCache = receipt.cacheRead >= receipt.tokens * 0.5;
  if (reProcessed) {
    const pause = receipt.pauseMs !== null && receipt.pauseMs >= 60_000 ? ` after a ${formatPause(receipt.pauseMs)} pause` : "";
    return { kind: "re-processed", text: `The last message re-processed the whole conversation (${formatTokens(receipt.tokens)} tokens)${pause}.` };
  }
  if (readFromCache) {
    return { kind: "read-from-cache", text: `The last message read ${formatTokens(receipt.cacheRead)} tokens from the model's cache.` };
  }
  return undefined;
}

export function promptCacheNoticeText(notice: PromptCacheNotice): string {
  return notice.kind === "warm"
    ? `This conversation is at ${formatTokens(notice.tokens)} tokens. After a 5-minute pause, your next message re-processes all of it.`
    : `The model's cache expired ${formatPause(notice.expiredForMs)} ago. Your next message re-processes the whole conversation: ${formatTokens(notice.tokens)} tokens.`;
}

/** 919K, 1.2M, 48K: as the footer's reading writes them. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/** 4:52 for what remains of the cache; a clock a person can watch. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** 6 min, 93 min, 1 h 33 min, 2 d: the pause as a person says it. */
export function formatPause(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d`;
}
