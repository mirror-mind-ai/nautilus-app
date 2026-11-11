[< RS016](index.md)

# CR225: Show the Selected Journey's Own Working Folder

**Status:** done · validated by the Navigator on macOS 2026-11-11 · published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #6](https://github.com/mirror-mind-ai/nautilus-app/pull/6); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #6, #10, #5 e do #8 com os ajustes mencionados"). Merge commit `869bf930`.

## Friction

Back on a Journey whose turn was running, the header said "Working in" the folder of the Journey
looked at before it, for the whole turn. The folder was kept without the Journey it was read for,
and it is not read while a turn runs, so the other Journey's stayed (CR202's reading).

## What Changed

- The folder is kept with the Journey it was read for (`JourneyWorkspaceReading`), and
  `workspacePreviewFor` shows it only for that Journey.
- `shouldReadJourneyWorkspace` reads the selected Journey's folder at once, turn or not, when the
  one kept is another's; a running turn's own folder is still left alone until the turn ends.
- Pure functions in `src/domain/journeyWorkingFolder.ts`; spec `src/tests/workingFolderPerJourney.test.ts` (5).

## Falsifier

Start a turn in one Journey, select another, select the first again while the turn runs: the
header names the first Journey's folder.

## Evaluation

Evaluated on 2026-11-10 with PRs #6, #10, #5 and #8 merged in that order onto `main` at `0f3ac37a`
in a separate worktree: no conflict; `tsc` clean; vitest 341 files, 2,920 passed, 3 skipped (two
of them the preflight tests that need the materialized runtime the worktree lacks); cargo 523
passed, 11 ignored. The merged `main` is byte for byte that evaluated tree. The repository has no
CI, so that run is its only green. After CR228's contrast fix, `main` ran again: vitest 344 files,
2,927 passed, 1 skipped; `tsc` clean.
