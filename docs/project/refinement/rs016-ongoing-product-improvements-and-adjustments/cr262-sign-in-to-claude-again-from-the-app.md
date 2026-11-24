[< RS016](index.md)

# CR262: Sign In to Claude Again From the App

**Status:** done 2026-11-20 (`0420aa2a`); plan approved by the Navigator, validated in a dev build by the Navigator on macOS: signed out through the app's Claude Code, Sign in from Model providers, back to Connected
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

## Spike (2026-11-20)

Run against the app's own Claude Code (2.1.306) under a scratch HOME and config folder, with an
`open` that only recorded its argument, so neither the Navigator's sign-in nor the browser was
touched.

- **`auth status --json`** prints `loggedIn` and `authMethod`, and no credential. It exits 1 when
  signed out, so the answer is read whatever the exit code.
- **`auth login --claudeai` without a terminal** works: it calls the browser itself with a local
  callback (`localhost`), prints "If the browser didn't open, visit: <page>" whose callback shows a
  code, and reads a pasted code from its input, without giving up on a closed input. A wrong code
  exits 1 with "Login failed: Request failed with status code 400" on stderr.
- **A turn without a sign-in** ends with `is_error` and the result "Not logged in · Please run
  /login", which the provider fork already passes on as the turn's error message.
- **USER is needed.** Run with the app's cleared environment and only HOME, the app's Claude Code
  said `loggedIn: false` with the Navigator signed in: on macOS it finds its sign-in in the keychain
  by USER (LOGNAME alone does not do). With USER it said `true`, `claude.ai`. Pi's turns inherit the
  app's environment, USER included, so the 2026-11-20 failure was a real expiry, not this.

## What Changed

- **`claude_sign_in.rs`.** Finds the app's Claude Code beside the installed provider
  (`node_modules/@anthropic-ai/claude-agent-sdk-<platform>/claude`), runs it with HOME, USER and
  the system's tool folders only, and offers four commands: `inspect_claude_sign_in`,
  `start_claude_login`, `answer_claude_login`, `cancel_claude_login`. A sign-in's lines become Pi's
  sign-in events on `pi-login-event` (the page to visit and a field for its code), numbered from
  the same count as Pi's sign-ins; its exit becomes Done, with the status asked again, or Failed in
  Claude Code's own reason. Cancel ends it at once. Only one sign-in, Pi's or Claude's, runs at a
  time. Claude Code opens the browser itself; "Open the sign-in page again" opens the page that
  shows a code.
- **Model providers.** The Claude line reads "Connected · signed in to Claude", "Signed out of
  Claude" or "Asking Claude Code whether it is signed in…", with **Sign in** when signed out or when
  Claude Code could not be asked. It is asked each time Model providers opens and after a Claude
  sign-in ends. The sign-in runs in the panel Pi's sign-in uses. A signed-out Claude no longer
  counts as a connection when the last Pi sign-in is about to be disconnected.
- **A signed-out turn.** `ProviderFailureLine` replaces the two "The provider reported" lines: for
  Claude Code's "Please run /login" it says "Claude is signed out, so this turn could not run." with
  a **Sign in to Claude** button that opens Settings on Model providers.
- **Guards kept.** The command census goes from 122 to 126 (async, like Pi's sign-in commands), and
  `claude_context` is classified as the app's toolchain in the app-data reader guard, like
  `pi_auth_context`.

Specs, red first: `claude_sign_in.rs` (status parse, binary path, environment, the page and code
events, a pasted code, a refused code, cancel, against a shell that says what Claude Code says) and
`cr262ClaudeSignIn.test.tsx` (the line, Sign in, the wiring, the signed-out turn).

## Conscious Exclusions

- **One sign-in for two Claude Codes.** The app's Claude Code reads the same sign-in as the
  person's own Claude Code (`~/.claude`, the system keychain). Signing in from the app signs both
  in, and signing out of either signs out both. Separating them would mean a second Claude account
  session for the app; not proposed.
- **No sign-out button.** Signing out of Claude belongs to Claude Code; the app only shows the
  state and offers to sign in. Reversed by CR282, which adds Sign out with a confirmation.
- **Console (API billing) sign-in** is not offered; the route is the Claude subscription.
- **Setup still counts an installed Claude Code as connected** (CR175). A first run has just
  installed it and the sign-in is the one already on the computer; asking there is left for when a
  first run is seen to stop on it.
- **The real sign-in was not run by the Driver.** It would have changed the Navigator's own sign-in;
  it is the falsifier's first step.

## Falsifier

With the app's Claude Code signed out, Settings › Model providers shows Claude as signed out, not
Connected. **Sign in** completes in the browser without a terminal, the line returns to Connected,
and the next Claude turn runs without restarting the app. A Claude turn sent while signed out says
that the sign-in is missing and where to renew it.
