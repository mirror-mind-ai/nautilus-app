/** CR216: a persona's name by its id, as the Core handed it (Core CR204). */
export type PersonaNames = Readonly<Record<string, string>>;

const PERSONA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The persona's own name, trimmed, when it is one a bubble can show. */
export function readablePersonaName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  // eslint-disable-next-line no-control-regex
  return name.length > 0 && [...name].length <= 80 && !/[\u0000-\u001f\u007f-\u009f]/.test(name) ? name : undefined;
}

/** Only an id with a readable name is kept; anything else the native side answers is dropped. */
export function sanitizePersonaNames(value: unknown): PersonaNames {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const names: Record<string, string> = {};
  for (const [id, name] of Object.entries(value)) {
    const readable = readablePersonaName(name);
    if (PERSONA_ID.test(id) && readable) names[id] = readable;
  }
  return names;
}
