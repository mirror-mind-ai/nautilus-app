import { fileAttachmentLimitMessage } from "./fileAttachments";

/** The largest pasted image kept; the native side holds the same figure and is the authority. */
export const PASTED_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** What a paste is read through: the clipboard's files and its text. */
export type PasteContent<F> = {
  files: ArrayLike<F>;
  getData: (format: string) => string;
};

/**
 * The files a paste is about. A paste that carries text is a paste of text, even when a picture of
 * the same content comes along, as it does from a spreadsheet or a document; only a paste with no
 * text is a paste of its files.
 */
export function filesInPaste<F>(clipboard: PasteContent<F>): F[] {
  if (clipboard.getData("text/plain").trim()) return [];
  return Array.from(clipboard.files);
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Why pasted files with no path behind them are not kept, or nothing when they can be. Only an
 * image is kept that way (in the Journey's folder); said before anything is written: a file that
 * is not an image, an image over the size limit, or a message that would pass its limit of files.
 */
export function pastedImageRefusal({ files, pending, maxFiles }: { files: ArrayLike<{ type: string; size: number }>; pending: number; maxFiles: number }): string | undefined {
  const pasted = Array.from(files);
  if (pasted.some((file) => !file.type.startsWith("image/"))) {
    return "This file could not be attached by pasting. Use the paperclip, or drop the file on the window. Nothing was attached.";
  }
  const largest = Math.max(0, ...pasted.map((image) => image.size));
  if (largest > PASTED_IMAGE_MAX_BYTES) {
    return `The pasted image is ${megabytes(largest)}, over the ${PASTED_IMAGE_MAX_BYTES / (1024 * 1024)} MB limit for a pasted image. Nothing was attached.`;
  }
  if (pending + pasted.length > maxFiles) return `${fileAttachmentLimitMessage(maxFiles)} Nothing was attached.`;
  return undefined;
}

/** Base64 of the bytes, built in pieces so a large image does not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
