// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Speech } from "../app/Speech";
import { MessageContent } from "../app/MessageContent";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// CR254: CR213's rule for the bubble's own copy action matched every copy action inside the bubble.
// The quoted draft's "Copy text" pill was squeezed into a 26px circle with its label spilling out,
// and a code block's copy action was hidden until hover and moved to the bubble's corner.
describe("CR254: the bubble's copy rule touches only the bubble's own action", () => {
  it("scopes every bubble copy rule to the bubble's direct child", () => {
    const selectors = [...cssSource.matchAll(/([^{}]*\.speech-bubble[^{}]*\.message-copy-action[^{}]*)\{/g)].map((match) => match[1]);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        if (part.includes(".message-copy-action")) expect(part).toMatch(/\.speech-bubble(?::[a-z-]+)?\s*>\s*\.message-copy-action/);
      }
    }
  });

  it("renders the bubble's action as its direct child, and the quote's and code's actions deeper", () => {
    const html = renderToStaticMarkup(
      <Speech side="agent" speaker={{ label: "Agent", avatar: "π", kind: "agent" }} copyBody="Corpo">
        <MessageContent content={"> Rascunho\n\n```\ncódigo\n```"} copyCodeBlocks />
      </Speech>,
    );
    expect(html).toMatch(/class="speech-bubble"><button[^>]*class="message-copy-action"/);
    expect(html).toContain("message-copy-action message-copy-ready-action");
    expect(html).toContain("message-copy-action message-code-block-copy-action");
  });
});
