[< RS016](index.md)

# CR222: Create a Persona

**Status:** captured · waits on a Core call
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("ter opções para incluir nova, excluir e editar"; "aprovado,
capture as CRs"); after [CR221](cr221-list-the-personas-in-the-sidebar.md), toward
[CV-015](../../roadmap/cv-015-personas-beside-journeys/index.md)

## Friction

A new persona can be made only in the terminal or by seeding identity files. Nautilus edits the
personas that exist (CR217) and cannot add one.

## Desired

- **The Personas section's ＋** (CR221, shown only when the section is open) opens the persona
  screen empty, titled "New persona".
- **The same fields as the edit**: name, description, prompt, routing keywords, and the image
  chooser once the persona exists. Plus an **id**, proposed from the name as a slug and editable
  until the first save; afterwards it is shown, not edited, as a Journey's id is.
- **The Core decides.** An id already taken, an empty prompt or a malformed id is refused by the
  Core with a reason the screen shows as written.
- **Created, it is listed at once** and the screen becomes the persona's edit screen, so an image
  can be chosen without reopening it.
- **The router sees it from the next turn.** A new persona is eligible for routing as soon as it
  exists; the description note under the field already says the Mirror chooses by it.

## Dependencies

- **A Core call to create a persona**, `createPersona`, on the shape of `updatePersona` (Core
  0.42.0): it writes one `identity` row with `layer = 'persona'`, its metadata (name, description,
  routing keywords) and its descriptor, refuses a taken id, and is exposed in `lib/desktop.js`.
  It needs its own Core CR, release and a new pin here.

## Not in Scope

- Duplicating an existing persona as a template.
- `default_model` and `inherits_from` in the form; the Core's defaults apply.

## Falsifiers

- ＋ opens an empty screen titled "New persona"; Cancel creates nothing.
- Saving creates the persona in the Core, lists it in the section, and turns the screen into its
  edit screen.
- An id already in use is refused with the Core's reason, and nothing is written.
- A turn whose subject fits the new persona's description can be routed to it.
