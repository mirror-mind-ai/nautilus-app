[< RS016](index.md)

# CR231: Open an Inline Code Span That Names a File, Whole

**Status:** validated on macOS 2026-11-11 ("CR230 a CR232 validadas") · published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #12](https://github.com/mirror-mind-ai/nautilus-app/pull/12); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #11, #12 e #9 e depois me de um roteiro de como valida-los em dev"). Merge commit `65124a13`.

## Friction

Agents mark files as inline code. A path with a space was cut in two, a name alone linked only for a
fixed list of source extensions, and a relative path written with `\` was reduced to its last
segment.

## What Changed

- `wholePathCandidate` (`LinkifiedText.tsx`): an inline code span whose whole text is a path (`/` or
  `\`, `~/…`) or a name with an extension, single line, not a URL, is one candidate.
- `InlineCodeText`: such a span becomes one link once `inspect_local_references` confirms the file;
  otherwise it reads exactly as before. Folders, plain code (`_14`, `npm test`) and fenced blocks are
  unchanged. The local-path anchor is shared with bare paths (`localPathAnchor`).
- Spec `src/tests/codeSpanPaths.test.tsx` (4).

## Noted at Review

Every code span that looks like a file (`App.tsx`, `console.log`, `v0.4.0`) now asks the native side
on its own, through the same serialization every native command takes, as CR230's links do. Each
ask is a cheap file check; a long Conversation full of code spans makes dozens of them in a row when
it opens. Batching them into one ask is left for a later change, if it is ever felt.

## Falsifier

An agent's `` `/path/with a space/plano final.md` `` to an existing file is one link that opens it;
`` `npm test` ``, `` `_14` `` and a folder stay code.

## Evaluation

Evaluated on 2026-11-11 with PRs #11, #12 and #9 merged in that order onto `main` at `03e71b96`
in a separate worktree. #12 conflicted with #11 in `LinkifiedText.tsx` and `MessageContent.tsx`;
both sides only add, and the evaluation kept both. Before the merge the contributor rebased #12 onto
#11 with a resolution identical in those files, so all three merged through GitHub with merge
commits. `tsc` clean; vitest 344 files, 2,937 passed, 3 skipped (two of them the preflight tests
that need the materialized runtime the worktree lacks); cargo 523 passed, 11 ignored. The merged
`main` is byte for byte that evaluated tree. The repository has no CI, so that run is its only
green.
