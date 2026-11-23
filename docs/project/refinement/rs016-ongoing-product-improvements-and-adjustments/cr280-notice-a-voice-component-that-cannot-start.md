[< RS016](index.md)

# CR280: Notice a Voice Component That Cannot Start

**Status:** done 2026-11-23 (`94ea83e2`); closed by the Navigator on the evidence of the tests, before a release and before it was seen on a real Mac whose program the system refuses
**Driver:** Navigator
**Requested:** on 2026-11-23, after CR278: "abra as crs e implemente-as", for the two items CR278 left open.

## Friction

The app took a voice component for ready while its receipt existed and its files had the recorded
sizes. It never ran the program. On the macOS 12 Mac the component stayed "ready" with a binary the
system would not load, and only a failed recording hinted otherwise. Everyone who installed the
component before CR278's fix, on macOS 12 or 13.0 to 13.2, is in that state until they remove it and
install it again, and nothing told them.

## What Changed

- `voice_transcription_status` runs the component's program with `-h` when the component looks ready
  (`status_probing`), through the same rule CR279 uses for "starts" and a 10 second bound. If it does
  not start, the state is `damaged` with "The installed transcription component cannot start on this
  computer. Remove it and install it again.", and the version, model, size and date are left out,
  because a component that cannot run is not installed.
- `damaged` was already a state the interface knows: Settings offers Remove, and the microphone
  button refuses to record with the message. The status is read when the app opens, so the person who
  opens the app after an update sees it at once, before recording anything.
- Nothing is run for a component that is not installed, unsupported, or already incomplete.

## Proof

`status_marks_a_ready_component_whose_program_cannot_start_as_damaged` checks that the probe is given
the installed program's path, that `false` turns `ready` into `damaged` with the message and no
version, and that a probe that panics is never called in the other three states. The start rule has
its own test over six programs (exits 0, exits 2, aborted by a signal, never ends, not executable,
missing).

## Not Done

- The program is run on every status read, once at start and again after a CR279 failure; at 14 ms for
  `-h` this costs nothing, and a cache would only be worth it if status were polled.
- A component the loader refuses only for a missing model, a damaged model file or a corrupt download
  is not found by `-h`: that is a failure of the recording, and CR279 words it as one.
- The removal still asks the person to do it; an automatic reinstall would download 190 MB without
  being asked.

## Falsifier

Open the app on a Mac whose installed whisper-cli the system refuses to load: Settings shows the
component as damaged with Remove, before any recording. On a Mac where it starts, Settings is as
before.

## Closing

Closed on 2026-11-23 at the Navigator's instruction ("pode fechar essas duas crs"). What stands behind
it is the test evidence above and the full suites (JS 3,169 tests, Rust 576), not a run on a Mac with a
binary the system refuses: CR278's reinstall replaced the only one, and the abort is represented by a
fixture. It reaches people with the next alpha. If the falsifier fails there, this CR reopens.
