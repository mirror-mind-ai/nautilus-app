[< RS016](index.md)

# CR241: List the Microphones Before the First Recording

**Status:** validated in dev on macOS 2026-11-11 (Navigator: "Funcionou"); not published
**Driver:** Navigator, field report 2026-11-11
**Implementation:** `a67f721a`

## Friction

With a Shure MV5 plugged in over USB, and macOS listing it as an input, Settings → Sound & Voice →
Microphone offered only "System default". After one recording the MV5 appeared. The Navigator had
not recorded in that session.

The microphone picker came with CR236 and was exercised on Windows. On macOS the WebView hides
the microphones until one has been allowed: `enumerateDevices` gives a single input with neither id
nor name. The picker dropped entries without an id, found nothing, and said "No microphone was
found." Windows behaves differently before the first allowance (ids without names), which is why
the picker there said to record once.

## What Changed

- `readAudioInputs` returns the named microphones and whether the system is hiding any (an input
  without id or without name). Hidden is no longer read as absent.
- When the list is hidden the picker shows **Allow microphone to list them**.
  `allowMicrophoneListing` asks for the microphone and releases the stream at once; nothing is
  recorded. The list is read again afterwards. A refusal says to allow Nautilus in the system's
  privacy settings for the microphone.
- The picker follows `devicechange`, so a microphone plugged in or out appears or disappears without
  reopening Settings. The refresh on focus is kept.
- "No microphone was found." appears only when the system lists no input at all.
- `listAudioInputs` is replaced by `readAudioInputs`; recording is unchanged.

## Evidence

`src/tests/cr241MicrophoneList.test.tsx` (6 tests) was red first. It reproduces the WebKit list
before the allowance, the Windows nameless list, the button and its absence, the MV5 named and
chosen, the refusal, the stream released without recording, and the subscription removed. Four
mutations were caught (hidden always false, tracks not stopped, no subscription, button never
offered). Full suite: 351 files, 2,960 passed, 1 skipped; `tsc` clean; build ok.

## Falsifier

On macOS, in a fresh app session with the MV5 plugged in, Settings → Sound & Voice shows the button
instead of "No microphone was found."; pressing it (and allowing, if macOS asks) lists the MV5
without a recording. Unplugging the MV5 with Settings open removes it from the list; plugging it
back brings it back. Choosing it and recording uses it.

## Not Yet Shown

Whether macOS keeps the allowance across app restarts in a signed build; on Windows the button
appears only before the first allowance, which the contributor's battery can confirm.
