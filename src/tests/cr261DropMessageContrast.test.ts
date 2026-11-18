// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../app/personaColour";

// CR261, iteration 2: the sentence after a Journey drop was written in the dark themes' pale green,
// pale blue and salmon. On the light sidebars the green read at about 1.6:1, which is to say it
// could not be seen.

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");
const LIGHT_THEMES = ["daylight", "mist", "parchment"];

function themeToken(theme: string, token: string): string {
  const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
  const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${theme} has no ${token}`);
  return value;
}

/** The registers the three light families share (CR106, CR102, CR151). */
function lightRegister(token: string): string {
  const start = cssSource.indexOf("/* CR106 light completion register.");
  const block = cssSource.slice(start, cssSource.indexOf("\n}\n", start));
  const value = block.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`the light register has no ${token}`);
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
  const start = cssSource.indexOf("/* CR261: the drop sentence in the light themes. */");
  return start < 0 ? "" : cssSource.slice(start, cssSource.indexOf("/* CR261 end */", start));
})();

describe("CR261: the sentence after a Journey drop reads in the light themes", () => {
  it("has a rule of its own for daylight, mist and parchment, for each of its three states", () => {
    for (const theme of LIGHT_THEMES) expect(lightRule).toContain(`[data-application-theme="${theme}"]`);
    for (const state of ["completed", "refused", "moving"]) expect(lightRule).toContain(`.journey-drop-hint.${state}`);
  });

  it("takes its colours from the light registers instead of repeating a hex", () => {
    expect(lightRule).toMatch(/\.journey-drop-hint\.completed\s*\{\s*color:\s*var\(--ui-success\);/);
    expect(lightRule).toMatch(/\.journey-drop-hint\.refused\s*\{\s*color:\s*var\(--ui-danger\);/);
    expect(lightRule).toMatch(/\.journey-drop-hint\.moving\s*\{\s*color:\s*color-mix\(in srgb, var\(--light-text\) \d+%, var\(--light-muted\)\);/);
  });

  it("reads at 4.5:1 or more on every surface the sidebar sits on, in every light theme", () => {
    // The wait is neutral, so it is the muted ink drawn toward the text ink: --light-muted alone is
    // 4.44:1 on daylight's sidebar, a hair under.
    const share = Number(lightRule.match(/color-mix\(in srgb, var\(--light-text\) (\d+)%, var\(--light-muted\)\)/)?.[1]);
    expect(share).toBeGreaterThan(0);
    for (const theme of LIGHT_THEMES) {
      const inks = {
        completed: lightRegister("--ui-success"),
        refused: lightRegister("--ui-danger"),
        moving: mix(themeToken(theme, "--light-text"), themeToken(theme, "--light-muted"), share / 100),
      };
      const surfaces = [opaque(themeToken(theme, "--sidebar-surface")), themeToken(theme, "--light-canvas"), themeToken(theme, "--light-surface")];
      for (const [state, ink] of Object.entries(inks)) {
        for (const surface of surfaces) {
          expect(contrastRatio(ink, surface), `${theme} ${state} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("leaves the dark themes' colours as they were", () => {
    expect(cssSource).toContain(".journey-drop-hint.completed { color: #9fd4a8; }");
    expect(cssSource).toContain(".journey-drop-hint.moving { color: #cfe3e7; }");
    expect(cssSource).toContain(".journey-drop-hint.refused { color: #e2957f; }");
  });
});
