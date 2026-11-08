import { invoke } from "@tauri-apps/api/core";
import { sanitizePersonaNames, type PersonaNames } from "../domain/personaNames";

export type { PersonaNames } from "../domain/personaNames";

/** The names kept for this home's personas. */
export async function loadPersonaNames(): Promise<PersonaNames> {
  return sanitizePersonaNames(await invoke<Record<string, string>>("load_persona_names"));
}
