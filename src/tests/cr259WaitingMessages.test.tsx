import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WaitingMessages } from "../app/WaitingMessages";

const noop = () => undefined;
const handlers = { onRemove: noop, onSendNow: noop, onReturnToComposer: noop };

describe("CR259: the waiting messages above the Composer", () => {
  it("renders nothing without a queue", () => {
    expect(renderToStaticMarkup(<WaitingMessages canSend={false} {...handlers} />)).toBe("");
  });

  it("lists what waits, each removable, and says when it leaves", () => {
    const html = renderToStaticMarkup(
      <WaitingMessages queue={{ items: ["first", "second"], state: "waiting" }} canSend={false} {...handlers} />,
    );
    expect(html).toContain('aria-label="Messages waiting for the compaction"');
    expect(html).toContain("2 messages waiting.");
    expect(html).toContain("as one message when the compaction ends");
    expect(html).toContain("<p class=\"waiting-message-text\">first</p>");
    expect(html).toContain('aria-label="Remove waiting message 2"');
    expect(html).not.toContain("Send now");
  });

  it("a held queue says why and offers sending it or taking it back", () => {
    const held = renderToStaticMarkup(
      <WaitingMessages
        queue={{ items: ["only"], state: "held", heldReason: "The compaction failed: boom." }}
        canSend
        {...handlers}
      />,
    );
    expect(held).toContain("1 message waiting.");
    expect(held).toContain("The compaction failed: boom.");
    expect(held).toContain(">Send now</button>");
    expect(held).toContain(">Back to the composer</button>");
    expect(held).not.toMatch(/<button[^>]*disabled[^>]*>Send now/);

    const blocked = renderToStaticMarkup(
      <WaitingMessages queue={{ items: ["only"], state: "held", heldReason: "x" }} canSend={false} {...handlers} />,
    );
    expect(blocked).toMatch(/<button[^>]*disabled[^>]*>Send now/);
  });

  it("a queue on its way offers nothing to change", () => {
    const html = renderToStaticMarkup(
      <WaitingMessages queue={{ items: ["a"], state: "sending" }} canSend={false} {...handlers} />,
    );
    expect(html).toContain("Sending to the agent");
    expect(html).not.toContain("<button");
  });
});
