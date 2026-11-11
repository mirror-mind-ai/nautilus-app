[< RS016](index.md)

# CR232: Keep a Windows Path's Drive Letter in a Link

**Status:** validated on macOS 2026-11-11 ("CR230 a CR232 validadas") · published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #9](https://github.com/mirror-mind-ai/nautilus-app/pull/9); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #11, #12 e #9 e depois me de um roteiro de como valida-los em dev"). Merge commit `3a4bcaf5`.

## Friction

On Windows an agent linked `C:/VSCode/…/artigo-v01.docx`. The local-path detector knew only POSIX
roots, so `C:` stayed text and the link carried `/VSCode/…`; clicking it classified that as relative
to the Journey and the open was refused.

## What Changed

- The detector in `LinkifiedText.tsx` keeps a drive-letter path whole, `C:/…` or `C:\…`, and not
  when the colon ends a word (`Nota:/x`). Native resolution is unchanged; it already handled the
  full path.
- Spec cases in `src/tests/linkifiedText.test.ts`; a native test,
  `routes_drive_letter_paths_written_with_forward_slashes`, runs on Windows only.

## Noted at Review

On macOS a `C:/…` path makes one native ask that finds nothing and stays text. The Windows native
test does not run here.

## Falsifier

On Windows, `C:/…/file.md` in an answer is one link that opens the file. On macOS, the same text
stays text and nothing else changes.

## Evaluation

Evaluated on 2026-11-11 with PRs #11, #12 and #9 merged in that order onto `main` at `03e71b96`
in a separate worktree. #12 conflicted with #11 in `LinkifiedText.tsx` and `MessageContent.tsx`;
both sides only add, and the evaluation kept both. Before the merge the contributor rebased #12 onto
#11 with a resolution identical in those files, so all three merged through GitHub with merge
commits. `tsc` clean; vitest 344 files, 2,937 passed, 3 skipped (two of them the preflight tests
that need the materialized runtime the worktree lacks); cargo 523 passed, 11 ignored. The merged
`main` is byte for byte that evaluated tree. The repository has no CI, so that run is its only
green.
