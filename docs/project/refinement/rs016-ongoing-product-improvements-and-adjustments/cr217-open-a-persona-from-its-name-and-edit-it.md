[< RS016](index.md)

# CR217: Open a Persona From Its Name, and Edit It

**Status:** captured
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("eu poder clicar no nome da persona e o app abrir uma tela
que me permita ver e editar os dados da persona, em especial, nome, avatar e o prompt dela");
follows [CR216](cr216-embed-the-core-that-routes-personas-and-show-their-names.md), first slice
toward [CV-015](../../roadmap/cv-015-personas-beside-journeys/index.md)

## Friction

A persona now speaks under its own name (CR216), but the name is all the app gives. To see what a
persona is, or to change its name, its description or its prompt, the Navigator leaves the app for
the terminal, where `mirror identity set` writes only the prompt: the metadata fields have no
surface anywhere. The 18 names filled on 2026-11-08, and the 4 accents fixed after them, were
written straight into the database by hand.

## Desired

- **The name beside an answer is a way in.** Clicking it opens the persona's screen. The agent's
  π opens nothing: there is no persona to show.
- **The screen shows the persona whole:** name, image (CR218), description, prompt, routing
  keywords, briefing, default model and what it inherits from. A persona is one identity row in
  the Core; these are all its fields.
- **Name, description, prompt, routing keywords and briefing can be edited.** The default model
  and the inheritance stay read-only: changing them changes routing semantics this package does
  not touch.
- **Edits go through the Core** (Core CR205: `listPersonas`, `readPersona`, `updatePersona`),
  through the host bridge, as Journey administration already does. Nautilus never writes the
  identity table.
- **A saved name takes effect at once:** the kept names (`persona-names.json`, CR216) and the open
  transcript update without waiting for that persona's next turn.

## Dependencies

- Core CR205 released and pinned. Until then the screen can be built read-only against the data a
  delivery already hands over, but the capture assumes the calls.
- CR218 gives the same screen its image chooser.

## Not in Scope

- Creating or deleting a persona, personas in the sidebar, talking with a held persona: CV-015.
- Setting a Journey's `default_persona`: a Core follow-up.
