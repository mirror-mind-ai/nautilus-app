// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

// A refused attachment (too many files, a pasted image over its limit) is said on one line above
// the Composer, the line every attachment and voice error is said on. That line was written
// in the dark themes' pale red only, and the light themes never took it over: measured in the
// installed application at 1.68:1 on daylight and 1.75:1 on mist and parchment. A limit that is
// said where it cannot be read is not said.
describe("the line an attachment error is said on, in the light themes", () => {
  const themeToken = (theme: string, token: string): string => {
    const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
    const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) throw new Error(`${theme} has no ${token}`);
    return value;
  };
  // The light themes' rule for error lines: `) :where(.provider-error, …) { color: #…; }`.
  const ruleStart = cssSource.indexOf(") :where(.provider-error,");
  const rule = cssSource.slice(ruleStart, cssSource.indexOf("}", ruleStart));
  const ink = rule.match(/color:\s*(#[0-9a-f]{6});/i)?.[1] ?? "";

  it("takes the red the other error lines take there", () => {
    expect(ruleStart).toBeGreaterThan(0);
    expect(rule.slice(0, rule.indexOf("{"))).toContain(".context-attachment-error");
  });

  it("measures 4.5:1 or more on every light theme's surfaces, where the pale red measured under 2:1", () => {
    expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    for (const theme of ["daylight", "mist", "parchment"]) {
      for (const surface of [themeToken(theme, "--light-canvas"), themeToken(theme, "--light-surface")]) {
        expect(contrastRatio(ink, surface), `${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio("#ffada8", surface), `the pale red on ${surface}`).toBeLessThan(2);
      }
    }
  });
});
