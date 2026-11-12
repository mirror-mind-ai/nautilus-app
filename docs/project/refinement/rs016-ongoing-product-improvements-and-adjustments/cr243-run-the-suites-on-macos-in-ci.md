[< RS016](index.md)

# CR243: Run the Suites on macOS in CI

**Status:** validated in CI on macOS 2026-11-12. A dispatched run is green and a deliberate break
was shown red; the workflow runs on push, pull requests and on demand.
**Driver:** Navigator, 2026-11-11 ("Temos que criar uma CI para o Mac, certo?", "Abra a CR e
planeje primeiro", then "plano aprovado. Implemente")
**Requested:** a continuous integration for macOS, the production platform, to match the Windows
one CR238 added.

## Friction

CR238 gave the repository a Windows workflow, but macOS, the platform production ships on, was
verified only on the assistant's machine. When an external pull request arrives, the assistant was
the single macOS check and the result was recorded nowhere. The first gate macOS passed through was
the local `prepare` at release time, which is late to learn a suite broke and invisible to a
contributor. The `real_host` tests, which exercise the embedded Mirror Core against the pinned
runtime, ran only locally and never on a pull request.

## What Changed

`.github/workflows/macos.yml`, a sibling to `windows.yml`, on push to `main`, on pull requests and
on demand, with its own `concurrency` group so a superseded run is cancelled. It runs `npm ci`,
`npm run build` (the `tsc` check and the Vite build), `npx vitest run` (the full frontend suite,
including the POSIX-only cases Windows skips by name), `cargo test --locked`, then lays out the
Mirror host runtime (`node scripts/mirror_host_pin.mjs materialize`) and runs the `real_host` tests
(`cargo test --locked real_host -- --ignored`) against it with `MIRROR_HOST_RUNTIME` pointed at the
laid-out runtime. That last step is the one Windows does not have and the one only the assistant ran
before; it is why the workflow exists. From the first commit it carries `permissions: contents:
read` and pins the third-party actions (`actions/checkout`, `actions/setup-node`,
`dtolnay/rust-toolchain`, `Swatinem/rust-cache`) by commit.

## The Runner Is arm64, and What That Costs

Nautilus ships Intel-only (x64), so the plan aimed at the Intel runner to exercise the x64 path the
app actually distributes. GitHub's free Intel runner, `macos-13`, no longer allocates: a job pinned
to it sat queued for thirteen minutes without a runner and was cancelled (run `43171400472`). The
Intel `-large` runners are a paid tier and off-limits for a public repository. So the workflow runs
on `macos-latest`, which the run records as arm64 (macOS 26.7.2, `uname -m: arm64`).

This is the plan's acknowledged fallback. The frontend suite, `cargo test` and the Core integration
are architecture independent and keep their value on arm64; the real_host tests run the Core on an
arm64 Node, not the x64 Node users receive, so the integration behaviour is covered while the
shipped binary's architecture is not. The DMG is therefore not built in CI: on arm64 it would be the
wrong architecture, and the shipped x64 bundle is produced locally at release `prepare`, unsigned.
Building the shipped x64 DMG in CI would mean cross-compiling to `x86_64-apple-darwin` and running it
under Rosetta on an arm64 runner; that is a separate refinement, not folded in here, and the record
says plainly that this CI does not exercise the shipped x64 runtime rather than implying it does.

## One Test Was Load-Sensitive, and the Cause Was Fixed

The first green-path run went red at `cargo test`: `turn_start_timing`'s
`each_phase_spans_from_the_previous_mark_and_is_named_by_the_step_that_ends_it` asserted that a phase
measured after a 40 ms sleep fell under 80 ms. A shared runner can deschedule a thread so a sleep
overshoots any absolute ceiling, and `sleep` only ever guarantees a floor. The ceilings were also
redundant: the record computes each phase as the span since the previous mark, so the phases
telescope to the last mark, and the partition check already present (`total >= first + second`) is
what proves a phase is a span and not the running total. The fix (`888827e7`) replaced the two
wall-clock ceilings with floors (each phase is at least its own sleep) and kept the partition check
as the real guard. A mutation that reintroduces the cumulative bug (`elapsed = *at`) still fails the
test through that partition check, verified locally before the change shipped, so the fix removed the
flake without weakening the falsification.

## Falsifier

On a throwaway branch, a deliberately broken test was shown to turn the job red at the test step,
not just at the type-check: `src/tests/cr243Falsifier.test.ts` asserted `Number("1")` is `2`, and the
run (`43176071146`) failed at "Frontend tests" with "expected 1 to be 2", `Tests 1 failed | 2959
passed`. The branch was deleted, local and remote; nothing reached `main`.

## What This Does Not Change

The release path. `prepare` and `publish` stay local; the updater signing key never reaches a
runner. The CI reports health; a release remains the Navigator's act.

## Evidence

- Intel runner unavailable: run `43171400472` queued thirteen minutes on `macos-13`, cancelled.
- Green on arm64: run `43174383896`, every step success, including `real_host` running exactly the
  five Core-integration tests (`mirror_host`, `mirror_host_bridge` x2, `mirror_learning`,
  `persona_admin`), `5 passed; 0 failed`.
- Red on a deliberate break: run `43176071146`, failed at the vitest step.
- Triggers enabled (`004bd8c3`); the push to `main` started a macOS run on push.

## Remaining

The hardening CR238 noted for `windows.yml` (declare `permissions: contents: read`, pin its actions
by commit) is still open and still touches the contributor's file, so it waits for the Navigator's
word; this workflow already carries both. Building the shipped x64 DMG in CI by cross-compiling under
Rosetta is a possible later refinement, not required for this slice.
