[< RS016](index.md)

# CR268: Read Mirror Host Requests on Newline Alone

**Status:** captured 2026-11-22; the fix is already a local commit (`c837f6c9`); validated by the Navigator on the user's Mac (the repair notice closed and the outbox emptied)
**Driver:** Navigator
**Requested:** on 2026-11-22, after CR267. The Journey opened, and the app offered "Repair Mirror Synchronization" with `synchronization_convergence_partial … mirror_append_process_failed`, and "1 exact Mirror settlement operation also needs attention".

## Friction

A turn that was complete in Pi and on screen could never be delivered to the Mirror. The person saw a
repair notice that named a process failure and could not do anything about it.

## Cause

`mirror-host/host.mjs` read requests with Node's `readline`, which ends a line at U+2028 and U+2029
as well as `\n`. JSON leaves those characters raw inside a string. A request whose text held one reached
the host in pieces; the host answered each piece with `id: null`, and the supervisor
(`src-tauri/src/mirror_host.rs:303`) reported "a response did not answer request 3" and killed the host.
The failure record in `mirror-append-failures.jsonl` carried that sentence.

Pi's own JSONL reader says in its source that it does not use `readline` for this reason and splits on
`\n` only. The host's own protocol comment promises one JSON object per line.

## What was done

- The host reads its input with a reader that splits on `\n` alone (an optional `\r` is dropped), by
  bytes and a `StringDecoder`.
- A host test sends U+2028 and U+2029 inside a request and expects one answer carrying its id. It fails
  without the change (`id: null`) and passes with it.

## Still open

- Other reads of a child's output by line in `src-tauri` and `mirror-host/pi-auth.mjs`
  (`createInterface` at line 190) were not audited for the same split.
- While diagnosing, `mirror_append_idempotency_conflict` appeared on the first attempt of old turns in
  four Journeys and was healed by the compatibility retry (`legacy_timestamp_compatibility_item`).
  Whether the first attempt should carry the timestamp the retry derives is a different CR, and the
  rows must not be confused with this one.
- A turn delivered by the retry is only safe while the stored `created_at` equals the one derived from
  the message id. A tool that inserts turns from an outbox (as a migration did here) has to use that
  value, or the retry itself conflicts.

## Acceptance

- A turn whose text holds U+2028 or U+2029 is delivered to the Mirror, and the outbox empties.
- The host's input framing is LF-only, in code and in its comment, and a test pins it.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The migration tool that inserted two outbox
turns wrote one timestamp one millisecond off; that was corrected by hand and backed up. It is part of
the evidence for the last item above.
