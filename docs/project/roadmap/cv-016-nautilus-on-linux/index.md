[< Roadmap](../index.md)

# CV-016 - Nautilus on Linux

**Status:** 🟡 Candidate. Captured from the Navigator on 2026-11-28 ("vamos atualizar o roadmap
ariad para ele receber tudo o que vamos precisar fazer para portar o nautilus pra ele rodar em uma
distribuição linux. Usarei o mint que acabamos de instalar como espaço de testes"); not planned,
and no code has been changed.

## Outcome

A person on a common Linux desktop installs Nautilus for Mirror as one file, opens it, connects to
their Mirror, works in their Journeys with the same conversation, tree and updates a person has on
macOS and Windows, and is told plainly what the Linux build does not yet do.

## Why (Navigator, 2026-11-28)

Nautilus ships on macOS and Windows. Linux is where many of the people who run their own Mirror and
their own Pi already work. The architecture was written to stay compatible with Linux
([App principles](../../../product/app-principles.md)); this capability turns that intent into a build
someone can install, and into a way to know it works.

## The Test Bench (2026-11-28)

The port is tested in one virtual machine on the Navigator's Mac, so no part of it needs a second
computer.

| Fact | Value |
|------|-------|
| Host | Mac Intel (i7-9750H), 16 GB, macOS 26, UTM 4.7.5 |
| Guest | Linux Mint 22.3 "Zena", Xfce edition, 64-bit (Ubuntu 24.04 base), X11 session |
| Virtualization | UTM, QEMU backend, `Architecture = x86_64`, `virtio-gpu-pci`, no emulation of another CPU |
| Installed | to the virtual disk, with a user and a password; the live ISO is ejected |
| Clipboard and resize | work after `sudo apt install spice-vdagent` and a restart (UTM's Linux guest page requires it) |
| ISO | `linuxmint-22.3-xfce-64bit.iso`, SHA256 checked by the Navigator; it can be deleted from Downloads |
| Disk | about 10 GB real for the guest; the Mac is short of space |

What this bench covers, and what it does not:

- It covers x86_64, glibc, GTK 3 and WebKitGTK 4.1 on X11, the Ubuntu 24.04 family, which is the
  most common base for a first-time Linux user.
- It does **not** cover Wayland, GNOME's own shell, Fedora or Arch libraries, a musl system, or ARM64
  (an Intel host cannot run an ARM64 guest at useful speed). Each is a named risk below, not a claim.

## What We Know Today (read from the repository on 2026-11-28)

These are facts read in the code, not decisions.

**What already helps.**

- The Rust shell has `cfg(unix)` paths, a `xdg-open` reveal, and the OpenRouter key file with 0600
  permissions (`src-tauri/src/platform.rs`).
- `claude_sign_in.rs` already maps Linux to the Claude SDK's Linux packages, and the SDK lockfile
  carries the x64 and arm64 variants, glibc and musl.
- The founding exploration anticipated Linux artifacts with a supported or preview status
  ([exploration](../../explorations/mirror-desktop-core-installer-and-tauri-app-migration/)).
- The Windows line is the model for a second release route: `windows.yml` (CI), `windows-release.yml`
  (the tagged build), `scripts/windows_release.mjs`, `docs/release/windows-release.md`.

**What stops a Linux build today.**

| Gate | Where | What it does today |
|------|-------|--------------------|
| Host pin | `scripts/mirror_host_pin.mjs`, `mirror-host/pin.json` | Knows `darwin-arm64`, `darwin-x64` and `win-x64` only; no Node for Linux |
| A test that wants the refusal | `src/tests/cv010HostPin.test.mjs` | Asserts that `bundleConfig("linux-x64")` throws; it will have to say the opposite |
| Window close | `src-tauri/src/main.rs`, `close_quits_app` and its test | True for Windows only; a test asserts `!close_quits_app("linux")` |
| Lockfile filter | `mirror-host/pi-install.mjs`, `readLockfile` | Filters by os and cpu but not libc, so both glibc and musl Claude SDK variants pass |
| Compatibility floor | `config/runtime-compatibility.json` | Has a macOS floor only |
| Bundle targets | `src-tauri/tauri.conf.json` | `targets: "all"`; Windows narrows it in `tauri.windows.conf.json` (CR247), Linux has no file |
| CI | `.github/workflows/` | No Linux workflow and no Linux release route |
| Updater route | `https://updates.mirrormind.sh/nautilus/{{target}}/{{current_version}}/latest.json` | No Linux target is published, so an installed Linux app would get 404 (the Windows problem of CR287) |
| Voice | `scripts/voice_component_manifest.mjs`, the whisper build scripts | macOS and Windows entries only |

**Not yet known.** None of these has been run: `tauri build` on Linux, the AppImage's behaviour on a
default Mint, the real WebKitGTK version the bench carries, whether the frontend passes the
WebKitGTK engine (the macOS 12 floor taught that an old WebKit rejects lookbehind, `.at()` and bare
`color-mix()`), and how the embedded Node, Core and Pi behave under a home with accented characters.

## Open Before Planning

- **Which artifact.** AppImage (one file, the updater can replace it) is the working proposal. A
  `.deb` is easier on Mint and Ubuntu but ties updates to a package manager. Flatpak and Snap are
  outside the first release.
- **Which CPU.** x86_64 only, as the first macOS release was Intel-only. ARM64 Linux needs a runner
  or a machine the Navigator does not have today.
- **Wayland.** The bench is X11. A second guest (Ubuntu 24.04 desktop, GNOME on Wayland, an ISO of
  about 6 GB) answers it, and costs disk the Mac is short of.
- **FUSE.** AppImage needs `libfuse2`, which Ubuntu 24.04 no longer installs by default. Whether
  Nautilus asks the person to install it, extracts itself, or ships another way is a decision.
- **Closing the window.** Quit, as on Windows, or stay in a tray, which Linux desktops do not
  agree on. Proposed: quit.
- **Voice.** Ship the first Linux build without it and say so, or build whisper.cpp for Linux first.
- **Status of the first release.** Proposed: a preview, named as such in the app and on the site,
  until a second machine and a second desktop environment have run it.
- **Where the artifact is described.** The site's Windows pages belong to another Journey and wait;
  the Linux page would be the same kind of request.

## Candidate Delivery Stories

The first story proves the path on the bench; the others widen it. Nothing is built before the
Navigator selects the capability. Each story is then split into small CRs, test first, in a new
refinement stream (RS029 is the next free number), as the Windows line was.

| Code | Delivery Story | Outcome | Status |
|------|----------------|---------|--------|
| CV-016.DS-001 | The Bench and a Dev Run | The prerequisites for building on Mint are written down and the source app starts on the bench with `npm run tauri:dev`, with whatever it shows recorded, including the WebKitGTK version and the first visible breakages | 🟡 Candidate |
| CV-016.DS-002 | A Linux Host Runtime | The pin knows `linux-x64` and a checked Node for it, the host lays out its runtime, the lockfile filter takes glibc only, and the test that wanted the refusal now wants the layout | 🟡 Candidate |
| CV-016.DS-003 | A Shell That Behaves on Linux | Window close, paths and XDG folders, opening links and revealing files, drag and drop of attachments and the first-run assistant work on the bench, each pinned by a test where the code can say so | 🟡 Candidate |
| CV-016.DS-004 | A Linux Bundle and Its CI | `tauri.linux.conf.json` narrows the bundle to the chosen artifact, a workflow on `ubuntu-24.04` runs the suites and builds it, and starts the built app headless as the Windows CI starts the installer | 🟡 Candidate |
| CV-016.DS-005 | Linux Updates and a Release Route | A tagged build is signed with the updater key outside CI, published at a Linux target of the updater endpoint, and an installed app updates and keeps its Journeys; the compatibility floor knows Linux; `docs/release/linux-release.md` exists | 🟡 Candidate |
| CV-016.DS-006 | Voice on Linux | A whisper.cpp build for Linux, pinned by commit and proven on a sample, a manifest entry, and the microphone permission through WebKitGTK; may follow the first release | 🟡 Candidate |
| CV-016.DS-007 | Say What Linux Is | The preview status, the tested distributions and the known gaps are stated in the app, in the install guide and on the site, and a second desktop (Wayland) is run or declared untested | 🟡 Candidate |

DS-001 comes first because it measures the rest. DS-002 and DS-003 can run after it in either
order; DS-004 needs DS-002; DS-005 needs DS-004; DS-006 and DS-007 need DS-005 only for what they
publish.

### What DS-001 Must Prove

- The app builds from source on the bench with the prerequisites written down, from a clean clone of
  the Mint VM, so the guide is true and not remembered.
- The frontend renders on the bench's WebKitGTK, or its failures are listed, each one a CR.
- The bench's facts (distribution, session type, glibc, WebKitGTK, FUSE 2) are recorded in the story,
  so the compatibility floor is chosen from a measurement.

## Boundaries

- This capability does not edit the production Mirror checkout or the production home; Linux tests run
  in the VM, in a home made for the test.
- It does not sign anything for Linux beyond the updater key, which never enters CI.
- No release, tag, publication, push or site change is authorized by this document. Each is the
  Navigator's own word, as for the other platforms.
- The site's pages belong to another Journey.
- Core changes, if the port finds any, go through the Core's own gates and release train.
