import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { wholePathCandidate } from "../app/LinkifiedText";
import { MessageContent } from "../app/MessageContent";
import messageContentSource from "../app/MessageContent.tsx?raw";

const b = String.fromCharCode(92);
const win = (...parts: string[]) => parts.join(b);

// Agents mark a file name or path as inline code. The backticks say exactly where it starts and
// ends, so the whole span is a candidate even with spaces, any extension, or `\` separators; the
// native side still decides whether it is a file.
describe("An inline code span that is a whole path", () => {
  it("takes the whole span, spaces, backslashes and any extension included", () => {
    const spreadsheet = win("C:", "_Pessoal", "STIMULUS PARTICIPACOES", "Financeiro", "Conciliado_15.xlsx");
    expect(wholePathCandidate(spreadsheet)).toBe(spreadsheet);
    expect(wholePathCandidate("QUADRO-APORTES-STIMULUS-COMPLETO-R07.pdf")).toBe("QUADRO-APORTES-STIMULUS-COMPLETO-R07.pdf");
    expect(wholePathCandidate(win("historico", "2026-11-10-aportes.md"))).toBe(win("historico", "2026-11-10-aportes.md"));
    expect(wholePathCandidate("docs/My Notes/plan.docx")).toBe("docs/My Notes/plan.docx");
    expect(wholePathCandidate("~/notes/today.md")).toBe("~/notes/today.md");
    expect(wholePathCandidate("  /Users/example/a b.md ")).toBe("/Users/example/a b.md");
  });

  it("leaves code that is not a path to the usual reading", () => {
    for (const code of ["_14", "npm test", "const x = 1;", "a\nb.md", "https://example.com/a.md", "R$ 1.022.550,99", "", "x".repeat(4097)]) {
      expect(wholePathCandidate(code)).toBeUndefined();
    }
  });

  it("is used for inline code in a message, and only there", () => {
    expect(messageContentSource).toContain("<InlineCodeText text={token.text}");
    // A fenced block can hold many lines and commands; it keeps the token-by-token reading.
    expect(messageContentSource).toContain("<code><LinkifiedText text={block.text}");
  });

  it("shows the span as code until the native side confirms the file", () => {
    const html = renderToStaticMarkup(MessageContent({ content: "Veja `QUADRO-APORTES-R07.pdf`." }));
    expect(html).toContain("<code>QUADRO-APORTES-R07.pdf</code>");
  });
});
