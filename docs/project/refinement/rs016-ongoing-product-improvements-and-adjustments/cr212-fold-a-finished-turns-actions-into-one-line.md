[< RS016](index.md)

# CR212: Fold a Finished Turn's Actions Into One Line

**Status:** captured
**Driver:** assistant
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
  the turn's line: actions, files touched, duration, model, and the copy action. On a finished turn
  it sits under the comments, as a discreet footer for what the reader may have skipped (Navigator,
  2026-11-07); while the turn runs, the live line and the actions stay above the speech. The speaker
  header goes away; who speaks moves to the comments (CR213).
- The fold must not move what the Navigator is reading: the scroll stays anchored to the comments
  while the card shrinks.
- Every turn, latest or older, has the same line; the historical disclosure and this line become one.

## Falsifier

A turn finishes while the Navigator reads its comments: the actions fold into one line, the
comments do not jump, and opening the line shows every action. A running turn still shows its
actions as they happen.
