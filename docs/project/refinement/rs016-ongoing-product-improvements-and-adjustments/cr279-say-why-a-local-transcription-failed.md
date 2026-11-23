[< RS016](index.md)

# CR279: Say Why a Local Transcription Failed

**Status:** in_progress 2026-11-23; implemented and covered by tests, awaiting a release and a look on the macOS 12 Mac
**Driver:** Navigator
**Requested:** on 2026-11-23, after CR278: "abra as crs e implemente-as", for the two items CR278 left open.

## Friction

On the macOS 12 Mac every recording ended in "Local transcription failed. The draft was left
unchanged." The cause, a program the system refused to load, took reading the installed binary by hand
over SSH to find. The sentence was the same for a recording that failed and for a component that could
never have worked, and only the second is something the person can fix.

## What Changed

- The native run no longer treats every failure alike. When the program cannot even be created, or
  when it fails and then does not start with `-h` (which prints its usage and leaves) either, the
  error is a new code, `voice_component_cannot_start`. A program that starts and fails on this
  recording stays `voice_transcription_failed`.
- "Starts" is defined as "the system let it run to an end of its own": a process that cannot be
  created, that outlives the probe, or that is killed by a signal (macOS aborts a binary the loader
  refuses) did not start; one that exits with a code of its own, even a failing one, did. On Windows
  an NTSTATUS-range code (`0xC0000000` and above) counts as not started. A non-zero `-h` is not taken
  as a failure, because the Windows component's `-h` could not be tried from here.
- The sentence for it: "The transcription component cannot start on this computer. The draft was left
  unchanged. Remove it in Settings > Sound & Voice and install it again."
- When a recording ends this way, the status is read again, so Settings shows the component as
  damaged with its Remove button instead of "ready" (see CR280).

## Proof

`a_transcription_that_fails_says_whether_the_program_could_start` runs three fixtures: a script the
system aborts (`kill -ABRT`), one that starts and fails with code 3, and a path that does not exist;
the first and last give the new code and the middle one the old, and the temporary audio is deleted in
all three. The existing failing fixture now answers `-h` normally and fails only the transcription,
which is the case it was always meant to cover. The message and the code reader have tests in
`voiceTranscription.test.ts`; the message test fails without the new sentence.

## Not Done

- Not run on a real macOS 12 Mac with the broken binary: that one was replaced by CR278's reinstall,
  and the abort that `dyld` causes (`Abort trap: 6`, observed over SSH) is what the signal fixture
  stands for.
- No stderr is read or shown: the component prints its own paths and model details, and the sentence
  does not need them.

## Falsifier

On a Mac whose installed whisper-cli the system refuses to load, a recording ends with the new
sentence and Settings offers Remove; on any Mac where the program starts, a recording that fails still
says "Local transcription failed".
