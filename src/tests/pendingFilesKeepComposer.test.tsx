import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { PendingFileAttachments } from "../app/PendingFileAttachments";
import type { FileAttachment } from "../domain/fileAttachments";

const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m"))?.[1] ?? "";
}

const email = (index: number): FileAttachment => ({
  schemaVersion: "0.2.0",
  attachmentId: `file-${index}`,
  journeyId: "journey-a",
  absolutePath: `C:\\Users\\example\\Downloads\\Fwd_ A very long forwarded newsletter subject number ${index}.eml`,
  displayName: `Fwd_ A very long forwarded newsletter subject number ${index}.eml`,
  sizeBytes: 120_000,
  selectedAt: "2026-11-11T12:00:00.000Z",
  kind: "file",
});

// Eight forwarded e-mails pushed the message field and Send below the window on 2026-11-11: the
// list of files grew without bound in the composer's own row, and only Tab could still reach them.
describe("Selected files never push the message field out of the window", () => {
  it("scrolls the list of files inside a bounded height, under a header that stays", () => {
    const list = rule(".pending-file-list");
    expect(list).toMatch(/max-height: min\(\d+vh, \d+px\)/);
    expect(list).toContain("overflow-y: auto");
    expect(list).toContain("overscroll-behavior: contain");
    const html = renderToStaticMarkup(<PendingFileAttachments attachments={[1, 2, 3, 4, 5, 6, 7, 8].map(email)} onRemove={vi.fn()} onClear={vi.fn()} />);
    expect(html.indexOf("8 files selected")).toBeLessThan(html.indexOf('class="pending-file-list"'));
    expect(html.indexOf("Clear all")).toBeLessThan(html.indexOf('class="pending-file-list"'));
  });

  it("gives each file two lines: its name, then where it is and its size", () => {
    const html = renderToStaticMarkup(<PendingFileAttachments attachments={[email(1)]} onRemove={vi.fn()} onClear={vi.fn()} />);
    expect(html).toContain('class="pending-file-name" title="Fwd_ A very long forwarded newsletter subject number 1.eml"');
    expect(html).toMatch(/<span class="pending-file-meta"><button[^>]*class="file-path-button"[^>]*>C:\\Users\\example\\Downloads\\Fwd_ A very long[^<]*<\/button><small>117\.2 KiB<\/small><\/span>/);
    expect(rule(".pending-file-name")).toContain("text-overflow: ellipsis");
    expect(rule(".pending-file-name")).toContain("white-space: nowrap");
    expect(rule(".pending-file-meta")).toContain("display: flex");
  });
});
