import { findJourneyById, type JourneyRegistry } from "./journeyRegistry";

/**
 * CR301: the conversations a turn was sent in, newest first, so the Activity view can keep one being
 * worked between turns within reach. Only a conversation that is not its Journey's own is recorded:
 * the Journey's own is reached from the Journey's row. The title is the one the conversation had
 * when the turn was sent, for as long as the Journey's catalog has not been read.
 */
export type WorkedConversation = { journeyId: string; threadId: string; title?: string; lastWorkedAt: string };

/** The Activity view reads a day of them; this only bounds the preferences file. */
export const MAX_WORKED_CONVERSATIONS = 64;

const TITLE_MAX = 512;

export function recordWorkedConversation(
  current: readonly WorkedConversation[],
  conversation: { journeyId: string; threadId: string; title?: string },
  admittedAt: string,
): readonly WorkedConversation[] {
  const { journeyId, threadId } = conversation;
  if (!journeyId.trim() || !threadId.trim() || !Number.isFinite(Date.parse(admittedAt))) return current;
  const title = conversation.title?.trim().slice(0, TITLE_MAX);
  const others = current.filter((entry) => entry.journeyId !== journeyId || entry.threadId !== threadId);
  return [{ journeyId, threadId, ...(title ? { title } : {}), lastWorkedAt: admittedAt }, ...others].slice(0, MAX_WORKED_CONVERSATIONS);
}

export function parseWorkedConversations(value: unknown): WorkedConversation[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_WORKED_CONVERSATIONS) return undefined;
  const parsed: WorkedConversation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const { journeyId, threadId, title, lastWorkedAt } = item as Record<string, unknown>;
    if (typeof journeyId !== "string" || !journeyId.trim() || typeof threadId !== "string" || !threadId.trim()) return undefined;
    if (typeof lastWorkedAt !== "string" || !Number.isFinite(Date.parse(lastWorkedAt))) return undefined;
    if (title !== undefined && (typeof title !== "string" || title.length > TITLE_MAX)) return undefined;
    parsed.push({ journeyId, threadId, ...(title ? { title } : {}), lastWorkedAt });
  }
  return parsed;
}

/** A Journey that no longer exists has no row to show its conversations under. */
export function sanitizeWorkedConversations(list: readonly WorkedConversation[], registry: JourneyRegistry): WorkedConversation[] {
  return list.filter((entry) => Boolean(findJourneyById(registry, entry.journeyId)));
}
