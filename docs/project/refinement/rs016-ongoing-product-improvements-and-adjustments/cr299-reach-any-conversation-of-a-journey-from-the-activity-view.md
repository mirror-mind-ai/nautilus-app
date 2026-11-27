[< RS016](index.md)

# CR299: Reach Any Conversation of a Journey from the Activity View

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

Options, none chosen:

- **A. The same expander in an Activity row.** The row gets the conversations control the other views have
  and shows the Journey's conversations under it, reusing `FocusedConversationSidebar`. It is one way to
  reach a conversation in all three views, and it answers the Navigator's case whatever the state of the
  turn. The cost is a taller list in a view meant to be read at a glance, so it stays collapsed unless asked.
- **B. A click on the Journey being worked stays where the person is.** A row already selected does not
  send the person to the Journey's own conversation. Smaller, but it only stops the wrong move; it does not
  open another conversation.
- **C. An Idle row leads to the conversation last worked in, not the root.** Changes what a click means for
  every Journey and needs a record of the last conversation per Journey, which the app may not keep.

The recommendation is A, with B as a small part of it if the reproduction shows the click moving the person
away from the conversation they are in. C is left out until the Navigator wants it.

## What Changed

Nothing yet.

## Noted at Review

To fill when built.

## Falsifier

In a Journey with two conversations, with the Navigator in the one that is not the Journey's own and no turn
running, the Activity view lets the Navigator open that conversation, or any other of the Journey, without
leaving the view. If a conversation can still only be reached by changing view, this CR reopens.

## Evaluation

To be written with the change. First, a test that an Activity row offers the conversations of its Journey,
and, from the reproduction, a test of what a click on the selected row does.

## Validation Route

In a dev build (`npm run tauri:dev`): open the Journey with the "Nautilus for Linux" conversation, stay in
that conversation with no turn running, switch to the Activity view and reach the conversation from there;
then send a turn in it and check that the row still leads there.
