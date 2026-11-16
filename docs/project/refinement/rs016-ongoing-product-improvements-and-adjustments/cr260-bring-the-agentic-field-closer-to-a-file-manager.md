[< RS016](index.md)

# CR260: Bring the Agentic Field Closer to a File Manager

**Status:** in_progress (opened 2026-11-16 by the Navigator; iterating in small steps like CR156, first iteration on the Navigator's word)
**Driver:** —
**Delivery:** —

## Friction

**Navigator request (2026-11-16):** the Agentic Field should move gradually toward an experience
similar to Finder or Windows Explorer. Five improvements were named:

1. A more compact layout. Today a wide gap separates the left and right panels, and the two read as
   independent cards rather than one browsing surface. A reference image accompanies the request.
2. Resizable panels. Dragging a divider should adjust the horizontal share of the tree and the
   viewer.
3. Top buttons for navigation (back and forward) integrated with action buttons such as Open folder
   and Open file.
4. The folder's name at the top and its full path at the footer.
5. A better answer for "Expand preview", possibly folded into the panel resize itself.

## Where the surface stands (after CR156)

The field is a Journey Briefing entry above a plain file tree on the left, and a viewer for the
briefing, a file or a folder on the right. The two sides are a CSS grid with `gap: 18px` and fixed
column proportions (`minmax(280px, 0.8fr) minmax(340px, 1.2fr)`), each painted as its own card.
"Expand preview" is a text button that switches a mode (`is-preview-expanded`) hiding the tree
column entirely; chat links can request that mode on reveal (`expandPreviewOnReveal`). There is no
navigation history, no path display, and the only actions live inside the viewer body (Open file,
Open folder) and the tree context menu.

## Reading of the scope

The five items share one direction: the field stops being two cards side by side and becomes one
file-manager surface with chrome. A file manager is recognized by its frame: a toolbar above
(navigation plus actions plus the current place's name), a content split below it, a thin draggable
divider between tree and viewer, and a path bar at the foot. Items 1, 3 and 4 build that frame;
items 2 and 5 are one mechanism, because a divider the Navigator can drag already contains the
collapse gesture that "Expand preview" approximates today.

Two parts carry design risk and deserve their own iterations: the divider (pointer capture, minimum
widths, persistence, keyboard access through a separator role) and the history (what a "place" is
when the viewer can show a briefing, a file or a folder).

## Plan (iterations, each validated in dev before the next)

1. **Compact layout.** Merge the two cards into one surface: one shared background and border, a
   hairline division instead of the 18px gap, tighter paddings and row heights in the tree. Starts
   from the Navigator's reference image.
2. **Toolbar.** One top bar across the whole surface: back and forward buttons, the selected
   place's name (folder name, file name or Journey Briefing), and the contextual actions (Open
   folder, Open file) moved up from the viewer body. Navigation history is a selection stack with a
   cursor; tree clicks, folder-listing clicks and briefing selection all push places.
3. **Path bar.** A footer showing the selection's full workspace path, the root shown as the
   Journey root. Display first; clickable segments only if the Navigator asks.
4. **Resizable divider.** The gap becomes a draggable divider adjusting the column shares, with
   minimum widths on both sides, double click to reset, and the width remembered per person.
5. **Retire "Expand preview".** Dragging the divider to the left edge collapses the tree; a small
   affordance on the divider reopens it. The chat-link intent (`expandPreviewOnReveal`) maps to the
   collapsed state. The mode button and `is-preview-expanded` go away.

## Open questions

- The reference image was a plain Finder screenshot; the Navigator chose to go on without it
  (2026-11-16), so iteration 1 follows Finder conventions.
- Whether back and forward should also walk into folder history only, or every selection including
  files, is a feel decision for dev validation in iteration 2.
- Where the divider width persists (per person, per Journey) is decided in iteration 4.

## Known pitfalls carried in

New toolbar and footer buttons are transparent text buttons: each must join both light-theme lists
in `app.css` (the light-text list and the white-ink exclusion list), the trap CR105, CR151 and
CR156 each hit once.

## Iteration 1: one compact surface (2026-11-16, `11ad32fb`)

The tree and the viewer stop being two cards. `.operational-artifacts-layout` now owns the single
background, border and a 14px radius, with `gap: 0` and `overflow: hidden`; the tree is a slightly
tinted sidebar with a hairline `border-right`, and the viewer is its content. Columns moved from
`0.8fr / 1.2fr` with a 280px floor to `0.75fr / 1.25fr` with a 240px floor. The outer margin went
from 24px 34px to 14px 18px; tree rows from 31px to 24px with 3px vertical padding; row, root and
briefing radii from 10px to 6px; the briefing entry and root padding tightened. The light families
paint the shared surface and give the sidebar a faint accent wash and a light hairline; on narrow
windows, where the panels stack, the hairline moves to the sidebar's bottom.

Test first: `src/tests/cr260CompactField.test.ts` (four guards on the stylesheet read as written)
was red on all four before the change. Checked by a throwaway render in dark and daylight. vitest
363 files, 3010 passed, 1 skipped; `tsc` clean; no Rust changed.

The "Expand preview" button still sits alone above the viewer; iteration 2 moves the actions into
the toolbar and iteration 5 retires it.

