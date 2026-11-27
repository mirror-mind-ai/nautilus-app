import { invoke } from "@tauri-apps/api/core";
import { normalizeFileAttachmentResponse, type FileAttachmentResponse } from "../domain/fileAttachments";
import { bytesToBase64 } from "../domain/pastedImage";

export async function chooseFileAttachments(journeyId: string): Promise<FileAttachmentResponse> {
  const value = await invoke<unknown>("choose_file_attachments", { journeyId });
  return normalizeFileAttachmentResponse(value, journeyId);
}

export async function inspectDroppedFileAttachments(journeyId: string, paths: string[]): Promise<FileAttachmentResponse> {
  const value = await invoke<unknown>("inspect_file_attachments", { journeyId, paths });
  return normalizeFileAttachmentResponse(value, journeyId);
}

/**
 * The files of a paste, by their own paths: the native side reads which files the clipboard holds
 * (those copied in the file manager), keeps the ones the paste named and inspects them as dropped
 * files. No attachments when the paste has no files behind it.
 */
export async function inspectClipboardFiles(journeyId: string, names: string[]): Promise<FileAttachmentResponse> {
  const value = await invoke<unknown>("inspect_clipboard_files", { journeyId, names });
  return normalizeFileAttachmentResponse(value, journeyId);
}

/**
 * Keeps an image pasted into the Composer as a file in the Journey's own folder and answers as a
 * selected file does: the native side names it, writes it and inspects it.
 */
export async function savePastedImage(journeyId: string, image: Blob): Promise<FileAttachmentResponse> {
  const dataBase64 = bytesToBase64(new Uint8Array(await image.arrayBuffer()));
  const value = await invoke<unknown>("save_pasted_image", { journeyId, dataBase64 });
  return normalizeFileAttachmentResponse(value, journeyId);
}

export async function openFileAttachment(path: string): Promise<void> {
  await invoke("open_local_reference", { path, basePath: null });
}
