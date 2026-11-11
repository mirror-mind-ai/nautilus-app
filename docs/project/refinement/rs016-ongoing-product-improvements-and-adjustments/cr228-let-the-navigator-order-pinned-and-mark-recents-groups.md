[< RS016](index.md)

# CR228: Let the Navigator Order Pinned, and Mark Recent's Groups

**Status:** done · validated by the Navigator on macOS 2026-11-11; the divider's wording moved to [CR229](cr229-name-recents-pinned-group-by-the-use-it-lacks.md)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #8](https://github.com/mirror-mind-ai/nautilus-app/pull/8); merged on
the Navigator's word, 2026-11-11 ("faça o merge do #6, #10, #5 e do #8 com os ajustes mencionados"). Merge commit `256b54c6`.

## Friction

Pinned was ordered by when each Journey was pinned; the only way to change it was to unpin and pin
again, which sent the Journey to the end. Recent mixed two rules without saying so: its recent
cards, by last message sent, were followed by pinned and selected cards only kept visible, which
read as recent cards out of order.

## What Changed

- **Pinned is the Navigator's order,** a local preference that never reaches Mirror: a new pin goes
  first; the card's menu gains Move Up in Pinned, Move Down in Pinned and Move to Top of Pinned,
  disabled at the edges; a card is dragged within Pinned when no search filters it, reusing CR203's
  pointer gesture with the ghost saying "Place it before/after …".
- **Recent stays automatic,** with a divider naming where the Pinned and Selected groups begin; in
  the compact rail the rule shows without the word.
- Pure functions in `src/domain/journeyListOrdering.ts`; spec `journeyListOrdering.test.ts` (16) and
  two menu cases in `journeyItemContextMenu.test.tsx`.

## Decisions

- **A new pin goes first,** where it used to go last. Accepted by the Navigator on 2026-11-11
  ("aceito a mudança no critério de organização das jornadas pinneds").
- **The light-theme contrast was fixed here, not sent back** ("Corrija o problema do contraste nos
  temas claros sem devolver o PR"). The divider had only the dark themes' ink: its word at 2.4 to
  2.7:1 on the light sidebars and its rule white at 12%. Daylight, Mist and Parchment now write the
  word in `color-mix(in srgb, var(--light-text) 25%, var(--light-muted))` (lowest 5.81:1; the muted
  ink alone would be 4.44:1) and draw the rule in `--light-border`. Spec
  `src/tests/cr228RecentDividerContrast.test.ts` (3), red first; both mutations caught. Code `c1a2bf65`.
- The PR's Canvas row, which had no CR number, is replaced by this CR's.

## Not in Scope

The drop line (`#76bdc7`), shared with the Tree's drag since CR203, is about 2:1 on the light
themes; it shows only during a drag and is left for its own change.

## Falsifier

Pin a Journey: it is first in Pinned. Move it with the menu and by dragging; the order survives a
relaunch. In Recent on a light theme, the PINNED divider reads.

## Evaluation

Evaluated on 2026-11-10 with PRs #6, #10, #5 and #8 merged in that order onto `main` at `0f3ac37a`
in a separate worktree: no conflict; `tsc` clean; vitest 341 files, 2,920 passed, 3 skipped (two
of them the preflight tests that need the materialized runtime the worktree lacks); cargo 523
passed, 11 ignored. The merged `main` is byte for byte that evaluated tree. The repository has no
CI, so that run is its only green. After CR228's contrast fix, `main` ran again: vitest 344 files,
2,927 passed, 1 skipped; `tsc` clean.
