[< RS016](index.md)

# CR299: Run the Shipped x64 Runtime Under Rosetta on an Apple Silicon Runner

**Status:** in_progress 2026-11-27. The plan was approved and the push authorized by the Navigator on the same day. The
workflow is written and its tests pass on x64; the runs on the arm64 runner are not made yet.
**Driver:** Navigator
**Delivery:** `main`
**Requested:** on 2026-11-27, after Vinicius opened the Intel build on a Mac that is not Intel and reported that the
app opens but does not work well, with no further detail. The Navigator asked for a manual job on GitHub's
`macos-latest` runner (arm64) to try to reproduce it.

## Friction

Nautilus ships one macOS build, x64. Whether it works on Apple Silicon under Rosetta has never been measured:
CR172 left it open ("including the bundled Node host and the app's own Pi"), and CV-010.DS-005 records that the
arm64 runtime "has not been run on an arm64 Mac" and that Rosetta was "never measured". The Navigator's Mac is
Intel, and a macOS virtual machine on an Intel host is Intel too, so neither can reproduce a Rosetta run. CR243's
macOS workflow does run on arm64, but with the arm64 Node, so it does not exercise the x64 Node the app ships.

Vinicius is the first report from Apple Silicon. Known: the app opens, so the executable starts and Rosetta is
present on his Mac. Not known: what failed, on which macOS, in which version of the app, and whether it is a
Rosetta problem at all; an Intel Mac with the same first-run state could meet the same thing.

## Planned

Proposed, not yet approved. A workflow that runs by hand only and answers one question: does the pinned x64
runtime the app embeds start and serve the Mirror Core when it is translated by Rosetta?

- `.github/workflows/macos-rosetta.yml`, `workflow_dispatch` as its only trigger, so it spends no minutes on a push
  or a pull request. `runs-on: macos-latest`, `permissions: contents: read`, and the third-party actions pinned by
  the same commits as `macos.yml`.
- It records `sw_vers` and `uname -m`, then makes sure Rosetta is present (`arch -x86_64 /usr/bin/true`, and
  `softwareupdate --install-rosetta --agree-to-license` when it is not).
- It runs `npm ci` and `node scripts/mirror_host_pin.mjs materialize --platform darwin-x64`. The script skips its
  own version check for a platform that is not the host's, so the job runs the x64 Node itself: `file` must say
  x86_64 and `node -p process.arch` must print `x64` while `uname -m` prints `arm64`. That pair is the proof the run
  was translated.
- It runs the `real_host` tests with `MIRROR_HOST_RUNTIME` pointing at `.mirror-host/runtime/darwin-x64`.
- First thing to read before writing it: what in the runtime starts Pi, and whether any `real_host` test reaches it.
  If none does, the job needs a minimal start check for Pi, since CR172 names Pi as unmeasured.

Open points, found by reading and not by trying: `materialize` for a non-host platform has not been run; Rosetta
on a hosted runner has not been confirmed; `macos-latest` moves to newer macOS releases and Vinicius's version is
unknown, so the run records the version it got rather than assuming one.

A workflow dispatched from the Actions tab must exist on the default branch, so the push of this file is a
separate decision of the Navigator. The Navigator authorized it with the plan.

Three choices made while building, each against the plan as first written:

- The native tests are compiled for `x86_64-apple-darwin` (`--target`), not left as the runner's arm64. The app that
  ships is x64 from the shell down, so its Rust side is translated too and reads `x86_64` as its architecture; an
  arm64 test binary driving an x64 Node would have been a half of that.
- The `real_host` filter does not reach Pi: Pi is installed and started by `real_pi_install_installs_the_pinned_pi_once`
  (it runs `pi --version` and expects `1.4.0`) and by `real_pi_auth_reports_and_signs_in_through_the_apps_pi`, so the
  job names `real_host real_pi_install real_pi_auth`. That settles the first thing the plan said to read.
- Left out on purpose: `real_keychain_keeps_reads_and_removes_a_key` (it touches the runner's login keychain, which
  says nothing about Rosetta) and the two voice spikes (the voice component is its own x64 binary, a separate question).

What it does not cover, said here so a green run is not read as more than it is: no window opens, so nothing about
WebKit, the interface or first-run screens; it runs the runtime layer only.

## What Changed

- `.github/workflows/macos-rosetta.yml`: the manual-only job described above, with a `falsifier` input.
- `src/tests/macosRosettaWorkflow.test.ts`: five checks on the workflow file (manual trigger only, read-only token,
  actions pinned by the commits `macos.yml` uses, the order of the steps, the translation condition, the
  falsifiers). Written first and seen failing with the file absent.

## Falsifier

A green job must be able to turn red. Run once with `MIRROR_HOST_RUNTIME` pointing at a directory that does not
exist: the `real_host` step must fail. Run also with the Node check expecting `arm64`: it must fail, which proves
the job tells a translated process from a native one.

`missing-runtime` was shown locally: the same command with a runtime that does not exist fails all 8 tests (exit
101). `expect-arm64` is owed on the runner.
If the job is green and Vinicius still has a problem, the defect is outside the runtime layer, and the next move is
a real Apple Silicon session with him. If it is red, the log is the reproduction and this CR becomes the fix.

## Evaluation

On the Navigator's Intel Mac (x86_64, macOS 12), in a clean environment with a scratch `HOME`, the exact command the
job runs, `cargo test --locked --target x86_64-apple-darwin -- --ignored real_host real_pi_install real_pi_auth`
against the materialized `darwin-x64` runtime: **8 passed, 0 failed**, including the Pi install and the Pi sign-in.
That is the baseline: a red run on the runner is the arm64 host, Rosetta or the runner's macOS, not the tests.

The arm64 half is not provable here. The Intel host cannot report `arm64`, so the translation check and its
`expect-arm64` falsifier are first exercised on the runner.

## Validation Route

The Navigator dispatches the workflow from the Actions tab (or with `gh workflow run macos-rosetta.yml`) and reads
the run: the recorded macOS and architecture, the translated Node check, and the `real_host` and Pi results. In this
order: `none` (the answer), `missing-runtime` (must be red at the test step), `expect-arm64` (must be red at the
translation check). Then the answer is compared with what Vinicius reports.
