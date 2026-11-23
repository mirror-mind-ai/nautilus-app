[< RS016](index.md)

# CR275: Reinstall a Connected Provider When Its Pin Changes

**Status:** done; implemented in `731a33e5`, validated by the Navigator on macOS in a dev build
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

## Implementation

Implemented on the Navigator's word, 2026-11-23 ("Implemente a CR275"), in `731a33e5`.

- `anthropic_provider::anthropic_install` tells three states apart: the pinned provider installed
  (`Current`), only an earlier pin's finished install (`Superseded`), or none (`Absent`). A stopped
  install, a Pi receipt, a log or a staging folder is not a connection the person made.
- `RuntimeChannelProfile::pi_extensions` keeps the person's `pi-claude-bridge` out while the provider is
  `Superseded`, as it does for `Current`. With `Absent` it still borrows the person's bridge (CR173),
  and the runtime diagnostic says so (`claudeBridgeBorrowed`), so Settings tells the person that turns
  on Claude run on their own bridge with their own Claude Code settings and hooks.
- The diagnostic says `anthropicUpdating` while `Superseded`. The app then calls the new
  `update_anthropic_provider` once, with no click: the same install Connect runs, whose installer
  removes the earlier pin's folder once the new one is in place. Settings lists Claude as
  "Connected · updating for this version of Nautilus…" meanwhile, without asking about sign-in; setup
  counts it as connected. If the update fails, Claude is offered again with the reason and Try again.
- A turn on Claude (`--provider claude-bridge` or a `claude-bridge/` model) that starts while the
  provider is `Superseded` says it is waiting, waits for the update, and, if the update fails, fails
  before the model with a sentence that says to connect Claude again in Settings.
- Whoever arrives while an install runs (Connect, the app's update, a turn) waits for it, for up to
  ten minutes, instead of starting another.
- The model catalog is read again after the update, so Claude's models return to it.

One departure from the Direction: the update does not wait for the person to be signed in to Claude
Code. An earlier pin's install exists only because the person chose Connect, and the sign-in lives
outside the install folder, so it is the same before and after; asking Claude Code about it would need
the binary the update replaces.

Tests: `anthropic_provider` (`an_earlier_pins_install_is_told_apart_from_none`), `runtime_channel`
(`a_superseded_provider_never_lets_the_persons_bridge_answer_in_its_place`), `pi_install` (an earlier
pin brought up once; nothing installed for a person who never connected; who arrives during an install
waits for it), `main` (`only_a_turn_on_claude_waits_for_claudes_update`), and
`src/tests/cr275ProviderPinUpdate.test.tsx` (4 tests). Suites: vitest 3133 passed, `tsc` clean, cargo
573 passed, 12 ignored.

## Validation Route

In a dev build on macOS, with the dev app's data, after restarting `npm run tauri:dev` (Rust changed):

1. Make the installed provider an earlier pin's: in
   `~/Library/Application Support/ai.mirrormind.nautilus.dev/anthropic`, rename
   `anthropic-e519b37b3400-ea4895ef6832` to `anthropic-b2df6deaf78c-ea4895ef6832` and change its
   `install-receipt.json` `sourceSha256` to any other 64 hex characters. Keep `claude-sessions`.
2. Open the dev app with no click: Settings lists Claude as connected and updating, then connected;
   the folder is back under the current pin's name and the earlier one is gone; `claude-sessions` is
   still there. Claude's models are in the model list.
3. Repeat step 1 and send a turn on Claude right after opening: it says it waits for the update, then
   answers; its record appears in `claude-sessions`.
4. With the person's `pi-claude-bridge` still in `~/.pi/agent/settings.json`, during step 3 no turn
   runs on it: the session's assistant entries name `claude-bridge` only after the update finished.
5. Remove the app's provider folder entirely: Settings offers Connect and says turns on Claude run on
   the person's own pi-claude-bridge. Connect restores the app's provider.

## Validation Evidence

2026-11-23, Navigator's Mac, dev build of `7a0ff072`. The dev install was made an earlier pin's
(folder renamed to `anthropic-b2df6deaf78c-ea4895ef6832`, receipt `sourceSha256` changed, `claude-sessions`
kept), the app was opened, and the Navigator reported: "Ao entrar no settings vi a atualização
acontecendo e agora está conectado. Novo turno rodou normalmente."

On disk afterwards: `install.log` shows the install of `e519b37b3400` starting on its own (107 packages,
104 downloaded, about 25 s, the same as Connect); only `anthropic-e519b37b3400-ea4895ef6832` remains, with
its receipt on the current pin, so the superseded folder was removed; `claude-sessions` kept its record
and the new turn rewrote it (CR274).

Not exercised on this Mac: a turn sent while the update runs, the person's own `pi-claude-bridge` present
during the update, and the absent-provider notice. Those rest on the Rust and vitest tests.
