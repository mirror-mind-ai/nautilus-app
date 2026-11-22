[< RS016](index.md)

# CR265: Open on macOS 12 Without a Black Window

**Status:** captured 2026-11-21; the fix is already a local commit (`dcc02d0b`), checked in an `eval` build on the Mac that showed the defect; awaiting the Navigator's validation
**Driver:** Navigator
**Requested:** on 2026-11-21, while moving a user's Mirror to a spare MacBook Air (Intel, macOS 12.7.6). The released alpha.20 opened to a black window and nothing else.

## Friction

On macOS 12 the app drew nothing. The window opened, the title was there, and the page behind it
stayed black, with no message. The person cannot tell a broken install from a slow one.

## Cause

CR253 added `inlineTrailingSignaturePattern` to `src/app/conversationPresentation.ts` with a
lookbehind (`(?<=…)`). The WebKit that macOS 12 ships cannot parse a lookbehind, and a regular
expression literal is parsed with the script that holds it: the whole frontend bundle was refused, so
no code ran at all. Nothing in the repository's gates runs the bundle on an older engine, so CR253
passed every one of them.

## What was done

- The pattern captures the closing mark and puts it back (`$1`); the result is the same text.
- `src/tests/legacyWebKitSource.test.ts` reads the whole frontend source for a lookbehind.
- Checked against the system JavaScriptCore of the Mac that showed the defect: the old bundle's regex
  is refused; the rebuilt bundle parses, and every regular expression it constructs is accepted.

## Still open

- The new test finds lookbehinds. Other syntax that a Safari 15-era WebKit refuses (a regex flag, a
  CSS feature) has not been audited. The audit is the part of this CR that is not done.
- Decide whether the supported floor for macOS is a statement of the product (and where it is
  written), since the installer accepts a machine that cannot draw the app.

## Acceptance

- The installer's app opens and draws on macOS 12.7.6.
- A change that reintroduces a construct the oldest supported WebKit cannot parse fails a gate.
- The audit of the frontend for other such constructs is done, or the record says what is left.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. Found with the alpha.20 DMG on a spare Mac;
the black window was traced to the bundle's parse, not to the data being opened.
