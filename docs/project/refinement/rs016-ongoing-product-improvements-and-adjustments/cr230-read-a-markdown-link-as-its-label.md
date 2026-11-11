[< RS016](index.md)

# CR230: Read a Markdown Link as Its Label, and Open What It Points To

**Status:** validated on macOS 2026-11-11 ("CR230 a CR232 validadas")
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #11](https://github.com/mirror-mind-ai/nautilus-app/pull/11); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #11, #12 e #9 e depois me de um roteiro de como valida-los em dev"). Merge commit `94b75242`.

## Friction

Agents write links as Markdown, `[label](destination)`. The message renderer did not read that form:
the brackets and parentheses showed raw, and only a bare path inside the parentheses could become a
link.

## What Changed

- `parseInlineTokens` (`MessageContent.tsx`) reads `[label](destination)` and
  `[label](<destination with spaces>)` as a `link` token.
- `MarkdownLink` (`LinkifiedText.tsx`): an `http(s)` destination links its label outside the app;
  a local path links its label only once `inspect_local_references` confirms the file, through the
  same Journey-aware click as a bare path; until then, or when it is no file, the label is followed
  by the destination as text. Any other scheme (`javascript:`, `file:`, `mailto:`, `data:`) and an
  in-page anchor stay text. A label written as code renders as code.
- A copied draft keeps the destination (`label (destination)`); a document preview shows the label
  with the destination in its title.
- Spec `src/tests/markdownLinks.test.tsx` (6).

## Noted at Review

A link inside emphasis (`**[a](b)**`) still shows raw: the inline reader does not nest. The native
side checks a web address again before opening it (`validate_external_url`).

## Falsifier

An agent's `[a documentação](https://example.com/docs)` reads "a documentação" and opens the browser;
a link to an existing local file opens it; a missing file reads as its label and destination; a
`javascript:` link stays text.

## Evaluation

Evaluated on 2026-11-11 with PRs #11, #12 and #9 merged in that order onto `main` at `03e71b96`
in a separate worktree. #12 conflicted with #11 in `LinkifiedText.tsx` and `MessageContent.tsx`;
both sides only add, and the evaluation kept both. Before the merge the contributor rebased #12 onto
#11 with a resolution identical in those files, so all three merged through GitHub with merge
commits. `tsc` clean; vitest 344 files, 2,937 passed, 3 skipped (two of them the preflight tests
that need the materialized runtime the worktree lacks); cargo 523 passed, 11 ignored. The merged
`main` is byte for byte that evaluated tree. The repository has no CI, so that run is its only
green.
