import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { markdownLinkTarget } from "../app/LinkifiedText";
import { MessageContent, messageInlinePlainText, parseInlineTokens } from "../app/MessageContent";
import artifactSource from "../app/ArtifactMarkdown.tsx?raw";

// Agents write links as Markdown, `[label](destination)`. The renderer did not read that form, so
// the brackets and parentheses showed raw around a path the Navigator could not click as a whole.
describe("Markdown links in a message", () => {
  it("reads the label and the destination, including a Windows path and a destination in <…>", () => {
    expect(parseInlineTokens("A [v01 em Word](C:/VSCode/review/artigo-v01.docx) está pronta.")).toEqual([
      { type: "text", text: "A " },
      { type: "link", text: "v01 em Word", href: "C:/VSCode/review/artigo-v01.docx" },
      { type: "text", text: " está pronta." },
    ]);
    expect(parseInlineTokens("[guia](<C:/Users/rodri/Mirror Journeys/guia.md>)")).toEqual([
      { type: "link", text: "guia", href: "C:/Users/rodri/Mirror Journeys/guia.md" },
    ]);
    expect(parseInlineTokens("Veja [docs](https://example.com/docs) e **isto**.")).toEqual([
      { type: "text", text: "Veja " },
      { type: "link", text: "docs", href: "https://example.com/docs" },
      { type: "text", text: " e " },
      { type: "strong", text: "isto" },
      { type: "text", text: "." },
    ]);
  });

  it("leaves brackets that are not a link alone", () => {
    expect(parseInlineTokens("lista [a, b] (c)")).toEqual([{ type: "text", text: "lista [a, b] (c)" }]);
  });

  it("opens only web links and local paths; anything else stays text", () => {
    expect(markdownLinkTarget("https://example.com")).toEqual({ kind: "url" });
    expect(markdownLinkTarget("C:/VSCode/a.docx")).toEqual({ kind: "local" });
    expect(markdownLinkTarget("C:\\VSCode\\a.docx")).toEqual({ kind: "local" });
    expect(markdownLinkTarget("docs/guide.md")).toEqual({ kind: "local" });
    expect(markdownLinkTarget("~/notes.md")).toEqual({ kind: "local" });
    for (const refused of ["javascript:alert(1)", "mailto:a@b.c", "file:///C:/a.md", "#section", "data:text/html,x"]) {
      expect(markdownLinkTarget(refused)).toEqual({ kind: "none" });
    }
  });

  it("shows the label, and keeps the destination readable until the file is confirmed", () => {
    const html = renderToStaticMarkup(MessageContent({ content: "A [v01 em Word](C:/VSCode/review/artigo-v01.docx) está pronta." }));
    expect(html).toContain("v01 em Word");
    expect(html).toContain("C:/VSCode/review/artigo-v01.docx");
    expect(html).not.toContain("[v01 em Word]");
    const web = renderToStaticMarkup(MessageContent({ content: "Veja [docs](https://example.com/docs)." }));
    expect(web).toContain('href="https://example.com/docs"');
    expect(web).toContain(">docs</a>");
    const script = renderToStaticMarkup(MessageContent({ content: "[x](javascript:alert(1))" }));
    expect(script).not.toContain("<a");
  });

  it("copies a link as its label and destination, so a copied draft keeps where it points", () => {
    expect(messageInlinePlainText("Leia [o artigo](https://example.com/a).")).toBe("Leia o artigo (https://example.com/a).");
  });

  it("shows a link's label in a document preview", () => {
    expect(artifactSource).toContain('case "link":');
  });
});
