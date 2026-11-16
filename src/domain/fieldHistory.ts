// CR260 iteration 2: back and forward in the Agentic Field, the way a file manager walks the places
// it has shown. A place is the briefing or a workspace path, never a node, because a node goes stale
// when the tree reloads; the browser resolves the path against the current tree.

export type FieldPlace = { kind: "briefing" } | { kind: "node"; relativePath: string };

export type FieldHistory = { places: readonly FieldPlace[]; index: number };

export const BRIEFING_PLACE: FieldPlace = Object.freeze({ kind: "briefing" });

const MAX_PLACES = 100;

export function startFieldHistory(): FieldHistory {
  return { places: [BRIEFING_PLACE], index: 0 };
}

export function currentFieldPlace(history: FieldHistory): FieldPlace {
  return history.places[history.index];
}

export function canGoBackInField(history: FieldHistory): boolean {
  return history.index > 0;
}

export function canGoForwardInField(history: FieldHistory): boolean {
  return history.index < history.places.length - 1;
}

/** Visiting drops the places ahead of the cursor; revisiting the current place records nothing. */
export function visitFieldPlace(history: FieldHistory, place: FieldPlace): FieldHistory {
  if (samePlace(currentFieldPlace(history), place)) return history;
  const places = [...history.places.slice(0, history.index + 1), place].slice(-MAX_PLACES);
  return { places, index: places.length - 1 };
}

export function fieldHistoryBack(history: FieldHistory): FieldHistory {
  return canGoBackInField(history) ? { ...history, index: history.index - 1 } : history;
}

export function fieldHistoryForward(history: FieldHistory): FieldHistory {
  return canGoForwardInField(history) ? { ...history, index: history.index + 1 } : history;
}

function samePlace(left: FieldPlace, right: FieldPlace): boolean {
  if (left.kind === "briefing" || right.kind === "briefing") return left.kind === right.kind;
  return left.relativePath === right.relativePath;
}
