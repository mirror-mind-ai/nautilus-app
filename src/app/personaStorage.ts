import { invoke } from "@tauri-apps/api/core";
import { sanitizePersona, type Persona, type PersonaChanges } from "../domain/personaEditing";

const UNREADABLE = "Mirror answered without the persona.";

/** CR217: one persona whole, as the Core keeps it. */
export async function readPersona(persona: string): Promise<Persona> {
  const answer = sanitizePersona(await invoke<unknown>("read_persona", { persona }));
  if (!answer) throw new Error(UNREADABLE);
  return answer;
}

/** CR217: change the fields in `changes`, refused when the persona changed since `expectedUpdatedAt`. */
export async function updatePersona(persona: string, expectedUpdatedAt: string, changes: PersonaChanges): Promise<Persona> {
  const answer = sanitizePersona(await invoke<unknown>("update_persona", { request: { persona, expectedUpdatedAt, ...changes } }));
  if (!answer) throw new Error(UNREADABLE);
  return answer;
}
