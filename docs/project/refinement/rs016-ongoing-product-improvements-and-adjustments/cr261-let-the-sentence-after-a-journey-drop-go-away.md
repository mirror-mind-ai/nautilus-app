[< RS016](index.md)

# CR261: Let the Sentence After a Journey Drop Go Away

**Status:** done 2026-11-18 (`f01dbd33`, `2639f9fa`); validated in dev by the Navigator on macOS, both iterations
**Driver:** Navigator
**Requested:** "Eu movi uma journey e o app mostra uma mensagem 'Moved Vida Condutora into Vida
Cidadã, as its first Journey.' Depois de a mensagem ser exibida ela nunca mais some. A única forma
de remove-la é saindo do app.", 2026-11-18.

## Friction

After a drag that moves a Journey, the sidebar says where it went. The sentence has no end: it
stays until the next drag of a Journey, and a Navigator who moves one Journey and goes back to work
sees it for the rest of the session. The same holds for a refusal.

## Cause

Not an accident. CR203 wrote it as a rule ("the sentence stays until the next gesture"), and the
code kept it: `journeyDropMessage` is cleared in one place, when the next drag starts
(`continueJourneyDrag`). The rule was meant to keep the sentence from vanishing before it was read,
and it solved that by never ending. Nothing else (selecting a Journey, opening a Conversation,
time) clears it.

## What Changed

- **The sentence leaves after a lifetime that depends on what it says.** A confirmed move stays
  6 seconds, enough to read where the Journey went (the reason it exists: a Journey dropped into a
  collapsed subtree must not look deleted). A refusal stays 12 seconds, because it asks for another
  try. "Moving" has no lifetime: it ends when Mirror answers, however long the write takes.
- **The rule is a pure function.** `dropMessageLifetimeMs(kind)` in `journeyPointerDrag.ts`, with
  the two durations named beside it.
- **The timer clears only its own sentence.** The effect in `App.tsx` arms on each new message and
  clears the state only if the message is still the one it was armed for, so an older timer never
  cuts a newer sentence short. Starting another drag still clears it at once.
- **CR203's wording is superseded.** Its record says the sentence stays until the next gesture;
  this CR replaces that with a lifetime. The sentence still says where the Journey went.

Specs in `cr261DropMessageLifetime.test.ts`, red first: the lifetime per kind (a refusal outlasts a
move, the wait never expires) and the App wiring.

## Iteration 2: the sentence in the light themes

Validating iteration 1 the Navigator found that the sentence could hardly be seen in the light
themes: a very pale green. The colour was never decided for them. `.journey-drop-hint.completed`
was `#9fd4a8`, `.moving` `#cfe3e7` and `.refused` `#e2957f`, picked against the dark sidebar, and
no rule overrode them for daylight, mist or parchment, which already carry inverted registers for
success, danger and muted text (CR106, CR102, CR151). The green measured about 1.6:1 on a light
sidebar, the pale blue under 1.3:1 and the salmon about 2.2:1.

- **The light families take their own registers.** One rule for daylight, mist and parchment sets
  the confirmed move to `--ui-success`, the refusal to `--ui-danger` and the wait to the muted ink
  drawn 35% toward the text ink. No new colour was invented.
- **The wait needed that pull.** `--light-muted` alone is 4.44:1 on daylight's sidebar, a hair under
  4.5:1, so the neutral state mixes in some of `--light-text`, the way CR228 did for Recent's
  divider.
- **The dark themes are untouched.** Their three hex values stay as they were.
- **Measured, not eyeballed.** `cr261DropMessageContrast.test.ts`, red first, computes each ink on
  the sidebar, canvas and surface of every light theme and asks for 4.5:1 or more. The three
  states were also looked at rendered, in the three light themes and in a dark one.

The refusal and the wait were not in the report, but they carried the same unseen colours, so they
went with it.

## Conscious Exclusions

- **No dismiss button and no fade.** The sentence is one line under the tree; an explicit close
  would add a control for something that already leaves on its own.
- **The durations are fixed,** not a setting.
- **Other sidebar notices** (the registry refresh message above it) are not touched; whether they
  share the same endless life is not known, and is a separate question.

## Falsifier

In dev, move a Journey by dragging it under another one: the sentence "Moved … into …" appears and
disappears by itself within about 6 seconds, without any click. A refused drop (for instance onto
its own descendant) says why and disappears within about 12 seconds. Dragging a second Journey
before the first sentence has gone replaces it at once, and the new one lasts its own full time.

In daylight, mist and parchment the three sentences read plainly: deep green for a move, deep red
for a refusal, a dark grey for the wait. In a dark theme they look as before.
