[< RS016](index.md)

# CR212: Fold a Finished Turn's Actions Into One Line

**Status:** in_progress
**Driver:** assistant
**Delivery:** `main` (`a05abf83`), built with CR213
**Reported:** Navigator, 2026-11-07 ("depois que o turno acaba as tool calls viram ruído visual")
**Mockup:** [cr213-mockup.html](cr213-mockup.html), cards 1 and 2

## Friction

The latest turn shows every Agent Action between the card's header and the agent's comments, which
is what the Navigator reads. After the turn ends, the actions are noise. Older turns already fold
them behind "Show turn details", but only those (`AgentTurn.tsx`, `proximity === "historical"`); the
latest turn never does.

## Direction

- While the turn runs, the actions stay open, as now, under a live line ("Working · 4 actions · 12 s").
- When the turn ends, the latest turn folds them the way older turns do. The fold's summary becomes
  the turn's line: actions, files touched, duration, model. On a finished turn
  it sits under the comments, as a discreet footer for what the reader may have skipped (Navigator,
  2026-11-07); while the turn runs, the live line and the actions stay above the speech. The speaker
  header goes away; who speaks moves to the comments (CR213).
- The fold must not move what the Navigator is reading: the scroll stays anchored to the comments
  while the card shrinks.
- Every turn, latest or older, has the same line; the historical disclosure and this line become one.

## Change

- `AgentTurn` draws a running turn (`active`) as a live line ("Working · 3 actions"), the actions,
  then the speech. Every other turn draws the speech, then its line: a disclosure whose summary
  reads "14 actions · 1 surface · <model>" and opens onto the actions and surfaces. The latest
  turn and the older ones now share the same line, and "Show turn details" is gone.
- A turn that failed or was cancelled is not noise: its line names the outcome ("Failed · …") and
  opens by itself, so the reason stays visible even when the turn took no action.
- The scroll anchor of CR125 now sits on the speech (`data-conversation-message-id` moved from the
  card to it), which is what moves when the actions fold above it.
- Not done: files touched and duration. The runtime projection keeps neither, so the line says
  actions, surfaces and model.

## Falsifier

A turn finishes while the Navigator reads its comments: the actions fold into one line, the
comments do not jump, and opening the line shows every action. A running turn still shows its
actions as they happen.

## Check

In `npm run tauri:dev`: a turn ends while the comments are on screen and they stay put; older and
latest turns read the same; a turn that failed shows why without a click.
