[< RS016](index.md)

# CR244: Run the Windows Voice Component With Relative Paths

**Status:** merged 2026-11-12; shown on two clean Windows 11 VMs by the contributor (en-US and pt-BR, the pt-BR profile named `João Çãõ Silva`); awaits a dev check of voice on macOS; not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #20](https://github.com/mirror-mind-ai/nautilus-app/pull/20); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `11f424c9`.

## Friction

On a clean pt-BR Windows whose profile name carries accents, the published voice component (CR240, `d732478f…`) installed and verified, then crashed on every transcription with `0xC0000409` and no output. The contributor isolated it with the same binary and model: it transcribes from an ASCII folder and crashes whenever `--model` or `--file` lies under `C:\Users\João Çãõ Silva\…`. The Windows C runtime hands `main()` its argv in the ANSI code page while whisper's model loader decodes the path as UTF-8. A Brazilian profile name is the ordinary case for this product's people, not an edge, so voice on Windows as released in alpha.12 works only for profiles with ASCII names.

## What Changed

`run_transcription` starts the component with its own folder (`<app data>/voice-transcription`) as working directory, and `transcription_arguments` gives `--model` and `--file` relative to it (`current/<model>`, `tmp/<nonce>.wav`), which are ASCII by construction. A path outside that folder keeps its full form. A new unit test builds the arguments under an accented root and asserts every argument is ASCII; the existing run test's fake component checks the relative audio path exists, which also proves the working directory. No manifest or binary change: the published component keeps its hash.

## Noted at Review

The change applies on every platform, so macOS also runs the component from its folder now; the native suite passes there, but a recording transcribed in dev on macOS has not been shown yet. The contributor also offered a patch to the pinned whisper.cpp command line (`wmain` with a UTF-8 argv, plus a Unicode path gate in `voice-windows.yml`, on the fork's branch `fix/voice-unicode-model-path`). It would fix the component itself but needs a republished binary with a new hash. Declined for now: Nautilus is the only caller of this component, so the app owning the invocation contract is enough, and keeping the published binary a clean build of a pinned upstream commit keeps the hash the contributor just verified. To be reopened if anything other than Nautilus ever runs that executable, or offered upstream.

## Falsifier

On Windows with an accented profile name, record a Portuguese sentence: it transcribes, and no `0xC0000409` appears. On macOS in dev, a recording still transcribes.

## Evaluation

Read in full before merging. The seven PRs (#14 to #20) were merged together onto `main` (`f6a1e168`) in a local integration branch and run on macOS from a clean environment: `npm run build`, Vitest 355 files, 2,973 passed and 1 skipped, `cargo test --locked` 534 passed and 11 ignored. The PRs' own CI had run only the Windows job, and `main` had moved since (CR243). The merged `main` was then compared with that integration tree and found identical.
