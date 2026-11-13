import type { ComposerDraftMap } from "../domain/composerDrafts";

type ComposerDraftPersistenceOptions<T extends object> = {
  save: (snapshot: T) => Promise<void>;
  idleMs: number;
  onError?: (error: unknown) => void;
};

export type ComposerDraftPersistence<T extends object = ComposerDraftMap> = {
  schedule: (snapshot: T) => void;
  flush: () => Promise<void>;
  dispose: () => void;
};

export function createComposerDraftPersistence<T extends object = ComposerDraftMap>({
  save,
  idleMs,
  onError = () => undefined,
}: ComposerDraftPersistenceOptions<T>): ComposerDraftPersistence<T> {
  let pending: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saveChain: Promise<void> = Promise.resolve();

  function clearTimer() {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
  }

  function persistPending(): Promise<void> {
    clearTimer();
    if (!pending) return saveChain;
    const snapshot = pending;
    pending = undefined;
    saveChain = saveChain
      .catch(() => undefined)
      .then(() => save(snapshot));
    return saveChain;
  }

  return {
    schedule(snapshot) {
      pending = { ...snapshot };
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void persistPending().catch(onError);
      }, idleMs);
    },
    flush: persistPending,
    dispose() {
      clearTimer();
      pending = undefined;
    },
  };
}
