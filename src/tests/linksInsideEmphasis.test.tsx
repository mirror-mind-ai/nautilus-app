import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtifactMarkdown } from "../app/ArtifactMarkdown";
import { MessageContent, messageInlinePlainText } from "../app/MessageContent";

// An agent wrote the link to the report it had just made in bold:
//   **[Abrir o relatório em PDF — 6 páginas](<C:/VSCode/investimentos-financas/RELATORIO….pdf>)**
// The bold was drawn, and inside it the brackets, the angle brackets and the path as plain text:
// nothing to click. Bold and italic text was never read for links, code or paths; a link the agent
// emphasised was as dead as no link at all.

const reportLink = "**[Abrir o relatório em PDF — 6 páginas](<C:/VSCode/investimentos-financas/RELATORIO-GLOBAL-SOCIOS-STIMULUS-2026-11-25-R01.pdf>)**";

describe("a link inside bold or italic text", () => {
  it("is read as a link, kept bold, with nothing of the Markdown left on screen", () => {
    const html = renderToStaticMarkup(MessageContent({ content: `2. Novo relatório aos sócios\n\n${reportLink}\n\nInclui as cinco obras.` }));
    expect(html).toMatch(/<strong>[^]*Abrir o relatório em PDF — 6 páginas[^]*<\/strong>/);
    expect(html).not.toContain("[Abrir");
    expect(html).not.toContain("](&lt;");
    // A local file becomes a link once the native side confirms it; until then its path is shown after the label.
    expect(html).toContain("C:/VSCode/investimentos-financas/RELATORIO-GLOBAL-SOCIOS-STIMULUS-2026-11-25-R01.pdf");
  });

  it("opens a web link from bold and from italic", () => {
    const bold = renderToStaticMarkup(MessageContent({ content: "**[docs](https://example.com/docs)**" }));
    expect(bold).toContain('<strong><a href="https://example.com/docs"');
    expect(bold).toContain(">docs</a></strong>");
    const italic = renderToStaticMarkup(MessageContent({ content: "*[docs](https://example.com/docs)*" }));
    expect(italic).toContain('<em><a href="https://example.com/docs"');
  });

  it("keeps the text around the link inside the bold", () => {
    const html = renderToStaticMarkup(MessageContent({ content: "**Leia [o guia](https://example.com/g) antes**" }));
    expect(html).toMatch(/<strong>Leia <a href="https:\/\/example\.com\/g"[^>]*>o guia<\/a> antes<\/strong>/);
  });

  it("reads code inside bold as code", () => {
    const html = renderToStaticMarkup(MessageContent({ content: "**rode `npm test` agora**" }));
    expect(html).toMatch(/<strong>rode <code>[^]*npm test[^]*<\/code> agora<\/strong>/);
  });

  it("leaves plain bold and italic as they were", () => {
    expect(renderToStaticMarkup(MessageContent({ content: "**Principal conclusão:** no cenário realista" }))).toContain("<strong>Principal conclusão:</strong>");
    expect(renderToStaticMarkup(MessageContent({ content: "um *destaque* só" }))).toContain("<em>destaque</em>");
  });

  it("still marks a conversation search inside bold and italic, and inside a link there", () => {
    const bold = renderToStaticMarkup(MessageContent({ content: "**Principal conclusão:** no cenário", highlightQuery: "conclusão" }));
    // Text inside bold now goes through the same path as text outside it, which wraps a highlighted run in a span.
    expect(bold).toMatch(/<strong>(<span>)?Principal <mark class="conversation-search-highlight">conclusão<\/mark>:(<\/span>)?<\/strong>/);
    const italic = renderToStaticMarkup(MessageContent({ content: "um *destaque* só", highlightQuery: "destaque" }));
    expect(italic).toMatch(/<em>(<span>)?<mark class="conversation-search-highlight">destaque<\/mark>(<\/span>)?<\/em>/);
    const link = renderToStaticMarkup(MessageContent({ content: "**[o relatório](https://example.com/r)**", highlightQuery: "relatório" }));
    expect(link).toContain('<mark class="conversation-search-highlight">relatório</mark></a></strong>');
  });

  it("copies a link in bold as its label and destination, like any link", () => {
    expect(messageInlinePlainText("Veja **[o relatório](<C:/VSCode/r.pdf>)**.")).toBe("Veja o relatório (C:/VSCode/r.pdf).");
  });

  it("shows a link's label in a document preview when the link is in bold", () => {
    const html = renderToStaticMarkup(<ArtifactMarkdown content={"Texto **[o relatório](<C:/VSCode/r.pdf>)** fim."} />);
    expect(html).toContain("<strong>");
    expect(html).toContain("o relatório");
    expect(html).not.toContain("[o relatório]");
  });
});
