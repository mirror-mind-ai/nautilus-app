import { describe, expect, it } from "vitest";
import { fileAttachmentLimitMessage, addFileAttachments, type FileAttachment } from "../domain/fileAttachments";
import { PASTED_IMAGE_MAX_BYTES, bytesToBase64, filesInPaste, pastedImageRefusal } from "../domain/pastedImage";
import appSource from "../app/App.tsx?raw";
import composerSource from "../app/ComposerDraftInput.tsx?raw";
import storageSource from "../app/fileAttachmentStorage.ts?raw";
import nativeSource from "../../src-tauri/src/pasted_image.rs?raw";
import clipboardSource from "../../src-tauri/src/clipboard_files.rs?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

// Ctrl+V of a screenshot, of an image copied from another program, or of a file copied in the file
// manager did nothing in the Composer: an attachment had to be a file picked with the paperclip.
// Pasted files are now attached. Files copied in the file manager, by their own paths; an image
// with no file behind it is kept in the Journey's folder first.

const file = (name: string, type: string, size = 1200) => ({ name, type, size });
const paste = (files: ReturnType<typeof file>[], text = "") => ({ files, getData: (format: string) => (format === "text/plain" ? text : "") });

describe("what a paste holds", () => {
  it("takes a screenshot: an image and no text", () => {
    expect(filesInPaste(paste([file("image.png", "image/png")]))).toHaveLength(1);
  });

  it("takes an image copied from a page, which comes with markup and no plain text", () => {
    const clipboard = { files: [file("image.png", "image/png")], getData: (format: string) => (format === "text/html" ? '<img src="x">' : "") };
    expect(filesInPaste(clipboard)).toHaveLength(1);
  });

  it("leaves a paste that carries text alone, even when a picture of it comes along", () => {
    // A spreadsheet or a document copies cells as text and as a picture of them; the person wants the text.
    expect(filesInPaste(paste([file("image.png", "image/png")], "A1\tB1"))).toEqual([]);
    expect(filesInPaste(paste([], "only words"))).toEqual([]);
  });

  it("treats blank text as no text", () => {
    expect(filesInPaste(paste([file("image.png", "image/png")], "  \n"))).toHaveLength(1);
  });

  it("takes every file of one paste, images or not", () => {
    expect(filesInPaste(paste([file("relatorio.pdf", "application/pdf")]))).toHaveLength(1);
    expect(filesInPaste(paste([file("notas.txt", "text/plain"), file("foto.jpg", "image/jpeg")]))).toHaveLength(2);
  });
});

describe("a paste with no file behind it: what is kept, and what is refused in words", () => {
  it("accepts an image within the limits", () => {
    expect(pastedImageRefusal({ files: [file("image.png", "image/png")], pending: 0, maxFiles: 32 })).toBeUndefined();
    expect(pastedImageRefusal({ files: [file("image.png", "image/png", PASTED_IMAGE_MAX_BYTES)], pending: 31, maxFiles: 32 })).toBeUndefined();
  });

  it("says so when the image is over the size limit, with both sizes", () => {
    const refusal = pastedImageRefusal({ files: [file("image.png", "image/png", 31.2 * 1024 * 1024)], pending: 0, maxFiles: 32 });
    expect(refusal).toBe("The pasted image is 31.2 MB, over the 20 MB limit for a pasted image. Nothing was attached.");
  });

  it("says so when the message would pass its limit of files, in the words the other ways of attaching use", () => {
    const refusal = pastedImageRefusal({ files: [file("image.png", "image/png")], pending: 32, maxFiles: 32 });
    expect(refusal).toBe(`${fileAttachmentLimitMessage(32)} Nothing was attached.`);
    expect(pastedImageRefusal({ files: [file("a.png", "image/png"), file("b.png", "image/png")], pending: 31, maxFiles: 32 })).toContain("no more than 32 files");
  });

  it("keeps only images that way: a file that is not one, with no path to attach it by, is refused with the other ways named", () => {
    const refusal = pastedImageRefusal({ files: [file("relatorio.pdf", "application/pdf")], pending: 0, maxFiles: 32 });
    expect(refusal).toBe("This file could not be attached by pasting. Use the paperclip, or drop the file on the window. Nothing was attached.");
    expect(pastedImageRefusal({ files: [file("foto.png", "image/png"), file("notas.txt", "text/plain")], pending: 0, maxFiles: 32 })).toBe(refusal);
  });

  it("keeps one sentence for the limit of files, whichever way a file arrives", () => {
    const attachment = (index: number): FileAttachment => ({ schemaVersion: "0.2.0", attachmentId: `file-${index}`, journeyId: "j", absolutePath: `C:/x/${index}.txt`, displayName: `${index}.txt`, sizeBytes: 1, selectedAt: "2026-11-26T12:00:00.000Z", kind: "file" });
    expect(() => addFileAttachments([attachment(1)], [attachment(2)], "j", 1)).toThrow(fileAttachmentLimitMessage(1));
    expect(fileAttachmentLimitMessage(32)).toBe("Attach no more than 32 files to one message.");
  });

  it("agrees with the native side about the size limit", () => {
    expect(PASTED_IMAGE_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(nativeSource).toContain("pub(crate) const PASTED_IMAGE_MAX_BYTES: usize = 20 * 1024 * 1024;");
  });
});

describe("the bytes on their way to the native side", () => {
  it("encodes them as the base64 the native side decodes, also when they are many", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(bytesToBase64(new TextEncoder().encode("abc"))).toBe("YWJj");
    const large = new Uint8Array(200_001).map((_, index) => index % 251);
    const decoded = Uint8Array.from(atob(bytesToBase64(large)), (character) => character.charCodeAt(0));
    expect(decoded.length).toBe(large.length);
    expect(decoded.every((value, index) => value === large[index])).toBe(true);
  });
});

describe("the paste in the Composer", () => {
  const handler = appSource.slice(appSource.indexOf("function handleComposerPaste"), appSource.indexOf("async function attachPastedFiles"));
  const attach = appSource.slice(appSource.indexOf("async function attachPastedFiles"), appSource.indexOf("function recordAdmittedJourneyActivity"));

  it("is offered by the Composer's input and handled by the application", () => {
    expect(composerSource).toContain("onPaste={onPaste}");
    expect(appSource).toContain("onPaste={handleComposerPaste}");
    expect(handler).toContain("filesInPaste(event.clipboardData)");
    // Only a paste of files is taken from the input; text is pasted as ever.
    expect(handler.indexOf("if (!files.length) return;")).toBeGreaterThan(0);
    expect(handler.indexOf("event.preventDefault();")).toBeGreaterThan(handler.indexOf("if (!files.length) return;"));
  });

  it("attaches files copied in the file manager by their own paths, before anything is kept as a copy", () => {
    const byPath = attach.indexOf("inspectClipboardFiles(ownerJourneyId, files.map((file) => file.name))");
    expect(byPath).toBeGreaterThan(0);
    // Every pasted file by its path, or none: then, and only then, the paste has no files behind it.
    expect(attach).toContain("if (byPath.attachments.length === files.length) {");
    expect(attach.indexOf("pastedImageRefusal(")).toBeGreaterThan(byPath);
    expect(attach.indexOf("savePastedImage(")).toBeGreaterThan(attach.indexOf("pastedImageRefusal("));
    expect(attach).toContain("setFileAttachmentError(");
    expect(attach).toContain("addPendingFiles(byPath, ownerJourneyId)");
  });

  it("keeps an image with no file through the native side, in the Journey's own folder, and attaches it by the attachment route", () => {
    expect(storageSource).toContain('invoke<unknown>("save_pasted_image", { journeyId, dataBase64 })');
    expect(storageSource).toContain("normalizeFileAttachmentResponse(value, journeyId)");
    // The folder the Journey's next turn works in, resolved as the turn resolves it, never the caller's word.
    expect(nativeSource).toContain("crate::resolved_journey_workspace(&app, &journey_id, &profile, true)?.path");
    expect(nativeSource).not.toContain("journey_root: String");
    expect(nativeSource).toContain("crate::inspect_file_attachments_at(&journey_id, &[saved])");
    expect(nativeSource).toContain("create_new(true)");
    expect(mainSource).toContain("pasted_image::save_pasted_image,");
  });

  it("reads where the pasted files are from the clipboard natively, and attaches only what the paste named", () => {
    expect(storageSource).toContain('invoke<unknown>("inspect_clipboard_files", { journeyId, names })');
    expect(clipboardSource).toContain("crate::inspect_file_attachments_at(&journey_id, &paths_named(&paths, &names))");
    // Nothing is written by this route, and elsewhere than Windows it answers no files.
    expect(clipboardSource).not.toMatch(/fs::write|create_new|File::create/);
    expect(clipboardSource).toContain("#[cfg(not(windows))]\nfn clipboard_drop_block() -> Option<Vec<u8>> {\n    None\n}");
    expect(mainSource).toContain("clipboard_files::inspect_clipboard_files,");
  });
});
