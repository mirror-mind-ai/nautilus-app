[< RS016](index.md)

# CR233: Close the App on Windows

**Status:** merged 2026-11-11, awaiting field validation; published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution
**Source:** [PR #7](https://github.com/mirror-mind-ai/nautilus-app/pull/7), merged as `9443dadc` on the Navigator's explicit authorization.

## Change

On Windows, closing the window requests app exit instead of hiding it. If agent work is live, the existing File > Exit confirmation applies. The native `desktop_close_quits_app` command exposes a platform constant. macOS retains hide-on-close. A failed platform read retains the previous hide behavior. Exit handling is shared through a ref.

## Evaluation and Limits

Evaluated with PR #4 on current main in a disposable worktree: TypeScript clean, vitest 2,943 passed and 3 skipped, build passed, cargo 525 passed and 11 ignored. Two preflight skips reflect the worktree's absent materialized runtime. The merged source tree matched the evaluated tree. Native command census tests passed again after merging, with 121 commands. There is no CI. Tests ran on macOS, not Windows; contributor-reported Windows verification is not independent local evidence.

## Falsifier

On Windows, closing an idle window exits the app. Closing during agent work asks for confirmation; cancelling leaves the app and work intact. On macOS, closing still hides the window and File > Exit still confirms during live work.
