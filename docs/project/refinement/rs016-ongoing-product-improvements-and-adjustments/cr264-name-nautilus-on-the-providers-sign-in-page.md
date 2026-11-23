[< RS016](index.md)

# CR264: Name Nautilus on the Provider's Sign-In Page

**Status:** done 2026-11-23 (`897ed4c5`, released in alpha.21); the page was seen naming Nautilus for Mirror in a dev build
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

## Claude's Sign-In

Since CR262, signing in to Claude runs Nautilus's own Claude Code (`claude auth login --claudeai`), not
Pi's Anthropic login. The app passes no name to that command and has none to pass; the page Claude shows
is Claude Code's. It is outside what the app can change, and it was not looked at.

## Acceptance

- The OpenAI and Anthropic sign-in pages name the app as Nautilus for Mirror, checked by signing in,
  or the record says plainly which of them the app cannot change and why.
- No sign-in path keeps the old name by accident, and the test that pinned it pins the new one.
- Signing in again from an installation that already has a login keeps working.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey while moving a user's Mirror to a spare Mac
with an `eval` build of alpha.20.

## Validation Evidence

- **2026-11-23, first look (production).** The page still read "Use o ChatGPT para entrar em Mirror
  Desktop". The connection came from the installed app, which was still alpha.20 (open since
  2026-11-21, never restarted into alpha.21); its `pi-auth.mjs` sends `agentName: "Mirror Desktop"`.
  Not a browser cookie.
- **2026-11-23, dev build.** The Navigator disconnected OpenAI and connected again from `npm run
  tauri:dev`, whose runtime sends "Nautilus for Mirror". The dev app data had no `pi-device-id`, so the
  page came with a device identifier OpenAI had never seen. The page named **Nautilus for Mirror**.
- Pi 1.4.0 reads `agentName` in two places only: `agent_name_hint` in Sign in with ChatGPT and
  `originator` in the Codex login (`dist/bundle/chunks/openai-chatgpt.js`, `openai-codex.js`).

## A Sign-In That Did Not Finish

After the page, the browser said "Authentication successful" and the app said "The sign-in did not
finish: OpenAI OAuth token request failed (400): invalid_grant". OpenAI refused the authorization code
when Pi exchanged it for a token; the name is not part of that request. A clean retry failed the same
way, and so did `/login` in Pi 1.4.0 alone, outside Nautilus, with a throwaway agent folder. So the
failure is Pi's or the account's, not this CR's. The Navigator suspects the account went back to the
free plan; that is not confirmed. The acceptance line on signing in again is therefore not met by
Nautilus being at fault, and the Navigator closed the CR on the page seen (2026-11-23, "vamos fechar
a CR"). Until OpenAI connects again, turns on `openai-codex` fail in every app that shares
`~/.pi/agent`.
