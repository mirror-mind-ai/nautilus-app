import { validatePngDataUrl } from "./imageDataUrl";

/** CR218: a persona's image by its id, kept by Nautilus for the home. */
export type PersonaImages = Readonly<Record<string, string>>;

const PERSONA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Only a persona id with a PNG data URL is kept; anything else the native side answers is dropped. */
export function sanitizePersonaImages(value: unknown): PersonaImages {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const images: Record<string, string> = {};
  for (const [id, image] of Object.entries(value)) {
    const valid = validatePngDataUrl(image);
    if (PERSONA_ID.test(id) && valid) images[id] = valid;
  }
  return images;
}

/** The images after `persona`'s was chosen, or removed when `image` is undefined. */
export function imagesAfterChange(images: PersonaImages, persona: string, image: string | undefined): PersonaImages {
  const { [persona]: _previous, ...others } = images;
  return image ? { ...others, [persona]: image } : others;
}
