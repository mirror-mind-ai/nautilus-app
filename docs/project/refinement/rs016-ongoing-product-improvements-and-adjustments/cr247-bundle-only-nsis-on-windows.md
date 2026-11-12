[< RS016](index.md)

# CR247: Bundle Only NSIS on Windows

**Status:** merged 2026-11-12; shown by the Windows CI; not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #14](https://github.com/mirror-mind-ai/nautilus-app/pull/14); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `5f48721b`.

## Friction

A Windows build with `targets: "all"` also tried MSI, which refuses a non-numeric pre-release such as `0.4.0-alpha.11`, and failed after the NSIS installer had been compiled. CI worked around it with `--bundles nsis`; a plain local build did not.

## What Changed

`src-tauri/tauri.windows.conf.json` sets `bundle.targets` to `["nsis"]`. Tauri merges it into every Windows build, so no flag is needed; other platforms keep `"all"`. A test pins both.

## Noted at Review

macOS bundling is untouched: the file is read only on Windows.

## Falsifier

On Windows, `npm run tauri:build:dev` without flags produces the NSIS installer and does not attempt MSI.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
