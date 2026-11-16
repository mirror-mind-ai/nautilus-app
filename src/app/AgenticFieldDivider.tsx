import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  clampFieldTreeShare,
  DEFAULT_FIELD_TREE_SHARE,
  FIELD_TREE_SHARE_STEP,
  fieldTreeCollapses,
} from "../domain/fieldDivider";

type Props = { share: number; onChange: (share: number) => void; onCollapse: () => void };

/** CR260 iteration 4: the draggable line between the workspace tree and the viewer. */
export function AgenticFieldDivider({ share, onChange, onCollapse }: Props) {
  const dragging = useRef<number | null>(null);

  useEffect(() => () => document.body.classList.remove("is-resizing-field"), []);

  function surfaceOf(element: HTMLElement): DOMRect | undefined {
    return element.parentElement?.getBoundingClientRect();
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-field");
  }

  function continueResize(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId) return;
    const surface = surfaceOf(event.currentTarget);
    if (!surface || surface.width <= 0) return;
    event.preventDefault();
    const offset = event.clientX - surface.left;
    // The remembered share is left as it was, so the tree comes back at the width it had.
    if (fieldTreeCollapses(offset)) {
      onCollapse();
      return;
    }
    onChange(clampFieldTreeShare(offset / surface.width, surface.width));
  }

  function stopResize(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove("is-resizing-field");
  }

  function resizeFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const requested = event.key === "ArrowLeft" ? share - FIELD_TREE_SHARE_STEP
      : event.key === "ArrowRight" ? share + FIELD_TREE_SHARE_STEP
        : event.key === "Home" ? 0
          : event.key === "End" ? 1
            : undefined;
    if (requested === undefined) return;
    event.preventDefault();
    onChange(clampFieldTreeShare(requested, surfaceOf(event.currentTarget)?.width ?? 0));
  }

  return <div
    className="agentic-field-divider"
    role="separator"
    aria-label="Resize workspace tree"
    aria-orientation="vertical"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(share * 100)}
    tabIndex={0}
    title="Drag to resize. Double click to reset."
    onPointerDown={startResize}
    onPointerMove={continueResize}
    onPointerUp={stopResize}
    onPointerCancel={stopResize}
    onLostPointerCapture={() => {
      dragging.current = null;
      document.body.classList.remove("is-resizing-field");
    }}
    onDoubleClick={() => onChange(DEFAULT_FIELD_TREE_SHARE)}
    onKeyDown={resizeFromKeyboard}
  />;
}
