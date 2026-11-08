import { invoke } from "@tauri-apps/api/core";
import { validatePngDataUrl } from "../domain/imageDataUrl";

export const validateUserAvatarDataUrl = validatePngDataUrl;

export async function importUserAvatar(): Promise<string | undefined> {
  const value = await invoke<string | null>("import_user_avatar");
  if (value === null) return undefined;
  const validated = validateUserAvatarDataUrl(value);
  if (!validated) throw new Error("Native user avatar import returned invalid presentation data.");
  return validated;
}

export async function loadUserAvatar(): Promise<string | undefined> {
  const value = await invoke<string | null>("load_user_avatar");
  if (value === null) return undefined;
  const validated = validateUserAvatarDataUrl(value);
  if (!validated) throw new Error("Stored user avatar returned invalid presentation data.");
  return validated;
}

export async function removeUserAvatar(): Promise<void> {
  await invoke("remove_user_avatar");
}
