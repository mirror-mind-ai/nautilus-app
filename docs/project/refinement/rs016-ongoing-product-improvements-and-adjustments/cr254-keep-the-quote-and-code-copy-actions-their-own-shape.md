[< RS016](index.md)

# CR254: Keep the Quote and Code Copy Actions Their Own Shape

**Status:** implemented 2026-11-12 (`def84d38`); validated in dev on macOS by the Navigator 2026-11-12; not released
**Driver:** Navigator, seen in production v0.4.0-alpha.12
**Requested:** "o botão copy não foi renderizado e no lugar dele aparece 'Copy Text'", 2026-11-12,
in a Conversation of the Journey Livro Liderança Soberana.

## Friction

A quoted draft in an answer carries a "Copy text" pill at its corner. In alpha.12 it showed as a
small empty circle with the words "Copy text" spilling across it. CR213's rule for the bubble's
own copy action (`.speech-bubble .message-copy-action`: 26px, top right, hidden until hover)
matched every copy action inside the bubble, and it is more specific than the quote's own rule,
so the pill was squeezed to the bubble's circle. A code block's copy action met the same rule:
hidden until the bubble was hovered and moved to the bubble's corner.

## What Changed

The three CR213 rules now use the child combinator (`.speech-bubble > .message-copy-action`),
which only the bubble's own action matches, since `Speech` renders it as the bubble's first
child. The quote's pill and the code block's action keep their own styling. Specs in
`cr254CopyActionsInsideTheBubble.test.tsx`: every bubble copy selector in the stylesheet is
scoped to the direct child, and the rendered bubble has its own action as a direct child and the
quote's and code's deeper. CR213's spec follows the new selector.

## Falsifier

In dev, an answer with a quoted draft shows the "Copy text" pill with its icon and label inside
it, always visible; a code block shows its copy action at its own corner; the bubble's own copy
still appears only on hover, at the bubble's corner.
