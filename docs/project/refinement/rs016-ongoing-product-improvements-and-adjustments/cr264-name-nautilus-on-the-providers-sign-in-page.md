[< RS016](index.md)

# CR264: Name Nautilus on the Provider's Sign-In Page

**Status:** in_progress 2026-11-22 (`897ed4c5`); awaiting a sign-in on the release build
**Driver:** Navigator
**Requested:** on 2026-11-21, while setting up Veronica's Mac. Connecting the OpenAI provider opened
OpenAI's page with "Connect your Mirror Desktop to ChatGPT". The app is Nautilus for Mirror; the
page should say so.

## Friction

The sign-in page of a provider names the application asking for access. The person is signing in
inside Nautilus for Mirror, and the page names a product that has not been called that since
2026-11. It reads as a different app asking for access to their account.

## What was found

`mirror-host/pi-auth.mjs` passed `agentName: "Mirror Desktop"` to Pi's `login`. Pi 1.4.0 uses it in
two places: Sign in with ChatGPT sends it as `agent_name_hint` (the words on the page that showed
the defect), and the Codex login sends it as `originator`. Anthropic's login does not read it, so
its page is not the app's to change.

Every other "Mirror Desktop" left in the code is a contract value (`product` in the update, release
and voice manifests, checked on both sides) or a test fixture. They stay. The home-adoption refusal
in `host.mjs` named "Mirror Desktop TS"; the screen shows its own sentence for that reason, but the
message now says "Nautilus" too.

## What was done

- `agentName` is "Nautilus for Mirror"; the test that pinned the old name pins the new one.

## Still open

- Seeing the page: a sign-in to OpenAI on the release build, which is the validation.

## Acceptance

- The OpenAI and Anthropic sign-in pages name the app as Nautilus for Mirror, checked by signing in,
  or the record says plainly which of them the app cannot change and why.
- No sign-in path keeps the old name by accident, and the test that pinned it pins the new one.
- Signing in again from an installation that already has a login keeps working.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey while moving a user's Mirror to a spare Mac
with an `eval` build of alpha.20.
