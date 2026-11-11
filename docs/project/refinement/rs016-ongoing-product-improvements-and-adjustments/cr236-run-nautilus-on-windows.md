[< RS016](index.md)

# CR236: Run Nautilus on Windows

**Status:** merged 2026-11-11, awaiting the Navigator's validation on macOS; not published
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #1](https://github.com/mirror-mind-ai/nautilus-app/pull/1); merged on
the Navigator's word, 2026-11-11 ("o ícone está aprovado, faça o merge dos quatro"). Merge commit `45085974`.

## Friction

Nautilus built and ran only on macOS. On Windows the native crate did not compile, the release
executable opened a console beside the window, a second launch opened a second window on the same
home, and several POSIX assumptions (shebangs, permission bits, `HOME`, the verbatim `\\?\` path
prefix) broke the host, Pi and the turn.

## What Changed

- `src-tauri/src/platform.rs` holds every platform decision: private files and directories,
  executable checks, directory sync, home and app-data roots, a `canonicalize` that strips the
  verbatim prefix, `HOME` and `USERPROFILE`, Pi run by the carried Node, no console on spawned
  processes, the taskbar's big icon. On POSIX each function does what the call site did before.
- `mirror-host/pin.json` adds win-x64 Node beside the two macOS archives; the Core pin (0.44.0)
  is unchanged. `scripts/mirror_host_pin.mjs` and `mirror-host/pi-install.mjs` learn the zip
  layout, bsdtar, rename retries and a Pi warm-up after install.
- A windowed executable, `tauri-plugin-single-instance` registered first, and a `.ico` per channel.
- **A new icon for every channel, macOS included**: the dark spiral gives way to a nautilus shell
  that reads at 16 px, the channel marked by a dot (teal for dev, amber for eval) instead of a
  text badge. `scripts/nautilus_icon.mjs` regenerates them. The Navigator approved it before the
  merge ("o ícone está aprovado"); the setup guide now describes the new marks.
- Shared behaviour a macOS person meets: a microphone picker in Settings → Sound & Voice, kept
  with the home's preferences, falling back once to the default when the chosen device is gone;
  whisper's audio context sized to the recording (`--audio-ctx`); Pi's provider status waits up
  to 60 s instead of 20 s; "this Mac" reads "this computer" in the interface.
- `scripts/build_whisper_cli_windows.cmd` builds a static whisper-cli for Windows. The binary is
  not yet in the voice manifest; see Noted at Review.

## Noted at Review

- `mirror-host/pi-install.mjs` changed, so a runtime laid out before this CR fails the private
  alpha preflight ("rematerialize with --replace"). The development runtime was rematerialized
  after the merge and the preflight passes.
- The Windows voice binary's publication was authorized with the merge. Its bytes were not
  available to the assistant: the contributor's fork has no release and the build script runs only
  on Windows. Publication waits for the binary; the manifest is unchanged.
- The contributor's Windows evidence (Windows 11, two clean VMs, 22 system and 39 UI checks each)
  is reported, not reproduced here.
- Left for decision, from the PR: `SAFE_VALUE` refuses Pi 1.4.0's `~anthropic/…` aliases, and the
  "Project path" placeholder is POSIX.

## Falsifier

On macOS: dev and the installed app still open side by side, a second launch of either brings its
own window forward, voice transcribes Portuguese as before and no slower, the microphone picker
records from the chosen device, and every turn, file link and artifact behaves as before. On
Windows, the contributor's battery holds.

## Evaluation

Evaluated on 2026-11-11 with PRs #1, #3, #2 and #13 merged in that order onto `main` at `0000ba39`
in a separate worktree; no conflicts. `tsc` clean; vitest 348 files, 2,952 passed with a
rematerialized runtime (two preflight tests fail against a runtime laid out before this CR, as
above); build passed; cargo 533 passed, 11 ignored; the five real-host tests against Core 0.44.0
passed. The merged `main` is byte for byte that evaluated tree. Windows-only code paths do not
run on macOS; from this merge on, CR238's Windows job runs them.
