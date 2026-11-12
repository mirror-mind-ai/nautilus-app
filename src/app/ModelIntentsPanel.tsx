import { useState, type FormEvent } from "react";
import type { AgentThinkingLevel } from "../domain/agentProfile";
import {
  modelFromOptionValue,
  modelKeyUnavailableReason,
  modelOptionValue,
  modelSupportsThinking,
  thinkingOptions,
  unavailableModelReason,
  type ModelCapabilityEntry,
  type ModelSelection,
} from "../domain/modelAvailability";
import {
  MODEL_INTENTS_MAX,
  MODEL_INTENT_BINDINGS_MAX,
  MODEL_INTENT_LABEL_MAX_LENGTH,
  addModelIntent,
  createModelIntentId,
  modelIntentProviderOrder,
  moveModelIntentProvider,
  normalizeModelIntentLabel,
  orderedModelIntentBindings,
  removeModelIntent,
  reorderModelIntent,
  updateModelIntent,
  type ModelIntents,
} from "../domain/modelIntents";

type ModelIntentsPanelProps = {
  intents: ModelIntents;
  catalog: readonly ModelCapabilityEntry[];
  modelOptions: readonly ModelSelection[];
  /** Model the form starts from when composing a new intent. */
  defaultModelKey: string;
  busy?: boolean;
  message?: string;
  error?: boolean;
  onChange: (next: ModelIntents) => void;
};

/** One model of the intent being composed, as the form's selects hold it. */
type BindingDraft = {
  modelKey: string;
  thinking: AgentThinkingLevel;
};

// CR078: the Navigator's own vocabulary for choosing a model. The mutations live in the
// domain module and are exercised there; this component only composes drafts and delegates.
// CR256: an intent holds a model per provider, so the draft is a list of bindings.
export function ModelIntentsPanel({
  intents,
  catalog,
  modelOptions,
  defaultModelKey,
  busy = false,
  message,
  error = false,
  onChange,
}: ModelIntentsPanelProps) {
  const [editingId, setEditingId] = useState<string>();
  const [labelDraft, setLabelDraft] = useState("");
  const [bindingDrafts, setBindingDrafts] = useState<BindingDraft[]>(
    () => [{ modelKey: defaultModelKey, thinking: "pi-default" }],
  );
  const [draftError, setDraftError] = useState<string>();

  const full = intents.intents.length >= MODEL_INTENTS_MAX && !editingId;
  const providerOrder = modelIntentProviderOrder(intents);

  function resetDraft() {
    setEditingId(undefined);
    setLabelDraft("");
    setBindingDrafts([{ modelKey: defaultModelKey, thinking: "pi-default" }]);
    setDraftError(undefined);
  }

  function changeBinding(index: number, patch: Partial<BindingDraft>) {
    setBindingDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)));
    setDraftError(undefined);
  }

  function selectModel(index: number, next: string) {
    const thinking = bindingDrafts[index].thinking;
    // Mirrors the Journey dialog: a model that cannot think forces the level down, and it
    // happens here, while the pair is being bound, rather than later at selection time.
    const forced = !modelSupportsThinking(catalog, next) && !["pi-default", "off"].includes(thinking);
    changeBinding(index, { modelKey: next, ...(forced ? { thinking: "off" as const } : {}) });
  }

  // A new row starts on a provider the intent does not use yet, since one provider holds one model.
  function addBinding() {
    const used = new Set(bindingDrafts.map((draft) => modelFromOptionValue(draft.modelKey).provider));
    const fresh = modelOptions.find((model) => !used.has(model.provider) && !unavailableModelReason(catalog, model));
    setBindingDrafts((current) => [
      ...current,
      { modelKey: fresh ? modelOptionValue(fresh) : defaultModelKey, thinking: "pi-default" },
    ]);
  }

  function submitDraft(event: FormEvent) {
    event.preventDefault();
    try {
      const label = normalizeModelIntentLabel(labelDraft);
      const bindings = bindingDrafts.map((draft) => ({
        model: modelFromOptionValue(draft.modelKey),
        thinkingLevel: draft.thinking,
      }));
      onChange(editingId
        ? updateModelIntent(intents, editingId, { label, bindings })
        : addModelIntent(intents, { id: createModelIntentId(label, intents), label, bindings }));
      resetDraft();
    } catch (failure) {
      setDraftError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  return (
    <section className="settings-section model-intents-card" aria-label="Model Intents">
      <h3>Model Intents</h3>
      <p className="settings-intro">
        Name the configurations you reach for, in your own words. Each intent binds a model and
        a thinking level, so choosing one later cannot change the pair behind your back. An
        intent can hold a model from each provider you use, so one name serves on all of them.
      </p>

      {intents.intents.length === 0 ? (
        <p className="provider-note">
          No intents yet — name your first one below.
        </p>
      ) : (
        <ul className="model-intent-list">
          {intents.intents.map((intent, index) => (
            <li className="model-intent-row" key={intent.id}>
              <div className="model-intent-identity">
                <strong>{intent.label}</strong>
                {orderedModelIntentBindings(intents, intent).map((binding) => {
                  const reason = unavailableModelReason(catalog, binding.model);
                  return (
                    <span className="model-intent-binding" key={binding.model.provider}>
                      {binding.model.provider}/{binding.model.model} · thinking {binding.thinkingLevel}
                      {reason ? <span className="model-intent-unavailable"> {reason}</span> : null}
                    </span>
                  );
                })}
              </div>
              <div className="model-intent-actions">
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Move ${intent.label} up`}
                  disabled={busy || index === 0}
                  onClick={() => onChange(reorderModelIntent(intents, intent.id, "up"))}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Move ${intent.label} down`}
                  disabled={busy || index === intents.intents.length - 1}
                  onClick={() => onChange(reorderModelIntent(intents, intent.id, "down"))}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Edit ${intent.label}`}
                  disabled={busy}
                  onClick={() => {
                    setEditingId(intent.id);
                    setLabelDraft(intent.label);
                    setBindingDrafts(orderedModelIntentBindings(intents, intent).map((binding) => ({
                      modelKey: modelOptionValue(binding.model),
                      thinking: binding.thinkingLevel,
                    })));
                    setDraftError(undefined);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Remove ${intent.label}`}
                  disabled={busy}
                  onClick={() => {
                    if (editingId === intent.id) resetDraft();
                    onChange(removeModelIntent(intents, intent.id));
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {providerOrder.length > 1 ? (
        <div className="model-intent-providers">
          <h4>Provider order</h4>
          <p className="provider-note">
            Choosing an intent by its name uses the first provider here whose model can run.
          </p>
          <ol className="model-intent-list">
            {providerOrder.map((provider, index) => (
              <li className="model-intent-row" key={provider}>
                <span className="model-intent-identity">{provider}</span>
                <div className="model-intent-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={`Move ${provider} up`}
                    disabled={busy || index === 0}
                    onClick={() => onChange(moveModelIntentProvider(intents, provider, "up"))}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={`Move ${provider} down`}
                    disabled={busy || index === providerOrder.length - 1}
                    onClick={() => onChange(moveModelIntentProvider(intents, provider, "down"))}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <form className="model-intent-form" onSubmit={submitDraft}>
        <label className="provider-field">
          Name
          <input
            value={labelDraft}
            maxLength={MODEL_INTENT_LABEL_MAX_LENGTH}
            disabled={busy || full}
            onChange={(event) => { setLabelDraft(event.target.value); setDraftError(undefined); }}
          />
        </label>
        {bindingDrafts.map((draft, index) => (
          <fieldset className="model-intent-binding-draft" key={index}>
            <label className="provider-field">
              Model
              <select
                value={draft.modelKey}
                disabled={busy || full}
                onChange={(event) => selectModel(index, event.target.value)}
              >
                {modelOptions.map((model) => {
                  const unavailable = Boolean(unavailableModelReason(catalog, model));
                  return (
                    <option key={modelOptionValue(model)} value={modelOptionValue(model)} disabled={unavailable}>
                      {model.provider} / {model.model}{unavailable ? " — unavailable" : ""}
                    </option>
                  );
                })}
              </select>
              {modelKeyUnavailableReason(catalog, draft.modelKey) ? (
                <p className="provider-note">{modelKeyUnavailableReason(catalog, draft.modelKey)}</p>
              ) : null}
            </label>
            <label className="provider-field">
              Thinking level
              <select
                value={draft.thinking}
                disabled={busy || full}
                onChange={(event) => changeBinding(index, { thinking: event.target.value as AgentThinkingLevel })}
              >
                {thinkingOptions(catalog, draft.modelKey, draft.thinking).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            {bindingDrafts.length > 1 ? (
              <button
                type="button"
                className="secondary-button"
                aria-label={`Remove model ${index + 1}`}
                disabled={busy}
                onClick={() => setBindingDrafts((current) => current.filter((_, at) => at !== index))}
              >
                Remove model
              </button>
            ) : null}
          </fieldset>
        ))}
        <div className="provider-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy || full || bindingDrafts.length >= MODEL_INTENT_BINDINGS_MAX}
            onClick={addBinding}
          >
            Add a model from another provider
          </button>
        </div>
        <div className="provider-actions">
          <button type="submit" disabled={busy || full || !labelDraft.trim()}>
            {editingId ? "Save intent" : "Add intent"}
          </button>
          {editingId ? (
            <button className="secondary-button" type="button" disabled={busy} onClick={resetDraft}>Cancel</button>
          ) : null}
        </div>
        {full ? (
          <p className="provider-note">
            Model intents reached their limit of {MODEL_INTENTS_MAX}. Remove one to add another.
          </p>
        ) : null}
        {draftError ? <p className="settings-error" role="alert">{draftError}</p> : null}
      </form>

      {message ? (
        <p className={error ? "settings-error" : "provider-note"} role={error ? "alert" : "status"}>{message}</p>
      ) : null}
    </section>
  );
}
