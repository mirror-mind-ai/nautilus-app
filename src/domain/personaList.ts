import { readablePersonaName } from "./personaNames";

/** CR221: a persona as the Core's `listPersonas` gives it, enough for a row of the sidebar. */
export type PersonaListEntry = {
  readonly id: string;
  readonly name: string | null;
  readonly description: string | null;
};

const PERSONA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PERSONAS = 512;

/** The name a person reads for the persona: its own, or its id when it has none. */
export function personaListLabel(entry: PersonaListEntry): string {
  return entry.name ?? entry.id;
}

/** Only well-formed entries, once each, in the order a person reads them. */
export function sanitizePersonaList(value: unknown): PersonaListEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: PersonaListEntry[] = [];
  for (const item of value.slice(0, MAX_PERSONAS)) {
    if (!item || typeof item !== "object") continue;
    const { id, name, description } = item as Record<string, unknown>;
    if (typeof id !== "string" || !PERSONA_ID.test(id) || seen.has(id)) continue;
    if (!isTextOrNull(name) || !isTextOrNull(description)) continue;
    seen.add(id);
    list.push({ id, name: readablePersonaName(name) ?? null, description: typeof description === "string" && description.trim() ? description.trim() : null });
  }
  return sortPersonaList(list);
}

/** By the name a person reads, accents and case aside, then by id. */
export function sortPersonaList(list: readonly PersonaListEntry[]): PersonaListEntry[] {
  return [...list].sort((left, right) =>
    personaListLabel(left).localeCompare(personaListLabel(right), undefined, { sensitivity: "base" }) || left.id.localeCompare(right.id));
}

/** The personas whose name, id or description holds the query, accents and case aside. */
export function filterPersonaList(list: readonly PersonaListEntry[], query: string): PersonaListEntry[] {
  const wanted = folded(query.trim());
  if (!wanted) return [...list];
  return list.filter((entry) => [entry.name, entry.id, entry.description].some((field) => field !== null && folded(field).includes(wanted)));
}

/** The list after the persona screen saved one of its personas; an unknown persona changes nothing. */
export function personaListAfterSave(list: readonly PersonaListEntry[], saved: PersonaListEntry): readonly PersonaListEntry[] {
  if (!list.some((entry) => entry.id === saved.id)) return list;
  return sortPersonaList(list.map((entry) => (entry.id === saved.id ? { id: saved.id, name: saved.name, description: saved.description } : entry)));
}

function isTextOrNull(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string";
}

function folded(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}
