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

A person who also has `pi-claude-bridge` in their own Pi settings sees something worse, found while
validating CR274 on the Navigator's Mac (2026-11-23): Settings says Claude through Claude Code is
disconnected, yet turns keep answering. They run through the person's own bridge, which registers the
same `claude-bridge` name: upstream as published, without CR167's `disableAllHooks`, CR176's settings
cut or CR274's settled session. The person's Claude Code hooks then run inside a Nautilus turn while the
app says the provider is not there.

## Cause

`src-tauri/src/anthropic_provider.rs` accepts an installed provider only when its install receipt names
the pinned source and lockfile hashes, and the install folder is named after them
(`anthropic/anthropic-<source>-<lockfile>`). A new pin is a folder that does not exist yet, and nothing
installs it except the Connect button. While it is missing, `RuntimeChannelProfile::pi_extensions`
(`src-tauri/src/runtime_channel.rs`) stops excluding the person's `pi-claude-bridge`, so the person's
copy fills the name the app's own provider left empty.

## Direction

When the app opens and finds an installed provider from an earlier pin, with the person signed in to
Claude Code, it installs the pinned one in the background, as Connect would, and the provider stays
listed as connected while it does. A turn sent before the install finishes waits for it or says plainly
that the provider is being updated. A person's own `pi-claude-bridge` is never loaded silently in place of the app's
provider: while the app's provider is missing, either the person's copy stays excluded or Settings
names plainly that turns run on the person's own bridge. Connect already removes the superseded install
folder (seen on the Navigator's Mac); the background install must do the same. `anthropic/claude-sessions` (CR274) is outside the install folder and stays.

## Falsifier

Install a build with the old pin, connect Claude, then open a build with the new pin: with no click,
Claude through Claude Code is still offered, and a turn on it answers. Repeat with the person's own
`pi-claude-bridge` in their Pi settings: turns still run on the app's provider (the CR274 record appears
in `anthropic/claude-sessions`, and the person's hooks do not run). If the person has to click Connect
again, a turn says `Unknown provider "claude-bridge"`, or a turn silently runs on the person's bridge
while Settings says disconnected, this CR did not do its work.

## Release Boundary

The next release that carries CR274 carries this CR too.
