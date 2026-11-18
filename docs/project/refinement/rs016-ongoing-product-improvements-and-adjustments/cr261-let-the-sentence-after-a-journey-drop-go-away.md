[< RS016](index.md)

# CR261: Let the Sentence After a Journey Drop Go Away

**Status:** in_progress 2026-11-18; implemented, awaiting the Navigator's look in dev
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
