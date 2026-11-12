import {
  unavailableModelReason,
  type ModelCapabilityEntry,
} from "../domain/modelAvailability";
import {
  orderedModelIntentBindings,
  resolveModelIntent,
  type ModelIntent,
  type ModelIntentBinding,
  type ModelIntents,
} from "../domain/modelIntents";

type ModelIntentMenuProps = {
  intents: ModelIntents;
  catalog: readonly ModelCapabilityEntry[];
  /** Intent the Journey's effective profile currently matches, when one does. */
  activeIntentId?: string;
  /** CR256: the provider of the matched intent's binding in use. */
  activeProvider?: string;
  usingGlobalDefault: boolean;
  globalModelLabel: string;
  /** The configuration in force, named when no entry in this menu represents it. */
  currentBinding?: string;
  /** CR154: true when this conversation holds a choice of its own rather than following its Journey. */
  conversationOwnsChoice: boolean;
  /** What this conversation would use if it stopped holding a choice of its own. */
  journeyDefaultLabel: string;
  onSelectIntent: (intent: ModelIntent, binding: ModelIntentBinding) => void;
  onFollowJourneyDefault: () => void;
  onUseGlobalDefaults: () => void;
  onOpenFullSelector: () => void;
};

// CR078: the consumption point for the semantic layer. The Navigator's order decides what
// sits nearest, and every entry keeps its binding legible so the label never hides the
// configuration it stands for.
export function ModelIntentMenu({
  intents,
  catalog,
  activeIntentId,
  activeProvider,
  usingGlobalDefault,
  globalModelLabel,
  currentBinding,
  conversationOwnsChoice,
  journeyDefaultLabel,
  onSelectIntent,
  onFollowJourneyDefault,
  onUseGlobalDefaults,
  onOpenFullSelector,
}: ModelIntentMenuProps) {
  return (
    <div className="model-intent-menu" role="menu" aria-label="Model intents">
      {!activeIntentId && !usingGlobalDefault && currentBinding ? (
        <p className="model-intent-menu-current">
          Currently {currentBinding} — not saved as an intent.
        </p>
      ) : null}
      {intents.intents.length === 0 ? (
        <p className="model-intent-menu-empty">
          No intents yet. Name the configurations you reach for in Settings → Agent.
        </p>
      ) : (
        intents.intents.map((intent) => {
          // CR256: choosing the name uses the first provider in order whose model can run; the
          // providers beside it choose one explicitly.
          const ordered = orderedModelIntentBindings(intents, intent);
          const resolved = resolveModelIntent(intents, intent, catalog);
          const active = intent.id === activeIntentId;
          const inUse = active ? ordered.find((binding) => binding.model.provider === activeProvider) : undefined;
          const shown = inUse ?? resolved ?? ordered[0];
          const reason = resolved ? undefined : unavailableModelReason(catalog, ordered[0].model);
          return (
            <div className="model-intent-menu-row" key={intent.id}>
              <button
                type="button"
                role="menuitem"
                className={`model-intent-menu-item${active ? " selected" : ""}`}
                aria-current={active ? "true" : undefined}
                disabled={!resolved}
                onClick={() => { if (resolved) onSelectIntent(intent, resolved); }}
              >
                <span className="model-intent-menu-label">{intent.label}</span>
                <span className="model-intent-binding">
                  {shown.model.provider}/{shown.model.model} · thinking {shown.thinkingLevel}
                </span>
                {reason ? <span className="model-intent-unavailable">{reason}</span> : null}
              </button>
              {ordered.length > 1 ? (
                <div className="model-intent-menu-providers" role="group" aria-label={`Providers for ${intent.label}`}>
                  {ordered.map((binding) => {
                    const current = binding === inUse;
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        key={binding.model.provider}
                        className={`model-intent-menu-provider${current ? " selected" : ""}`}
                        aria-current={current ? "true" : undefined}
                        aria-label={`${intent.label} with ${binding.model.provider}/${binding.model.model}`}
                        title={`${binding.model.provider}/${binding.model.model} · thinking ${binding.thinkingLevel}`}
                        disabled={Boolean(unavailableModelReason(catalog, binding.model))}
                        onClick={() => onSelectIntent(intent, binding)}
                      >
                        {binding.model.provider}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div className="model-intent-menu-separator" role="separator" />

      {/*
        CR154: the precise inverse of a pick made here, offered only when there is something to undo.
        Picking in this menu now writes the conversation's own choice, so the conversation needs a way
        back to its Journey that does not also discard the Journey's own override — which is what the
        entry below would do.
      */}
      {conversationOwnsChoice ? (
        <button
          type="button"
          role="menuitem"
          className="model-intent-menu-item"
          onClick={onFollowJourneyDefault}
        >
          <span className="model-intent-menu-label">Follow the Journey default</span>
          <span className="model-intent-binding">{journeyDefaultLabel}</span>
        </button>
      ) : null}

      <button
        type="button"
        role="menuitem"
        className={`model-intent-menu-item${usingGlobalDefault ? " selected" : ""}`}
        aria-current={usingGlobalDefault ? "true" : undefined}
        onClick={onUseGlobalDefaults}
      >
        <span className="model-intent-menu-label">Use global defaults</span>
        <span className="model-intent-binding">{globalModelLabel}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="model-intent-menu-item"
        onClick={onOpenFullSelector}
      >
        <span className="model-intent-menu-label">Open full selector…</span>
      </button>
    </div>
  );
}
