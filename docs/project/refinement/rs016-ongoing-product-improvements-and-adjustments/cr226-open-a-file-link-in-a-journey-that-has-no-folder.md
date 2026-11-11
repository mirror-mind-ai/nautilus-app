[< RS016](index.md)

# CR226: Open a File Link in a Journey That Has No Folder

**Status:** merged 2026-11-11, awaiting the Navigator's validation on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #10](https://github.com/mirror-mind-ai/nautilus-app/pull/10); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #6, #10, #5 e do #8 com os ajustes mencionados"). Merge commit `05698b39`.

## Friction

A local file link in a Journey with no folder failed with "The selected Journey has no configured
workspace path", even when the link named the file by its full path. In the contributor's home, 6
of 50 Journeys have no folder.

## What Changed

- `classify_chat_local_reference` (`main.rs`): when the Journey's folder cannot be read, a full path
  or `~/…` to an existing file is classified `external_file` and opens natively, as a file outside
  a Journey already did; a relative path keeps the Journey's refusal.
- Journeys with a folder are unchanged. Native test
  `a_journey_without_a_folder_still_opens_a_file_named_by_its_full_path`.

## Noted at Review

Any failure to read the folder takes this path, not only "this Journey has no folder" (an
unreadable registry, an empty id). It opens no file a Journey with a folder could not already
open, so it was not held; a narrower match can come later.

## Falsifier

In a Journey with no folder, a message naming a file by its full path opens it; a relative path
says the Journey has no folder.

## Evaluation

Evaluated on 2026-11-10 with PRs #6, #10, #5 and #8 merged in that order onto `main` at `0f3ac37a`
in a separate worktree: no conflict; `tsc` clean; vitest 341 files, 2,920 passed, 3 skipped (two
of them the preflight tests that need the materialized runtime the worktree lacks); cargo 523
passed, 11 ignored. The merged `main` is byte for byte that evaluated tree. The repository has no
CI, so that run is its only green. After CR228's contrast fix, `main` ran again: vitest 344 files,
2,927 passed, 1 skipped; `tsc` clean.
