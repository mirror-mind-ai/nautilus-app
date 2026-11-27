[< RS016](index.md)

# CR306: Drop the Context Reading a Compaction Overtook

**Status:** in_progress 2026-11-27 (merge `e0e01c75`); not in any release; not yet seen in the app by the Navigator
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated, completed with a guard, and merged by the assistant
**Requested:** contribution [PR #36](https://github.com/mirror-mind-ai/nautilus-app/pull/36); merged on the Navigator's word, 2026-11-27 ("Execute o merge", in the same batch as #34 and #35), after the evaluation, with the correction as a commit on the contributor's branch.
Merge commit `e0e01c75`.

## Friction

A manual compaction that ends while another Journey is on screen cannot hand its estimate to the
conversation, so the store keeps the size the model measured before the cut. Back in the conversation, the
footer showed that size as a measurement, and the prompt cache notice said the next message would
re-process all of it, with Compact now disabled because the branch already ended in a compaction. From the
field on Windows: 101K tokens announced after the compaction had completed.

## What Changed

When the session inspection says the branch ends in a compaction whose usage is pending, and the stored
reading is a measurement rather than the estimate a compaction leaves, the reading effect drops it and shows
`unknown_after_compaction`, the state a compaction with no estimate already shows. The next turn measures.

Commits:

- **The rule** (`07720b46`, the author's): `cachedReadingPredatesCompaction` in
  `src/app/contextUsageState.ts`, and its use in the reading effect in `App.tsx`. Tests in
  `src/tests/contextUsageState.test.ts` and `src/tests/contextReadingIntegration.test.ts`, written first.
- **Only the reading judged** (`fdd23fba`, the assistant's): the update that drops the reading looked only at
  the session and the generation. It now drops the stored reading only while it is the same one the read was
  judged against, so an estimate a compaction left meanwhile stays. Source test in
  `contextReadingIntegration.test.ts`, seen failing first.

## Noted at Review

- **How wide the gap was.** A compaction that ends on screen stores its estimate and bumps the refresh epoch,
  which cancels the read in flight, so the normal case was already safe. The gap the guard closes lies
  between those calls and React applying them. Read from the code, not reproduced.
- **Why it matters more now.** [CR303](cr303-show-the-activity-view-when-a-manual-compaction-starts.md)
  switches the sidebar to Activity when a manual compaction starts, which makes leaving the conversation
  while it runs more likely.
- **Left to a later CR, as the author proposed.** The compaction's estimate is not carried to a conversation
  that is not on screen; that would show a number instead of `?` on the way back, and means writing to the
  store of a conversation that is not selected. The footer's tooltip in the `?` state says the reading is
  estimated from the compaction, which this state is not; the wording is older than this change.
- An automatic compaction that ends a turn follows the same rule by the code; not provoked.

## Falsifier

In a dev build with a conversation of some size: Compact now, go to another Journey, come back after it ends.
The footer shows `?` and no notice announces the old size; one more turn measures. Compacting while staying
on the conversation keeps the approximate reading (`~`), also after leaving and coming back. If any fails,
this CR reopens.

## Evaluation

Diff read in full. Tried merged with [CR304](cr304-attach-an-image-pasted-into-the-composer.md) and
[CR305](cr305-attach-a-file-copied-in-explorer-by-its-own-path.md) onto `main` at `fa765ca4`; the results are
in CR304. The PR's Windows and macOS CI passed on `fdd23fba`. Not seen by the assistant in a running app; the
author's evidence is on Windows, alpha.28 against this branch, by the same script.

## Validation Route

1. `npm run tauri:dev`; open a conversation past a few tens of thousands of tokens.
2. Compact now and go at once to another Journey; come back once the compaction card says completed.
3. The footer shows `?`; with prompt cache notices on, no notice names the old size. Send one turn: the
   footer measures.
4. Compact again and stay until it ends: the footer shows `~` and keeps it after leaving and coming back.
