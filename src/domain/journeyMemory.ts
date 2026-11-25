/**
 * What Mirror kept from a Journey: the memories it extracts from the Journey's Conversations and
 * hands to the agent when a turn calls for them. Mirror classifies each (`memory_type`); the panel
 * shows them as the person reads them, by kind, newest first, and nothing here changes them.
 */

import type { ConversationCatalogEntry } from "./conversationSpaces";

export type JourneyMemory = {
  id: string;
  memoryType: string;
  layer: string;
  title: string;
  content: string;
  persona: string | null;
  /** The Mirror Conversation the memory was taken from, when Mirror recorded it. */
  conversationId: string | null;
  createdAt: string;
  readinessState: string | null;
};

export type JourneyMemoryKind = "commitment" | "decision" | "learning" | "insight" | "other";

export type JourneyMemoryGroup = {
  kind: JourneyMemoryKind;
  label: string;
  hint: string;
  memories: JourneyMemory[];
};

export type JourneyMemoryRead = {
  journeyId: string;
  memories: JourneyMemory[];
  /** The list was cut at the read's limit; the counts still say how many there are. */
  truncated: boolean;
};

const KINDS: Record<JourneyMemoryKind, { label: string; hint: string; order: number }> = {
  commitment: { label: "Commitments", hint: "What was agreed to do, or to keep doing.", order: 0 },
  decision: { label: "Decisions", hint: "What was settled, and why.", order: 1 },
  learning: { label: "Learnings", hint: "What turned out to be true, or to work.", order: 2 },
  insight: { label: "Insights", hint: "What was seen in a new way.", order: 3 },
  other: { label: "Other memories", hint: "Everything else Mirror kept, by its own kind.", order: 4 },
};

const MAX_MEMORIES = 2_000;

export function memoryKindOf(memoryType: string): JourneyMemoryKind {
  return memoryType === "commitment" || memoryType === "decision" || memoryType === "learning" || memoryType === "insight"
    ? memoryType
    : "other";
}

/** Only well-formed memories, once each, as the host gave them; the order is the host's (newest first). */
export function sanitizeJourneyMemoryRead(value: unknown): JourneyMemoryRead | undefined {
  if (!isRecord(value) || typeof value.journeyId !== "string" || value.journeyId.length === 0 || !Array.isArray(value.memories)) return undefined;
  const seen = new Set<string>();
  const memories: JourneyMemory[] = [];
  for (const item of value.memories.slice(0, MAX_MEMORIES)) {
    if (!isRecord(item)) continue;
    const { id, memoryType, layer, title, content, persona, conversationId, createdAt, readinessState } = item;
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    if (typeof memoryType !== "string" || typeof title !== "string" || typeof content !== "string" || typeof createdAt !== "string") continue;
    seen.add(id);
    memories.push({
      id,
      memoryType,
      layer: typeof layer === "string" ? layer : "",
      title,
      content,
      persona: textOrNull(persona),
      conversationId: textOrNull(conversationId),
      createdAt,
      readinessState: textOrNull(readinessState),
    });
  }
  return { journeyId: value.journeyId, memories, truncated: value.truncated === true };
}

/** By kind in the order a person acts on them, each kind newest first; an empty kind is left out. */
export function groupJourneyMemories(memories: readonly JourneyMemory[]): JourneyMemoryGroup[] {
  const groups = new Map<JourneyMemoryKind, JourneyMemory[]>();
  for (const memory of memories) {
    const kind = memoryKindOf(memory.memoryType);
    groups.set(kind, [...(groups.get(kind) ?? []), memory]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => KINDS[left].order - KINDS[right].order)
    .map(([kind, list]) => ({ kind, label: KINDS[kind].label, hint: KINDS[kind].hint, memories: [...list].sort(newestFirst) }));
}

/** "14 decisions · 3 commitments · 8 learnings", in the groups' order, for the panel's header. */
export function describeJourneyMemoryCounts(memories: readonly JourneyMemory[]): string {
  const groups = groupJourneyMemories(memories);
  if (groups.length === 0) return "Nothing kept yet";
  return groups.map((group) => `${group.memories.length} ${countLabel(group.kind, group.memories.length)}`).join(" · ");
}

function countLabel(kind: JourneyMemoryKind, count: number): string {
  const singular: Record<JourneyMemoryKind, string> = { commitment: "commitment", decision: "decision", learning: "learning", insight: "insight", other: "other" };
  return count === 1 ? singular[kind] : KINDS[kind].label.toLowerCase().replace("other memories", "other");
}

export type MemoryConversationTarget =
  | { kind: "desktop_conversation"; conversationId: string }
  | { kind: "mirror_history"; conversationId: string };

/**
 * Where "Open the conversation" leads: the Desktop conversation whose generation the memory's
 * Mirror Conversation belongs to, else the Mirror history entry with that id, else nowhere. The
 * catalog is the app's own read of the Journey's conversations; nothing is guessed from ids.
 */
export function memoryConversationTarget(
  memory: Pick<JourneyMemory, "conversationId">,
  entries: readonly ConversationCatalogEntry[],
): MemoryConversationTarget | undefined {
  if (!memory.conversationId) return undefined;
  for (const entry of entries) {
    if (entry.kind === "desktop_conversation" && entry.authority.generations.some((generation) => generation.mirrorConversationId === memory.conversationId)) {
      return { kind: "desktop_conversation", conversationId: entry.conversationId };
    }
  }
  for (const entry of entries) {
    if (entry.kind === "mirror_history" && entry.conversationId === memory.conversationId && entry.availability === "available_in_mirror") {
      return { kind: "mirror_history", conversationId: entry.conversationId };
    }
  }
  return undefined;
}

/** The memory's date as a person reads it; the text as stored when it is not a date. */
export function formatMemoryDate(createdAt: string, locale?: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return createdAt;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(parsed));
}

const EXCERPT_CHARS = 280;

/** The first sentences of a long content, so a list of memories reads as a list; the whole on request. */
export function memoryExcerpt(content: string): { text: string; cut: boolean } {
  const text = content.trim();
  if (text.length <= EXCERPT_CHARS) return { text, cut: false };
  const head = text.slice(0, EXCERPT_CHARS);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("\n"));
  return { text: `${(end > EXCERPT_CHARS / 2 ? head.slice(0, end + 1) : head).trimEnd()}…`, cut: true };
}

function newestFirst(left: JourneyMemory, right: JourneyMemory): number {
  const a = Date.parse(left.createdAt), b = Date.parse(right.createdAt);
  if (Number.isNaN(a) && Number.isNaN(b)) return right.createdAt.localeCompare(left.createdAt);
  if (Number.isNaN(a)) return 1;
  if (Number.isNaN(b)) return -1;
  return b - a;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
