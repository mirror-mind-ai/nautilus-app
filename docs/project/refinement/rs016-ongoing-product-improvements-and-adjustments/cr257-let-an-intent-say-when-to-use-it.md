[< RS016](index.md)

# CR257: Let an Intent Say When to Use It

**Status:** implemented 2026-11-13 (`16f18184`); validated in dev on macOS by the Navigator 2026-11-13; published in v0.4.0-alpha.15 (2026-11-13)
**Driver:** Navigator
**Requested:** "Vamos aplicar esses cinco nomes, abrir a CR e executá-la", 2026-11-13, after
renaming the Navigator's Model Intents along one axis, what the work needs.

## Friction

After CR256 an intent is a purpose with a model per provider, but its name is all the menu
shows. A name short enough for the footer cannot say when to choose it: the Navigator's own
definitions ran to a sentence each ("when it will reach an external client and must arrive in its
best version"), and without them the choice fell back on remembering which model sat behind the
name, the very thing an intent exists to spare.

## What Changed

- **A line per intent.** An intent may carry `whenToUse`, up to 160 characters of human text, no
  control characters, whitespace collapsed; a blank line is dropped. It shows under the name in
  the menu and in Settings, and the intent form has a "When to use" field.
- **Schema 2.1.0, only when needed.** The store says 2.1.0 while some intent carries a line and
  stays 2.0.0 otherwise, so a store without lines remains readable by alpha.14. 2.0.0 keeps its
  exact shape: a line there is refused. The native validator follows the TypeScript one.
- **The menu stops at 420px,** so a long line wraps instead of widening it.

Specs in `modelIntents.test.ts`, `modelIntentMenu.test.tsx`, `modelIntentsPanel.test.tsx` and
`model_intents.rs`. Checked in a browser against the app stylesheet with a line of 154
characters: it wraps in two lines and the menu stays at 420px.

## The Navigator's Store

The five names agreed in the Conversation were applied to the production store (2.0.0, readable
by alpha.14) with a backup beside it, ids and bindings unchanged. The Navigator's definitions,
summarised, were written as lines to the dev app's store only, with a backup, because alpha.14
cannot read 2.1.0; they reach production once a release carrying this change is installed.

## Falsifier

In dev, the model menu shows each intent's line under its name, wrapped within the menu; Settings
shows it under the name and lets it be edited or cleared. Clearing every line and saving writes
2.0.0.
