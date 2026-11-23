[< RS016](index.md)

# CR278: Start the macOS Voice Component on macOS 12

**Status:** validated 2026-11-23 (`196314e5`, `2b0ea4d6`); published, installed from the manifest on the macOS 12 Mac, and a recording transcribed there
**Driver:** Navigator
**Requested:** on 2026-11-23, using alpha.21 on the macOS 12 Mac: "a transcrição de áudio não está funcionando. Dá esse erro: Local transcription failed. The draft was left unchanged." Then "sim, pode prosseguir" to the plan below.

## Friction

On macOS 12, Settings installs the voice component and the microphone records, and every
transcription ends in "Local transcription failed. The draft was left unchanged." The sentence is
the same for every failure, so it says nothing about the cause.

## What Was Found

Run by hand on the macOS 12.7.6 Mac, the installed `whisper-cli-v1.8.3-macos-x64` does not start:

```text
dyld: Symbol not found: (_cblas_sgemm$NEWLAPACK$ILP64)
  Expected in: /System/Library/Frameworks/Accelerate.framework/Versions/A/Accelerate
```

- whisper.cpp's BLAS backend defines `ACCELERATE_NEW_LAPACK` whenever it finds Accelerate
  (`ggml/src/ggml-blas/CMakeLists.txt`), and the new LAPACK symbols exist in the framework only from
  macOS 13.3. The deployment target does not change that.
- The published binary also declares `minos 26.0`: it was built on a macOS 26 Mac without a
  deployment target. That alone would stop it on any older macOS; the missing symbol is what the
  loader meets first.
- The first fix tried, a build with target 12.0, kept the Accelerate import and passed on the
  macOS 26 Mac. It failed the same way on the macOS 12 Mac. Only a run there tells.

The app does not compare the installed executable with the manifest: the state is "ready" while the
sizes match the receipt. An installed binary that cannot start stays "ready" until the person removes
the component and installs it again.

## What Was Done

- `scripts/build_whisper_cli_macos.sh <dir> [<model>]` builds whisper.cpp at the commit the Windows
  build already pins (`2eeeba56…`, checked after the fetch) with deployment target 12.0, AVX2 and no
  BLAS, in a clean environment and with the Makefile generator that comes with the Xcode tools. It
  names the result `whisper-cli-v1.8.3-macos12-x64`, never the name already served, runs the check
  below, and with a model transcribes upstream's sample. Run twice, it gave the same bytes
  (`fd2179a0…`, 2,647,960 bytes).
- `scripts/check_whisper_cli_macos.mjs` refuses a binary that asks for a macOS above the floor of
  `config/runtime-compatibility.json` (a test ties the two), links Accelerate or any library outside
  `/usr/lib` and `/System/Library`, or imports a `NEWLAPACK` symbol. Over the real files: the
  published binary is refused for all three, the first rebuild for the last two, the script's output
  passes (`src/tests/whisperCliMacosCheck.test.mjs`).
- Proved on the macOS 12.7.6 Mac, outside the app and its data: the artifact's digest matched, and
  with the installed `small-q5_1` model and the app's arguments (`--audio-ctx 614`) it transcribed
  upstream's sample ("And so my fellow Americans, ask not what your country can do for you…").
  Without Accelerate it takes about 26 s for 11 s of audio on that i5, against 8 s with it on a
  newer Mac.

## Publication

On `szen-vps`, `/var/www/mirror-desktop-updates/mirror-desktop/voice/`, as in CR240, authorized by the
Navigator ("pode publicar") on 2026-11-23:

| File | sha256 | sizeBytes |
|---|---|---|
| `whisper-cli-v1.8.3-macos12-x64` | `fd2179a04e83737faa5548c6e651c840879caedda65bfaad61bd01c4d217b24a` | 2,647,960 |
| `manifest.json` | `e71e48fdd1d724d31045304c67c58bb7742883664d3d87332a57703eacb64056` | 1,422 |

The executable went first, through a hidden temporary name, and its digest was checked over HTTPS;
the manifest then replaced the previous one by an atomic move. The manifest differs only in the
macOS x64 entry. The previous manifest (`195b4abf…`) is kept at
`~/voice-manifest-backups/manifest.20261123-before-macos12.json` on the host; restoring it is the
rollback. The old `whisper-cli-v1.8.3-macos-x64` is still served and untouched. Before the swap, a
throwaway test (not committed) ran the app's own `parse_manifest` over the file: it accepted
`macos/x64` and `windows/x64` and refused `macos/aarch64`, as before. After it, all four files in
the manifest answered 200.

## Shown on macOS 12

On 2026-11-23 the Navigator removed the component in Settings and installed it again on the macOS
12.7.6 Mac, recorded a sentence and it transcribed. The installed `whisper-cli-v1.8.3-macos12-x64`
there is 2,647,960 bytes with the published digest (`fd2179a0…`), beside `ggml-small-q5_1.bin`.

## Not Done

- **The sentence.** "Local transcription failed" still hides the cause. Saying that the component
  cannot start on this macOS, and offering reinstall when it is the installed one that is wrong, is a
  smaller change worth its own plan.
- **Installed binaries that cannot start** are not detected; see What Was Found.
- **A Mac Pro of 2013** has no AVX2 and would not start this binary either; macOS 12 is its last
  system and the app does not target it.

## Falsifier

On the macOS 12 Mac, after the manifest names the new file, Settings installs the component and a
recorded sentence in Portuguese appears in the draft; on a current Mac, installing and transcribing
are unchanged.
