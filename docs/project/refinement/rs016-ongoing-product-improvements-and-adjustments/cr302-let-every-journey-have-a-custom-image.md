[< RS016](index.md)

# CR302: Let Every Journey Have a Custom Image

**Status:** done 2026-11-27 (`4fe6323c`), validated by the Navigator
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

Options, as offered:

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

On 2026-11-27 the Navigator said "implemente a 302" without choosing among the options, after being given the
recommendation; B was built, which is the recommendation and leaves the persona images (C) to their own CR. If
that was not the intent, A or C are small changes from here.

One cost to say before it is chosen. A build older than this change that reads a preferences file holding more
than 32 custom entries discards the whole file. It is the downgrade path only (an update never goes back), and
it is the reason the parser, not only the import, has to change in the same commit.


## What Changed

Built in `4fe6323c`; the CR was written, read and built within the same day.

- **The native import** (`import_at` in `src-tauri/src/journey_appearance.rs`) no longer counts the images
  already stored; `MAX_CUSTOM_IMAGES` is gone. It resolves the target path (which still rejects unsafe ids and
  symbolic links), normalizes the source and writes it atomically.
- **The renderer** (`chooseJourneyCustomAppearance` and `applyJourneySystemAppearance` in `src/app/App.tsx`)
  no longer refuses on 32 custom images or 256 entries, and the two messages are gone.
- **The parser** (`parseJourneyAppearanceById`) no longer counts, so a map of any size is read; each entry is
  still checked for the Journey id's shape, the kind and its exact fields. This is the copy that discarded the
  whole preferences file.
- **The architecture note** (`docs/architecture/app-architecture.md`) no longer states the numbers.
- **Kept:** the per-image protections (5 MiB of source, 2 MiB normalized, approved formats, 512 px square,
  regular files under app storage), the in-memory cache that evicts the oldest, and the personas' own limit of
  64.

Tests: `src/tests/cr302JourneyImagesHaveNoCount.test.ts` (5: a map of 40 custom images and one of 300 system
icons and a mixed one of 300 are read; one bad entry among 300 still rejects the map; the sanitizer still drops
Journeys that do not exist; the renderer and the native import hold no count and no "At most" message; the
file protections are still stated) and, in Rust, `cr302_a_journey_image_is_kept_however_many_other_journeys_have_one`
(40 Journeys import an image, one is replaced, 40 files remain). The old assertions of the limit were removed
from `journeyAppearance.test.ts` and `journeyVisualMark.test.tsx`. Whole suite: 399 files, 3335 tests passing;
`tsc` clean; the 11 tests of the module pass under `cargo test journey_appearance`.

## Noted at Review

- **Not seen in a running app.** The screen part of the route was not exercised; the Rust test holds the import
  and the TypeScript tests hold the parser and the renderer's source.
- **The Rust test was written with the change, not seen failing first.** Its failure on the old code is read from
  the code (the 33rd import returned the error), not run. The TypeScript tests were run red first: three failed
  for the reasons expected.
- A person with a very large number of Journeys with images now keeps all of them; each is read when its mark is
  drawn and the cache bound still applies, so the cost is disk (an image at most 2 MiB, in practice far less).
- The downgrade hazard stays as said in Planned: an older build reading more than 32 custom entries resets the
  preferences.

## Falsifier

The change is wrong if, with more than 32 Journeys holding a custom image, the app restarts and any of them is
missing, the saved preferences (pins, recents, order, theme) reset, or the sidebar becomes visibly slow to
draw. It is also wrong if a file that is not an image, an oversized file or a symbolic link is now accepted for
an image, since those protections were meant to stay.

## Evaluation

The tests hold the removal at each of the four places and the protections that stay, and the Navigator
validated the change.

## Validation Route

In a dev build (`npm run tauri:dev`), give a custom image to more Journeys than the old limit allowed (the 33rd
is the one that was refused), close and open the app, and see that every image is still there and the pins,
recents and theme are as they were. Then try a file over 5 MiB, and a text file renamed to `.png`, and see that
both are still refused with their own messages. If the Journey list holds fewer than 33 Journeys on the machine,
the temporary app-data directory test in Rust is the evidence and the screen part waits.

## Closing

Closed on 2026-11-27 on the Navigator's report: "Ok, marque essa CR como validada." It was one sentence and did
not say which build was run, whether more than 32 Journeys were given an image, or whether the app was
restarted afterwards. What stands behind the closing is that report, the five TypeScript tests and the Rust one,
the whole suite (399 files), a clean `tsc` and the CI of `1dfdac9f`. Not exercised, as far as the report
tells: the 33rd image chosen on the screen, the preferences surviving a restart with more than 32 images, and
the refusal of an oversized or renamed file after the change. The persona images keep their limit of 64. If the
falsifier fails, this CR reopens.
