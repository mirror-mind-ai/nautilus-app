[< RS016](index.md)

# CR227: Do Not Hold a Returning Launch on Provider Discovery

**Status:** done · validated by the Navigator on macOS 2026-11-11 · published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #5](https://github.com/mirror-mind-ai/nautilus-app/pull/5); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #6, #10, #5 e do #8 com os ajustes mencionados"). Merge commit `7db792b7`.

## Friction

Every launch asks Pi which providers are signed in. On a machine whose antivirus reads Pi's files
cold that took 20 to 37 s, and setup held the person at "Checking your model providers…" though
they had finished setup the day before.

## What Changed

- `providerSetupNeeded` and `openRouterSetupNeeded` (`src/domain/launchSetupGate.ts`): a person who
  finished setup on this device before (a model is kept) works while Pi answers; a first run waits
  as before. Pi's answer still brings the provider step back when nothing is signed in.
- Spec `src/tests/launchSetupGate.test.ts` (11); the CV-010 connection tests follow the new shape.

## Noted at Review

If Pi answers after launch that no provider is ready (an expired sign-in, say), the window turns
to the provider step while the app is in use, where before the person never reached the app.
Accepted: a turn would fail without a provider anyway, and the draft is kept.

## Falsifier

With setup finished, a launch shows the Journeys before Pi has answered; with every provider
signed out, the provider step returns once Pi answers.

## Evaluation

Evaluated on 2026-11-10 with PRs #6, #10, #5 and #8 merged in that order onto `main` at `0f3ac37a`
in a separate worktree: no conflict; `tsc` clean; vitest 341 files, 2,920 passed, 3 skipped (two
of them the preflight tests that need the materialized runtime the worktree lacks); cargo 523
passed, 11 ignored. The merged `main` is byte for byte that evaluated tree. The repository has no
CI, so that run is its only green. After CR228's contrast fix, `main` ran again: vitest 344 files,
2,927 passed, 1 skipped; `tsc` clean.
