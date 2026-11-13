import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { ModelIntentsPanel } from "../app/ModelIntentsPanel";
import { addModelIntent, createEmptyModelIntents, type ModelIntent } from "../domain/modelIntents";

const cssSource = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const everyday: ModelIntent = {
  id: "para-tarefas-cotidianas",
  label: "Para tarefas cotidianas",
  bindings: [{ model: { provider: "openai-codex", model: "gpt-5.5" }, thinkingLevel: "medium" }],
};

const hardest: ModelIntent = {
  id: "para-as-implementacoes-mais-dificeis",
  label: "Para as implementações mais difíceis",
  bindings: [{ model: { provider: "retired-bridge", model: "claude-fable-5-1" }, thinkingLevel: "high" }],
};

const catalog = [
  { provider: "openai-codex", model: "gpt-5.5", available: true, thinking: true },
  { provider: "retired-bridge", model: "claude-fable-5-1", available: false, thinking: true },
];

const modelOptions = catalog.map(({ provider, model }) => ({ provider, model }));

function render(intents = createEmptyModelIntents(), overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <ModelIntentsPanel
      intents={intents}
      catalog={catalog}
      modelOptions={modelOptions}
      defaultModelKey={"openai-codex\tgpt-5.5"}
      onChange={() => undefined}
      {...overrides}
    />,
  );
}

describe("model intents panel", () => {
  it("invites the first intent when none exist", () => {
    const html = render();
    expect(html).toContain("Model Intents");
    expect(html).toContain("name your first one");
    expect(html).not.toContain("model-intent-row");
    // The form is present even when empty, so creating the first one takes no extra step.
    expect(html).toContain("model-intent-form");
  });

  // CR078: the semantic layer never hides the mechanical one. In the list there is room, so
  // the binding is always-visible secondary text rather than a hover-only disclosure.
  it("shows the model and thinking level behind every label without hovering", () => {
    const html = render(addModelIntent(createEmptyModelIntents(), everyday));
    expect(html).toContain("Para tarefas cotidianas");
    expect(html).toContain("model-intent-binding");
    expect(html).toContain("openai-codex/gpt-5.5");
    expect(html).toContain("thinking medium");
    expect(cssSource).toContain(".model-intent-binding");
  });

  it("explains an intent whose model can no longer run", () => {
    const html = render(addModelIntent(createEmptyModelIntents(), hardest));
    expect(html).toContain("Para as implementações mais difíceis");
    expect(html).toContain("retired-bridge/claude-fable-5-1");
    expect(html).toContain("could not load");
  });

  it("names each row action after the intent it acts on", () => {
    const store = addModelIntent(addModelIntent(createEmptyModelIntents(), everyday), hardest);
    const html = render(store);
    expect(html).toContain('aria-label="Move Para tarefas cotidianas down"');
    expect(html).toContain('aria-label="Edit Para tarefas cotidianas"');
    expect(html).toContain('aria-label="Remove Para tarefas cotidianas"');
    // The ends cannot move past themselves; React emits `disabled` after `aria-label`.
    const firstUp = html.indexOf('aria-label="Move Para tarefas cotidianas up"');
    expect(html.slice(firstUp, firstUp + 120)).toContain("disabled");
    const lastDown = html.indexOf('aria-label="Move Para as implementações mais difíceis down"');
    expect(html.slice(lastDown, lastDown + 130)).toContain("disabled");
  });

  it("stops every control while a write is in flight", () => {
    const html = render(addModelIntent(createEmptyModelIntents(), everyday), { busy: true });
    expect(html.match(/disabled=""/gu)?.length ?? 0).toBeGreaterThan(4);
  });

  it("reports a failure from the parent", () => {
    const html = render(createEmptyModelIntents(), { message: "Could not publish model intents.", error: true });
    expect(html).toContain("Could not publish model intents.");
    expect(html).toContain('role="alert"');
  });
});

// CR256: a purpose keeps one name and a model per provider.
const serious: ModelIntent = {
  id: "execucao-seria",
  label: "Execução Séria",
  bindings: [
    { model: { provider: "openai-codex", model: "gpt-5.5" }, thinkingLevel: "high" },
    { model: { provider: "retired-bridge", model: "claude-fable-5-1" }, thinkingLevel: "pi-default" },
  ],
};

describe("CR256: a purpose with a model per provider in Settings", () => {
  it("lists every model behind the name, in provider order", () => {
    const store = { ...addModelIntent(createEmptyModelIntents(), serious), providerOrder: ["retired-bridge"] };
    const html = render(store);
    expect(html.match(/Execução Séria</gu)?.length).toBe(1);
    expect(html.indexOf("retired-bridge/claude-fable-5-1 · thinking pi-default"))
      .toBeLessThan(html.indexOf("openai-codex/gpt-5.5 · thinking high"));
  });

  it("lets the Navigator order the providers once there is more than one", () => {
    const html = render(addModelIntent(createEmptyModelIntents(), serious));
    expect(html).toContain("Provider order");
    expect(html).toContain('aria-label="Move openai-codex down"');
    expect(html).toContain('aria-label="Move retired-bridge up"');
    expect(render(addModelIntent(createEmptyModelIntents(), everyday))).not.toContain("Provider order");
  });

  it("offers a model from another provider in the form", () => {
    const html = render();
    expect(html).toContain("Add a model from another provider");
    expect(html).toContain("model-intent-binding-draft");
    // No provider names in the label: the form's own hint says where the provider goes.
    expect(html).not.toContain("[Anthropic]");
  });
});

describe("CR257: when to use an intent, in Settings", () => {
  it("shows the line under the name and offers it in the form", () => {
    const html = render(addModelIntent(createEmptyModelIntents(), { ...everyday, whenToUse: "Rotina interna que não pode falhar." }));
    expect(html).toContain('<span class="model-intent-use">Rotina interna que não pode falhar.</span>');
    expect(html).toContain("When to use");
    expect(html).toContain('maxLength="160"');
  });
});
