[< RS016](index.md)

# CR288: Give Every Turn Its Own Context Re-Read Budget

**Status:** in_progress 2026-11-25 (`f9ab867b`); on main, awaiting a look in a dev build on macOS
**Driver:** Navigator
**Requested:** on 2026-11-25, during the field run of [CR285](cr285-say-what-the-next-message-will-cost-before-a-pause.md), with a capture taken after the third message of a run: the cache notice was gone and the footer read "~6.5%". After the reading of the cause: "ok, siga em frente."

## Friction

When a turn ends, the app reads the context from Pi's session file. If the read finds the file still
behind the answer, the reading is an estimate, the footer marks it with "~", and everything that
needs a measured reading (the CR285 cache notice among them) hides. CR079 added re-reads at 1.5 s,
5 s and 15 s for a reading that has not settled, but their budget reset only when the Conversation
changed. Three turns in a row spent it: in the field the third turn's reading stayed approximate for
15 s (the stats were rewritten 15.2 s after the answer, with its exact 64,782 tokens), and a fourth
turn would have had no re-read at all, leaving the "~" until something else read the context again.

## What Changed

The re-read budget also resets when a turn starts or ends (`isStreaming` joins the reset in
`src/app/App.tsx`), so each turn gets its re-reads from 1.5 s. Guarded in
`contextReadingIntegration.test.ts`. No Rust.

## Noted at Review

The cause of the lag is inferred, not observed: the session file holds the answer, with its usage,
from 15:35:17.742, and nothing after it, so a read 15 s later found the measured value; the state in
between was not recorded. A second change was considered and left out: keeping a measurement the
turn itself reported when the file read returns an estimate. The read gives no time for its entries,
so the app cannot tell a file that lags the answer from a newer message that never got one (an
aborted turn), and the estimate is the honest reading in the second case. If the "~" still lasts
about 1.5 s after each turn, that question returns with evidence.

## Falsifier

Four or more turns in a row in one conversation, each followed within seconds by a look at the
footer: if any reading stays "~" for more than a few seconds after its answer, with the model
unchanged, this CR reopens.

## Evaluation

Test first (red, then green). Full suites in a clean environment: vitest 390 files, 3256 passed,
4 skipped; `tsc` clean. Not run in a dev build by the assistant.

## Validation Route

1. `npm run tauri:dev`, with the CR285 notices on, in a conversation over 50K tokens.
2. Send four messages in a row without leaving the conversation.
3. A few seconds after each answer, the footer reads without "~" and the notice counts down.
