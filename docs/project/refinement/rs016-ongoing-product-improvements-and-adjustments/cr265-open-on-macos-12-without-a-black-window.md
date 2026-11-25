[< RS016](index.md)

# CR265: Open on macOS 12 Without a Black Window

**Status:** done 2026-11-25; validated 2026-11-22 (`dcc02d0b`, `4721d609`); published in v0.4.0-alpha.21, opened and used by the Navigator on the macOS 12 Mac
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

- The pattern captures the closing mark and puts it back (`$1`); the result is the same text
  (`dcc02d0b`).
- Checked against the system JavaScriptCore of the Mac that showed the defect: the old bundle's regex
  is refused; the rebuilt bundle parses, and every regular expression it constructs is accepted.
- The audit (`4721d609`). The declared floor is macOS 12.0 (`config/runtime-compatibility.json`),
  whose WebKit is 15.0 until Safari is updated, while Vite 7 builds for Safari 16 by default. The
  build now targets `safari15`. Seven `.at()` calls and one `Object.hasOwn` (both WebKit 15.4)
  became index reads and `hasOwnProperty`; they throw where they run, and one sat in the signature
  code every assistant message passes through.
- `src/tests/legacyWebKitSource.test.ts` refuses a lookbehind, the built-ins newer than WebKit 15.0
  and a build target other than `safari15`. The built bundle, dependencies included, has none.

## Still open

- The stylesheet's `color-mix()` (223 declarations then) dropped whole declarations on that engine, which the
  update panel showed as a background-less box: CR281 writes a plain declaration before each. `@container`
  and `:has()` remain, and are listed there.

## Acceptance

- The installer's app opens and draws on macOS 12.7.6.
- A change that reintroduces a construct the oldest supported WebKit cannot parse fails a gate.
- The audit of the frontend for other such constructs is done, or the record says what is left.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. Found with the alpha.20 DMG on a spare Mac;
the black window was traced to the bundle's parse, not to the data being opened.

## Closing

On 2026-11-25 the Navigator asked for the validated CRs to be closed. The closing rests on the alpha.21 app opened and used by the Navigator on the macOS 12 Mac, which now runs production ("o sobressalente já está rodando produção"). Not exercised, and not part of this closing: the audit of `@container` and `:has()` (listed in the record) and any macOS older than 12.7.6. A failed falsifier or acceptance item reopens it.
