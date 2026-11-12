[< RS016](index.md)

# CR240: Build and Publish the Windows Voice Component

**Status:** published 2026-11-11; installed from the manifest on two clean Windows 11 VMs by the contributor, 2026-11-12; transcription under an accented profile name needs CR244
**Driver:** Navigator, completing CR236
**Requested:** "a publicação do binario de voz do windows está autorizada" with the merge of CR236,
then "vamos Compilar na nossa própria CI do Windows", 2026-11-11.
**Implementation:** `0eb00c79`, `9b2d88b2`; CI run `43069386929`

## Friction

CR236 made voice work on Windows but the voice manifest had no Windows executable, so Settings →
Sound & Voice could not install one there. The contributor offered a binary built on his machine;
the Navigator chose to build it from source in this repository's own CI instead, so what Nautilus
distributes comes from a pinned upstream commit and a recorded build.

## What Changed

- `.github/workflows/voice-windows.yml`, run by hand, with only `contents: read` and actions pinned
  by commit. It fetches whisper.cpp at `2eeeba56e9edd762b4b38467bab96c2517163158` (the lightweight
  `v1.8.3` tag could be moved; the commit cannot), finds Visual Studio with `vswhere`, runs
  `scripts/build_whisper_cli_windows.cmd`, and proves the result before keeping it:
  - it imports only Windows' own DLLs (`dumpbin /dependents`: `KERNEL32.dll`, `ADVAPI32.dll`);
  - it transcribes upstream's `samples/jfk.wav` with the published `ggml-base-q5_1.bin`, its digest
    checked first, called with the arguments the app passes for an 11 s recording
    (`--audio-ctx 614`). The run's transcript: "And so my fellow Americans, ask not what your
    country can do for you, ask what you can do for your country."
- `scripts/build_whisper_cli_windows.cmd` accepts `VS` from its caller, and now really links the C
  runtime in: whisper.cpp declares CMake 3.5, so policy CMP0091 was old and
  `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded` was ignored without a word. The first CI run caught
  it: the binary needed `VCRUNTIME140.dll`, `MSVCP140.dll` and the CRT API sets, and would not have
  started on a Windows without the Visual C++ Redistributable. `-DCMAKE_POLICY_DEFAULT_CMP0091=NEW`
  fixes it.
- `.gitattributes` checks `*.cmd` out with CRLF, as cmd.exe expects.

## Publication

On `szen-vps`, `/var/www/mirror-desktop-updates/mirror-desktop/voice/`:

| File | sha256 | sizeBytes |
|---|---|---|
| `whisper-cli-v1.8.3-windows-x64.exe` | `d732478f9f8249e9031d5d631e38bd38233be1c0c1e149ab09fbad52d1cc58b9` | 2,195,968 |
| `manifest.json` | `195b4abf3d0e9ddc7f77e48a9217b8430c37ec3040710b30778650aafa6d737a` | 1,418 |

The executable went first and was verified over HTTPS; the manifest then replaced the previous one
by an atomic move. The manifest only adds the Windows entry: the macOS executable and both models
are unchanged and still served. The previous manifest
(`511950630503acdaa10a54c12d442f79b1914e966f472db15f1ab945a04efb29`) is kept outside the web root at
`~/voice-manifest-backups/manifest.20261111-before-windows.json` on the host; restoring it is the
rollback. The app's own `parse_manifest` accepted the served bytes for `macos/x64` and
`windows/x64` and refused `windows/aarch64`, in a throwaway test that was not committed.

The digest differs from the one the contributor reported (`b46b0634…`, 1,701,376 bytes): MSVC
builds are not byte-reproducible, and the extra half megabyte is the C runtime now linked in.

## Falsifier

On Windows, Settings → Sound & Voice installs the component from the default manifest, its digest
verified, and a Portuguese recording transcribes; on a Windows without the Visual C++
Redistributable it still starts. On macOS, the voice install and transcription are unchanged.

## Shown on Windows

On 2026-11-12 the contributor installed from the default manifest on two clean Windows 11 VMs
(en-US and pt-BR) without the Visual C++ Redistributable (no `VC\Runtimes` key, no `vcruntime140`
or `msvcp140` in System32). The installed `whisper-cli` matched the manifest (`d732478f…`,
2,195,968 bytes) and started, so the linked-in C runtime holds outside CI. On the pt-BR VM, whose
profile name has accents, every transcription crashed (`0xC0000409`) until CR244: the component
reads its argv in the ANSI code page and decodes paths as UTF-8. With CR244, a Portuguese sentence
transcribed on both VMs. The published binary and manifest stay as they are.
