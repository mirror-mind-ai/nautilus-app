[< RS016](index.md)

# CR242: Name the Microphone That Is Recording

**Status:** validated in dev on macOS 2026-11-11 (Navigator: "dev validado"); published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Navigator, after validating CR241, 2026-11-11: when the microphone is clicked and
"Recording" appears, say which microphone it records from.
**Implementation:** `24c61a58`

## Friction

With several inputs (built-in, a Shure MV5, Teams and Zoom virtual devices) the recording status
said only "Recording · 0:05 · limit 5:00". Nothing showed whether the chosen microphone was the one
listening, and a chosen microphone that is unplugged silently falls back to the system default.

## What Changed

- The capture handle carries `microphone`, the label of the recording's own audio track, read
  after any fallback. It names what is recording, not what Settings asked for.
- The status reads "Recording from Shure MV5 · 0:05 · limit 5:00". Without a label from the system
  it stays "Recording · 0:05 · limit 5:00". Transcribing and permission states do not name it.
- A long name is cut with an ellipsis so Cancel stays in the row.

## Evidence

`src/tests/cr242RecordingMicrophone.test.tsx` (3 tests) was red first: the chosen microphone's
name, the fallback named as the default it fell to, an unnamed track left out, the status text,
and App passing the name through. Three mutations were caught. Full suite: 352 files, 2,963
passed, 1 skipped; `tsc` clean; build ok.

## Falsifier

On macOS with the MV5 chosen, the status names "Shure MV5" while recording. With the MV5 chosen and
unplugged, it names the built-in microphone. With "System default", it names whatever macOS uses
as input.
