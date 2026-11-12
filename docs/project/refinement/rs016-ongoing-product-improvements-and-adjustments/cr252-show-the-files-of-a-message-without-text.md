[< RS016](index.md)

# CR252: Show the Files of a Message Without Text

**Status:** implemented 2026-11-12 (`4f24964d`); awaits a dev check on macOS; not released
**Driver:** Navigator, at the dev check of CR250
**Requested:** "Quando eu mando um arquivo sem escrever nada no campo de texto, nao aparece nada na
bolha do dialogo enviado por mim", 2026-11-12, expecting the files shown as with a message that
has text.

## Friction

CR250 let a message carry files and no text. The turn ran and Pi read the file, but the
conversation showed only the agent's answer: the Navigator's bubble was drawn only when it had
text, and the files are drawn inside it. A reload lost them too, because the surface rebuilt from
Pi's session skips user entries without visible text, and the files are bound to that entry.

## What Changed

`ConversationTranscript` draws the Navigator's bubble when it has text or files; without text it
shows the time, the files and their provenance, and no copy action. `projectPiBackedConversationSurface`
keeps an empty Pi request when its bound message carries files; an empty request with no files is
still skipped. Three specs in `cr252AttachmentOnlyBubble.test.tsx`, the two that cover the defect
seen failing first.

## Falsifier

In dev, send a file with the field empty: the bubble shows the file as a message with text would.
Reload the conversation: the bubble and the file are still there.
