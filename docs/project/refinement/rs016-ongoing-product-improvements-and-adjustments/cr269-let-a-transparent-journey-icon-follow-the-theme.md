[< RS016](index.md)

# CR269: Let a Transparent Journey Icon Follow the Theme

**Status:** in_progress 2026-11-23 (`0d5eaaf5`); awaiting a look in a dev build, in a light theme and a dark one, with a transparent PNG
**Driver:** Navigator
**Requested:** on 2026-11-23. Icons the agent draws as SVG and converts to a transparent PNG always showed a black background in the app, in every theme.

## Friction

A Journey's icon was meant to be a drawing. A drawing with a transparent background showed a dark
square behind it, also in daylight, mist and parchment, where it looked like a hole in the page.
Changing the theme changed nothing.

## Cause

The image itself was fine. The import (`journey_appearance.rs`) resizes to a square and saves a PNG,
which keeps the alpha channel. The black came from behind it: `JourneyVisualMark.tsx` put an inline
`backgroundColor: "#101719"` on every custom mark. An inline colour does not pass through the theme,
so no theme could change it.

The colour was added on purpose (`bf404bbb`, "Show custom Journey images without theme tint"): a
custom mark used to wear the same accent tint as a default one, and that tint coloured the drawing.
The fix kept the drawing neutral and lost the theme.

## What Changed

- **The surface comes from the stylesheet.** `.journey-visual-mark.custom` is the dark neutral
  (`#101719`, with the faint light border) and daylight, mist and parchment share one rule that uses
  `--light-surface` and `--light-border`. The accent tint stays off the drawing, which was the point of
  the old colour.
- **The component carries no style.** One place decides the surface, and it is the one that knows the
  theme.
- **Every place a Journey's image appears is covered,** because they all draw `JourneyVisualMark`: the
  tree, the sidebar card, the active Journey header and the empty state. The selected-card border in
  each theme is untouched, its selectors are more specific.

Specs, red first, in `journeyVisualMark.test.tsx`: the mark renders with no `style` and no `#101719`,
and the stylesheet gives the dark neutral by default and the light surface and border to the three
light themes. Seen in a page with the real stylesheet and a transparent PNG in all four themes: a
dark surface in dark, a light one in the other three.

## Conscious Exclusions

- **No checkerboard and no per-image choice.** One neutral per theme family. An icon drawn in white
  strokes will not show on a light theme, and nothing here repairs that; a drawing meant for both
  needs strokes that read on both.
- **Persona images are not touched.** Their preview has its own surface (`hsl(var(--persona-hue) …)`);
  this CR is about Journey icons.
- **Opaque images look as before.** The surface only shows through transparent pixels.

## Falsifier

A Journey whose icon is a transparent PNG with dark strokes shows the strokes on a light surface in
daylight, mist and parchment and on a dark one in the dark themes, in the tree and in the header. If
any light theme still shows a dark square behind the drawing, this CR did not do its work.
