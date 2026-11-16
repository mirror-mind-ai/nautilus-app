/**
 * CR260 iteration 4: how much of the Agentic Field the workspace tree takes. Kept as a share of the
 * surface rather than pixels, so a remembered split follows the window as it is resized.
 */
export const DEFAULT_FIELD_TREE_SHARE = 0.375;
export const MIN_FIELD_TREE_WIDTH = 180;
export const MIN_FIELD_VIEWER_WIDTH = 320;
export const FIELD_TREE_SHARE_STEP = 0.02;
/** CR260 iteration 5: dragged this close to the left edge, the tree folds away instead of shrinking. */
export const FIELD_TREE_COLLAPSE_WIDTH = MIN_FIELD_TREE_WIDTH / 2;

export function fieldTreeCollapses(pointerOffset: number): boolean {
  return pointerOffset < FIELD_TREE_COLLAPSE_WIDTH;
}

const FALLBACK_LOW = 0.2;
const FALLBACK_HIGH = 0.7;

export function clampFieldTreeShare(share: number, surfaceWidth: number): number {
  if (!Number.isFinite(share)) return DEFAULT_FIELD_TREE_SHARE;
  const measured = Number.isFinite(surfaceWidth) && surfaceWidth > 0;
  let low = measured ? MIN_FIELD_TREE_WIDTH / surfaceWidth : FALLBACK_LOW;
  let high = measured ? 1 - MIN_FIELD_VIEWER_WIDTH / surfaceWidth : FALLBACK_HIGH;
  // Too narrow for both minimums: the stylesheet stacks the panels there, so any sane share will do.
  if (low > high) [low, high] = [FALLBACK_LOW, FALLBACK_HIGH];
  return Math.min(high, Math.max(low, share));
}
