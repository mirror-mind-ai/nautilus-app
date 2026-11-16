import { DEFAULT_FIELD_TREE_SHARE } from "../domain/fieldDivider";

const KEY_PREFIX = "mirror-desktop:agentic-field-tree-share:v1";

/** One split per person and runtime channel, the same in every Journey, as a file manager keeps it. */
export function loadFieldTreeShare(channel: string): number {
  try {
    const value = Number(window.localStorage.getItem(`${KEY_PREFIX}:${channel}`));
    return Number.isFinite(value) && value > 0 && value < 1 ? value : DEFAULT_FIELD_TREE_SHARE;
  } catch {
    return DEFAULT_FIELD_TREE_SHARE;
  }
}

export function saveFieldTreeShare(channel: string, share: number): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}:${channel}`, String(Math.round(share * 1000) / 1000));
  } catch {
    // The split in memory remains usable when persistence is unavailable.
  }
}
