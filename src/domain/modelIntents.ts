// CR078: a Model Intent binds a Navigator-authored purpose to the configuration that serves
// it, adding a second semantic level above the Pi catalog without changing the first.
//
// This lives outside `agent-settings.json` on purpose. That file validates by exact key
// allowlist as a secret-exclusion guard, and its value rule admits neither spaces nor
// accents, so it cannot express a label a person would write. Intent labels are human text
// and get validation shaped for that; machine identifiers keep the stricter rule.
//
// CR256: a purpose is served by up to one model per provider. Before, an intent was exactly one
// model, so keeping a purpose on a second provider took a second intent with the provider written
// into its name. Choosing an intent by its name uses the first provider, in the Navigator's
// provider order, whose model can run.
//
// CR257: a short name cannot say when to choose it, so an intent may carry a line that does.
// The file says 2.1.0 only while some intent carries one; without them it stays 2.0.0, which an
// app from before this change can still read.
import { agentThinkingLevels, validAgentModelId, type AgentModelSelection, type AgentThinkingLevel } from "./agentProfile";
import { unavailableModelReason, type ModelAvailabilityEntry } from "./modelAvailability";

export const MODEL_INTENT_LABEL_MAX_LENGTH = 80;
export const MODEL_INTENTS_MAX = 12;
export const MODEL_INTENT_BINDINGS_MAX = 4;
export const MODEL_INTENT_USE_MAX_LENGTH = 160;

const INTENT_ID = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/u;
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$/u;
// Control characters and the two Unicode line separators: the things a label must not hide.
// Kept to exactly what Rust's `char::is_control` plus U+2028/U+2029 expresses, so the
// TypeScript and native validators cannot drift apart.
const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}]/u;

const ROOT_KEYS = new Set(["schemaVersion", "providerOrder", "intents"]);
const INTENT_KEYS = new Set(["id", "label", "bindings"]);
const OPTIONAL_USE_KEY = "whenToUse";
const BINDING_KEYS = new Set(["model", "thinkingLevel"]);
const MODEL_KEYS = new Set(["provider", "model"]);
// The 1.0.0 shape, read so an existing store opens unchanged and is written back as 2.0.0.
const LEGACY_ROOT_KEYS = new Set(["schemaVersion", "intents"]);
const LEGACY_INTENT_KEYS = new Set(["id", "label", "model", "thinkingLevel"]);

export type ModelIntentBinding = {
  model: AgentModelSelection;
  thinkingLevel: AgentThinkingLevel;
};

export type ModelIntent = {
  id: string;
  label: string;
  bindings: ModelIntentBinding[];
  /** CR257: when the Navigator chooses this intent, in their words. */
  whenToUse?: string;
};

export type ModelIntents = {
  schemaVersion: "2.0.0" | "2.1.0";
  /** Providers in the Navigator's order of preference; the rest follow in order of first use. */
  providerOrder: string[];
  intents: ModelIntent[];
};

export type ModelIntentMatch = {
  intent: ModelIntent;
  binding: ModelIntentBinding;
};

export function createEmptyModelIntents(): ModelIntents {
  return { schemaVersion: "2.0.0", providerOrder: [], intents: [] };
}

/** Trims the label and collapses internal whitespace runs, so stored labels are canonical. */
export function normalizeModelIntentLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/**
 * Derives a readable identity from the label so the stored file can be read by a person.
 * The identity is assigned once and never re-derived, so renaming an intent keeps its row.
 */
export function createModelIntentId(label: string, store: ModelIntents): string {
  const slug = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60)
    .replace(/-+$/gu, "");
  const base = INTENT_ID.test(slug) ? slug : "intent";
  if (!store.intents.some((intent) => intent.id === base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!store.intents.some((intent) => intent.id === candidate)) return candidate;
  }
}

export function addModelIntent(store: ModelIntents, intent: ModelIntent): ModelIntents {
  const parsed = parseModelIntent(intent, true);
  if (store.intents.some((existing) => existing.id === parsed.id)) {
    throw new Error("Model intent identity is already used.");
  }
  if (store.intents.length >= MODEL_INTENTS_MAX) {
    throw new Error("Model intents reached their limit.");
  }
  return versioned({ ...store, intents: [...store.intents, parsed] });
}

export function updateModelIntent(
  store: ModelIntents,
  id: string,
  patch: Partial<Omit<ModelIntent, "id">>,
): ModelIntents {
  const index = store.intents.findIndex((intent) => intent.id === id);
  if (index < 0) throw new Error("Model intent does not exist.");
  const next = parseModelIntent({ ...store.intents[index], ...patch }, true);
  const intents = [...store.intents];
  intents[index] = next;
  return versioned({ ...store, intents });
}

export function removeModelIntent(store: ModelIntents, id: string): ModelIntents {
  return versioned({ ...store, intents: store.intents.filter((intent) => intent.id !== id) });
}

export function reorderModelIntent(
  store: ModelIntents,
  id: string,
  direction: "up" | "down",
): ModelIntents {
  const index = store.intents.findIndex((intent) => intent.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= store.intents.length) return store;
  const intents = [...store.intents];
  [intents[index], intents[target]] = [intents[target], intents[index]];
  return { ...store, intents };
}

/**
 * The providers the intents use, the Navigator's order first and the rest in order of first use.
 * A provider no intent uses any more drops out instead of lingering in the order.
 */
export function modelIntentProviderOrder(store: ModelIntents): string[] {
  const used: string[] = [];
  for (const intent of store.intents) {
    for (const binding of intent.bindings) {
      if (!used.includes(binding.model.provider)) used.push(binding.model.provider);
    }
  }
  return [
    ...store.providerOrder.filter((provider) => used.includes(provider)),
    ...used.filter((provider) => !store.providerOrder.includes(provider)),
  ];
}

/** Moves a provider one place and stores the whole order that results. */
export function moveModelIntentProvider(
  store: ModelIntents,
  provider: string,
  direction: "up" | "down",
): ModelIntents {
  const order = modelIntentProviderOrder(store);
  const index = order.indexOf(provider);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= order.length) return store;
  [order[index], order[target]] = [order[target], order[index]];
  return { ...store, providerOrder: order };
}

export function orderedModelIntentBindings(store: ModelIntents, intent: ModelIntent): ModelIntentBinding[] {
  const order = modelIntentProviderOrder(store);
  return [...intent.bindings].sort(
    (left, right) => order.indexOf(left.model.provider) - order.indexOf(right.model.provider),
  );
}

/** The binding choosing the intent by its name uses: the first in provider order that can run. */
export function resolveModelIntent(
  store: ModelIntents,
  intent: ModelIntent,
  catalog: readonly ModelAvailabilityEntry[],
): ModelIntentBinding | undefined {
  return orderedModelIntentBindings(store, intent)
    .find((binding) => !unavailableModelReason(catalog, binding.model));
}

/**
 * The footer names an intent only when the effective configuration matches one of its bindings
 * exactly. A partial match would claim a purpose the configuration does not actually serve.
 */
export function matchModelIntent(store: ModelIntents, profile: ModelIntentBinding): ModelIntentMatch | undefined {
  for (const intent of store.intents) {
    const binding = intent.bindings.find((candidate) => (
      candidate.model.provider === profile.model.provider
      && candidate.model.model === profile.model.model
      && candidate.thinkingLevel === profile.thinkingLevel
    ));
    if (binding) return { intent, binding };
  }
  return undefined;
}

export function parseModelIntents(value: unknown): ModelIntents {
  const root = objectRecord(value, "Model intents root");
  const legacy = root.schemaVersion === "1.0.0";
  const withUse = root.schemaVersion === "2.1.0";
  if (!legacy && !withUse && root.schemaVersion !== "2.0.0") {
    throw new Error("Model intents schema version is unsupported.");
  }
  exactKeys(root, legacy ? LEGACY_ROOT_KEYS : ROOT_KEYS, "Model intents root");
  if (!Array.isArray(root.intents)) throw new Error("Model intents collection is invalid.");
  if (root.intents.length > MODEL_INTENTS_MAX) throw new Error("Model intents reached their limit.");

  const intents = root.intents.map((intent) => (
    legacy ? parseLegacyModelIntent(intent) : parseModelIntent(intent, withUse)
  ));
  const identities = new Set<string>();
  for (const intent of intents) {
    if (identities.has(intent.id)) throw new Error("Model intent identity is already used.");
    identities.add(intent.id);
  }
  return versioned({
    schemaVersion: "2.0.0",
    providerOrder: legacy ? [] : parseProviderOrder(root.providerOrder),
    intents,
  });
}

export function serializeModelIntents(store: ModelIntents): string {
  return JSON.stringify(parseModelIntents(versioned(store)), null, 2);
}

/** 2.1.0 exactly while some intent carries a line saying when to use it. */
function versioned(store: ModelIntents): ModelIntents {
  const schemaVersion = store.intents.some((intent) => intent.whenToUse) ? "2.1.0" : "2.0.0";
  return { ...store, schemaVersion };
}

function parseModelIntent(value: unknown, withUse: boolean): ModelIntent {
  const intent = objectRecord(value, "Model intent");
  const { [OPTIONAL_USE_KEY]: rawUse, ...required } = intent;
  exactKeys(withUse ? required : intent, INTENT_KEYS, "Model intent");
  if (!Array.isArray(intent.bindings) || intent.bindings.length === 0) {
    throw new Error("Model intent needs a model.");
  }
  if (intent.bindings.length > MODEL_INTENT_BINDINGS_MAX) throw new Error("Model intent has too many models.");
  const bindings = intent.bindings.map((binding) => parseBinding(binding));
  const providers = new Set(bindings.map((binding) => binding.model.provider));
  if (providers.size !== bindings.length) throw new Error("Model intent uses a provider twice.");
  const whenToUse = rawUse === undefined ? "" : parseUse(rawUse);
  return { ...parseIdentity(intent), bindings, ...(whenToUse ? { whenToUse } : {}) };
}

function parseUse(value: unknown): string {
  if (typeof value !== "string" || CONTROL_CHARACTER.test(value)) throw new Error("Model intent use is invalid.");
  const use = normalizeModelIntentLabel(value);
  if (use.length > MODEL_INTENT_USE_MAX_LENGTH) throw new Error("Model intent use is invalid.");
  return use;
}

function parseLegacyModelIntent(value: unknown): ModelIntent {
  const intent = objectRecord(value, "Model intent");
  exactKeys(intent, LEGACY_INTENT_KEYS, "Model intent");
  return {
    ...parseIdentity(intent),
    bindings: [{ model: parseModel(intent.model), thinkingLevel: parseThinkingLevel(intent.thinkingLevel) }],
  };
}

function parseIdentity(intent: Record<string, unknown>): { id: string; label: string } {
  if (typeof intent.id !== "string" || !INTENT_ID.test(intent.id)) {
    throw new Error("Model intent identity is invalid.");
  }
  if (typeof intent.label !== "string") throw new Error("Model intent label is invalid.");
  const label = normalizeModelIntentLabel(intent.label);
  if (!label || label.length > MODEL_INTENT_LABEL_MAX_LENGTH || CONTROL_CHARACTER.test(intent.label)) {
    throw new Error("Model intent label is invalid.");
  }
  return { id: intent.id, label };
}

function parseBinding(value: unknown): ModelIntentBinding {
  const binding = objectRecord(value, "Model intent binding");
  exactKeys(binding, BINDING_KEYS, "Model intent binding");
  return { model: parseModel(binding.model), thinkingLevel: parseThinkingLevel(binding.thinkingLevel) };
}

function parseProviderOrder(value: unknown): string[] {
  if (
    !Array.isArray(value)
    || value.length > MODEL_INTENTS_MAX * MODEL_INTENT_BINDINGS_MAX
    || value.some((provider) => typeof provider !== "string" || !validProvider(provider))
    || new Set(value).size !== value.length
  ) {
    throw new Error("Model intents provider order is invalid.");
  }
  return [...value] as string[];
}

function validProvider(value: string): boolean {
  return SAFE_VALUE.test(value) && !value.includes("/");
}

function parseModel(value: unknown): AgentModelSelection {
  const model = objectRecord(value, "Model intent model");
  exactKeys(model, MODEL_KEYS, "Model intent model");
  if (typeof model.provider !== "string" || !validProvider(model.provider)) {
    throw new Error("Model intent provider is invalid.");
  }
  if (typeof model.model !== "string" || !validAgentModelId(model.model)) {
    throw new Error("Model intent model is invalid.");
  }
  return { provider: model.provider, model: model.model };
}

function parseThinkingLevel(value: unknown): AgentThinkingLevel {
  if (typeof value !== "string" || !agentThinkingLevels.includes(value as AgentThinkingLevel)) {
    throw new Error("Model intent thinking level is invalid.");
  }
  return value as AgentThinkingLevel;
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${label} contains an unsupported field.`);
  }
  for (const key of allowed) {
    if (!(key in record)) throw new Error(`${label} is missing a required field.`);
  }
}
