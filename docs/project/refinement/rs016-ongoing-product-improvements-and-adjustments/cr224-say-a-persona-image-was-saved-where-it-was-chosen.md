[< RS016](index.md)

# CR224: Say a Persona's Image Was Saved, Where It Was Chosen

**Status:** built, awaiting the Navigator's validation
**Driver:** assistant
**Requested:** Navigator, 2026-11-09 ("quando eu escolho uma imagem para a persona, o formulário
salva a imagem automáticamente e o botao save fica desabilitado... acabo achando que houve um erro";
"capture e construa a CR224 de acordo com sua recomendacao"); after
[CR218](cr218-give-a-persona-its-own-image.md)

## Friction

The persona screen saves in two ways and says so in neither place. An image is kept the moment it
is chosen (CR218), while name, description, prompt and keywords wait for Save. After choosing an
image the Save button stays off, because no field changed, and nothing near the gesture says the
image was kept. The screen covers the list behind it, so there is no other feedback. It reads as
an error.

## Desired

- **"Image saved." beside the image buttons**, right after a choice or a removal succeeds, in the
  place where an import's refusal already shows. It leaves when another field is edited or another
  image action starts.
- **The rule said before the gesture.** The note under the buttons reads "Kept on this device, not
  in Mirror. Saved as soon as you choose it, apart from the Save below."
- A file dialog closed without a choice says nothing.

## Not in Scope

- Making the image wait for Save. The image is Nautilus's, not Mirror's; holding it would need a
  provisional file kept until Save or Discard.

## Falsifiers

- Choosing an image shows "Image saved." under the image, at once; the Save button's state is
  unchanged.
- Removing an image shows the same line.
- Cancelling the file dialog shows nothing.
- Typing in a field removes the line.
- A refused image shows its refusal, not "Image saved.".

## Built (2026-11-09)

Captured and built on the same word, as recommended. No Core change.

- `PersonaForm` takes `imageSaved`; the screen sets it after a choice or a removal succeeds, clears
  it when another image action starts or a field is edited, and leaves it off when the file dialog
  closes without a choice. A refusal shows alone.
- "Image saved." is a `role="status"` line under the image control, in the theme's ink
  (`--text`), where the refusal already showed.
- The note reads "Kept on this device, not in Mirror. Saved as soon as you choose it, apart from
  the Save below."

**Evidence.** Spec `src/tests/cr224PersonaImageSaved.test.tsx` (3), red first; `cr218PersonaImage`
pins the new note. 7 mutations (`.tmp/cr224-mutations.py`): 6 caught at first, the survivor (the
prop not passed by the screen) answered with an assertion. `tsc` clean; vitest 340 files, 2,891
passed, 1 skipped. Code `667aa107`.
