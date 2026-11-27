[< RS016](index.md)

# CR302: Let Every Journey Have a Custom Image

**Status:** captured 2026-11-27
**Driver:** Navigator
**Requested:** on 2026-11-27, in this Journey, after meeting the message "At most 32 Journeys can use custom images on this device.": "Crie uma CR para corrigirmos a seguinte situação: 'At most 32 Journeys can use custom images on this device.' Não vejo porque termos um limite pra isso."

## Friction

Choosing a custom image for a Journey is refused once 32 Journeys already have one, with the message above. The
person has no way to know the number beforehand, nothing in the screen says why it is 32, and the only way out
is to take the image off another Journey. The Navigator sees no reason for the limit, and a reading of the code
finds none that belongs to the person: the number comes from the first version of the Journey appearance
feature (`de4998b7`), which bounded everything it stored as a matter of caution, not from a need.

What the limit costs and what it protects, read from the code (not observed in a running app):

- **It is one rule written in four places.** The native import refuses the 33rd image
  (`MAX_CUSTOM_IMAGES` in `src-tauri/src/journey_appearance.rs`); the renderer refuses it before asking the
  native side (`chooseJourneyCustomAppearance` in `src/app/App.tsx`); the reader of the saved preferences
  (`parseJourneyAppearanceById` in `src/domain/journeyAppearance.ts`) rejects a file that holds more; and a
  test and the architecture document state the number.
- **The reader's copy is the dangerous one.** When the appearance map is rejected, the whole preferences file is
  discarded (`journeyPreferencePersistence.ts`), so pins, recents, order and theme go with it. Raising only the
  native limit would let the 33rd image be saved and then reset every preference at the next start.
- **What it could be protecting is small.** Each image is stored once per Journey as a 512 pixel PNG, at most
  2 MiB after normalizing and in practice far less; an image is read only when a Journey's mark is drawn, and the
  in-memory copy is a bounded cache that evicts the oldest and reloads on demand, so it refuses nothing. The
  count of Journeys itself bounds the images, since there is at most one per Journey and the saved map drops
  Journeys that no longer exist.
- **A sibling limit of the same kind** caps the whole appearance map, system icons included, at 256 Journeys
  (the same four places, in `App.tsx` twice and in the parser), and the personas have the same shape at 64
  images (`MAX_PERSONA_IMAGES`). The Navigator asked about the 32; the others are named here so the choice is
  made with them in view.

## Planned

Options, none chosen:

- **A. Drop the limit of 32 only.** Remove the refusal in the native import and in the renderer, remove the
  count in the parser while keeping its check of every entry (the Journey id's shape, the kind, no extra
  fields), and update the test and the architecture sentence. The other limits stay.
- **B. Drop the limits on Journey appearance: the 32 and the 256.** The same as A, and the 256 goes too: it is
  the same kind of rule, it would be the next refusal for a person with many Journeys, and its reader copy
  discards the whole preferences file in the same way. The protection that remains is the per-image one (5 MiB
  of source, 2 MiB normalized, decoded as PNG, JPEG or WebP, a regular file under app storage), which is the
  one that guards against a bad file.
- **C. B and the persona images (64).** Consistent, but the persona limit was not asked about and has its own
  tests (`CR218`); better as its own CR if the Navigator wants it.

Recommendation: **B.** The Navigator's question applies to the 256 as much as to the 32, and removing one while
leaving the other would only move the refusal to a larger number. In both A and B the same test comes first: a
Journey appearance map with more than 32 custom entries (and, for B, more than 256 entries) is accepted by the
parser, and the native import writes a 33rd image into a temporary app-data directory. Nothing is migrated:
files saved under the old limit stay valid.

One cost to say before it is chosen. A build older than this change that reads a preferences file holding more
than 32 custom entries discards the whole file. It is the downgrade path only (an update never goes back), and
it is the reason the parser, not only the import, has to change in the same commit.

## What Changed

Nothing yet.

## Noted at Review

Not yet reviewed.

## Falsifier

The change is wrong if, with more than 32 Journeys holding a custom image, the app restarts and any of them is
missing, the saved preferences (pins, recents, order, theme) reset, or the sidebar becomes visibly slow to
draw. It is also wrong if a file that is not an image, an oversized file or a symbolic link is now accepted for
an image, since those protections were meant to stay.

## Evaluation

Not yet evaluated.

## Validation Route

In a dev build (`npm run tauri:dev`), give a custom image to more Journeys than the old limit allowed (the 33rd
is the one that was refused), close and open the app, and see that every image is still there and the pins,
recents and theme are as they were. Then try a file over 5 MiB, and a text file renamed to `.png`, and see that
both are still refused with their own messages. If the Journey list holds fewer than 33 Journeys on the machine,
the temporary app-data directory test in Rust is the evidence and the screen part waits.
