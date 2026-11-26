// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

// The label of a Settings checkbox (`.provider-check`) was written in a fixed pale ink, `#c6dce2`,
// the dark themes' colour. PR #31 put "Prompt cache notices" under Settings › You › Advanced with
// that class, on a card the light themes paint white: measured in the installed application at
// 1.41:1 on daylight and mist and 1.38:1 on parchment, the name of the setting could not be read.
// The two checkboxes of "Current session controls" carry the same class.

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");
const appSource: string = readFileSync(new URL("../app/App.tsx", import.meta.url), "utf8");
const lightThemes = ["daylight", "mist", "parchment"];
const paleInk = "#c6dce2";

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

describe("the label of a Settings checkbox reads in the light themes", () => {
  it("is still what names the prompt cache setting", () => {
    const advanced = appSource.slice(appSource.indexOf('aria-label="Advanced"'));
    expect(advanced.slice(0, advanced.indexOf("</section>"))).toMatch(/<label className="provider-check">[\s\S]*Prompt cache notices/);
  });

  it("is written in the theme's own ink, not in a fixed pale colour", () => {
    expect(rule(".provider-check")).toMatch(/\bcolor:\s*var\(--ui-text\);/);
    expect(rule(".provider-check")).not.toContain(paleInk);
  });

  it("measures 4.5:1 or more on the surfaces of every light theme, where the pale ink measured under 1.5:1", () => {
    for (const theme of lightThemes) {
      // `--ui-text` is `--light-text` in the light families (CR151).
      const ink = themeToken(theme, "--light-text");
      for (const surface of [themeToken(theme, "--light-surface"), themeToken(theme, "--light-canvas")]) {
        expect(contrastRatio(ink, surface), `${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(paleInk, surface), `the pale ink on ${surface}`).toBeLessThan(1.5);
      }
    }
  });
});
