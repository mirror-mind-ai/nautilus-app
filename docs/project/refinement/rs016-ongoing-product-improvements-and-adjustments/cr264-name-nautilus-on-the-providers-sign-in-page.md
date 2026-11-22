[< RS016](index.md)

# CR264: Name Nautilus on the Provider's Sign-In Page

**Status:** captured 2026-11-21
**Driver:** Navigator
**Requested:** on 2026-11-21, while setting up Veronica's Mac. Connecting the OpenAI provider opened
OpenAI's page with "Connect your Mirror Desktop to ChatGPT". The app is Nautilus for Mirror; the
page should say so.

## Friction

The sign-in page of a provider names the application asking for access. The person is signing in
inside Nautilus for Mirror, and the page names a product that has not been called that since
2026-11. It reads as a different app asking for access to their account.

## Where it likely comes from (not yet investigated)

`mirror-host/pi-auth.mjs:171` passes `agentName: "Mirror Desktop"` to the Pi runtime's `login`, for
every provider and both sign-in types. The same name is pinned by `src/tests/cv010PiAuth.test.mjs:110`
(`expect(options.agentName).toBe("Mirror Desktop")`), so the test must change with the value.

To establish before changing anything:

- whether the OpenAI page takes its words from `agentName`, or from the OAuth client Pi registers
  with OpenAI, in which case the app cannot change it and the answer is a different one;
- the other providers that show an application name (Anthropic's browser login among them);
- whether any other user-facing text still says "Mirror Desktop" where the product is now Nautilus
  for Mirror, for example `mirror-host/host.mjs:295`, whose message reaches the home-adoption
  screen.

## Acceptance

- The OpenAI and Anthropic sign-in pages name the app as Nautilus for Mirror, checked by signing in,
  or the record says plainly which of them the app cannot change and why.
- No sign-in path keeps the old name by accident, and the test that pinned it pins the new one.
- Signing in again from an installation that already has a login keeps working.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey while moving a user's Mirror to a spare Mac
with an `eval` build of alpha.20.
