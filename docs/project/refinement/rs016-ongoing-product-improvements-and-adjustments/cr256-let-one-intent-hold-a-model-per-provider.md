[< RS016](index.md)

# CR256: Let One Intent Hold a Model per Provider

**Status:** implemented 2026-11-12 (`dca5f329`); validated in dev on macOS by the Navigator 2026-11-12; not released
**Driver:** Navigator
**Requested:** "eu tenho que duplicar a semantica por provider", 2026-11-12, reading the Model
Intents of production v0.4.0-alpha.13.

## Friction

A Model Intent (CR078) was exactly one model and one thinking level. The purpose and the
configuration serving it were one thing, so a purpose kept on two providers took two intents,
and the provider moved into the name: the Navigator's store held five purposes as ten intents
labelled "[Anthropic] ..." and "[OpenAI] ...". The limit of twelve intents left no room for a
third provider, and switching every purpose to the other provider meant picking a different
intent each time.

## What Changed

The store moves to schema 2.0.0. An intent holds a name and up to four bindings, one per
provider; the store keeps the Navigator's provider order.

- **Choosing by name.** The menu shows each purpose once. Choosing the name uses the first
  provider in order whose model can run, so a provider that cannot run is skipped. When an
  intent has more than one binding, its providers sit beside the name and each chooses its own.
  The entry shows the binding in use, or the one the name would choose.
- **Settings.** The panel lists every binding under the name, composes an intent from one or
  more models ("Add a model from another provider"), and orders the providers once there is more
  than one.
- **Recognition.** Conversations still store the concrete model and thinking level, as before.
  The footer names an intent when the configuration in force equals any of its bindings. A
  change of provider order affects the next choice, not a conversation that already holds one.
- **Compatibility.** A 1.0.0 store is read as intents of one binding each, in TypeScript and in
  the native validator, and is written back as 2.0.0 on the next save. An app before this change
  cannot read a 2.0.0 store.

Specs: `modelIntents.test.ts` (the 1.0.0 reading, bindings, provider order, resolution and
matching), `modelIntentMenu.test.tsx` (the providers beside the name, and which binding a choice
sends), `modelIntentsPanel.test.tsx`, and the Rust tests in `model_intents.rs`.

## The Navigator's Store

At the Navigator's request, the ten intents were merged into five purposes with two bindings each
(claude-bridge first, then openai-codex), the names without the provider prefix, every binding
kept exactly. Every one of the ten old bindings is still recognised by the merged store. Because
the production app reads only 1.0.0, the merged file was written to the dev app's data and
staged beside the production file, with a backup of the original; it replaces the production
file once a release carrying this change is installed there.

## Falsifier

In dev, the menu shows five purposes, each with claude-bridge and openai-codex beside it.
Choosing a name uses claude-bridge; choosing openai-codex uses that model, and the footer still
names the purpose. Moving openai-codex up in Settings makes the name choose it.
