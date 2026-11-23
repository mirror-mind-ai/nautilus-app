[< RS016](index.md)

# CR270: Read the macOS 12 Source Check's Files on Windows

**Status:** done 2026-11-23 (`e3373099`); test only, proven by the Windows CI on `main`
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #25](https://github.com/mirror-mind-ai/nautilus-app/pull/25); merged on the Navigator's word, 2026-11-23 ("Proposta aprovada. Execute."), in a round with PR #21 and PR #23.
Merge commit `e3373099`.

## Friction

The Windows workflow was red on `main` since `925b21d0` (alpha.21). Two of the four tests in
`legacyWebKitSource.test.ts` failed, the job stopped there, and `cargo test` and the NSIS build no
longer ran on Windows for any change.

## Cause

Ours, from CR265. The test collected each frontend source as the `pathname` of a file URL and read
that. On Windows a pathname is `/D:/a/…`, which Node reads as `D:\D:\a\…`.

## What Changed

The test keeps the file URLs and reads through them (`readFileSync(new URL(file))`). What it looks for
is unchanged, and nothing in the app changes. The contributor showed that the check still names a
temporary source file holding a lookbehind and `.at(`.

## Falsifier

The Windows workflow on `main` after this merge runs the file's four tests green and goes on to
`cargo test` and the NSIS build. If it stops on `legacyWebKitSource.test.ts`, this CR did not do its
work.

## Evaluation

Read in full. Merged together with PR #21 and PR #23 in a throwaway worktree on `63e1da50`: vitest
373 files, 3109 passed; `tsc` clean; cargo 566 passed, 12 ignored. The merged `main` has the same tree
as the tested worktree.

The Windows workflow on the merged `main` (`1876987d`, run 45197478118) passed: the file's four tests,
`cargo test` 500 passed, and the NSIS bundle built. It had been red since `925b21d0`.
