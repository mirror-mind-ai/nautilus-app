[< RS016](index.md)

# CR283: Start the Dev App on Windows Without Watching the Native Build

**Status:** done 2026-11-25 (`e5b95262`); closed by the Navigator on the tests and the author's Windows evidence, not from a run on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #27](https://github.com/mirror-mind-ai/nautilus-app/pull/27); merged on the Navigator's word, 2026-11-25 ("estou de acordo. Continue."), after the evaluation, in a round with PR #28.
Merge commit `e5b95262`.

## Friction

On Windows, `npm run tauri:dev` does not open the app. While the native crate compiles it writes and
locks files under `src-tauri/target`; Vite's watcher follows them, the dev server stops with `EBUSY`
and the `beforeDevCommand` ends with a non-zero status, so no window opens.

## What Changed

The dev server ignores `src-tauri` (`server.watch.ignored: ["**/src-tauri/**"]` in `vite.config.ts`).
Vite serves nothing from that folder on any platform, so nothing it reloads today is lost. Development
only: the built app does not change. The new `src/tests/devServerWatch.test.ts` asserts the setting in
the config's text, in the style of the check on the build target.

## Noted at Review

- The test reads `vite.config.ts` as text; it holds the setting, not the watcher's behaviour. The
  behaviour was shown by the author on Windows 11 (below).
- The PR was opened on `8863b9d3`, 32 commits before `main`. `vite.config.ts` gained the CR281 PostCSS
  plugin in between; the merge was automatic and both settings stand.

## Falsifier

On Windows, with a native crate to compile, `npm run tauri:dev` opens the window "Nautilus for Mirror
Dev" with no `EBUSY` in the log. On macOS it opens as before and an edit under `src/` still reloads the
window. If the macOS dev server stops following a file it used to follow, this CR reached further than
it says.

## Evaluation

Read in full. Tested merged with PR #28 onto `6f6a6348` in a throwaway worktree: vitest 382 files, 3191
passed, 1 skipped; `tsc` clean. No Rust change. The merged `main` has the same tree as the tested
worktree. The PR's own Windows and macOS CI were green on `15e90292`.

The author's Windows 11 evidence, same checkout, a run with the native crate to compile: `main`
(`8863b9d3`) stops with `EBUSY` 60 s in, with no window; the branch compiles, runs
`target\debug\mirror-desktop.exe` and opens the window; a second run with the build cached opened it in
10 s. Not run on macOS by the author or by the assistant.

## Validation Route

1. `npm run tauri:dev` from the repository root on macOS: the window opens.
2. Edit a visible string under `src/`: the window reloads.

## Closing

Closed on 2026-11-25 at the Navigator's instruction ("vamos fechar pelos testes e pela evidência do
autor"). What stands behind it is the test above, the merged suites (vitest 3191 passed, `tsc` clean)
and the author's Windows 11 run, where the same checkout that stopped with `EBUSY` opened the window.
No `tauri:dev` run on macOS is recorded, by the Navigator or by the assistant. If the macOS dev server
stops following a file it used to follow, this CR reopens.
