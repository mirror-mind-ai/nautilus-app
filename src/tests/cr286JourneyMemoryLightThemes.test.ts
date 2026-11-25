// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

// CR286 (PR #30): the Journey memory panel was drawn in the dark themes' ink only. Its text was a
// fixed pale colour and its rules white at 8 to 16%, so on daylight, mist and parchment it read as
// white on white, the defect CR151 repaired once across the app. It now follows the chapter index
// it is modelled on, which has a light rule of its own.

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");
const lightThemes = ["daylight", "mist", "parchment"];

function themeToken(theme: string, token: string): string {
  const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
  const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${theme} has no ${token}`);
  return value;
}

const lightRule = (() => {
  const start = cssSource.indexOf("/* CR286: the Journey memory panel in the light themes.");
  return start < 0 ? "" : cssSource.slice(start, cssSource.indexOf("/* CR286 end */", start));
})();

describe("CR286: the Journey memory panel reads in the light themes", () => {
  it("has a rule of its own for daylight, mist and parchment", () => {
    for (const theme of lightThemes) expect(lightRule).toContain(`[data-application-theme="${theme}"]`);
  });

  it("gives the panel, its secondary text and its content the theme's ink", () => {
    expect(lightRule).toMatch(/\.journey-memory-panel\s*\{[^}]*color:\s*var\(--light-text\);/);
    expect(lightRule).toMatch(/\.journey-memory-content\s*\{\s*color:\s*var\(--light-text\);/);
    for (const selector of [".journey-memory-head span", ".journey-memory-foot", ".journey-memory-empty", ".journey-memory-group h3 small", ".journey-memory-meta"]) {
      expect(lightRule).toContain(selector);
    }
    expect(lightRule).toMatch(/\.journey-memory-meta\s*\{\s*color:\s*var\(--light-muted\);/);
  });

  it("draws the item, tag and foot rules in the theme's border colours, not in white", () => {
    expect(lightRule).toMatch(/\.journey-memory-item\s*\{[^}]*border-color:\s*var\(--light-soft-border\);/);
    expect(lightRule).toMatch(/\.journey-memory-tag\s*\{\s*border-color:\s*var\(--light-border\);/);
    expect(lightRule).toMatch(/\.journey-memory-foot\s*\{\s*border-top-color:\s*var\(--light-soft-border\);/);
    expect(lightRule).not.toContain("255, 255, 255");
  });

  it("keeps its links in the accent: they opt out of the light themes' white ink for filled buttons", () => {
    // Rendered, "Open the conversation" was white on white in all three light themes. The guard in
    // themeTokenContract.test.ts finds transparent controls coloured `var(--text…)`; this link is
    // coloured with the accent, so it slipped past.
    const whiteInk = cssSource.slice(cssSource.indexOf(") :where(button:not(.secondary-button"));
    const exclusionList = whiteInk.slice(0, whiteInk.indexOf("{"));
    expect(exclusionList).toMatch(/\.journey-memory-link[,)]/);
  });

  it("writes its secondary text at 4.5:1 or more on every light theme's panel", () => {
    for (const theme of lightThemes) {
      for (const surface of [themeToken(theme, "--light-surface"), themeToken(theme, "--light-canvas")]) {
        expect(contrastRatio(themeToken(theme, "--light-muted"), surface), `${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
