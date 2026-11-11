[< RS016](index.md)

# CR237: List the App's Own Claude Code Models

**Status:** validated in dev on macOS 2026-11-11 by the Navigator ("dev validado"); published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #3](https://github.com/mirror-mind-ai/nautilus-app/pull/3); merged on
the Navigator's word, 2026-11-11 ("faça o merge dos quatro"). Merge commit `8fd6b401`.

## Friction

After "Claude · through Claude Code" installed, the model list showed no Claude Code model on a
machine without the upstream `pi-claude-bridge` installed globally. The catalog came from Pi's
auto-discovered extensions in `~/.pi/agent`; the app's own provider (CR173) lives in app data, so
its models were only ever used to mark others available. A Mac that also has the global bridge
hides the gap.

## What Changed

`mark_model_availability` in `agent_settings.rs` returns the person's offered models, marked as
before, plus what only the app's own invocation can run, available by definition. One new test,
`offers_what_only_the_apps_own_invocation_can_run`.

## Falsifier

On a machine without the global bridge, connecting Claude through Claude Code lists its models and
a turn through one answers. On a Mac with the global bridge, the list is unchanged and no model
appears twice.

## Evaluation

Evaluated with CR236, CR238 and CR239; see CR236's Evaluation. The fix is platform-independent;
the contributor verified it on Windows through the app.
