import { invoke } from "@tauri-apps/api/core";
import { sanitizePersona, type Persona, type PersonaChanges } from "../domain/personaEditing";
import { sanitizePersonaDeletionPreview, type PersonaCreation, type PersonaDeletionPreview } from "../domain/personaLifecycle";

const UNREADABLE = "Mirror answered without the persona.";
const DELETION_UNREADABLE = "Mirror's list of what this persona holds could not be read.";

/** CR223: Mirror's backup, and what Nautilus could not remove of its own after the Core deleted. */
export type PersonaDeletionReceipt = { backup: string | null; problem: string | null };

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

/** CR222: create a persona; it answers as `readPersona` reads it, so the edit screen takes it back. */
export async function createPersona(request: PersonaCreation): Promise<Persona> {
  const answer = sanitizePersona(await invoke<unknown>("create_persona", { request }));
  if (!answer) throw new Error(UNREADABLE);
  return answer;
}

/** CR223: what deleting `persona` takes, from the Core and from this device. */
export async function previewPersonaDeletion(persona: string): Promise<PersonaDeletionPreview> {
  const answer = sanitizePersonaDeletionPreview(await invoke<unknown>("preview_persona_deletion", { persona }));
  if (!answer) throw new Error(DELETION_UNREADABLE);
  return answer;
}

/** CR223: delete `persona` as the preview with `expectedDigest` showed it. */
export async function deletePersona(persona: string, expectedDigest: string): Promise<PersonaDeletionReceipt> {
  const answer = await invoke<unknown>("delete_persona", { persona, expectedDigest });
  const receipt = answer as Partial<PersonaDeletionReceipt> | null;
  return {
    backup: typeof receipt?.backup === "string" ? receipt.backup : null,
    problem: typeof receipt?.problem === "string" ? receipt.problem : null,
  };
}
