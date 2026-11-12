[< RS016](index.md)

# CR248: Install, Launch and Uninstall in the Windows CI

**Status:** merged 2026-11-12; validated by the Windows CI (run `43223100214`, all twelve checks passed, installing `mirror-desktop-dev.exe` per CR249); not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #15](https://github.com/mirror-mind-ai/nautilus-app/pull/15); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `380a683c`.

## Friction

The Windows job compiled the installer and kept it, which proves the compiler ran, not that a person can install and start the app.

## What Changed

`scripts/windows_install_smoke.ps1` runs the NSIS installer silently, checks the registered version, the executable, the bundled Mirror host Node and the Start menu shortcut, starts the app and checks it is still running after fifteen seconds, then uninstalls silently and checks the executable, shortcut and registration are gone while the app data is kept. `windows.yml` runs it after the bundle step. A test pins the order and the checks.

## Noted at Review

The executable is read from the registration (`MainBinaryName`), so it holds with CR249's separate development name.

## Falsifier

Break the bundled Node path or the app's start: the Windows job turns red at the install step.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
