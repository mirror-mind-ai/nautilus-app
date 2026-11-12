[< RS016](index.md)

# CR251: Pin the Windows CI Actions and Narrow Its Token

**Status:** validated by CI 2026-11-12: the Windows run on `3b90073b` (`43223100214`) passed every step with the pinned actions, and the macOS run (`43223100303`) passed alongside it
**Driver:** Navigator, 2026-11-12 ("Sobre o endurecimento do windows, pode fazer")
**Requested:** the hardening noted at CR238's review and left open because it touches the
contributor's workflow file.

## Friction

`windows.yml` (CR238) referenced its actions by moving names (`@v4`, `@v2`, `@stable`) and declared
no token permissions, so it ran with the repository default. A moved or compromised tag would change
what runs on every push and pull request without a change in this repository, and the job held more
token authority than reading the code needs. `macos.yml` (CR243) already had both.

## What Changed

`permissions: contents: read` at workflow level. `actions/checkout`, `actions/setup-node`,
`dtolnay/rust-toolchain`, `Swatinem/rust-cache` and `actions/upload-artifact` are pinned by full
commit, with the tag kept as a comment, the same commits `macos.yml` and `voice-windows.yml` use.
Each was checked against its tag's peeled commit before the change. `dtolnay/rust-toolchain` is
pinned at a `master` commit and takes `toolchain: stable` as input, as in `macos.yml`. Steps are
otherwise unchanged.

## Noted

Pinned actions do not update themselves. Moving a pin is a deliberate commit: resolve the new
tag's commit, read the change, replace the hash and the comment in all three workflows together.

## Falsifier

The Windows job runs green with the pinned actions, uploads the installer artifact, and its token
cannot write to the repository.
