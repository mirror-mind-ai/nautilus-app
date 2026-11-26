[< RS016](index.md)

# CR297: Open a Link Inside Bold or Italic Text

**Status:** in_progress 2026-11-26 (merge `f9ff7323`); released in alpha.28 on 2026-11-26; not yet seen in the app by the Navigator
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #33](https://github.com/mirror-mind-ai/nautilus-app/pull/33); merged on the Navigator's word, 2026-11-26 ("vamos mergear os prs que faltam para incluir na próxima release"), after the evaluation below. Merge commit `f9ff7323`.

## Friction

An agent wrote the link to a report in bold, `**[label](<path with spaces>)**`. The bold was drawn and inside
it the brackets, the angle brackets and the path as plain text, with nothing to click: `renderInline` drew the
text of bold and italic with the search highlight only, so a link, a code span or a path inside them was never
read. It has been so since links were first read in messages (alpha.12) and surfaced now because a model
started bolding its links. A link outside bold worked.

## What Changed

Bold and italic render their text with the same inline reader as the text around them; `parseInlineTokens` is
unchanged and its `**…**` and `*…*` cannot hold a `*`, so the recursion is one level deep.
`src/app/MessageContent.tsx` does it in `renderInline` and in `messageInlinePlainText` (a copied message keeps a
link in bold as its label and destination), and `src/app/ArtifactMarkdown.tsx` does it for the document
preview. Also changed: a bare path inside bold or italic becomes a link like a bare path anywhere, once the
native side confirms the file, and with a conversation search active a highlighted run inside bold is wrapped
in a `<span>`, as it already was outside bold. A test, `src/tests/linksInsideEmphasis.test.tsx` (8 tests, 6 red
before the change). No Rust, no CSS.

## Noted at Review

The change is the smallest that reads what the text already contained, and it adds no parsing. Inside bold a
local link takes the local-path style, monospace; in Daylight its contrast is 4.5:1, that of every local
link in that theme today and not something this change introduces.

## Falsifier

A message that holds `**[label](<path with spaces>)**` shows the label as a link inside the bold, with no
brackets or path text beside it, and a click opens the file; the same for a web link in bold and in italic;
plain bold and italic look as before; a copied message keeps the label and the destination. If any fails,
this CR reopens.

## Evaluation

Diff read in full (three files). Tried as a merge onto `29f39d30` together with [CR296](cr296-read-the-label-of-a-settings-checkbox-in-the-light-themes.md)
in a throwaway worktree: vitest 393 files, 3294 passed, 6 skipped; `tsc` clean. The PR's own Windows and
macOS CI passed on its head. Not seen by the assistant in a running app; the author's demonstration was on
Windows with a DEV build, and the document preview was covered by the test only.

## Validation Route

1. `npm run tauri:dev`; in a Journey with a working folder, ask the agent to reply with exactly one line
   `**[Open the report](<path with spaces/report.md>)**` pointing at a file there.
2. The label shows as a link inside the bold with no brackets or path text; click it and the file opens.
3. Optional: the same in italic with a web link; open a Markdown file in the document preview whose text
   holds a bold link.
