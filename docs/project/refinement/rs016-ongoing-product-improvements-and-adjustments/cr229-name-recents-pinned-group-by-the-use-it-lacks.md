[< RS016](index.md)

# CR229: Name Recent's Pinned Group by the Use It Lacks

**Status:** built, awaiting the Navigator's validation
**Driver:** assistant
**Requested:** Navigator, 2026-11-11 ("Talvez a hesitação seja essa de pinned aparecer em dois lugares
e no meio das recentes nao está claro se foi pinnada recentemente ou acionada recentemente";
"use PINNED BUT NOT USED RECENTLY"); after [CR228](cr228-let-the-navigator-order-pinned-and-mark-recents-groups.md)

## Friction

CR228's divider in Recent said only "Pinned". Between recent cards it did not say whether the card
was pinned recently or used recently, and the word was the same as the Pinned filter's. The group
is the Journeys that are pinned and not among the last used; "recent" in Recent is the last message
sent, never the pin.

## Desired

- The divider reads "Pinned but not used recently" (shown in capitals by the stylesheet, as before).
- At the narrowest sidebar (240 px) the words need about 199 px on one line and wrap to two; a stretch
  of rule (at least 16 px) stays beside them.
- "Selected", the other divider, is unchanged.

## Considered

Pinned, not used lately; Pinned, no recent messages; Pinned, not recent; Kept by pin; Also pinned;
Older pins. The last two were set aside: "Older pins" repeats the confusion between the age of the
pin and the age of the use, and "Also pinned" suggests the recent cards above are not pinned.

## Built (2026-11-11)

- `RecentSidebarDivider` is `"Pinned but not used recently" | "Selected"`
  (`src/domain/journeyListOrdering.ts`); `.journey-list-divider::after` gains `min-width: 16px`.
- Specs: `journeyListOrdering.test.ts` (CR228's two expectations updated, two new). Mutations: the old
  word and the removed `min-width`, both caught. Rendered with the app's stylesheet at 200 px and
  250 px. `tsc` clean; vitest 344 files, 2,929 passed, 1 skipped. Code `8fed1e46`.
- The light-theme ink and rule of CR228 are unchanged, so its contrast test still holds.

## Falsifier

In Recent, with a pinned Journey not among the last used, the divider above it reads "Pinned but not
used recently", on one line at the default sidebar width and on two at the narrowest, with a rule
beside it.
