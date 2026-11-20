[< RS016](index.md)

# CR262: Sign In to Claude Again From the App

**Status:** captured 2026-11-20; plan awaiting the Navigator's word
**Driver:** Navigator
**Requested:** "Deu certo, mas isso é um problema na mão do usuário, ele deveria poder resolver isso
dentro do próprio app.", 2026-11-20, after the Claude sign-in behind "Claude · through Claude Code"
expired and could be renewed only from a terminal.

## Friction

Claude through Claude Code (CR173) uses the Claude sign-in already on the computer. When that
sign-in expires or is signed out, the app has no way back: the Navigator had to find the app's own
Claude Code binary inside Application Support and run `claude auth login --claudeai` in a terminal.
A person without a terminal habit has no route at all.

## Cause

Two gaps, the second hiding the first.

- **Settings says Connected when it is not.** The Model providers line "Connected · Claude sign-in
  on this computer" is shown whenever the app's Claude Code is installed
  (`runtimeChannel.anthropicInstalled`). It never asks Claude Code whether it is signed in. On
  2026-11-20 it read Connected while `claude auth status` for the app's copy (2.1.306) answered
  `"loggedIn": false`.
- **Nothing in the app can sign in.** Connect installs Claude Code and stops; there is no Sign in
  action. Pi's own Anthropic sign-in (`pi-auth.mjs`) is a different credential: it was ready the
  same day and does not serve the Claude Code route.
- **A turn does not name it either.** Neither the provider fork nor the app recognizes Claude Code's
  "not logged in" answer, so the failure reaches the Navigator as a generic one.

## Plan

1. **Ask before saying Connected.** A native command runs the app's Claude Code `auth status --json`
   (it prints no credential) under a deadline, with the cleared environment `pi_auth.rs` already
   uses. The line reads "Connected · signed in to Claude" or "Signed out of Claude" with a
   **Sign in** button. Re-asked when Settings opens and after a sign-in.
2. **Sign in from the app.** **Sign in** runs the app's Claude Code `auth login --claudeai` and
   follows it the way Pi's sign-in is followed: the app opens the https sign-in page itself, shows
   a field if the flow asks for a pasted code, offers Cancel, and reports success or the reason it
   failed. The first step is a spike, without touching the Navigator's sign-in, to learn how that
   command behaves without a terminal (local callback, pasted code, or both) and what a turn prints
   when signed out.
3. **Name it in a turn.** When a Claude Code turn fails because it is signed out, the failure says
   so and points to Settings › Model providers, instead of a generic error.

Tests first in each step: the status parse and the line it produces, the sign-in event sequence
against a scripted helper (as `pi_auth.rs` tests do), and the turn failure's words. The new native
commands join `KEPT_ON_MAIN_THREAD`.

## Conscious Exclusions

- **One sign-in for two Claude Codes.** The app's Claude Code reads the same sign-in as the
  person's own Claude Code (`~/.claude`, the system keychain). Signing in from the app signs both
  in, and signing out of either signs out both. Separating them would mean a second Claude account
  session for the app; not proposed.
- **No sign-out button.** Signing out of Claude belongs to Claude Code; the app only shows the state
  and offers to sign in.
- **Console (API billing) sign-in** is not offered; the route is the Claude subscription.

## Falsifier

With the app's Claude Code signed out, Settings › Model providers shows Claude as signed out, not
Connected. **Sign in** completes in the browser without a terminal, the line returns to Connected,
and the next Claude turn runs without restarting the app. A Claude turn sent while signed out says
that the sign-in is missing and where to renew it.
