[< RS016](index.md)

# CR223: Delete a Persona, After Showing What Goes

**Status:** captured · waits on a Core call
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("ter opções para incluir nova, excluir e editar"; "aprovado,
capture as CRs"); after [CR221](cr221-list-the-personas-in-the-sidebar.md), on RS028's rule for
deleting a Journey ([CR204](../rs028-journey-management/cr204-delete-a-journey-with-everything-under-it.md),
[CR205](../rs028-journey-management/cr205-make-the-deletion-list-legible-and-name-the-journey-in-the-title.md))

## Friction

A persona can be created in the terminal and edited here, but never removed: an unused or
duplicated persona (two strategists, one per language) stays in the router's choice forever.

## Desired

- **Two doors, one act.** "Delete persona…" at the foot of the persona screen (CR217), and Delete
  in the row's ⋯ (CR221). Both open the same confirmation.
- **The confirmation lists what goes and what stays**, as a Journey's deletion does, in full ink
  (CR205's rule for warnings), the persona's name as the title under "Delete persona":
  - goes: the persona's definition, its descriptor, its image on this device (CR218), its
    bindings to extensions;
  - stays, as history: the Conversations and memories recorded with it, which keep its id;
  - named, if any: personas that inherit from it, and Journeys whose default persona it is,
    with what happens to each as the Core decides.
- **Confirmed, it is gone at once** from the list, from routing and from the screen. A bubble it
  signed earlier keeps its name and colour from the record.

## Dependencies

- **Two Core calls**, `previewPersonaDeletion` and `deletePersona`, on the shape of the Journey
  deletion calls (Core CR200): the preview counts what references the persona (Conversations,
  memories, runtime sessions, extension bindings, `inherits_from`, Journeys' `default_persona`)
  and says what each will become; the deletion removes the definition and its descriptor in one
  transaction and refuses a persona that changed since the preview. What happens to an heir and
  to a Journey's default is the Core CR's decision. It needs its own Core CR, release and a new
  pin here.
- Nautilus removes the image after the Core confirms.

## Not in Scope

- Undo. The Core's backup is the way back, as for a Journey.
- Deleting the Conversations or memories recorded with the persona.

## Falsifiers

- Both doors open the same confirmation, titled with the persona's name.
- The list's counts match the Core's preview; Cancel changes nothing.
- Confirmed, the persona leaves the list and the router, and its image file is gone.
- Conversations and memories recorded with it are still there and still readable.
- A persona edited between preview and confirmation is refused, with the reason shown.
