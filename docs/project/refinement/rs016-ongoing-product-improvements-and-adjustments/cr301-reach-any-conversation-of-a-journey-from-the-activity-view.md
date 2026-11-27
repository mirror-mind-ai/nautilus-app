[< RS016](index.md)

# CR301: Reach Any Conversation of a Journey from the Activity View

**Status:** in_progress 2026-11-27 (`37aa93fd`); built test first, not yet seen in a running app
**Driver:** Navigator
**Requested:** on 2026-11-27, in this Journey: "Vamos abrir uma CR pra ajustar a aba activity quando temos uma conversa acontecendo (acho que tem outra CR recente que foi resolvida sobre isso). O exemplo é a conversa 'Nautilus for Linux' nessa jornada. Estou trabalhando nela, mas ela não fica disponível para eu entrar nela via aba activity. Eu tenho que mudar de aba, para recents por exemplo, para conseguir ter acesso ao link onde reabro a conversa."

## Friction

The Activity view lists Journeys, one row each, and a row can lead to one conversation only: the one at work
(CR284, for live work and for a turn that just ended there) or, failing that, the Journey's own. It has no
way to open the list of a Journey's conversations. The Recents and Tree views do: each Journey row carries
the control that expands its conversations (`journey-conversation-toggle`, which renders
`FocusedConversationSidebar`). So a conversation the Navigator works in, inside a Journey that is not
running a turn at that moment, cannot be entered from Activity, and the view has to be left for Recents to
get to it.

Read from the code, not observed in the app:

- `onSelect` in `App.tsx` for an Activity row leads to the conversation only when the row has `inside`;
  otherwise it dispatches `select_root` and selects the Journey. On the Journey the Navigator is already in,
  that click moves from the conversation being worked to the Journey's own.
- `inside` is claimed from live work, or from a turn that ended in a conversation and was not yet seen
  (`journeyActivityInputs.ts`). A conversation with no run at work and no unseen answer is never claimed.
- `JourneyActivityList.tsx` has no conversations control at all.

CR284 is the neighbouring record and does not cover this: it follows work and its answer, and says that the
other views' marks and the "seen" rule stay as they were.

Not known: whether a turn was running in that conversation when the Navigator looked. If one was, the row
should have led there through CR284 and this would be a different defect (the owner not being claimed), so
the first step of the work is to reproduce it with and without a live turn.

## Planned

Three options were put to the Navigator on 2026-11-27. The answer: "Sim, é a opção A. Mas acho que a
opção B não se aplica. Se eu clicar na journey, devo ir para a conversa da journey. Eu acho que temos uma
decisão a tomar sobre o critério para exibir uma conversa na aba activity. Se encontrarmos um critério que
se encaixe com a experiência de uso, não precisaríamos implementar toda a parafernália de opções e filtros
dentro do card conversations na aba recent."

So A is taken in a narrower form. Activity does not get the Recents expander (`FocusedConversationSidebar`,
with its cap, its Show more, its hidden section and its kind filter). It shows, under a Journey row, the
conversations that meet one criterion, each as its own line that leads to it. B is dropped: a click on a
Journey row leads to the Journey's own conversation. That also takes back the detour CR284 put on the
Journey row (a row whose work is in a conversation led there), since the conversation at work now has its
own line; C is dropped with B.

The open decision is the criterion. Candidates, as read from the code:

- **Where the person is.** In each Journey, the conversation the person was last in. The app already keeps
  it per Journey and persists it (CR137's `lastConversationSelection`). It answers the case that raised
  this CR at almost no cost, but it shows one conversation per Journey at most, and also one only opened
  for a look.
- **In motion.** A conversation while the agent works or finishes in it, or while it waits for the person
  (an unread answer, a failure, an interruption). It is CR284's rule given to every conversation instead
  of one per Journey. It does not answer the case: between turns, with the answer read, the line goes.
- **Worked recently.** In motion, plus every conversation where the person sent a turn in the last N hours,
  with the "ago" time Idle rows already show. It answers the case, and two conversations of one Journey
  worked side by side. It needs what the app does not keep yet: the time of the last turn per conversation.
  Today there is one per Journey (`lastWorkedAtByJourneyId`, written in `recordAdmittedJourneyActivity` when
  a turn is admitted); the same call would write it per conversation. Titles come from the Journey's
  catalog, which is read only when a Journey is expanded, so a line would read "A conversation" until it is
  read, as CR284's line does, unless the catalog of a Journey with such a line is read for it.

The recommendation is "worked recently" with a window of 24 hours, the Navigator to confirm or change the
window. The Navigator, the same day: "concordo com o que você trouxe. E com as 24horas tambem. Implemente."

## What Changed

Built in `37aa93fd`, no Rust.

- **The rule** (`activityConversationsOf` in `src/domain/journeyActivity.ts`). Under a Journey's row: what is
  in motion in its conversations, always, and every conversation a turn was sent in during the last
  24 hours (`ACTIVITY_CONVERSATION_WINDOW_MS`), never the Journey's own. What is in motion comes first, then
  the most recently worked, each conversation once.
- **What is in motion** (`deriveJourneyActivityInputs`). The conversation CR284 already claims for the row's
  state (live work, or a turn that ended there), plus every other conversation of the Journey that holds an
  open lease in the native registry, working or finishing. A conversation at work beside the Journey's own
  work now shows too; before, CR140's rule let the row report only the Journey's own.
- **The record of worked conversations** (`src/domain/workedConversations.ts`). Written when a live turn is
  admitted in a desktop conversation (the one the send was made in, only when it is the run's own thread),
  next to the Journey's last-worked time; kept newest first, one entry per conversation, at most 64, with
  the title the conversation had then. It lives in the Journey preferences file as `workedConversations`;
  an invalid value empties only this list, and a Journey that no longer exists loses its entries.
- **The lines** (`JourneyActivityList.tsx`, `presentation.css`). Each conversation is its own line under the
  row: the status glyph the sidebar uses, the title (the catalog's current one when read, else the recorded
  one, else "A conversation"), what it does or waits for, and the clock of its work or how long ago it was
  worked. It is a button of its own (pointer, Enter, Space) and leads there through CR134's route; the line
  of the conversation the person is in is marked.
- **The Journey's row** leads to the Journey's own conversation, whatever its conversations do. Its mark
  still says when its state is in a conversation, but no longer leads there, and its line says where the
  Journey sits or what it holds, in plain text, while the work, its clock and its outcome are on the
  conversation's line. This takes back CR284's detour on the row, by the Navigator's choice.

Tests: `src/tests/cr301ActivityConversations.test.tsx` (18: the rule, its window and order, the line's
words, the record and its persistence, the derivation, the drawing and the wiring). Two tests of
`journeyActivity.test.ts` that asserted CR284's naming on the row were removed (the cr301 file covers what
replaced them), and the wiring tests of `journeyActivityView.test.tsx` were rewritten to the new route.
Whole suite: 398 files, 3330 tests passing; `tsc` clean.

## Noted at Review

- **Not seen in a running app.** The list was rendered statically with the app's own CSS in the dark,
  Daylight and Compact forms and looked at in a browser; that caught the row's line being drawn as a
  command when it only names the Journey's place, fixed in the same commit. Clicking a line, the record
  being written by a real turn, and the layout in the app's WebKit were not exercised.
- A compaction is work but not a turn sent, so it does not keep a conversation in the view.
- A conversation renamed before its Journey's catalog is read shows the title it had at the last turn.
- CR284's one record per Journey still holds for an ended turn: if two conversations of a Journey end a turn
  while the person is away, the newest is Need you and the other shows as a quiet line.
- The day is counted on the sidebar's minute clock, so a line leaves within a minute of its 24 hours.
- An older build reading the preferences file ignores the field and drops it on its next save.

## Falsifier

In a Journey with two conversations, after a turn sent in the one that is not the Journey's own and its
answer read, the Activity view shows that conversation under its Journey and leads to it, and a click on the
Journey row leads to the Journey's own conversation. If the conversation can only be reached by changing
view, or the Journey row leads anywhere else, this CR reopens.

## Evaluation

The tests hold the rule, the record and the wiring. Whether the view now answers the case that raised the
CR is for the Navigator to see in a dev build, by the route below.

## Validation Route

In a dev build (`npm run tauri:dev`): in this Journey, send a turn in a conversation that is not the
Journey's own, read the answer, move to another Journey, switch to the Activity view and go back to the
conversation from its line; then click the Journey row and land on the Journey's own conversation.
