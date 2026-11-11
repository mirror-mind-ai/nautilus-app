[< RS016](index.md)

# CR238: Run the Suites and the Installer on Windows in CI

**Status:** validated 2026-11-11 by its first run on `main`, green · published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #2](https://github.com/mirror-mind-ai/nautilus-app/pull/2); merged on
the Navigator's word, 2026-11-11 ("faça o merge dos quatro"). Merge commit `39af40ea`.

## Friction

The repository had no continuous integration, and nobody on the project runs Windows. CR236's
Windows paths would otherwise be tested only on the contributor's machine.

## What Changed

`.github/workflows/windows.yml`, the repository's first workflow: on every push to `main`, every
pull request and on demand, `windows-latest` builds the frontend, runs vitest (POSIX-only cases
skip by name), runs `cargo test --locked`, lays out the win-x64 Mirror host runtime and bundles the
development channel as an NSIS installer, kept as an artifact for seven days. macOS is still
verified locally only.

## Noted at Review

- The workflow declares no `permissions`, so it runs with the repository's default token scope.
  It needs only `contents: read`.
- Third-party actions (`dtolnay/rust-toolchain`, `Swatinem/rust-cache`) are referenced by tag,
  not by commit. Both are worth tightening in a follow-up.

## Falsifier

A push to `main` runs the job to green on Windows; a pull request that breaks a Windows path turns
it red.

## Evaluation

The workflow's own evidence is the contributor's rehearsal on his fork against the same tree, green
in 15 minutes. The first run on `main` that completed, run `43063746657` at `f0b73997`, passed every
step: frontend build, vitest, `cargo test --locked`, the win-x64 runtime layout and the NSIS bundle.
The run started by the merge itself was superseded by the next push, as the workflow's concurrency
rule intends.
