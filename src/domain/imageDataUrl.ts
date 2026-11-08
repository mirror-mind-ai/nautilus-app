const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_DATA_URL_LENGTH = 2_800_000;

/** A PNG data URL the native side normalized, bounded; anything else is not shown. */
export function validatePngDataUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= MAX_DATA_URL_LENGTH && PNG_DATA_URL.test(value)
    ? value
    : undefined;
}
