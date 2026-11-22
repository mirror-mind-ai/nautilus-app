[< RS016](index.md)

# CR268: Read Mirror Host Requests on Newline Alone

**Status:** validated 2026-11-22 (`c837f6c9`, `9a7cfb1d`); published in v0.4.0-alpha.21, opened and used by the Navigator on the macOS 12 Mac
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
  bytes and a `StringDecoder`. A host test sends U+2028 and U+2029 inside a request and expects one
  answer carrying its id; it fails without the change (`id: null`) and passes with it (`c837f6c9`).
- The audit (`9a7cfb1d`). `mirror-host/pi-auth.mjs` read the app's answers during a sign-in with
  `readline`: a typed value holding a separator was cut and dropped. It has its own LF-only reader
  now (it also runs alone, so it cannot import the host's), with a test that failed before.
  `scripts/dev_ts_home.mjs` read the host's answers with `readline` and now uses `requestLines`.
  The Rust side reads children with `BufRead::lines` and the frontend splits on `\r?\n`; both end a
  line on newline only.

## Still open

- `mirror_append_idempotency_conflict` appeared on the first attempt of old turns in four Journeys
  and was healed by the compatibility retry (`legacy_timestamp_compatibility_item`). Whether the
  first attempt should carry the timestamp the retry derives is a different CR.
- A turn delivered by the retry is only safe while the stored `created_at` equals the one derived from
  the message id. A tool that inserts turns from an outbox (as the migration did) has to use that
  value, or the retry itself conflicts.

## Acceptance

- A turn whose text holds U+2028 or U+2029 is delivered to the Mirror, and the outbox empties.
- The host's input framing is LF-only, in code and in its comment, and a test pins it.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The migration tool that inserted two outbox
turns wrote one timestamp one millisecond off; that was corrected by hand and backed up. It is part of
the evidence for the last item above.
