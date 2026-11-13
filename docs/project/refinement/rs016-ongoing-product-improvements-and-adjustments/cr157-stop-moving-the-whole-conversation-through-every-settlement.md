[< RS016](index.md)

# CR157: Stop Moving the Whole Conversation Through Every Settlement

**Status:** done (the outbox half, validated in dev by the Navigator 2026-11-13; to be published in v0.4.0-alpha.17)
**Driver:** Navigator
**Delivery:** `1a06c125`

## Where This Comes From

CR149's main-thread measurement
([cr149-main-thread-measurement-2026-10-13.md](../../../update/cr149-main-thread-measurement-2026-10-13.md)).
CR149 moved the settlement's commands off the main thread, which is what the freeze needed. It did
not change what those commands do, and what they do is the cost this CR names.

## The Cost

A settlement on `alissonvale-com` — projection **11,491,284 bytes**, `mirror-desktop` is 14.2 MB —
runs `save_projection`, `save_post_frontier_projection` and `save_durable_projection`, and
`load_persisted_projection`. Each save sends the **entire conversation** as one JSON string across
the IPC, where the native side parses it into a generic `serde_json::Value`, validates authority,
re-serialises it and writes it with `fsync`. In the measured settlement those four phases were
**1,557 ms of 5,984 ms (26.0%)**, and the self-time was `memmove`, `read`, `serde_json` escape
handling and `fcntl`.

This is a design cost, not a bug. It survives CR149's thread move: the renderer still pays a
`JSON.stringify` of the whole conversation per save, the IPC still marshals megabytes, and a worker
thread is now held for the duration instead of the UI.

The outbox path (`deliver` + `enqueue` + `acknowledge`, **54.0%**) is larger and is *not* obviously
payload-bound; its cost has not been decomposed and may be a different CR.

## Outcome

A settlement's persistence cost grows with what the turn added, not with how long the conversation
is.

## First Investigation

1. **Decompose the save.** Measure, in Rust, parse / validate / serialise / write for one 11.5 MB
   save, so the repair is aimed at the measured part rather than at "the payload".
2. **Establish whether the three saves are three different contents** or one content written three
   times under three names. The settlement model
   ([settlement-durable-state-model.md](../../../architecture/settlement-durable-state-model.md))
   says what each is for; the ledger says what each costs.
3. **Decompose the outbox path** the same way, before assuming it is or is not the same problem.

## Candidate Shapes, Not Yet Chosen

- Append-only turn storage with the projection rebuilt from segments, so a save writes one turn.
- A native-side projection cache keyed by `(journeyId, generation, turnId)` so the renderer sends a
  delta and the native side composes the full document.
- Streaming the payload rather than one `String` argument.

Each changes the durable-state model and must be argued from it, not from the timing alone.

## Exclusions

- Anything on the main thread. CR149 owns that and has measured it.
- Reducing what a conversation *contains*. This CR is about what crosses per settlement.

---

## Measured scaling (2026-10-13)

Across 13 Journeys with settlement records, settlement p50 against the largest projection file:

| Journey | projection | n | p50 | p90 | max |
|---|---|---|---|---|---|
| `mirror-desktop` | 14,719,598 | 165 | 6,062 | 10,240 | **81,338** |
| `alissonvale-com` | 11,671,263 | 255 | 5,842 | 8,406 | 48,546 |
| `livro-lideranca-soberana` | 11,430,552 | 256 | 4,576 | 6,838 | **113,048** |
| `flip-website` | 1,851,221 | 10 | 3,394 | 16,048 | 16,048 |
| `flip-podcast` | 1,438,153 | 57 | 2,690 | 3,657 | 10,035 |
| `venda-de-livros` | 1,081,209 | 53 | 2,427 | 2,934 | 5,308 |
| nine Journeys under 500 KB | — | 1–7 each | 1,391–2,625 | — | — |

**`r = 0.96` across the six Journeys above 1 MB, marginal cost ≈ 241 ms per MB.** So about half of a
large Journey's settlement is size-driven and about half is fixed — which means this CR's ceiling is
roughly half the settlement, not all of it, and the fixed half belongs to the outbox decomposition
the First Investigation already asks for.

The shape of the cost is the argument: **it has no brake.** Every turn adds to the projection and
every subsequent settlement pays for it again, three times over. `mirror-desktop` is already at
14.7 MB with a maximum of 81 s and `livro-lideranca-soberana` at 113 s.

### What makes this sharper than it was yesterday

CR149's serialisation guard is process-wide: one command runs at a time across every Journey. **The
longest single depth-0 phase ever recorded is 41,081 ms — `save_projection` on
`livro-lideranca-soberana`** — and that is now the worst-case wait for any data command in any other
Journey. Typical worst case is far smaller, about 1.6 s, and the Navigator reported no such stall in
the field.

So CR149 did not make that cost disappear; it made it **invisible**, by moving it off the thread that
draws. Reducing what a settlement moves is therefore also a concurrency repair, not only a latency
one.

## Re-read on 0.3 (2026-11-03)

Half delivered by [CR184](../rs026-after-the-0-3-cutover/cr184-finish-a-turn-without-redrawing-the-whole-conversation.md).
The renderer now sends only the loaded window (28.2 MB to 1.08 MB per save in its rehearsal), and
the native save preserves the rest. Production settlement records for `mirror-desktop`:

| | settled turns | settlement p50 | max | saves p50 | max |
|---|---:|---:|---:|---:|---:|
| 0.3, before alpha.10 | 127 | 9.9 s | 78.8 s | 3.6 s | 36.9 s |
| alpha.10 and later | 9 | 6.9 s | 7.1 s | 1.8 s | 1.9 s |

What remains is native: each save still reads and merges the whole stored projection
(`generation-4.json`, 34.3 MB), so the cost still grows with the conversation, off the main
thread. The Outcome above is not met yet. Still valid, narrowed to the native side; the Navigator
decides whether to keep it in the queue.

## Kept (RS027 verdict, 2026-11-13)

Kept, and moved back to RS016 by the Navigator's word: the only one of RS027's nine with current
evidence, and it is growing. Production settlement records, 2026-11-08 to 2026-11-13:

| Journey | settlements | total p50 | projection phases p50 | outbox phases p50 |
|---|---:|---:|---:|---:|
| `mirror-desktop` | 127 | 8.6 to 10.5 s a day | 2.7 to 3.4 s | 4.6 to 5.1 s |
| `alissonvale-com` | 127 | 7.8 to 13.3 s a day | 2.3 to 4.3 s | 4.2 to 6.5 s |

Projection phases are `save_projection`, `save_post_frontier_projection`, `load_persisted_projection`
and `load_active_evidence`; outbox phases are `enqueue_outbox_item`, `deliver_outbox_item` and
`acknowledge_outbox_item`. The `mirror-desktop` stored projection grew from 34.3 MB (2026-11-03) to
45.1 MB (2026-11-13). Eight settlements took over 20 s since the cutover, the slowest 65 s; the
largest single phases in them were `enqueue_outbox_item` (up to 14.7 s) and `save_projection` (up to
18.8 s). It no longer touches the thread that draws, but the Navigator watches *Finishing* for this
long after every turn, and nothing bounds its growth.

The scope widens to the whole settlement: the outbox is now the larger half, so its decomposition,
already item 3 of the First Investigation, comes first rather than last.

## Cause Measured (2026-11-13)

Production settlements on `mirror-desktop`, 2026-11-08 to 2026-11-13 (127), phase medians:
`enqueue_outbox_item` 2,415 ms, `save_post_frontier_projection` 1,428, `acknowledge_outbox_item`
1,353, `deliver_outbox_item` 1,055, `advance_journal` 1,001 (run twice), `save_projection` 888;
total 9,215. The files those outbox and journal commands write are small (the outbox is empty
between turns, the journal 112 KB), so their cost is not their own payload.

It is a validation. For a Pi-backed outbox item (schema 1.1.0), `validate_outbox_generation_authority`
reads the whole Pi session file and re-derives the active branch to compare the item's text with the
turn (CR126). It runs at enqueue (and `pi_backed_enqueue_item` reads the session again), at delivery,
at acknowledgement, and through `validate_post_frontier_outbox_authority` in the journal transitions
and the post-frontier save. The active session of this Journey is **217.5 MB** (31,679 entries);
`alissonvale-com`'s is 242 MB.

Measured on a copy, release build, the `serde_json` the app pins (1.0.151): reading the session takes
160 to 290 ms and parsing its lines 400 ms, before the branch walk. Roughly seven such passes per
settlement account for most of the nine seconds, and they grow with the Pi session, which grows faster
than the projection. They also hold CR149's process-wide command lock, so every other Journey's data
command waits behind them.

Refuted on the way: the stored projection (45 MB) parses in about 140 ms, so re-reading it for
authority costs well under a second per settlement. It is not the main cost.

**Direction.** The item's text is a fact about an append-only file that Pi has stopped writing by the
time the settlement runs. Verify it once, at enqueue, and let later checks reuse that verdict while
the session file is unchanged (same path, size and modification time); a changed file is verified
again in full, so CR126's guarantee holds. Expected, not yet measured: a large Journey's settlement
from about 9 s to about 3 s. The projection's own read and merge (`save_projection`, the
post-frontier save) is the smaller, slower-growing half and stays for later.

## Implementation (2026-11-13, `1a06c125`)

The Navigator authorized the outbox half. A new module, `src-tauri/src/pi_turn_verification.rs`,
remembers a passing CR126 verdict for a claim (the session id, the entry pair, both messages' text and
times) against a session stamp (path, size, modification time). `validate_outbox_generation_authority`
asks it before reading the session; a hit costs one `stat`. Only passes are remembered, a read during
which the file changed is never remembered, any later change to the file sends the next check back to
a full read, and at most sixteen verdicts are kept.

At enqueue, the read that builds the Pi-backed item now also counts as its check, so a settlement
reads the session once instead of about seven times. The comparison itself is unchanged, moved into
`verify_pi_backed_item_text_in`; the CR126 source guard follows it there.

Tests: five in the module (a verdict holds while the session is unchanged, covers only its claim, is
dropped when the session grows or disappears, and stays bounded) and five in `main.rs`
(`cr157_session_read_tests`), which rewrite the session's answer while keeping its size and time: a
check that passes afterwards proves the session was not read again, a moved time forces the full check,
and a refused item is never remembered. Suites: cargo 549 passed, 11 ignored; vitest 363 files, 3034
passed, 1 skipped; `tsc` clean.

**Not yet shown:** the settlement time. Expected on `mirror-desktop` from about 9 s to about 3 s; the
settlement timings after the next release will say. The projection's read and merge remains, as above.

## Closed (2026-11-13, Navigator)

Validated in dev on macOS and closed on the Navigator's word. What is left out is stated, not
forgotten: the projection half (reading and rewriting the whole stored conversation at each
settlement, about 3 s on a large Journey) is not part of this CR. If the settlement timings after
alpha.17 still show it as the larger share, it is recaptured as its own CR with those numbers.
