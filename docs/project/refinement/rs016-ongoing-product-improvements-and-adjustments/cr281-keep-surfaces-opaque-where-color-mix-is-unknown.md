[< RS016](index.md)

# CR281: Keep Surfaces Opaque Where color-mix Is Unknown

**Status:** in_progress 2026-11-23; implemented and covered by tests, awaiting a release and a look on the macOS 12 Mac
**Driver:** Navigator
**Requested:** on 2026-11-23, with a photo from the macOS 12 Mac: "quando eu clico no número de versão para ver seus detalhes, a tela que abre aparece transparente. Vamos abrir uma CR e corrigir."

## Friction

Clicking the version under the app's name opens the update panel ("Nautilus update is available",
the release reading, Later / Details / Update). On the macOS 12 Mac it had no background: its text was
drawn over the journey list behind it and neither could be read.

## What Was Found

`.self-update-popover` has one `background`: `color-mix(in srgb, var(--shell-middle) 96%, #000000 4%)`.
`color-mix()` arrived in WebKit 16.2; WebKit 15, which macOS 12 runs until Safari is updated, does not
know it, drops the whole declaration, and the panel keeps the default `transparent`. This is the
stylesheet item CR265 left open, with its visible effect.

It was not one panel. In the built stylesheet 227 declarations use `color-mix()`, 93 of them as the
only `background`: the speech bubbles of both sides of the conversation, the search and turn panels,
the composer's wrapper, the release reading, the update chip, the selected and hovered Journey rows,
and about fifty surfaces of the three light themes. Borders, shadows and some text colours go the same
way. Nothing in a test or in the Mac this is built on could show it.

## What Changed

- `scripts/postcss_color_mix_fallback.mjs`, a PostCSS plugin registered in `vite.config.ts`, writes a
  plain declaration before each one that uses `color-mix()`. The plain value is the mix with each pair
  replaced by its dominant colour: the larger share, the first on a tie. A tint over `transparent`
  falls back to nothing, which is what that engine drew anyway; a surface mixed from two opaque
  colours, such as the panel, falls back to the main one (`background: var(--shell-middle)`). An
  engine that knows `color-mix()` uses the declaration that follows, so nothing changes for it.
- Values with several mixes (gradients, shadows) and nested mixes are handled; a mix it cannot read is
  left as written. A declaration that already has a plain one of its own before it is kept as it was
  written, which also makes the plugin safe to run twice.
- The result is in the built stylesheet, not only in the plugin's tests: `.self-update-popover` and
  `.speech-bubble` come out with both declarations, so the minifier keeps them.

## Proof

`colorMixFallback.test.mjs`: the dominant-colour rule over tints, half-and-half pairs, a leading
percentage and unequal shares; gradients, shadows and nested mixes; no change where a plain declaration
is already there; custom properties and unreadable mixes untouched; the plugin registered in the
build; and every declaration of both stylesheets that uses `color-mix()` having a plain one before it
once the plugin has run. Over the built stylesheet: of 227 declarations, 222 have one before them.

## Not Done

- **Five custom properties** of the light themes hold a mix (`--canvas-text-muted`, `--map-text-muted`,
  `--map-text-subject`, `--persona-sidebar-quiet`, `--p-hover`). An engine that does not know the
  function keeps their text and the declaration that reads them fails, so a sibling declaration cannot
  repair it; the properties that read them fall back to inherited text colour there. An `@supports`
  rule would, and was left out of this change.
- **`@container` (twice) and `:has()` (twice)** are still dropped by that engine: two narrow-column
  rules that hide labels, and two small layout adjustments of a menu and a notice.
- **Not seen on a real WebKit 15.** The Mac this is built on knows `color-mix()`, so what it shows is
  the modern declaration; the fallback is proved by the stylesheet's text and the engine's rule for
  dropped declarations, and the Navigator's look on the macOS 12 Mac is the validation.

## Falsifier

On the macOS 12 Mac, clicking the version number opens a panel with a background; the speech bubbles,
search panel and the light themes' surfaces are drawn, not transparent. On a current Mac the interface
is unchanged.
