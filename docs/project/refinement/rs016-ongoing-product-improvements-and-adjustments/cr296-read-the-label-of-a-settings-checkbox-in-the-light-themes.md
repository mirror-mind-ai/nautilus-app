[< RS016](index.md)

# CR296: Read the Label of a Settings Checkbox in the Light Themes

**Status:** in_progress 2026-11-26 (merge `afce936d`); merged on the Navigator's word, not yet seen in the app by the Navigator
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #32](https://github.com/mirror-mind-ai/nautilus-app/pull/32); merged on the Navigator's word, 2026-11-26 ("vamos mergear os prs que faltam para incluir na próxima release"), after the evaluation below. Merge commit `afce936d`.

## Friction

The label "Prompt cache notices" under Settings › You › Advanced ([CR291](cr291-move-the-prompt-cache-option-to-an-advanced-settings-tab.md))
and the two checkboxes of Diagnostics' "Current session controls" use `.provider-check`, which wrote its text in a
fixed pale ink, `#c6dce2`. The light themes paint the card white, so the label measured 1.41:1 in Daylight and
Mist and 1.38:1 in Parchment, against 11.7:1 in the dark themes (the author's measurement in a DEV build). It
is a defect of PR #31's wiring that [CR285](cr285-say-what-the-next-message-will-cost-before-a-pause.md)'s
correction did not reach; the Diagnostics checkboxes are older.

## What Changed

One declaration in `src/styles/app.css`: `.provider-check` takes `var(--ui-text)`, the contract of CR151,
as CR285 did for the notice, with a comment saying why. In the dark themes the label goes from `#c6dce2` to
`#e6edf0` (11.7:1 to 14.1:1), the ink every other label already has. A test,
`src/tests/settingsCheckboxLabelLightThemes.test.ts` (3 tests), guards the rule and the contrast of
`--light-text` on the light themes' surfaces. No Rust.

## Noted at Review

The author left, for the Navigator's call, two lines of the CR285 notice in Daylight a little under 4.5:1:
its clock (4.39:1) and its receipt (4.23:1). They are the level of Daylight's own muted ink on a raised
surface elsewhere (4.44:1), and nothing here changes them.

## Falsifier

In Daylight, Mist and Parchment, the label "Prompt cache notices" (Settings › You › Advanced) and the two
checkboxes of Diagnostics' "Current session controls" are legible; in the dark themes they are as before or
a little lighter. If any is still pale on white, this CR reopens.

## Evaluation

Diff read in full (two files). Tried as a merge onto `29f39d30` together with [CR297](cr297-open-a-link-inside-bold-or-italic-text.md)
in a throwaway worktree: vitest 393 files, 3294 passed, 6 skipped; `tsc` clean; the stylesheet gate of
CR293 still green. The PR's own Windows and macOS CI passed on its head. Not seen by the assistant in a
running app; the contrast figures are the author's.

## Validation Route

1. `npm run tauri:dev`; choose Daylight in Settings › Appearance.
2. Settings › You › Advanced: read "Prompt cache notices". Settings › Diagnostics: read the two checkboxes
   of "Current session controls".
3. Repeat in Mist and Parchment, and glance at a dark theme.
