[< RS016](index.md)

# CR255: Show a Long Intent Name in the Composer Footer

**Status:** implemented 2026-11-12 (`7cf73d0c`); not validated; not released
**Driver:** Navigator, seen in production v0.4.0-alpha.13
**Requested:** "quando seleciono a intenção, o texto fica cortado no rodapé abaixo do composer",
2026-11-12.

## Friction

The model control in the Composer footer was capped at 260px with an ellipsis. With a matched
Model Intent it reads "<intent> with <model>" (CR103), so an intent name of forty characters
filled the cap and cut the rest of the name, the connector and the model. The title carried
only the binding, so not even the pointer could read the whole name.

## What Changed

The cap is gone. The control is a shrinkable flex container that takes the room its line has
(the footer already wraps); the intent's name is its own element and is the only part that
gives way, with an ellipsis, while "with <model>" stays whole. The title carries the whole
phrase, the intent's name in front of the exact binding. The control's items take the underline
themselves, since a flex container does not pass it on. Specs in
`cr255IntentLabelInTheFooter.test.tsx`; CR103's title assertion follows the new title. Checked in
a browser against the app stylesheet: at 720px the whole phrase shows; at 260px the name is cut
and the model is not.

## Falsifier

In dev, choosing an intent with a long name shows the whole name and the model in the footer
when the window is wide; narrowing the window cuts only the name, and hovering the control shows
the whole phrase.
