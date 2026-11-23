[< RS016](index.md)

# CR272: Find a File Opened From a Folder's Listing Again

**Status:** done 2026-11-23 (`1876987d`); validated by the Navigator in a dev build on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #23](https://github.com/mirror-mind-ai/nautilus-app/pull/23); merged on the Navigator's word, 2026-11-23 ("Proposta aprovada. Execute."), in a round with PR #25 and PR #21.
Merge commit `1876987d`.

## Friction

In the Agentic Field, a file opened from the listing of a folder selected in the tree could not be
found again. Back then Forward said "That place is no longer in the Journey workspace" and showed
nothing; Reload said "The previously selected artifact is no longer present". The file was there. A
file under a folder expanded in the tree was not affected, so it was easy to miss.

## Cause

Ours, from CR260. A folder selected in the tree opens as a listing in the viewer without the tree
loading its children, so a file opened from it is under a folder the tree never read. `goTo` and the
reload looked the place up in the tree as it happened to be.

## What Changed

- **`resolveDocumentationPlace`** (domain, pure) reads the unloaded folders on the way to a place,
  shallow first, before deciding it is gone. `goTo` uses it when the tree does not hold the place. A
  failed read says it could not read, not that the place left.
- **Reload** reads the shown place's folders again together with the expanded ones.
- **The briefing supersedes** a place still being read, so a late answer cannot land over it.

## Noted at Review

The link navigation effect walks ancestors with its own loop. The contributor left it as it was to
keep the change small; it could later use the same function.

## Falsifier

Select a folder in the tree, open a file from its listing, go somewhere else, then Back, Forward and
Reload: the file is shown each time. A file deleted on disk is still said to be gone. If the field
says a present file is gone, this CR did not do its work.

## Evaluation

Read in full. Seven tests in `agenticFieldPlaceInUnloadedFolder.test.ts`, red then green by the
contributor. Same combined run as CR270: vitest 3109 passed, `tsc` clean, cargo 566 passed. Not run
on macOS by the contributor.

Validated by the Navigator in a dev build on macOS, 2026-11-23 ("Testes realizados no dev. Tudo ok."). Closed as done; not yet in a release.
