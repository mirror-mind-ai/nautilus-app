[< RS016](index.md)

# CR266: Open a Journey Whose Old Turns Disagree About Pi

**Status:** validated 2026-11-22 (`549f34b4`); published in v0.4.0-alpha.21, opened and used by the Navigator on the macOS 12 Mac
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

## What was done

- A settled turn whose claim contradicts an entry an earlier turn owns is read as unknown, whole:
  neither of its entries is bound, the first owner keeps the entry, and its id is listed in
  `declinedPiEvidenceTurnIds` on the projection. The list is derived on every reconstruction and
  dropped on write, like the other Pi-derived maps.
- The latest turn of the conversation, the only one the current run can have written, still throws
  `pi_surface_metadata_conflict`. The existing test of that refusal is unchanged.
- The unavailable surface names the cause it met: "Availability reason: runtime_read_failed
  (pi_surface_metadata_conflict)".
- Projected over the user's original `generation-2.json` (from her Mac) and the Pi inspection, the
  Journey that threw now gives 534 messages and declines exactly the four turns found by hand; the
  transcript equals the one the hand repair produced.

## Still open

- How the 0.1.0 app wrote the duplicates is not established. If the writer of today could produce
  one, the refusal on the latest turn is the alarm that will say so.
- `declinedPiEvidenceTurnIds` is not shown anywhere yet; it is there for a diagnostics surface.

## Acceptance

- A conversation with duplicated Pi ownership in settled turns opens, shows its messages, and records
  which turns were treated as unknown.
- A conflict in a turn being written still refuses, as today.
- The reason shown for an unavailable Journey is the reason found.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The repair applied by hand is
`~/Migracao-Veronica/scripts/repair_shared_pi_entries.py` (dry run by default, keeps a
`.before-repair` copy); the original file is in the Journey's `mac-dela/` evidence.
