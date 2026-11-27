[< RS016](index.md)

# CR300: Build a Private Apple Silicon Test Bundle on the arm64 Runner

**Status:** in_progress 2026-11-27. Opened and implemented in the same turn: the Navigator asked for the bundle after the
cost was laid out ("vamos implementar o Bundle de teste para o Vinicius, aí eu mando pra ele").
**Driver:** Navigator
**Delivery:** `main`
**Requested:** on 2026-11-27, so that Vinicius, who found the Intel build opening but not working well on a Mac that is
not Intel, can try a native arm64 build as soon as he can. The Navigator sends it to him by hand.

## Friction

Nautilus ships one macOS build, x64. CR299 showed that its runtime layer runs under Rosetta on an arm64 runner, and that
a first run of the x64 Node there took 18 to 24 s against a 10 s host handshake; whether that is what Vinicius met is not
known, and he is not reachable now. Nobody on the team has an Apple Silicon Mac, so there is no arm64 bundle to hand him,
and no way to see one open here.

What is already in place, read in the code and not assumed: the app chooses its embedded runtime from the architecture it
runs on (`runtime_platform(arch)` in `mirror_host_bridge.rs`), `bundleConfig` is already per platform, `pin.json` pins the
`darwin-arm64` Node and the Claude SDK lock has the `darwin-arm64` binary, and `macos.yml` already runs the arm64 Node
through the `real_host` tests on this runner. On an arm64 host, `prepareBundledBuild` picks `darwin-arm64` by itself, so
building on the runner needs no change to any script.

## Planned

A workflow that only a person starts, builds the bundle on the arm64 runner and leaves it as a downloadable artifact.

**Which channel, and why.** The evaluation channel (`npm run tauri:build:eval`), not the user channel.

- The user channel enables the updater and polls `updates.mirrormind.sh` for `darwin-aarch64`. `manifestFor` writes one
  manifest for every target, so that endpoint serves the x64 archive: an arm64 user-channel app would be offered an Intel
  build at the next release, and the updater verifies a signature, not an architecture.
- The evaluation channel has no updater, its icon carries an amber dot so nobody takes it for the release, it builds only
  the `.app` and it asks for no updater key, so no secret reaches the runner.
- What it costs: it uses the stable identifier `ai.mirrormind.nautilus`, so it **reads and writes the same app data and
  Mirror binding as the installed app**, and it refuses to start while the stable app is running. The tester's guide says
  both. It is also the same code as the release, which is why it is a fair test of the release.

**What the job does.** Dispatch only, `macos-latest`, read-only token, actions pinned as in the other workflows. It stops
if the runner is not arm64. It lays out the host runtime for the runner's own platform, builds the evaluation bundle, and
checks it before it is worth sending: identifier `ai.mirrormind.nautilus`, name `Nautilus Eval`, the version of
`package.json`, the main executable and the embedded Node both `arm64`, the runtime receipt naming `darwin-arm64`. It
records the bundle's signature state, signs it ad hoc and verifies it, packs it with `ditto` and publishes the zip, its
SHA-256 and a summary as an artifact kept 7 days.

**Why an ad hoc signature.** An arm64 executable must carry at least an ad hoc signature to run. The linker gives the
binary one, but a bundle that is not sealed is the usual cause of "is damaged and can't be opened" once it has been
downloaded. Signing the bundle ad hoc does not make it trusted: Gatekeeper still asks the tester to open it anyway. The
job records the state before and after, because whether Tauri already seals it is not known.

**What it does not do, said so a green run is not read as more.** It cannot open the app or show a window; it cannot test
Gatekeeper, since nothing is quarantined on the runner; the voice component has no arm64 entry in its manifest, so voice
will not be available in this build; and it is not a release: no tag, no updater, no publication.

## What Changed

- `.github/workflows/macos-arm64-test-bundle.yml`: the manual job described above. It stops unless the runner is arm64,
  builds with `npm run tauri:build:eval -- -- --locked`, checks the bundle, signs it ad hoc and verifies that, packs it with
  `ditto`, writes the SHA-256 and a step summary, and uploads the zip for 7 days.
- `scripts/verify_macos_bundle.sh`: the check, outside the YAML so it can be run on any bundle. It reads the identity and
  version in `Info.plist`, requires the main executable and the embedded Node to be one architecture and the right one, and
  requires the runtime receipt to name the expected platform. It runs nothing from the bundle and changes nothing.
- `docs/alpha/apple-silicon-test-bundle.md`: how the maintainer builds and hands it over, and what the tester does and
  should expect, including that it shares the installed app's data and refuses to start beside it.
- `src/tests/macosArm64TestBundleWorkflow.test.ts`: 11 checks on the workflow, the script and the guide. Written first and
  seen failing with the workflow absent.

## Falsifier

The job must fail when the bundle is not what it should be. The guard on the runner's architecture is shown by the job
refusing on a non-arm64 host (not provable on an arm64 runner, so it is asserted by test on the file), and the checks on
the executable's architecture are shown by running the same shell on the x64 bundle already built on the Navigator's Mac.

Shown that way, on the Navigator's Intel Mac, against the x64 `Nautilus for Mirror Eval.app` already in `target`:
`verify_macos_bundle.sh` passes when told that bundle's own truth (x86_64, `darwin-x64`, its own version), and stops, exit 1,
when told it should be arm64 ("is not arm64"), when given another version, and when given the `darwin-arm64` runtime.

## Evaluation

Locally: the 11 new checks and the 5 of CR299's workflow pass, `git diff --check` is clean, and the workflow parses as
YAML with `workflow_dispatch` as its only trigger.

On the runner, pushed at `2e46ee95` and dispatched once: run `46005110297`, **success**, every step green, on macOS 26.7.2,
`uname -m` `arm64`. The runtime laid out was `darwin-arm64`. `verify_macos_bundle.sh` ended with `bundle ok: Nautilus Eval
0.4.0-alpha.28 (ai.mirrormind.nautilus), arm64, runtime darwin-arm64`.

The signature, which the plan said was not known: before the ad hoc signing the bundle carried only what the linker
adds (`flags=0x20002(adhoc,linker-signed)`, `Identifier=mirror_desktop`, not the bundle's identifier), so the bundle was
not sealed. After it: `Identifier=ai.mirrormind.nautilus`, `Signature=adhoc`, `TeamIdentifier=not set`, `valid on
disk` and `satisfies its Designated Requirement`. That is the reason the job signs it: without the seal, a downloaded copy
is the usual "is damaged" case.

Checked again from outside, in a new folder and without running anything from it: the artifact
`Nautilus-for-Mirror-Eval_0.4.0-alpha.28_arm64-2e46ee9.zip` (51 MB) matches its SHA-256
`318334ee9987072755d1a919412ac08e92583861e8c0b9df14665f7a1d475149`; unpacked, the identifier, name and version are right,
the executable and the embedded Node are `Mach-O 64-bit executable arm64`, and `codesign --verify --strict` passes.

Not shown, and it cannot be from here: that the app opens, what Gatekeeper says about the downloaded copy, and anything
about the window. Nobody has opened this bundle; Vinicius is the first.

## Validation Route

The Navigator dispatches the workflow, downloads the artifact with `gh run download`, checks the SHA-256, and sends the
zip with the guide to Vinicius. The CR closes on what Vinicius reports, or on the Navigator's word.
