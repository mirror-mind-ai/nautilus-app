[< RS016](index.md)

# CR275: Reinstall a Connected Provider When Its Pin Changes

**Status:** planned
**Driver:** the assistant
**Requested:** opened on the Navigator's word, 2026-11-23 ("mescle os dois, abra a CR275 e só depois vamos avaliar se já podemos gerar uma nova release").

## Friction

When an update changes the pinned source of the app's own Anthropic provider, as CR274 does, the
installed provider no longer matches the pin. The app then treats Claude through Claude Code as not
installed: the provider shows under "Connect another provider", and a turn comes back to the composer
with `Unknown provider "claude-bridge"` until the person clicks Connect (about 25 s, 142 MB, measured by
the contributor of CR274). Nothing tells the person why a provider that worked yesterday is gone.

## Cause

`src-tauri/src/anthropic_provider.rs` accepts an installed provider only when its install receipt names
the pinned source and lockfile hashes, and the install folder is named after them
(`anthropic/anthropic-<source>-<lockfile>`). A new pin is a folder that does not exist yet, and nothing
installs it except the Connect button.

## Direction

When the app opens and finds an installed provider from an earlier pin, with the person signed in to
Claude Code, it installs the pinned one in the background, as Connect would, and the provider stays
listed as connected while it does. A turn sent before the install finishes waits for it or says plainly
that the provider is being updated. The superseded install folder is removed after the new one is in
place. `anthropic/claude-sessions` (CR274) is outside the install folder and stays.

## Falsifier

Install a build with the old pin, connect Claude, then open a build with the new pin: with no click,
Claude through Claude Code is still offered, and a turn on it answers. If the person has to click
Connect again, or a turn says `Unknown provider "claude-bridge"`, this CR did not do its work.

## Release Boundary

The next release that carries CR274 carries this CR too.
