// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

// CR285 (PR #31): the prompt cache notice wrote its text in the dark themes' ink, a fixed pale
// colour, so on daylight, mist and parchment the notice and its receipt read as near white on
// white. Its amber was the dark themes' amber too, which CR209 had already found unreadable on a
// light surface.

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");
const lightThemes = ["daylight", "mist", "parchment"];

function rule(selector: string): string {
  const start = cssSource.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return cssSource.slice(start, cssSource.indexOf("}", start));
}

function themeToken(theme: string, token: string): string {
  const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
  const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${theme} has no ${token}`);
  return value;
}

function mix(left: string, right: string, leftShare: number): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const [a, b] = [channels(left), channels(right)];
  return `#${a.map((value, index) => Math.round(value * leftShare + b[index]! * (1 - leftShare)).toString(16).padStart(2, "0")).join("")}`;
}

const lightRule = (() => {
  const start = cssSource.indexOf("/* CR285: the prompt cache notice in the light themes.");
  return start < 0 ? "" : cssSource.slice(start, cssSource.indexOf("/* CR285 end */", start));
})();

describe("CR285: the prompt cache notice reads in the light themes", () => {
  it("writes the notice and its receipt in the theme's own ink, not in a fixed pale colour", () => {
    expect(rule(".prompt-cache-notice")).toMatch(/\bcolor:\s*var\(--ui-text\);/);
    expect(rule(".prompt-cache-receipt")).toMatch(/\bcolor:\s*var\(--ui-muted\);/);
    expect(rule(".prompt-cache-notice")).not.toContain("#d8e7eb");
    expect(rule(".prompt-cache-receipt")).not.toContain("216, 231, 235");
  });

  it("has an amber of its own for daylight, mist and parchment", () => {
    for (const theme of lightThemes) expect(lightRule).toContain(`[data-application-theme="${theme}"]`);
    expect(lightRule).toContain(".prompt-cache-notice.is-expired .prompt-cache-notice-clock");
    expect(lightRule).toContain(".prompt-cache-receipt.is-re-processed");
  });

  it("writes that amber at 4.5:1 or more on the expired notice of every light theme", () => {
    const ink = lightRule.match(/is-re-processed\s*\{\s*color:\s*(#[0-9a-f]{6});/i)?.[1];
    expect(ink).toBeDefined();
    for (const theme of lightThemes) {
      for (const surface of [themeToken(theme, "--light-canvas"), themeToken(theme, "--light-surface"), themeToken(theme, "--shell-end")]) {
        // The expired notice tints the surface with the same amber at 6%.
        const tinted = mix(ink!, surface, 0.06);
        expect(contrastRatio(ink!, tinted), `${theme} on ${tinted}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
