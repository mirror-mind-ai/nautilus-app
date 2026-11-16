// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
import { describe, expect, it } from "vitest";

const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function px(block: string, property: string): number {
  const match = block.match(new RegExp(`\\n\\s*${property}:\\s*(\\d+)px`));
  expect(match, `${property} in ${block}`).not.toBeNull();
  return Number(match![1]);
}

describe("CR260 iteration 1: one compact browsing surface", () => {
  it("draws the tree and the viewer as one surface, with no gap between them", () => {
    const layout = rule(".operational-artifacts-layout");
    expect(layout).toMatch(/\n\s*gap: 0;/);
    expect(layout).toContain("background:");
    expect(layout).toContain("border: 1px solid");
    expect(layout).toContain("overflow: hidden");
  });

  it("stops painting each panel as its own card and separates them by a hairline", () => {
    const panels = rule(".operational-artifacts-browser,\n.operational-artifact-document-viewer");
    expect(panels).not.toContain("border-radius");
    expect(panels).not.toContain("border: 1px solid");
    expect(rule(".operational-artifacts-browser")).toContain("border-right: 1px solid");
  });

  it("tightens the tree rows and the surrounding margin", () => {
    expect(px(rule(".journey-documentation-toggle,\n.journey-documentation-file-mark"), "height")).toBeLessThanOrEqual(26);
    expect(rule(".journey-documentation-select")).toMatch(/\n\s*padding: [0-4]px /);
    expect(px(rule(".operational-artifacts-workspace"), "margin")).toBeLessThanOrEqual(16);
  });

  it("gives the light families the shared surface, not two cards", () => {
    expect(css).toMatch(/\) :where\(\.operational-artifacts-layout\) \{\n\s*background: linear-gradient\(160deg, var\(--light-surface\), var\(--light-raised\)\);/);
    expect(css).not.toContain(":where(.operational-artifacts-browser, .operational-artifact-document-viewer) {");
  });
});
