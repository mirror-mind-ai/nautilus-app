/**
 * CR263: a Journey's briefing is its `identity` content in Mirror, the text the runtime delivers
 * to every turn (Core CR217, `readJourney`). The panel shows all of it as markdown.
 */
export type JourneyBriefing = {
  id: string;
  name: string;
  /** The content as stored, whole. Empty when the Journey has none. */
  content: string;
  updatedAt: string;
};

/** Where a read of the briefing stands: the panel shows nothing of an old text while it reads. */
export type BriefingReadStatus = "loading" | "ready" | "failed";

export function sanitizeJourneyBriefing(value: unknown): JourneyBriefing | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return undefined;
  if (typeof raw.name !== "string" || typeof raw.content !== "string" || typeof raw.updatedAt !== "string") return undefined;
  return { id: raw.id, name: raw.name, content: raw.content, updatedAt: raw.updatedAt };
}

// The lines the app already shows beside the panel: the Journey's name in the header, its status
// and stage in the Journey's own surfaces. They sit ahead of the first `## ` section.
const TITLE_LINE = /^#\s+\S/;
const STATUS_OR_STAGE_LINE = /^\*\*(?:Status|Stage):\*\*/;
const SECTION_LINE = /^##\s/;

/**
 * What the panel shows of `content`: all of it, except the title, Status and Stage lines that come
 * before the first section. The same lines inside a section are the author's text and stay.
 */
export function briefingBodyOf(content: string): string {
  const lines = content.split(/\r\n|\r|\n/);
  const firstSection = lines.findIndex((line) => SECTION_LINE.test(line));
  const preambleEnd = firstSection === -1 ? lines.length : firstSection;
  const kept = [
    ...lines.slice(0, preambleEnd).filter((line) => !TITLE_LINE.test(line) && !STATUS_OR_STAGE_LINE.test(line)),
    ...lines.slice(preambleEnd),
  ];
  return kept.join("\n").trim();
}
