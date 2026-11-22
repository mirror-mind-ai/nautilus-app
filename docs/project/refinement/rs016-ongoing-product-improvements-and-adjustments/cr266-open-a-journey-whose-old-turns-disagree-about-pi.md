[< RS016](index.md)

# CR266: Open a Journey Whose Old Turns Disagree About Pi

**Status:** captured 2026-11-22; not started
**Driver:** Navigator
**Requested:** on 2026-11-21, after a migrated Journey (`operacao-natal`) would not open. The Navigator asked for what was needed to make the Journey work.

## Friction

The Journey list loaded, other Journeys opened, and this one showed "Availability reason:
runtime_read_failed". The sentence names no cause the person or a helper can act on. The cause was
four turns out of 269 in a conversation of 537 messages.

## What was found

`projectPiBackedConversationSurface` (`src/domain/piBackedConversationSurface.ts`, the binding at
line 682) throws `pi_surface_metadata_conflict` when two reconciliation turns cite the same Pi entry.
In `dedicated-journey-conversations/operacao-natal/generation-2.json`, turns 53, 54, 132 and 134 cited
entries that earlier turns (52, 131, 133) own. The data came from the 0.1.0 app and from a force-quit;
how the duplication was written has not been established.

The throw is the right alarm for a turn that is being written now. For turns settled weeks before, it
turns one ambiguous line of history into a Journey that cannot be opened, and `App.tsx:2562` reduces
the error to one generic reason.

## Direction (not decided)

- An old turn whose evidence conflicts with an earlier owner reads as `unknown` Pi evidence, keeps its
  Mirror side, and the Journey opens. This is what the manual repair did; the app should do it and say
  so.
- The unavailable state names the real reason (`pi_surface_metadata_conflict`, which turn) in the
  diagnostics, and offers the repair the Navigator needs instead of a dead end.
- Establish first whether the conflict can arise in the current writer, in which case the alarm stays
  for turns in the current run and the tolerance applies to settled ones only.

## Acceptance

- A conversation with duplicated Pi ownership in settled turns opens, shows its messages, and records
  which turns were treated as unknown.
- A conflict in a turn being written still refuses, as today.
- The reason shown for an unavailable Journey is the reason found.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The repair applied by hand is
`~/Migracao-Veronica/scripts/repair_shared_pi_entries.py` (dry run by default, keeps a
`.before-repair` copy); the original file is in the Journey's `mac-dela/` evidence.
