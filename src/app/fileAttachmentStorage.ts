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
