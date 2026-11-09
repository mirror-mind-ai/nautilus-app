import { parseRoutingKeywords, personaDraftProblem, type PersonaDraft } from "./personaEditing";
import { sortPersonaList, type PersonaListEntry } from "./personaList";

/**
 * CR222 and CR223: a persona created, and one deleted after showing what goes, through Core
 * CR207's calls (mirror-mind 0.44.0). The Core decides; these say what it was asked and what it
 * answered.
 */

/** A new persona's fields: an edit's, with the id it will keep. */
export type NewPersonaDraft = PersonaDraft & {
  id: string;
  /** Once the person types the id, the name no longer proposes it. */
  idTyped: boolean;
};

/** What `createPersona` is sent: only the fields given. */
export type PersonaCreation = {
  persona: string;
  name: string;
  prompt: string;
  description?: string;
  routingKeywords?: string[];
};

/** The identity layer's grammar for a new key, the one Core CR207 checks. */
const PERSONA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ID = 80;

export function newPersonaDraft(): NewPersonaDraft {
  return { id: "", idTyped: false, name: "", description: "", prompt: "", routingKeywords: "" };
}

/** The id the name proposes: lowercase, accents aside, every other run of characters a hyphen. */
export function personaIdFromName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, MAX_ID).replace(/-+$/, "");
}

export function newPersonaDraftWithName(draft: NewPersonaDraft, name: string): NewPersonaDraft {
  return { ...draft, name, ...(draft.idTyped ? {} : { id: personaIdFromName(name) }) };
}

export function newPersonaDraftWithId(draft: NewPersonaDraft, id: string): NewPersonaDraft {
  return { ...draft, id, idTyped: true };
}

/** What is wrong with `draft`, in a sentence, before the Core is asked. */
export function personaCreationProblem(draft: NewPersonaDraft): string | undefined {
  if (!draft.name.trim()) return "A new persona needs a name.";
  if (!draft.id) return "A new persona needs an id.";
  if (draft.id.length > MAX_ID || !PERSONA_ID.test(draft.id)) {
    return "The id takes lowercase letters, digits and single hyphens, at most 80 characters.";
  }
  return personaDraftProblem(draft);
}

export function personaCreation(draft: NewPersonaDraft): PersonaCreation {
  const creation: PersonaCreation = { persona: draft.id, name: draft.name.trim(), prompt: draft.prompt };
  const description = draft.description.trim();
  if (description) creation.description = description;
  const keywords = parseRoutingKeywords(draft.routingKeywords);
  if (keywords.length) creation.routingKeywords = keywords;
  return creation;
}

/** The list with `created` in it, in its place; an id already listed is replaced. */
export function personaListAfterCreate(list: readonly PersonaListEntry[], created: PersonaListEntry): PersonaListEntry[] {
  const entry = { id: created.id, name: created.name, description: created.description };
  return sortPersonaList([...list.filter((item) => item.id !== created.id), entry]);
}

export function personaListAfterDelete(list: readonly PersonaListEntry[], personaId: string): readonly PersonaListEntry[] {
  return list.some((entry) => entry.id === personaId) ? list.filter((entry) => entry.id !== personaId) : list;
}

/** The Core's `previewPersonaDeletion`, and whether Nautilus keeps an image for the persona. */
export type PersonaDeletionPreview = {
  persona: string;
  heirs: string[];
  kept: { conversations: number; memories: number; runtime_sessions: number };
  deleted: { descriptors: number; identity_integrations: number; extension_bindings: number };
  cleared: { journey_defaults: string[]; sticky_default: boolean };
  digest: string;
  image: boolean;
};

/** Held identical to the native sentence by a test: a stale digest previews again. */
export const PERSONA_DELETION_CHANGED = "What this persona holds changed since the list was shown. Review the new list and confirm again.";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const areCounts = (value: unknown, keys: readonly string[]): boolean => isObject(value) && keys.every((key) => isCount(value[key]));
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

export function sanitizePersonaDeletionPreview(value: unknown): PersonaDeletionPreview | undefined {
  if (!isObject(value)) return undefined;
  const { persona, heirs, kept, deleted, cleared, digest, image } = value;
  const valid = typeof persona === "string" && PERSONA_ID.test(persona)
    && isIdList(heirs)
    && areCounts(kept, ["conversations", "memories", "runtime_sessions"])
    && areCounts(deleted, ["descriptors", "identity_integrations", "extension_bindings"])
    && isObject(cleared) && isIdList(cleared.journey_defaults) && typeof cleared.sticky_default === "boolean"
    && typeof digest === "string" && digest.length > 0
    && typeof image === "boolean";
  return valid ? (value as PersonaDeletionPreview) : undefined;
}

const counted = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

/** Why the deletion cannot go ahead, or nothing when it can. */
export function personaDeletionRefusal(preview: PersonaDeletionPreview, nameOfPersona: (id: string) => string): string | undefined {
  const count = preview.heirs.length;
  if (count === 0) return undefined;
  return `${counted(count, "persona inherits", "personas inherit")} from this one: ${preview.heirs.map(nameOfPersona).join(", ")}. `
    + "Mirror deletes a persona only when none does.";
}

/** The confirmation's lines: what goes, what is cleared, and the history that stays. */
export function personaDeletionSummary(
  preview: PersonaDeletionPreview,
  nameOfJourney: (id: string) => string,
): { goes: string[]; cleared: string[]; kept: string[] } {
  const goes = ["Its definition: name, description, prompt and routing keywords"];
  if (preview.deleted.descriptors > 0) goes.push("Its generated descriptor");
  if (preview.deleted.identity_integrations > 0) {
    goes.push(counted(preview.deleted.identity_integrations, "identity integration", "identity integrations"));
  }
  if (preview.deleted.extension_bindings > 0) {
    goes.push(counted(preview.deleted.extension_bindings, "extension binding", "extension bindings"));
  }
  if (preview.image) goes.push("Its image on this device");
  const cleared = preview.cleared.journey_defaults.map((journey) => `The default persona of ${nameOfJourney(journey)}`);
  if (preview.cleared.sticky_default) cleared.push("Mirror's remembered default persona");
  const kept: string[] = [];
  if (preview.kept.conversations > 0) kept.push(counted(preview.kept.conversations, "Conversation", "Conversations"));
  if (preview.kept.memories > 0) kept.push(counted(preview.kept.memories, "memory", "memories"));
  if (preview.kept.runtime_sessions > 0) kept.push(counted(preview.kept.runtime_sessions, "runtime session", "runtime sessions"));
  return { goes, cleared, kept };
}
