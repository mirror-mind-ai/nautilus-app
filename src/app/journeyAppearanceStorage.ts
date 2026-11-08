import { invoke } from "@tauri-apps/api/core";
import { validatePngDataUrl } from "../domain/imageDataUrl";

const validateImageDataUrl = validatePngDataUrl;

export async function importJourneyCustomImage(journeyId: string): Promise<string | undefined> {
  const value = await invoke<string | null>("import_journey_custom_image", { journeyId });
  if (value === null) return undefined;
  const validated = validateImageDataUrl(value);
  if (!validated) throw new Error("Native Journey image import returned invalid presentation data.");
  return validated;
}

export async function loadJourneyCustomImage(journeyId: string): Promise<string | undefined> {
  const value = await invoke<string | null>("load_journey_custom_image", { journeyId });
  if (value === null) return undefined;
  const validated = validateImageDataUrl(value);
  if (!validated) throw new Error("Stored Journey image returned invalid presentation data.");
  return validated;
}

export async function removeJourneyCustomImage(journeyId: string): Promise<void> {
  await invoke("remove_journey_custom_image", { journeyId });
}
