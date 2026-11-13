import { invoke } from "@tauri-apps/api/core";
import {
  createPersistedComposerDrafts,
  parsePersistedComposerDrafts,
  type ComposerDraftMap,
  type ComposerQueuedMap,
} from "../domain/composerDrafts";

/** What the draft file keeps: each conversation's draft and, CR259, its messages waiting for a compaction. */
export type ComposerStore = {
  drafts: ComposerDraftMap;
  queued: ComposerQueuedMap;
};

let saveChain: Promise<void> = Promise.resolve();

export async function loadComposerDrafts(): Promise<ComposerStore> {
  const payload = await invoke<string | null>("load_composer_drafts");
  if (payload === null) return { drafts: {}, queued: {} };

  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new Error("Composer draft storage contains malformed JSON.");
  }
  const parsed = parsePersistedComposerDrafts(value);
  if (!parsed) throw new Error("Composer draft storage contains an invalid payload.");
  return { drafts: parsed.drafts, queued: parsed.queued };
}

export function saveComposerDrafts({ drafts, queued }: ComposerStore): Promise<void> {
  const payload = JSON.stringify(createPersistedComposerDrafts(drafts, new Date(), queued), null, 2);
  const operation = saveChain
    .catch(() => undefined)
    .then(() => invoke<void>("save_composer_drafts", { payload }));
  saveChain = operation;
  return operation;
}
