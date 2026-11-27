[< RS016](index.md)

# CR301: Reach Any Conversation of a Journey from the Activity View

**Status:** captured 2026-11-27
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
window.

## What Changed

Nothing yet.

## Noted at Review

To fill when built.

## Falsifier

In a Journey with two conversations, after a turn sent in the one that is not the Journey's own and its
answer read, the Activity view shows that conversation under its Journey and leads to it, and a click on the
Journey row leads to the Journey's own conversation. If the conversation can only be reached by changing
view, or the Journey row leads anywhere else, this CR reopens.

## Evaluation

To be written with the change, once the criterion is chosen. First, a domain test of the criterion (which
conversations of a Journey get a line, for each state and each age), then a view test that a conversation
line leads to its conversation and the Journey row to the Journey's own.

## Validation Route

In a dev build (`npm run tauri:dev`): in this Journey, send a turn in a conversation that is not the
Journey's own, read the answer, move to another Journey, switch to the Activity view and go back to the
conversation from its line; then click the Journey row and land on the Journey's own conversation.
