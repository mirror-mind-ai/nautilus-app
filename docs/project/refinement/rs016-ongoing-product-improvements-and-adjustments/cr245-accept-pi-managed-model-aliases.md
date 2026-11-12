[< RS016](index.md)

# CR245: Accept Pi-Managed Model Aliases

**Status:** merged 2026-11-12; validated in dev on macOS 2026-11-12 except the alias itself: Pi listed no `~` model, so it was not exercised; published in v0.4.0-alpha.13 (2026-11-12)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #18](https://github.com/mirror-mind-ai/nautilus-app/pull/18); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `b2e6f25c`.

## Friction

Pi 1.4.0 lists some managed OpenRouter models with a leading `~` (for example `~anthropic/…`). The catalog and the native validator accept them, but the TypeScript settings parser's `SAFE_VALUE` refused them, so choosing such a model failed to save. Noted at the review of PR #1 and deferred.

## What Changed

`validAgentModelId` admits a single leading `~` on the model id only, then applies the unchanged `SAFE_VALUE` rule to the rest, bounding the whole id to 160 characters. Used by both the agent settings and the model intents parsers. The provider rule is unchanged. Tests round-trip `~anthropic/claude-sonnet-latest` and refuse `~`, `~~…`, `~../model`, a space, an overlong id and a `~` provider.

## Noted at Review

Mixed dots and slashes inside a model id were already admitted before this change; the `~` adds no new path-like form.

## Falsifier

In Settings, choose a Pi-managed `~anthropic/…` model and save: it is kept after a restart, and a turn runs with it.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
