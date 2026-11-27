import { describe, expect, it } from "vitest";
import { fileAttachmentLimitMessage, addFileAttachments, type FileAttachment } from "../domain/fileAttachments";
import { PASTED_IMAGE_MAX_BYTES, bytesToBase64, imagesInPaste, pastedImageRefusal } from "../domain/pastedImage";
import appSource from "../app/App.tsx?raw";
import composerSource from "../app/ComposerDraftInput.tsx?raw";
import storageSource from "../app/fileAttachmentStorage.ts?raw";
import nativeSource from "../../src-tauri/src/pasted_image.rs?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

// Ctrl+V of a screenshot, or of an image copied from another program, did nothing in the Composer:
// an attachment had to be a file first, saved by hand and then picked. A pasted image is now kept in
// the Journey's folder and attached like any selected file.

const file = (name: string, type: string, size = 1200) => ({ name, type, size });
const paste = (files: ReturnType<typeof file>[], text = "") => ({ files, getData: (format: string) => (format === "text/plain" ? text : "") });

describe("what a paste holds", () => {
  it("takes a screenshot: an image and no text", () => {
    expect(imagesInPaste(paste([file("image.png", "image/png")]))).toHaveLength(1);
  });

  it("takes an image copied from a page, which comes with markup and no plain text", () => {
    const clipboard = { files: [file("image.png", "image/png")], getData: (format: string) => (format === "text/html" ? '<img src="x">' : "") };
    expect(imagesInPaste(clipboard)).toHaveLength(1);
  });

  it("leaves a paste that carries text alone, even when a picture of it comes along", () => {
    // A spreadsheet or a document copies cells as text and as a picture of them; the person wants the text.
    expect(imagesInPaste(paste([file("image.png", "image/png")], "A1\tB1"))).toEqual([]);
    expect(imagesInPaste(paste([], "only words"))).toEqual([]);
  });

  it("treats blank text as no text", () => {
    expect(imagesInPaste(paste([file("image.png", "image/png")], "  \n"))).toHaveLength(1);
  });

  it("leaves files that are not images alone", () => {
    expect(imagesInPaste(paste([file("relatorio.pdf", "application/pdf")]))).toEqual([]);
    expect(imagesInPaste(paste([file("notas.txt", "text/plain"), file("foto.jpg", "image/jpeg")]))).toEqual([file("foto.jpg", "image/jpeg")]);
  });

  it("takes every image of one paste", () => {
    expect(imagesInPaste(paste([file("a.png", "image/png"), file("b.jpg", "image/jpeg")]))).toHaveLength(2);
  });
});

describe("the limits of a paste, said in words", () => {
  it("accepts an image within the limits", () => {
    expect(pastedImageRefusal({ images: [file("image.png", "image/png")], pending: 0, maxFiles: 32 })).toBeUndefined();
    expect(pastedImageRefusal({ images: [file("image.png", "image/png", PASTED_IMAGE_MAX_BYTES)], pending: 31, maxFiles: 32 })).toBeUndefined();
  });

  it("says so when the image is over the size limit, with both sizes", () => {
    const refusal = pastedImageRefusal({ images: [file("image.png", "image/png", 31.2 * 1024 * 1024)], pending: 0, maxFiles: 32 });
    expect(refusal).toBe("The pasted image is 31.2 MB, over the 20 MB limit for a pasted image. Nothing was attached.");
  });

  it("says so when the message would pass its limit of files, in the words the other ways of attaching use", () => {
    const refusal = pastedImageRefusal({ images: [file("image.png", "image/png")], pending: 32, maxFiles: 32 });
    expect(refusal).toBe(`${fileAttachmentLimitMessage(32)} Nothing was attached.`);
    expect(pastedImageRefusal({ images: [file("a.png", "image/png"), file("b.png", "image/png")], pending: 31, maxFiles: 32 })).toContain("no more than 32 files");
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
  it("is offered by the Composer's input and handled by the application", () => {
    expect(composerSource).toContain("onPaste={onPaste}");
    expect(appSource).toContain("onPaste={handleComposerPaste}");
    expect(appSource).toContain("imagesInPaste(event.clipboardData)");
    // Only a paste that is an image is taken from the input; text is pasted as ever.
    const handler = appSource.slice(appSource.indexOf("function handleComposerPaste"), appSource.indexOf("async function attachPastedImages"));
    expect(handler.indexOf("if (!images.length) return;")).toBeGreaterThan(0);
    expect(handler.indexOf("event.preventDefault();")).toBeGreaterThan(handler.indexOf("if (!images.length) return;"));
  });

  it("refuses before anything is written, and says why where attachment errors are said", () => {
    const attach = appSource.slice(appSource.indexOf("async function attachPastedImages"), appSource.indexOf("function recordAdmittedJourneyActivity"));
    expect(attach.indexOf("pastedImageRefusal(")).toBeGreaterThan(0);
    expect(attach.indexOf("savePastedImage(")).toBeGreaterThan(attach.indexOf("pastedImageRefusal("));
    expect(attach).toContain("setFileAttachmentError(");
    expect(attach).toContain("addPendingFiles(");
  });

  it("keeps the image through the native side, in the Journey's own folder, and attaches it by the attachment route", () => {
    expect(storageSource).toContain('invoke<unknown>("save_pasted_image", { journeyId, dataBase64 })');
    expect(storageSource).toContain("normalizeFileAttachmentResponse(value, journeyId)");
    // The folder the Journey's next turn works in, resolved as the turn resolves it, never the caller's word.
    expect(nativeSource).toContain("crate::resolved_journey_workspace(&app, &journey_id, &profile, true)?.path");
    expect(nativeSource).not.toContain("journey_root: String");
    expect(nativeSource).toContain("crate::inspect_file_attachments_at(&journey_id, &[saved])");
    expect(nativeSource).toContain("create_new(true)");
    expect(mainSource).toContain("pasted_image::save_pasted_image,");
  });
});
