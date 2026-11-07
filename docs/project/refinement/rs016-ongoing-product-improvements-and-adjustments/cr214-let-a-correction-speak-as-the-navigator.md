[< RS016](index.md)

# CR214: Let a Correction Speak as the Navigator

**Status:** in_progress
**Driver:** assistant
**Delivery:** `main` (`e54d35ce`)
**Reported:** Navigator, 2026-11-07 ("só a parte do Correction during response que ficou meio fora da ideia. Talvez isso deveria estar em uma bolha do usuário também?"); follows CR117 and CR213
**Mockup:** [cr213-mockup.html](cr213-mockup.html), cards 5 to 8

## Friction

After CR213 every speaker speaks in a bubble beside their avatar. A correction sent while the agent
works (CR117) was still a system box, "↳ Correction during response", although it is the Navigator
speaking. It also sat after the agent's speech, where it read as a request the answer had ignored,
when the answer had in fact been written with it.

## Change

- Each correction is a speech of the Navigator: their avatar and name, mirrored on the right, in a
  smaller bubble with a dashed border, an aside rather than a new request. The tail stays solid.
- It sits before the speech it shaped: between the open actions and the speech while the turn
  runs; on a finished turn the order is request, correction, speech, turn line.
- What became of it is said beside the name in CR117's words, no more: "↳ correction · queued",
  "✓ reached the agent", "✓✓ applied", "✕ not applied", "✕ rejected". A correction the agent never
  took is not drawn in the accent colour.
- The bubble copies its words like every other bubble.
- The persona's colour was keyed on the turn's article (`.message.speaker-persona`), so a
  correction inside a persona's turn took the persona's colour; it is now scoped to the agent's
  speech (`.agent-speech`).

The ordering gives up the exact moment: a correction that arrived between two progress notes is
still drawn before the whole speech. Interleaving it would put two voices in one bubble.

## Falsifier

On a turn corrected mid-way, the Navigator reads the correction as their own words, before the
answer, and can tell from the line beside their name whether it reached the agent or was applied.
A correction the agent never took never reads as applied.

## Check

In `npm run tauri:dev`: send a correction while a turn runs, on a dark and a light theme. The bubble
appears on the right, above the persona's words, with your avatar in your colour; when the turn ends
it stays above the speech, and the line under the speech folds as before.
