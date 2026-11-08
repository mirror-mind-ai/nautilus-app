import { invoke } from "@tauri-apps/api/core";
import { validatePngDataUrl } from "../domain/imageDataUrl";
import { sanitizePersonaImages, type PersonaImages } from "../domain/personaImages";

/** CR218: choose an image for `persona`; undefined when the person chose none. */
export async function importPersonaImage(persona: string): Promise<string | undefined> {
  const value = await invoke<string | null>("import_persona_image", { persona });
  if (value === null) return undefined;
  const validated = validatePngDataUrl(value);
  if (!validated) throw new Error("The persona image could not be shown.");
  return validated;
}

/** CR218: the images kept for this home's personas. */
export async function loadPersonaImages(): Promise<PersonaImages> {
  return sanitizePersonaImages(await invoke<unknown>("load_persona_images"));
}

export async function removePersonaImage(persona: string): Promise<void> {
  await invoke("remove_persona_image", { persona });
}
