import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComposerRuntimeFooter } from "../app/ComposerRuntimeFooter";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const start = cssSource.indexOf(`\n${selector} {`);
  expect(start, `${selector} has its own rule`).toBeGreaterThanOrEqual(0);
  return cssSource.slice(start, cssSource.indexOf("}", start));
}

const longLabel = "Execução Séria e Sensível ao Longo Prazo";

function renderFooter() {
  return renderToStaticMarkup(
    <ComposerRuntimeFooter
      onSelectProviderModel={() => undefined}
      providerModel="claude-bridge/claude-opus-5-5"
      modelDisplayName="claude-opus-5-5"
      activeIntentLabel={longLabel}
    />,
  );
}

// CR255: a long intent name was cut at 260px in the footer, so the Navigator saw neither the
// whole purpose nor, past it, the model that would run.
describe("CR255: the intent's name in the Composer footer", () => {
  it("gives the name its own element, so only the name gives way when space runs out", () => {
    const html = renderFooter();
    expect(html).toContain(`<span class="composer-model-intent-label">${longLabel}</span>`);
    expect(html.indexOf("composer-model-intent-label")).toBeLessThan(html.indexOf("composer-model-identity"));
  });

  it("offers the whole phrase to the pointer, not only the binding", () => {
    expect(renderFooter()).toContain(`title="${longLabel} with claude-bridge/claude-opus-5-5"`);
  });

  it("has no fixed width cap on the model control, and lets it shrink within its line", () => {
    const control = rule(".composer-provider-model");
    expect(control).not.toContain("260px");
    expect(control).toContain("max-width: 100%");
    expect(control).toContain("min-width: 0");
    const capped = cssSource.slice(
      cssSource.indexOf(".composer-runtime-metadata span:last-child"),
      cssSource.indexOf("{", cssSource.indexOf(".composer-runtime-metadata span:last-child")),
    );
    expect(capped).not.toContain(".composer-provider-model");
    const wrap = rule(".model-intent-menu-wrap");
    expect(wrap).toContain("min-width: 0");
    expect(wrap).toContain("max-width: 100%");
  });

  it("cuts the name with an ellipsis and keeps the model whole", () => {
    const name = rule(".composer-model-intent-label");
    expect(name).toContain("text-overflow: ellipsis");
    expect(name).toContain("min-width: 0");
    expect(rule(".composer-model-identity")).toContain("flex-shrink: 0");
    // The control lays out as a flex container, which does not pass its underline to its items.
    expect(rule(".composer-provider-model > span")).toContain("text-decoration: inherit");
  });
});
