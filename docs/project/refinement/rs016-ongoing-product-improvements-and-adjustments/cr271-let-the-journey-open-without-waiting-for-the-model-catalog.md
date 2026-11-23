[< RS016](index.md)

# CR271: Let the Journey Open Without Waiting for the Model Catalog

**Status:** merged 2026-11-23; measured on Windows by the contributor; awaiting a look in a dev build on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #21](https://github.com/mirror-mind-ai/nautilus-app/pull/21); merged on the Navigator's word, 2026-11-23 ("Proposta aprovada. Execute."), in a round with PR #25 and PR #23.
Merge commit `611b2e0c`.

## Friction

At launch the main screen came up, and the selected Journey's conversation appeared seconds later. It
showed most on Windows, where Pi runs under the carried Node.

## Cause

`list_pi_models` took the command serialisation guard and held it while Pi started twice (the catalog
with the person's extensions, then with the app's invocation). Until Pi answered, every other
serialised command waited: `load_journey_thread`, `read_journey_canvas`, `list_turn_journal`,
`preview_journey_workspace`.

## What Changed

The command takes the guard, reads the runtime profile and builds both Pi commands under it, and
releases it only for the wait on Pi, which reads nothing of the app's data. `inspect_pi_providers`
already waited on Pi this way. A test helper, `free_within`, lets a native test see that the guard is
free while Pi runs.

Measured by the contributor on installed development builds, time from process start to the
conversation being visible: later launches on a Windows 11 workstation 4.00 s on `main` and 1.88 s on
the branch (median of 10); first launches after a boot about 10 s and 7 s. The catalog itself is the
same on both builds.

## Noted at Review

- **Pi can change during the wait.** Another command may now run while the catalog waits on Pi, a Pi
  reinstall among them. The worst case is a failed catalog on that launch; nothing the app stores is
  read or written during the wait.
- **Not changed:** the first launch commands still wait behind `list_personas`, which holds the guard
  across a Mirror host request. The contributor names it as a separate decision.

## Falsifier

On launch, the selected Journey's conversation is visible before the model catalog has arrived, and a
turn sent at once runs. If the conversation still waits for the catalog, or the catalog differs from
the one before this change, this CR did not do its work.

## Evaluation

Read in full. The red/green native test `the_catalog_waits_for_pi_with_the_command_serialisation_guard_released`
passes. Same combined run as CR270: vitest 3109 passed, `tsc` clean, cargo 566 passed.
