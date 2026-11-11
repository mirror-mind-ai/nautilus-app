// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

// CR228 (PR #8): Recent's divider was drawn in the dark themes' ink only. On the light themes its
// word read at 2.4 to 2.7:1 and its rule, white at 12%, was not seen at all.

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function themeToken(theme: string, token: string): string {
  const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
  const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${theme} has no ${token}`);
  return value;
}

function opaque(colour: string): string {
  if (colour.startsWith("#")) return colour;
  const [r, g, b] = colour.match(/\d+(?:\.\d+)?/g)!.map(Number);
  return `#${[r, g, b].map((channel) => Math.round(channel!).toString(16).padStart(2, "0")).join("")}`;
}

function mix(left: string, right: string, leftShare: number): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const [a, b] = [channels(left), channels(right)];
  return `#${a.map((value, index) => Math.round(value * leftShare + b[index]! * (1 - leftShare)).toString(16).padStart(2, "0")).join("")}`;
}

const lightRule = (() => {
  const start = cssSource.indexOf("/* CR228: Recent's divider in the light themes. */");
  return start < 0 ? "" : cssSource.slice(start, cssSource.indexOf("/* CR228 end */", start));
})();

describe("CR228: Recent's divider reads in the light themes", () => {
  it("has a rule of its own for daylight, mist and parchment", () => {
    for (const theme of ["daylight", "mist", "parchment"]) {
      expect(lightRule).toContain(`.app-shell[data-application-theme="${theme}"]`);
    }
    expect(lightRule).toContain(".journey-list-divider");
  });

  it("writes its word at 4.5:1 or more on the sidebar of every light theme", () => {
    const share = Number(lightRule.match(/color:\s*color-mix\(in srgb, var\(--light-text\) (\d+)%, var\(--light-muted\)\)/)?.[1]);
    expect(share).toBeGreaterThan(0);
    for (const theme of ["daylight", "mist", "parchment"]) {
      const ink = mix(themeToken(theme, "--light-text"), themeToken(theme, "--light-muted"), share / 100);
      for (const surface of [opaque(themeToken(theme, "--sidebar-surface")), themeToken(theme, "--light-canvas"), themeToken(theme, "--light-surface")]) {
        expect(contrastRatio(ink, surface), `${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("draws its rule in the theme's border colour, not in white", () => {
    expect(lightRule).toMatch(/\.journey-list-divider::after\s*\{\s*border-top-color:\s*var\(--light-border\);/);
  });
});
