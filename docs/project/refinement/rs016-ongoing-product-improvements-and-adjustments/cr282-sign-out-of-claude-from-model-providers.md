[< RS016](index.md)

# CR282: Sign Out of Claude from Model Providers

**Status:** in_progress 2026-11-24; implemented and covered by tests, published in v0.4.0-alpha.24, awaiting a real sign-out
**Driver:** Navigator
**Requested:** on 2026-11-24, with a screenshot of Settings > Models: OpenAI has **Disconnect** and Claude has nothing. "Bug ou by design?" was answered as a decision of CR262; then: "Quero o botão com confirmação. Nosso usuário primário usa o claude code como recurso secundário para usar o nautilus. Ter a consciência de que há um claude code separado seria para usuários avançados que são uma pequena minoria."

## Friction

Model providers lets a person disconnect OpenAI and any Pi provider, and gives the Claude line only
**Sign in**. To leave Claude the person had to open a terminal and run Claude Code's own command.
CR262 left the button out on purpose: the sign-in is the one the person's own Claude Code reads, so
signing out of the app signs out of that too. The Navigator's reading of who the product is for
reverses the weight of that reason: the primary person uses Claude Code as a means to use Nautilus,
not as a separate tool, so the sign-in is simply "Claude on this computer", and the few who also use
Claude Code in a terminal are told the effect in the confirmation instead of being protected from it by
a missing button.

## What Changed

- **A button on the Claude line.** **Sign out**, beside "Connected · signed in to Claude". It is there
  only while Claude is signed in and the app's Claude Code is not being updated; it is not in setup.
- **A confirmation first,** in the form the Pi providers' Disconnect uses: "Sign out of Claude? This
  signs you out on this computer, in Nautilus and in Claude Code in a terminal." with **Sign out** and
  **Keep**. It names the effect in plain words and does not explain the arrangement behind it.
- **Native `sign_out_of_claude`.** Runs the app's Claude Code with `auth logout`, then asks `auth
  status --json` and returns what it says. A sign-in that is still there is an error ("Claude Code
  could not sign out. Try again, or run `claude auth logout` in a terminal."), whatever the logout
  said; a logout that exits badly because the person was already signed out is a sign-out. It does not
  run while a Pi or Claude sign-in is in progress, stops a logout that does not end in 30 seconds, and
  reads, keeps and logs no credential. The command census goes from 128 to 129.
- **While it runs** the line says "Signing out…" and the other buttons wait, as for a disconnect. When
  it ends the panel says "Signed out of Claude." and asks Claude Code again, so the line then shows
  "Signed out of Claude" with **Sign in**. A turn on Claude from there says so, with its Sign in button
  (CR262).

## Proof

`claude_sign_in.rs` against a shell that plays Claude Code: a logout that removes the sign-in and a
status that then says signed out; a logout that exits 1 with status signed out; a logout that exits 0
and leaves the sign-in (an error); a logout that never ends (stopped, status not trusted); a Claude
Code that cannot be started. `cr282ClaudeSignOut.test.tsx`: the button only while signed in, not for
signed out, asking, unknown, updating or setup; the confirmation and its words; "Signing out…" with the
button held; the command registered, called and wired, and Claude Code asked again at the end.
`claude auth logout` exists in the installed Claude Code (2.1.306) with no options.

## Not Done

- **Not run for real.** The Driver did not sign the Navigator's own Claude out, as in CR262. The real
  sign-out is the falsifier's first step.
- **No "only provider" warning.** For Pi providers the confirmation says when it is the last connection
  and Nautilus will ask for one. Setup still counts an installed Claude Code as connected (CR175), so
  that promise would be false here; a turn on Claude after signing out fails with its own Sign in line.
- **One sign-in for two Claude Codes** is unchanged and is now said once, in the confirmation.

## Falsifier

In Settings > Models with Claude signed in, **Sign out** asks, **Keep** leaves everything as it was,
and **Sign out** ends with "Signed out of Claude" and a Sign in button; `claude auth status` in a
terminal then also says signed out. With Claude signed out, there is no Sign out button.
