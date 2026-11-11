import { useEffect, useRef } from "react";
import type { PinnedMove } from "../domain/journeyListOrdering";

type JourneyItemContextMenuProps = {
  journeyId: string;
  x: number;
  y: number;
  pinned: boolean;
  /** Present for a pinned Journey: which moves within Pinned its place allows. */
  pinnedMoves?: Record<PinnedMove, boolean>;
  onMovePinned?: (journeyId: string, move: PinnedMove) => void;
  deleteDisabled: boolean;
  deleteTitle: string;
  returnFocusTo: HTMLElement | null;
  onTogglePin: (journeyId: string) => void;
  onEdit: (journeyId: string) => void;
  onCreate: (journeyId: string) => void;
  onMove: (journeyId: string) => void;
  onDelete: (journeyId: string) => void;
  onDismiss: () => void;
};

export function JourneyItemContextMenu({
  journeyId,
  x,
  y,
  pinned,
  pinnedMoves,
  onMovePinned,
  deleteDisabled,
  deleteTitle,
  returnFocusTo,
  onTogglePin,
  onEdit,
  onCreate,
  onMove,
  onDelete,
  onDismiss,
}: JourneyItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  const returnFocusRef = useRef(returnFocusTo);
  onDismissRef.current = onDismiss;
  returnFocusRef.current = returnFocusTo;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]:not(:disabled), [role="menuitem"]:not(:disabled)')?.focus();
    }, 0);

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onDismissRef.current();
    }

    function closeWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismissRef.current();
        returnFocusRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, []);

  return (
    <div
      className="journey-item-context-menu"
      role="menu"
      ref={menuRef}
      aria-label="Journey options"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={pinned}
        onClick={() => { onTogglePin(journeyId); onDismiss(); }}
      >
        {pinned ? "Unpin Journey" : "Pin Journey"}
      </button>
      {pinned && pinnedMoves && onMovePinned ? (
        <>
          <button type="button" role="menuitem" disabled={!pinnedMoves.up} onClick={() => { onMovePinned(journeyId, "up"); onDismiss(); }}>
            Move Up in Pinned
          </button>
          <button type="button" role="menuitem" disabled={!pinnedMoves.down} onClick={() => { onMovePinned(journeyId, "down"); onDismiss(); }}>
            Move Down in Pinned
          </button>
          <button type="button" role="menuitem" disabled={!pinnedMoves.top} onClick={() => { onMovePinned(journeyId, "top"); onDismiss(); }}>
            Move to Top of Pinned
          </button>
        </>
      ) : null}
      <button type="button" role="menuitem" onClick={() => onEdit(journeyId)}>Edit Journey…</button>
      <button type="button" role="menuitem" onClick={() => onCreate(journeyId)}>Create Journey…</button>
      <button type="button" role="menuitem" onClick={() => onMove(journeyId)}>Move Journey…</button>
      <button
        className="danger-menu-item"
        type="button"
        role="menuitem"
        disabled={deleteDisabled}
        title={deleteTitle}
        onClick={() => onDelete(journeyId)}
      >
        Delete Journey…
      </button>
    </div>
  );
}
