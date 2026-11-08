import { readablePersonaName, type PersonaNames } from "./personaNames";

/** CR217: a persona as the Core answers it (Core CR205, `readPersona` and `updatePersona`). */
export type Persona = {
  id: string;
  name: string | null;
  description: string | null;
  prompt: string;
  routingKeywords: string[];
  defaultModel: string | null;
  inheritsFrom: string | null;
  /** The reading an edit sends back, so a persona changed since is refused, not overwritten. */
  updatedAt: string;
};

/** The screen's fields as typed. Keywords are one text, split by commas or lines. */
export type PersonaDraft = {
  name: string;
  description: string;
  prompt: string;
  routingKeywords: string;
};

/** What an edit sends: only the fields that changed. `null` removes a name or a description. */
export type PersonaChanges = {
  name?: string | null;
  description?: string | null;
  prompt?: string;
  routingKeywords?: string[];
};

const PERSONA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Core CR205's bounds, said here before the Core is asked.
const MAX_NAME = 80;
const MAX_DESCRIPTION = 2000;
const MAX_KEYWORD = 80;
const MAX_KEYWORDS = 200;

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The persona the native side answered, or nothing when it is not one. */
export function sanitizePersona(value: unknown): Persona | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !PERSONA_ID.test(raw.id)) return undefined;
  if (typeof raw.prompt !== "string" || typeof raw.updatedAt !== "string") return undefined;
  return {
    id: raw.id,
    name: optionalText(raw.name),
    description: optionalText(raw.description),
    prompt: raw.prompt,
    routingKeywords: Array.isArray(raw.routingKeywords)
      ? raw.routingKeywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : [],
    defaultModel: optionalText(raw.defaultModel),
    inheritsFrom: optionalText(raw.inheritsFrom),
    updatedAt: raw.updatedAt,
  };
}

export function draftFromPersona(persona: Persona): PersonaDraft {
  return {
    name: persona.name ?? "",
    description: persona.description ?? "",
    prompt: persona.prompt,
    routingKeywords: persona.routingKeywords.join(", "),
  };
}

export function parseRoutingKeywords(text: string): string[] {
  return text.split(/[,\n]/).map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

/** The fields of `draft` that differ from `persona`; empty when nothing changed. */
export function personaChanges(persona: Persona, draft: PersonaDraft): PersonaChanges {
  const changes: PersonaChanges = {};
  const name = optionalText(draft.name);
  if (name !== persona.name) changes.name = name;
  const description = optionalText(draft.description);
  if (description !== persona.description) changes.description = description;
  if (draft.prompt !== persona.prompt) changes.prompt = draft.prompt;
  const keywords = parseRoutingKeywords(draft.routingKeywords);
  if (!sameList(keywords, persona.routingKeywords)) changes.routingKeywords = keywords;
  return changes;
}

/** What is wrong with `draft`, in a sentence, before the Core is asked. */
export function personaDraftProblem(draft: PersonaDraft): string | undefined {
  if (draft.prompt.trim().length === 0) return "The prompt cannot be empty.";
  const name = draft.name.trim();
  if (name && !readablePersonaName(name)) return `The name must be at most ${MAX_NAME} characters, on one line.`;
  if ([...draft.description.trim()].length > MAX_DESCRIPTION) {
    return `The description must be at most ${MAX_DESCRIPTION.toLocaleString("en")} characters.`;
  }
  const keywords = parseRoutingKeywords(draft.routingKeywords);
  if (keywords.length > MAX_KEYWORDS) return `At most ${MAX_KEYWORDS} routing keywords.`;
  if (keywords.some((keyword) => [...keyword].length > MAX_KEYWORD)) {
    return `Each routing keyword must be at most ${MAX_KEYWORD} characters.`;
  }
  return undefined;
}

/** CR216's kept names after a save: the persona's name now, or none, so its id shows. */
export function namesAfterSave(names: PersonaNames, persona: Persona): PersonaNames {
  const { [persona.id]: _previous, ...others } = names;
  const name = readablePersonaName(persona.name);
  return name ? { ...others, [persona.id]: name } : others;
}
