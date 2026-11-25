[< RS016](index.md)

# CR285: Say What the Next Message Will Cost, Before a Pause

**Status:** in_progress 2026-11-25 (`90a6c216`, receipt corrected in `54e90852`); merged, seen once in a dev build on macOS, the light themes not yet
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated, completed for the light themes and merged by the assistant
**Requested:** contribution [PR #31](https://github.com/mirror-mind-ai/nautilus-app/pull/31); merged on the Navigator's word, 2026-11-25 ("pode começar pela correção e depois siga suas recomendações para o merge dos 3 prs"), after the evaluation and a correction for the light themes.
Merge commit `90a6c216`.

## Friction

A model's prompt cache lasts about five minutes. In a long conversation, a message sent after a longer
pause makes the model process the whole conversation again, at full price and with a slower start, and
nothing in the app says so before or after.

## What Changed

An advanced option, off by default (Settings › You › Advanced), stored per runtime channel. With it on,
a conversation of 50K tokens or more shows a notice above the composer: while the cache is warm, how
long it has left and what a message after the pause would re-process; once it has expired, that the
next message will. Compact now and Not now sit beside it. After each turn a receipt says whether the
last message read from the cache or re-processed the conversation. The text states only what the usage
the model reported supports. No Rust.

Three commits:

- **The notices** (`1a320efb`, the author's): `src/domain/promptCacheNotice.ts`,
  `src/app/PromptCacheNotice.tsx`, the wiring in `App.tsx`, the cache usage carried through
  `agentStream.ts` and `piProcessStream.ts`, the setting in `sidebarPresentationStorage.ts`, and
  `promptCacheNotice.test.tsx`.
- **The light themes** (`3d670758`, the assistant's): the notice and its receipt were written in a
  fixed pale ink and read as near white on white on daylight, mist and parchment. They now use the
  `--ui-text` and `--ui-muted` contract of CR151, so the dark look is unchanged. The expired amber,
  which CR209 had found unreadable on a light surface, takes `#8a5010` in the light themes: 4.75:1 on
  the worst tinted notice, where CR209's `#9a5b13` reached 4.0:1. Guarded by
  `cr285PromptCacheNoticeLightThemes.test.ts`.
- **The partial re-processing** (`54e90852`, the assistant's, after the field run below): a call
  that writes most of the context beside a partial read now says it re-processed most of the
  conversation, with what it wrote and the conversation's size. An even split still gets no claim.

## Falsifier

With the option on, in a conversation over 50K tokens: after a turn, the notice counts down from five
minutes and the receipt says the message read from the cache; after more than five minutes, the notice
says the cache expired and the next message's receipt says it re-processed the conversation. In each
light theme every line of the notice is legible. With the option off, nothing appears. If any of these
fails, this CR reopens.

## Evaluation

Read in full. Tested merged with PR #30 onto `2ac03746` in a throwaway worktree: vitest 385 files, 3219
passed, 1 skipped; `tsc` clean. The stylesheet was built and the notice rendered in the four themes
before and after the correction (the defect, then every line legible). After the correction the PR's
Windows and macOS CI were green on `3d670758`. Not run in a dev build on macOS or Windows by the
assistant; the author's demonstration was on the dark theme.

In the field, 2026-11-25, the Navigator ran the route in a dev build on macOS, in a 63K conversation
on Claude last answered two days before. Before sending, the notice said the cache had expired. The
message then read 21,731 tokens from the cache and wrote 40,961 (35% and 65% of 62,702), which fell
between the receipt's two readings, so no receipt appeared. The route had promised "re-processed"
without checking it against real usage; a provider can keep an older stretch of the prompt warm. The
next message read 62,627 of 63,274 tokens and the one after it 63,240 of 64,782, and the receipt said
they read 63K from the cache, as expected. In the capture after the third message the notice was
gone and the footer read "~6.5%": the context reading stayed approximate for 15 s after the turn,
which [CR288](cr288-give-every-turn-its-own-context-re-read-budget.md) addresses. The
receipt was corrected in `54e90852`; the light themes (step 4) are still to be seen.

## Validation Route

1. `npm run tauri:dev`; Settings › You › Advanced; turn the prompt cache notices on.
2. In a conversation over 50K tokens, send a turn: the notice and the receipt appear.
3. Wait more than five minutes: the notice says the cache expired; send a message and read the receipt.
4. Switch to daylight, mist and parchment: every line is legible.
