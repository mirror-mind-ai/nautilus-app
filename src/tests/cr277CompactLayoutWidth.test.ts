import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("CR277: the Compact layout keeps the conversation inside the window", () => {
  it("never lets the conversation column grow past the shell", () => {
    // The Compact header lays its parts on one line; with an implicit `auto` column the line's
    // full width became the column's floor, and the column grew past the window.
    expect(rule(".chat-shell")).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("clips the shell so following the conversation cannot scroll it sideways", () => {
    // `overflow: hidden` still lets `scrollIntoView` scroll the shell, and nothing scrolls it back.
    const shell = rule(".app-shell");
    expect(shell).toContain("overflow: hidden;");
    expect(shell.indexOf("overflow: clip;")).toBeGreaterThan(shell.indexOf("overflow: hidden;"));
  });
});
