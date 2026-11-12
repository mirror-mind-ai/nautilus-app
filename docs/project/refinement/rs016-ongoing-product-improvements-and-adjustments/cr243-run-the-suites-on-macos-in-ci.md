[< RS016](index.md)

# CR243: Run the Suites on macOS in CI

**Status:** planned; not implemented
**Driver:** Navigator, 2026-11-11 ("Temos que criar uma CI para o Mac, certo?" then "Abra a CR e
planeje primeiro")
**Requested:** a continuous integration for macOS, the production platform, to match the Windows
one CR238 added.

## Friction

CR238 gave the repository a Windows workflow, but macOS, the platform production ships on, is
verified only on the assistant's machine. When an external pull request arrives, the assistant is
the single macOS check and the result is recorded nowhere. The first gate macOS passes through is
the local `prepare` at release time, which is late to learn a suite broke and invisible to a
contributor. The `real_host` tests, which exercise the embedded Mirror Core against the pinned
runtime, run only locally and never on a pull request.

## Plan

A second workflow, `.github/workflows/macos.yml`, a sibling to `windows.yml`, on push to `main`,
on pull requests and on demand, with its own `concurrency` group so a superseded run is cancelled.
On the macOS runner:

1. `npm ci`, then `npm run build` (the `tsc` check and the Vite build).
2. `npx vitest run` (the full frontend suite; the POSIX-only cases that skip on Windows run here).
3. `cargo test --locked` in `src-tauri`.
4. Lay out the Mirror host runtime (`node scripts/mirror_host_pin.mjs materialize`) and run the
   `real_host` tests (`cargo test real_host -- --ignored`) against it. This is the step Windows
   does not have and the one that only the assistant runs today; it is why the workflow exists.
5. Build the development-channel DMG only on demand (`workflow_dispatch`), not on every push: it is
   the slowest step and the least informative, and it claims no signing or notarization.

Least privilege from the first commit: `permissions: contents: read`, and the third-party actions
pinned by commit, not tag.

## Open Decisions

- **Which runner matches the app's architecture.** Nautilus is Intel-only (x64). GitHub's
  `macos-latest` is Apple Silicon (arm64). To exercise the real x64 path the job should run on the
  Intel runner (`macos-13` at the time of writing); the Intel runners are being retired, so the
  label that still provides x86_64 is verified at implementation and the result recorded. If no
  Intel runner remains, the suites run on arm64 and the DMG is a cross-compiled x64 artifact the CI
  does not execute, which the record states plainly rather than implying x64 coverage it does not
  have.
- **Load-sensitive tests.** The unpack tests already needed a 30 s timeout locally; a shared runner
  may make them flaky. If they flake, the cause is fixed, not the timeout raised.
- **The `real_host` step's cost.** Materializing the runtime and running the ignored tests adds
  minutes. Kept because it is the unique signal; revisited only if runner minutes become a
  constraint (they are free while the repository is public).
- **The Windows workflow's open follow-up.** CR238 noted `windows.yml` declares no `permissions`
  and pins its actions by tag. Tightening both, in `windows.yml` and the new `macos.yml` together,
  is a separate commit that touches the contributor's file and needs the Navigator's word; it is
  not folded into this plan silently.

## What This Does Not Change

The release path. `prepare` and `publish` stay local; the updater signing key never reaches a
runner. The CI reports health; a release remains the Navigator's act.

## Falsifier

A push to `main` runs the macOS job to green; a pull request that breaks a macOS-only case, or the
embedded Core against the pinned runtime, turns it red. Before the workflow is trusted, a
deliberately broken macOS-only test on a branch is shown to make the job red, once.

## Next Step

On the Navigator's word, implement the workflow, run it first through `workflow_dispatch`, confirm
the result (including which runner architecture it actually used), and only then leave it enabled on
push and pull requests. Record the outcome here and move the status from planned to validated.
