import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  draftFromPersona,
  personaChanges,
  personaDraftProblem,
  type Persona,
  type PersonaDraft,
} from "../domain/personaEditing";
import { personaHue, personaLightColour } from "./personaColour";
import {
  newPersonaDraft,
  newPersonaDraftWithId,
  newPersonaDraftWithName,
  personaCreation,
  personaCreationProblem,
  type NewPersonaDraft,
} from "../domain/personaLifecycle";
import { importPersonaImage, removePersonaImage, choosePersonaMedal } from "./personaImageStorage";
import { builtInPersonaMedal, MEDAL_IDS } from "./personaMedals";
import { createPersona, readPersona, updatePersona } from "./personaStorage";

type PersonaFormState = "idle" | "saving" | "saved" | "error";

/** The fields an edit and a creation share: description, prompt and routing keywords. */
function PersonaFields({ draft, onDraft, promptNote }: { draft: PersonaDraft; onDraft: (draft: PersonaDraft) => void; promptNote: string }) {
  return (
    <>
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
      <small id="persona-prompt-note" className="journey-admin-immutable-note persona-screen-note">{promptNote}</small>
      <label>Routing keywords<textarea
        className="persona-screen-keywords"
        value={draft.routingKeywords}
        onChange={(event) => onDraft({ ...draft, routingKeywords: event.target.value })}
        aria-describedby="persona-keywords-note"
      /></label>
      <small id="persona-keywords-note" className="journey-admin-immutable-note persona-screen-note">Separated by commas or lines.</small>
    </>
  );
}

/**
 * CR217: a persona's name, description, prompt and routing keywords, edited. CR218: its image,
 * applied at once and kept on this device, never in Mirror.
 */
export function PersonaForm({
  persona,
  draft,
  state,
  message,
  onDraft,
  onSave,
  onClose,
  image,
  imageBusy = false,
  imageMessage,
  imageSaved = false,
  onChooseImage,
  onChooseMedal,
  onRemoveImage,
  onDelete,
}: {
  persona: Persona;
  draft: PersonaDraft;
  state: PersonaFormState;
  message?: string;
  onDraft: (draft: PersonaDraft) => void;
  onSave: () => void;
  onClose: () => void;
  image?: string;
  imageBusy?: boolean;
  imageMessage?: string;
  /** CR224: an image was just kept, so the screen says so where it was chosen. */
  imageSaved?: boolean;
  onChooseImage: () => void;
  onChooseMedal?: (medal: string) => void;
  onRemoveImage: () => void;
  /** CR223: the screen's door to the deletion's confirmation. */
  onDelete?: () => void;
}) {
  const label = persona.name ?? persona.id;
  const displayedImage = image ?? builtInPersonaMedal(persona.id);
  const colour = { "--persona-hue": personaHue(persona.id), "--persona-light": personaLightColour(persona.id) } as CSSProperties;
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
      <div className="persona-image-control" style={colour}>
        <span className={`persona-image-preview${displayedImage ? " has-image" : ""}`}>
          {displayedImage ? <img src={displayedImage} alt={`The image of ${label}`} /> : <span aria-hidden="true">◇</span>}
        </span>
        <div className="persona-image-actions">
          <button type="button" className="secondary-button" onClick={onChooseImage} disabled={imageBusy}>
            {imageBusy ? "Importing…" : image ? "Replace image…" : "Choose image…"}
          </button>
          <button type="button" className="secondary-button" onClick={onRemoveImage} disabled={imageBusy || !image}>Remove image</button>
          <small className="journey-admin-immutable-note">Kept on this device, not in Mirror. Saved as soon as you choose it, apart from the Save below.</small>
        </div>
      </div>
      {onChooseMedal ? <div className="persona-medal-choice">
        <small className="journey-admin-immutable-note">Built-in medals · choose one to replace this persona's image.</small>
        <div className="persona-medal-gallery" role="group" aria-label="Built-in persona medals">
        {MEDAL_IDS.map((id) => <button key={id} type="button" disabled={imageBusy} title={id.replaceAll("-", " ")}
          aria-label={`Choose ${id.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} medal`}
          onClick={() => onChooseMedal(id)}><img src={builtInPersonaMedal(id)} alt="" /></button>)}
        </div>
      </div> : null}
      {imageMessage ? <p className="settings-error" role="alert">{imageMessage}</p> : null}
      {imageSaved && !imageMessage ? <p className="persona-image-saved" role="status">Image saved.</p> : null}
      <label>Name<input value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} maxLength={160} placeholder={persona.id} /></label>
      <PersonaFields
        draft={draft}
        onDraft={onDraft}
        promptNote="A changed prompt reaches each Conversation the next time this persona speaks there, open ones included."
      />
      {problem ? <p className="settings-error">{problem}</p> : null}
      {state === "error" && message ? <p className="settings-error" role="alert">{message}</p> : null}
      {state === "saved" ? <p className="journey-admin-immutable-note" role="status">Saved.</p> : null}
      <div className="settings-actions">
        {onDelete ? <button type="button" className="persona-screen-delete" onClick={onDelete} disabled={saving}>Delete persona…</button> : null}
        <button type="button" onClick={onClose} disabled={saving}>{changed ? "Discard" : "Close"}</button>
        <button type="submit" disabled={!changed || Boolean(problem) || saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

/** CR217: opens one persona from the Core and saves its edits through it. */
export function PersonaScreen({
  personaId,
  image,
  onClose,
  onSaved,
  onImageChanged,
  onDelete,
}: {
  personaId: string;
  image?: string;
  onClose: () => void;
  onSaved: (persona: Persona) => void;
  onDelete?: () => void;
  /** CR218: the persona's image now, undefined once removed. */
  onImageChanged: (personaId: string, image: string | undefined) => void;
}) {
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState<string>();
  // CR224: the image is kept at once, apart from Save; the screen says so where it was chosen.
  const [imageSaved, setImageSaved] = useState(false);
  const changeImage = (change: () => Promise<string | undefined | null>) => {
    setImageBusy(true);
    setImageMessage(undefined);
    setImageSaved(false);
    change().then(
      // null: the person closed the file dialog without choosing; nothing changes.
      (next) => {
        if (next !== null) {
          onImageChanged(personaId, next);
          setImageSaved(true);
        }
      },
      (error: unknown) => setImageMessage(error instanceof Error ? error.message : String(error)),
    ).finally(() => setImageBusy(false));
  };
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
            setImageSaved(false);
            setDraft(next);
            if (state === "saved" || state === "error") setState("idle");
          }}
          onSave={save}
          onClose={onClose}
          {...(image ? { image } : {})}
          imageBusy={imageBusy}
          {...(imageMessage ? { imageMessage } : {})}
          imageSaved={imageSaved}
          onChooseImage={() => changeImage(async () => (await importPersonaImage(personaId)) ?? null)}
      onChooseMedal={(medal) => changeImage(() => choosePersonaMedal(personaId, medal))}
          onRemoveImage={() => changeImage(async () => {
            await removePersonaImage(personaId);
            return undefined;
          })}
          {...(onDelete ? { onDelete } : {})}
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

/** CR222: a persona not yet in Mirror: an id, a name and a prompt at least. */
export function NewPersonaForm({
  draft,
  state,
  message,
  onDraft,
  onCreate,
  onClose,
}: {
  draft: NewPersonaDraft;
  state: "idle" | "saving" | "error";
  message?: string;
  onDraft: (draft: NewPersonaDraft) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const problem = personaCreationProblem(draft);
  const saving = state === "saving";
  const touched = Boolean(draft.name || draft.id || draft.prompt);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!problem && !saving) onCreate();
  };
  return (
    <form
      className="settings-window journey-admin-dialog persona-screen"
      role="dialog"
      aria-modal="true"
      aria-label="New persona"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose();
      }}
    >
      <div className="settings-header">
        <div>
          <p className="eyebrow">Persona</p>
          <h2>New persona</h2>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} disabled={saving}>×</button>
      </div>
      <small className="journey-admin-immutable-note">An image can be chosen once the persona is created.</small>
      <label>Name<input value={draft.name} onChange={(event) => onDraft(newPersonaDraftWithName(draft, event.target.value))} maxLength={160} autoFocus /></label>
      <label>Id<input
        value={draft.id}
        onChange={(event) => onDraft(newPersonaDraftWithId(draft, event.target.value))}
        maxLength={80}
        spellCheck={false}
        aria-describedby="persona-id-note"
      /></label>
      <small id="persona-id-note" className="journey-admin-immutable-note persona-screen-note">Cannot be changed once the persona is created.</small>
      <PersonaFields
        draft={draft}
        onDraft={(fields) => onDraft({ ...draft, ...fields })}
        promptNote="What the persona is told each time it speaks."
      />
      {touched && problem ? <p className="settings-error">{problem}</p> : null}
      {state === "error" && message ? <p className="settings-error" role="alert">{message}</p> : null}
      <div className="settings-actions">
        <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" disabled={Boolean(problem) || saving}>{saving ? "Creating…" : "Create persona"}</button>
      </div>
    </form>
  );
}

/** CR222: creates a persona through the Core, then hands it to the app to open as an edit. */
export function NewPersonaScreen({ onClose, onCreated }: { onClose: () => void; onCreated: (persona: Persona) => void }) {
  const [draft, setDraft] = useState<NewPersonaDraft>(newPersonaDraft);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string>();
  const create = () => {
    setState("saving");
    setMessage(undefined);
    createPersona(personaCreation(draft)).then(onCreated, (error: unknown) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    });
  };
  return (
    <div className="settings-backdrop" role="presentation">
      <NewPersonaForm
        draft={draft}
        state={state}
        {...(message ? { message } : {})}
        onDraft={(next) => {
          setDraft(next);
          if (state === "error") setState("idle");
        }}
        onCreate={create}
        onClose={onClose}
      />
    </div>
  );
}
