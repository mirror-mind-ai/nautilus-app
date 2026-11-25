[< RS016](index.md)

# CR284: Lead an Activity Row to the Conversation at Work and to Its Answer

**Status:** done 2026-11-25 (`3dfa4723`); closed by the Navigator on the tests and the author's evidence, not from a look in a dev build on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #28](https://github.com/mirror-mind-ai/nautilus-app/pull/28); merged as it stands on the Navigator's word, 2026-11-25 ("#28 - mesclar como está"), after the evaluation.
Merge commit `3dfa4723`.

## Friction

A Journey can be at work in a conversation inside it instead of in its own. On a Journey row CR134 tells
the two apart: the status mark is drawn nested and leads to the conversation. The Activity view (CR276)
dropped that. A conversation at work showed as the Journey's work with nothing saying where; the row
opened the Journey's own conversation; and when the turn ended, "Finished. Open it to read the answer"
was announced on the Journey and the row opened its own conversation, where the answer is not.

## What Changed

Two commits, as contributed, no Rust and no stored format.

- **A row follows live work into a conversation** (`5630ea86`). The row names the conversation before
  the operation (`Nova Feature · bash npm test`, or `A conversation · …` while the Journey's catalog has
  not been read), draws the nested status mark, and leads to the conversation from the row and from the
  mark, through CR134's own route (`navigateToJourneyWorkOwner`, unchanged). With several workspaces of
  a Journey at work, the line describes the one the row is about; the Journey's own work still wins over
  a conversation's (CR140).
- **A Need you row leads to the conversation the turn ended in** (`2e6dc99b`). The finished-turn
  attention keeps the workspace of the run that finished, and an interrupted or failed outcome reads it
  from the turn journal (`deriveJourneyTurnOutcomeOwner`, from the same record the outcome comes from).
  The Activity inputs claim a conversation only when it is known not to be the Journey's own.

Files: `src/app/App.tsx`, `JourneyActivityList.tsx`, `journeyActivityInputs.ts`, `journeyAgentStatus.ts`,
`journeyWorkLocus.ts`, `turnJournal.ts`, `src/domain/journeyActivity.ts`, and four test files.

## Left Open by the Author, and Kept

- **When an answer counts as seen.** As today, when its Journey is opened. A turn that ends in one
  conversation while the person is in another of the same Journey is acknowledged at once and never
  reaches Need you. Making "seen" mean "its conversation was opened" would also change how long the
  Ready mark stays on a Journey row in the other views. A product decision for the Navigator; if wanted,
  its own CR.
- **One record per Journey:** if two conversations of a Journey end a turn while the person is away,
  the row is about the newest.
- **The other views:** a Journey row's mark still leads to a conversation only for live work.

## Noted at Review

- The compaction handler builds the owner with the active generation's `mirrorConversationId` read at
  the moment of the click; it would be wrong only if the generation changed during the compaction.
- The wiring in `App.tsx` is held by source assertions and the author's installed run, not by a unit
  test that runs it.
- **Not verified in an installed build:** a failed turn and a manual compaction ending in a
  conversation (unit tests only), and an interruption found after restarting the app, where the
  conversation is claimed once the Journey's own thread is known and the row leads to the Journey until
  then.
- In the author's regression battery (135 checks) one of two runs of "two Journeys at once" had the
  model write past what was asked; the same step passed in the same build on new Journeys. Not a
  finding of this change.

## Falsifier

With a conversation inside a Journey at work, from another Journey's Activity: the row's line begins
with the conversation's title, the mark is nested, and clicking the row or the mark opens that
conversation. When the turn ends, a Need you row says `<title> · Finished. Open it to read the answer`
and opens the conversation with the answer; likewise for a stopped turn. If a Journey whose work is in
its own conversation changes at all, this CR reached further than it says.

## Evaluation

Read in full. The PR was opened on `e9dee341`; tested merged with PR #27 onto `6f6a6348` in a
throwaway worktree: vitest 382 files, 3191 passed, 1 skipped; `tsc` clean. The merged `main` has the
same tree as the tested worktree. The PR's Windows and macOS CI were green on `2e6dc99b`. The author
ran it on Windows 11 in installed development builds (tables before and after for a live conversation
and for a finished and a stopped turn) and reports coverage of 100% of lines for `journeyActivity.ts`
and `journeyAgentStatus.ts` and 98% for `journeyActivityInputs.ts`. Not run on macOS.

## Validation Route

1. `npm run tauri:dev` from the repository root; Activity view; two Journeys, one with a conversation
   inside it.
2. In that conversation send a long turn (a `sleep 30`), then go to the other Journey: the Activity row
   names the conversation; the row and the mark lead there.
3. Let the turn end while away: the Need you row names the conversation and opens its answer.
4. A Journey whose work is in its own conversation reads as before.

## Closing

Closed on 2026-11-25 at the Navigator's instruction ("vamos fechar pelos testes e pela evidência do
autor"). What stands behind it is the merged suites (vitest 3191 passed, `tsc` clean), the 8 new tests
and the author's installed runs on Windows 11, with the tables before and after for a live
conversation, a finished turn and a stopped one. Not seen on macOS, and not exercised in an installed
build: a failed turn, a manual compaction ending in a conversation, and an interruption found after a
restart. The question of when an answer counts as seen stays with the Navigator. If a Journey whose
work is in its own conversation reads differently, or a row leads to the wrong conversation, this CR
reopens.
