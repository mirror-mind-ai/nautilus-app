import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  PERSONA_DELETION_CHANGED,
  personaDeletionRefusal,
  personaDeletionSummary,
  type PersonaDeletionPreview,
} from "../domain/personaLifecycle";
import { deletePersona, previewPersonaDeletion } from "./personaStorage";

type PersonaDeletionListProps = {
  preview?: PersonaDeletionPreview;
  error?: string;
  nameOfJourney: (journeyId: string) => string;
  nameOfPersona: (personaId: string) => string;
};

/** CR223: the Delete persona confirmation's list, in CR205's ink: what goes, what is cleared, what stays. */
export function PersonaDeletionList({ preview, error, nameOfJourney, nameOfPersona }: PersonaDeletionListProps) {
  if (error) return <p className="settings-error" role="alert">{error}</p>;
  if (!preview) return <p className="journey-deletion-loading" role="status">Asking Mirror what this persona holds…</p>;
  const refusal = personaDeletionRefusal(preview, nameOfPersona);
  if (refusal) return <p className="settings-error" role="alert">{refusal}</p>;
  const summary = personaDeletionSummary(preview, nameOfJourney);
  return (
    <div className="journey-deletion-list">
      <p>Will be deleted:</p>
      <ul aria-label="Will be deleted">
        {summary.goes.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {summary.cleared.length > 0 ? (
        <>
          <p>Will be cleared:</p>
          <ul aria-label="Will be cleared">
            {summary.cleared.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      ) : null}
      {summary.kept.length > 0 ? (
        <>
          <p>Will be kept, as history, with the persona's id:</p>
          <ul aria-label="Will be kept">
            {summary.kept.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      ) : (
        <p>No Conversation or memory was recorded with this persona.</p>
      )}
      <p>A bubble this persona signed keeps its name and colour.</p>
    </div>
  );
}

/**
 * CR223: one confirmation for both doors, the persona screen and the row's ⋯. It asks the Core
 * what goes, deletes exactly that behind the Core's backup, and previews again when the persona
 * changed in between.
 */
export function PersonaDeletionDialog({
  personaId,
  label,
  nameOfJourney,
  nameOfPersona,
  onClose,
  onDeleted,
}: {
  personaId: string;
  label: string;
  nameOfJourney: (journeyId: string) => string;
  nameOfPersona: (personaId: string) => string;
  onClose: () => void;
  /** After the Core deleted it; `problem` is what Nautilus could not remove of its own. */
  onDeleted: (personaId: string, problem: string | null) => void;
}) {
  const [preview, setPreview] = useState<PersonaDeletionPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string>();

  const readPreview = useCallback(() => {
    let cancelled = false;
    setPreview(undefined);
    setPreviewError(undefined);
    previewPersonaDeletion(personaId).then(
      (read) => {
        if (!cancelled) setPreview(read);
      },
      (error: unknown) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [personaId]);
  useEffect(() => readPreview(), [readPreview]);

  const refused = preview ? Boolean(personaDeletionRefusal(preview, nameOfPersona)) : true;
  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (!preview || refused || deleting) return;
    setDeleting(true);
    setMessage(undefined);
    deletePersona(personaId, preview.digest).then(
      (receipt) => onDeleted(personaId, receipt.problem),
      (error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        setDeleting(false);
        setMessage(text);
        if (text === PERSONA_DELETION_CHANGED) readPreview();
      },
    );
  };

  return (
    <div className="settings-backdrop" role="presentation">
      <form
        className="settings-window journey-admin-dialog danger-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete persona"
        onSubmit={confirm}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !deleting) onClose();
        }}
      >
        <div className="settings-header">
          <div>
            <p className="eyebrow">Delete persona</p>
            <h2>{label}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={deleting}>×</button>
        </div>
        <div className="journey-admin-summary">
          Permanently delete {label} from Mirror. Mirror takes a backup first.
        </div>
        <PersonaDeletionList
          {...(preview ? { preview } : {})}
          {...(previewError ? { error: previewError } : {})}
          nameOfJourney={nameOfJourney}
          nameOfPersona={nameOfPersona}
        />
        {message ? <p className="settings-error" role="alert">{message}</p> : null}
        <div className="settings-actions">
          <button type="button" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="danger-button" type="submit" disabled={refused || deleting}>{deleting ? "Deleting…" : "Delete persona"}</button>
        </div>
      </form>
    </div>
  );
}
