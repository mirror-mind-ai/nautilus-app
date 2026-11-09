import { invoke } from "@tauri-apps/api/core";
import { sanitizePersonaList, type PersonaListEntry } from "../domain/personaList";

/** CR221: every persona the active home keeps, read from the Core through the host. */
export async function loadPersonaList(): Promise<PersonaListEntry[]> {
  return sanitizePersonaList(await invoke<unknown>("list_personas"));
}
