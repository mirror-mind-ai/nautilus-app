// @ts-expect-error Vitest runs in Node; production frontend has no Node dependency.
import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { applyVerifiedLocalPaths, highlightConversationText, parseLinkifiedText, renderLinkifiedText } from "../app/LinkifiedText";

describe("LinkifiedText", () => {
  it("highlights every case-insensitive search match without changing its text", () => {
    const result = highlightConversationText("Mirror and mirror", "mirror");
    expect(Array.isArray(result)).toBe(true);
    const parts = result as Array<string | ReactElement>;
    expect(parts.filter((part) => isValidElement(part))).toHaveLength(2);
    expect(parts.filter((part) => isValidElement(part)).map((part) => (part as ReactElement<{ children: string }>).props.children)).toEqual(["Mirror", "mirror"]);
  });

  it("detects public and loopback HTTP links without trailing punctuation", () => {
    expect(parseLinkifiedText("Open https://example.com/docs.")) .toEqual([
      { type: "text", text: "Open " },
      { type: "url", text: "https://example.com/docs", href: "https://example.com/docs" },
      { type: "text", text: "." },
    ]);
    expect(parseLinkifiedText("Open http://127.0.0.1:8012/")) .toEqual([
      { type: "text", text: "Open " },
      { type: "url", text: "http://127.0.0.1:8012/", href: "http://127.0.0.1:8012/" },
    ]);
  });

  it("does not treat a slash embedded in ordinary prose as a local path", () => {
    expect(parseLinkifiedText("Estado errado/incompleto")) .toEqual([
      { type: "text", text: "Estado errado/incompleto" },
    ]);
    expect(parseLinkifiedText("Estado errado/incompleto, then /Users/example/note.md")).toEqual([
      { type: "text", text: "Estado errado/incompleto, then " },
      { type: "local_path_candidate", text: "/Users/example/note.md" },
    ]);
  });

  it("recognizes absolute paths after punctuation without regex lookbehind", () => {
    expect(parseLinkifiedText("See (/Users/example/note.md).")) .toEqual([
      { type: "text", text: "See (" },
      { type: "local_path_candidate", text: "/Users/example/note.md" },
      { type: "text", text: ")." },
    ]);
  });

  it("keeps the drive letter of a Windows path, so the link opens the file it names", () => {
    // The Navigator clicked `C:/VSCode/…/artigo-v01.docx` inside a Markdown link on 2026-11-09: the
    // drive stayed text, the link carried `/VSCode/…`, and opening it was refused.
    expect(parseLinkifiedText("A [v01 em Word](C:/VSCode/jornadaflip.com.br/_Local/review/artigo-v01.docx) está pronta")).toEqual([
      { type: "text", text: "A [v01 em Word](" },
      { type: "local_path_candidate", text: "C:/VSCode/jornadaflip.com.br/_Local/review/artigo-v01.docx" },
      { type: "text", text: ") está pronta" },
    ]);
    expect(parseLinkifiedText("Veja C:\\VSCode\\nautilus-app\\README.md.")).toEqual([
      { type: "text", text: "Veja " },
      { type: "local_path_candidate", text: "C:\\VSCode\\nautilus-app\\README.md" },
      { type: "text", text: "." },
    ]);
    expect(parseLinkifiedText("em d:/dados/plano.md")).toEqual([
      { type: "text", text: "em " },
      { type: "local_path_candidate", text: "d:/dados/plano.md" },
    ]);
  });

  it("does not mistake a word ending in a colon for a drive", () => {
    const parts = parseLinkifiedText("Nota:/x/y.md e ver:\\a.md");
    expect(parts.filter((part) => part.type !== "text" && /^[A-Za-z]:/.test(part.text))).toEqual([]);
    expect(parseLinkifiedText("Open https://example.com/docs")[1]).toEqual(
      { type: "url", text: "https://example.com/docs", href: "https://example.com/docs" },
    );
  });

  it("keeps the frontend source parseable by legacy macOS WebKit", () => {
    const source = readFileSync(new URL("../app/LinkifiedText.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("(?<!");
    expect(source).not.toContain("(?<=");
  });

  it("detects supported path shapes as candidates, not links", () => {
    expect(parseLinkifiedText("See docs/project/roadmap/index.md and /Users/example/note.md")).toEqual([
      { type: "text", text: "See " },
      { type: "local_path_candidate", text: "docs/project/roadmap/index.md" },
      { type: "text", text: " and " },
      { type: "local_path_candidate", text: "/Users/example/note.md" },
    ]);
  });

  it("preserves current-user home-relative paths as complete verification candidates", () => {
    expect(parseLinkifiedText("Created ~/.config/alissonvale-com/youtube/o-reflexo-episodio-1-metadata-diff.md."))
      .toEqual([
        { type: "text", text: "Created " },
        {
          type: "local_path_candidate",
          text: "~/.config/alissonvale-com/youtube/o-reflexo-episodio-1-metadata-diff.md",
        },
        { type: "text", text: "." },
      ]);
    const unsupported = parseLinkifiedText("Bare ~ and ~someone/private.md remain text.");
    expect(unsupported.every((part) => part.type === "text")).toBe(true);
    expect(unsupported.map((part) => part.text).join(""))
      .toBe("Bare ~ and ~someone/private.md remain text.");
  });

  it("routes verified chat paths through the supplied Journey-aware handler", () => {
    const onLocalPathClick = vi.fn();
    const [link] = renderLinkifiedText(
      [{ type: "local_path", text: "docs/guide.md" }],
      "/journey",
      onLocalPathClick,
    );
    expect(isValidElement(link)).toBe(true);
    if (!isValidElement(link)) throw new Error("expected link element");
    const localLink = link as ReactElement<{ onClick: (event: { preventDefault: () => void }) => void }>;
    localLink.props.onClick({ preventDefault: vi.fn() });
    expect(onLocalPathClick).toHaveBeenCalledWith("docs/guide.md");
  });

  it("promotes only native-verified files to local path links", () => {
    const parsed = parseLinkifiedText("Files docs/real.md and docs/missing.md");
    expect(applyVerifiedLocalPaths(parsed, new Set(["docs/real.md"]))).toEqual([
      { type: "text", text: "Files " },
      { type: "local_path", text: "docs/real.md" },
      { type: "text", text: " and " },
      { type: "text", text: "docs/missing.md" },
    ]);
  });
});
