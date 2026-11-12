[< RS016](index.md)

# CR249: Give the Windows Development App Its Own Executable

**Status:** merged 2026-11-12; shown on a clean Windows VM by the contributor (10 of 10); the Windows CI install check registered and ran `mirror-desktop-dev.exe` (run `43223100214`); not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #16](https://github.com/mirror-mind-ai/nautilus-app/pull/16); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `7ddac5d4`.

## Friction

Both channels installed `mirror-desktop.exe` on Windows, and the NSIS installer, the updater too, ends any running process with its executable's name: installing the development app closed the daily one.

## What Changed

`src-tauri/tauri.dev.windows.conf.json` sets `mainBinaryName` to `mirror-desktop-dev`, and the channel launcher adds it only for the development channel on Windows. The stable and development configs keep no `mainBinaryName`, so macOS bundles are unchanged. Tests pin both, and the host pin test accepts the extra argument.

## Noted at Review

Applies to both `dev` and `build` of the development channel on Windows.

## Falsifier

On Windows, with the stable app open, install the development build: the stable app keeps running.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
