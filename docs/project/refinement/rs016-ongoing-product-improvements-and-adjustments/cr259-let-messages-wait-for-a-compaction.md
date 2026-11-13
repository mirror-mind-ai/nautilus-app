[< RS016](index.md)

# CR259: Let Messages Wait for a Compaction

**Status:** implemented 2026-11-13 (`d0a35f5a`); validated in dev on macOS by the Navigator 2026-11-13; not released
**Driver:** Navigator
**Requested:** "Quando eu disparo a compactação manual, tenho que ficar aguardando a compactação
terminar para mandar novos comandos para o agente. Queria poder enviar novos comandos que o app
fosse acumulando em uma espera pelo fim da compactação", 2026-11-13.

## Friction

A manual compaction is occupancy: it rewrites the session, so the conversation cannot send until it
settles. The Composer already let the Navigator type, but Enter and Send did nothing, so the next
instruction had to be held in mind, or in the field, for minutes and sent by hand afterwards.

## What Changed

- **A message waits instead of being refused.** While a compaction runs, Enter and Send ("Send
  when the compaction ends") move the draft into a queue above the Composer and clear the field for
  the next one. Each waiting message can be removed.
- **The queue leaves as one turn.** Messages written with no answer in between are one intention,
  so they go joined by a blank line. Separate turns would answer the first without the second.
  Files pending in the Composer go with that turn, as with any send.
- **It leaves from the conversation on screen.** A waiting queue is released once its conversation,
  selected, can send again. A queue left in another Journey waits there, and the sidebar counts it
  beside the Journey's name until the Navigator opens it.
- **A failed compaction asks.** A compaction that fails may leave the context full, so the queue is
  held with the reason and two ways out: "Send now" and "Back to the composer". A refusal because
  there was nothing new to compact leaves the context as it was, and the queue goes. Enter beside a
  held queue adds the new message to it and sends all of it, in the order written.
- **A send that fails returns to the queue.** The queue leaves the store only when the agent has the
  turn. A rollback, a cancel before any answer, or a turn that ends first holds it again with the
  reason, and nothing is written over what is being typed in the Composer.
- **It survives closing the app, held.** The queue rides in the Composer draft file, which says
  1.1.0 only while a message waits, so a store without a queue keeps the shape alpha.15 reads. After
  a restart a queue comes back held: no compaction is running, so sending on its own would surprise.
  The native validator checks the same bounds: at most 20 messages, none blank, together no longer
  than one message.

The rules live in `src/domain/compactionQueue.ts` and the view in `src/app/WaitingMessages.tsx`.
Specs in `cr259CompactionQueue.test.ts` (queue rules and stored shape),
`cr259WaitingMessages.test.tsx` (the view) and `cr259QueueWiring.test.ts` (the App wiring), and
`validates_the_compaction_queue_beside_the_drafts` for the native validator. Seven source guards
from CR113, CR181, CR183 and the draft integration were updated to the new expressions they guard.

## Conscious Exclusions

- **Not while a turn runs.** Queuing behind a live turn is a different path (Pi's follow-up
  messages); during a turn the Composer still steers.
- **Not released into a Journey that is not on screen,** by choice: starting a turn needs the
  conversation's authority, which only the selected one has loaded.
- **Files are not queued,** only words. Files attached while waiting go with the queue's turn, and
  files are not kept across a restart, as before.
- **An app before this release cannot read a 1.1.0 draft file.** Send or clear the queue before going
  back a version.

## Falsifier

In dev on macOS, start a manual compaction and type two messages, pressing Enter after each: both
appear above the Composer and the field clears. When the compaction ends they reach the agent as
one message, and the queue disappears once the turn starts. Start another compaction, queue a
message, switch to another Journey: its row shows the count, and the message goes on returning.
Queue a message and quit: on reopening it is there, held, and leaves only on "Send now".
