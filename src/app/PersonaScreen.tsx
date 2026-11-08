import { useEffect, useState, type FormEvent } from "react";
import {
  draftFromPersona,
  personaChanges,
  personaDraftProblem,
  type Persona,
  type PersonaDraft,
} from "../domain/personaEditing";
import { readPersona, updatePersona } from "./personaStorage";

type PersonaFormState = "idle" | "saving" | "saved" | "error";

/**
 * CR217: the persona whole. Its name, description, prompt and routing keywords are edited; its
 * default model and what it inherits from are shown, not changed.
 */
export function PersonaForm({
  persona,
  draft,
  state,
  message,
  onDraft,
  onSave,
  onClose,
}: {
  persona: Persona;
  draft: PersonaDraft;
  state: PersonaFormState;
  message?: string;
  onDraft: (draft: PersonaDraft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const problem = personaDraftProblem(draft);
  const changed = Object.keys(personaChanges(persona, draft)).length > 0;
  const saving = state === "saving";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changed && !problem && !saving) onSave();
  };
  return (
    <form
      className="settings-window journey-admin-dialog persona-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Persona"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose();
      }}
    >
      <div className="settings-header">
        <div>
          <p className="eyebrow">Persona</p>
          <h2>{persona.name ?? persona.id}</h2>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} disabled={saving}>×</button>
      </div>
      <label>Name<input value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} maxLength={160} placeholder={persona.id} /></label>
      <label>Description<textarea
        className="persona-screen-description"
        value={draft.description}
        onChange={(event) => onDraft({ ...draft, description: event.target.value })}
        aria-describedby="persona-description-note"
      /></label>
      <small id="persona-description-note" className="journey-admin-immutable-note persona-screen-note">Mirror chooses a turn's persona by this description.</small>
      <label>Prompt<textarea
        className="persona-screen-prompt"
        value={draft.prompt}
        onChange={(event) => onDraft({ ...draft, prompt: event.target.value })}
        spellCheck={false}
        aria-describedby="persona-prompt-note"
      /></label>
      <small id="persona-prompt-note" className="journey-admin-immutable-note persona-screen-note">
        A changed prompt reaches the Conversations where this persona speaks next. One where it already spoke keeps the prompt it was given until that Conversation is compacted.
      </small>
      <label>Routing keywords<textarea
        className="persona-screen-keywords"
        value={draft.routingKeywords}
        onChange={(event) => onDraft({ ...draft, routingKeywords: event.target.value })}
        aria-describedby="persona-keywords-note"
      /></label>
      <small id="persona-keywords-note" className="journey-admin-immutable-note persona-screen-note">Separated by commas or lines.</small>
      <dl className="persona-screen-facts">
        <dt>Id</dt><dd>{persona.id}</dd>
        <dt>Default model</dt><dd>{persona.defaultModel ?? "Not set"}</dd>
        <dt>Inherits from</dt><dd>{persona.inheritsFrom ?? "Not set"}</dd>
      </dl>
      {problem ? <p className="settings-error">{problem}</p> : null}
      {state === "error" && message ? <p className="settings-error" role="alert">{message}</p> : null}
      {state === "saved" ? <p className="journey-admin-immutable-note" role="status">Saved.</p> : null}
      <div className="settings-actions">
        <button type="button" onClick={onClose} disabled={saving}>{changed ? "Discard" : "Close"}</button>
        <button type="submit" disabled={!changed || Boolean(problem) || saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

/** CR217: opens one persona from the Core and saves its edits through it. */
export function PersonaScreen({
  personaId,
  onClose,
  onSaved,
}: {
  personaId: string;
  onClose: () => void;
  onSaved: (persona: Persona) => void;
}) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [state, setState] = useState<PersonaFormState>("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setPersona(null);
    setDraft(null);
    setState("idle");
    setMessage(undefined);
    readPersona(personaId).then(
      (read) => {
        if (cancelled) return;
        setPersona(read);
        setDraft(draftFromPersona(read));
      },
      (error: unknown) => {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const save = () => {
    if (!persona || !draft) return;
    setState("saving");
    setMessage(undefined);
    updatePersona(persona.id, persona.updatedAt, personaChanges(persona, draft)).then(
      (saved) => {
        setPersona(saved);
        setDraft(draftFromPersona(saved));
        setState("saved");
        onSaved(saved);
      },
      (error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : String(error));
      },
    );
  };

  return (
    <div className="settings-backdrop" role="presentation">
      {persona && draft ? (
        <PersonaForm
          persona={persona}
          draft={draft}
          state={state}
          {...(message ? { message } : {})}
          onDraft={(next) => {
            setDraft(next);
            if (state === "saved" || state === "error") setState("idle");
          }}
          onSave={save}
          onClose={onClose}
        />
      ) : (
        <div className="settings-window journey-admin-dialog persona-screen" role="dialog" aria-modal="true" aria-label="Persona">
          <div className="settings-header">
            <div>
              <p className="eyebrow">Persona</p>
              <h2>{personaId}</h2>
            </div>
            <button type="button" aria-label="Close" onClick={onClose}>×</button>
          </div>
          {state === "error" ? <p className="settings-error" role="alert">{message}</p> : <p>Reading the persona from Mirror…</p>}
        </div>
      )}
    </div>
  );
}
