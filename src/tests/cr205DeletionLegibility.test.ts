import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import appSource from "../app/App.tsx?raw";
import { journeyAdminHeading } from "../domain/journeyMutation";

// RS028 / CR205: the Delete Journey dialog's list is read in the theme's own text colours, on every
// theme, and the Journey that will be deleted is the dialog's title.

const css = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");
const FLOOR = 4.5;

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  const hex = value.trim().replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

function token(block: string, name: string): Rgb {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(rule(block));
  expect(match, `${block} ${name}`).not.toBeNull();
  return parseHex(match![1]);
}

describe("CR205: the deletion list reads on every theme", () => {
  it("takes its colours from the theme, never a fixed one", () => {
    const list = rule(".journey-deletion-list");
    expect(list).toMatch(/color:\s*var\(--text\);/);
    expect(list).not.toMatch(/color:\s*#/);
    // The folder's notes say the files go for good: a warning, not a quieter line.
    expect(rule(".journey-deletion-folder small")).toMatch(/color:\s*var\(--text\);/);
    expect(rule(".journey-deletion-loading")).toMatch(/color:\s*var\(--text-muted\);/);
  });

  it("reaches 4.5:1 for every line of the list, and for the loading line on the dialog, light and dark", () => {
    for (const theme of ["daylight", "mist", "parchment"]) {
      const block = `.app-shell[data-application-theme="${theme}"]`;
      const surface = token(block, "--light-surface");
      for (const background of [surface, parseHex("#ffffff"), parseHex("#f6f7f9"), parseHex("#f4f1ea")]) {
        expect(contrast(token(block, "--light-text"), background), `${theme} text`).toBeGreaterThanOrEqual(FLOOR);
      }
      expect(contrast(token(block, "--light-muted"), surface), `${theme} muted`).toBeGreaterThanOrEqual(FLOOR);
    }
    // The dark dialog's surface, `rgba(13, 18, 20, 0.98)`, read as opaque.
    const darkSurface: Rgb = [13, 18, 20];
    for (const ink of ["--text", "--text-muted"]) {
      expect(contrast(token(".app-shell", ink), darkSurface), ink).toBeGreaterThanOrEqual(FLOOR);
    }
  });
});

describe("CR205: the Journey that goes is the title", () => {
  it("names the Journey in the delete dialog's title, and changes no other title", () => {
    expect(journeyAdminHeading("delete", "nova")).toEqual({ eyebrow: "Delete Journey", title: "nova" });
    expect(journeyAdminHeading("delete", undefined)).toEqual({ eyebrow: "Journey safety", title: "Delete Journey" });
    expect(journeyAdminHeading("create", "nova")).toEqual({ eyebrow: "Journey details", title: "Create Journey" });
    expect(journeyAdminHeading("edit", "nova")).toEqual({ eyebrow: "Journey details", title: "Edit Journey" });
    expect(journeyAdminHeading("move", "nova")).toEqual({ eyebrow: "Journey organization", title: "Move Journey" });
  });

  it("wraps a long name rather than cutting it", () => {
    expect(rule(".journey-admin-dialog .settings-header h2")).toMatch(/overflow-wrap:\s*anywhere;/);
    for (const part of ["eyebrow", "title"]) {
      expect(appSource).toContain(`journeyAdminHeading(journeyAdminDialog.mode, journeyAdminTargetName).${part}`);
    }
  });
});
