[< RS016](index.md)

# CR223: Delete a Persona, After Showing What Goes

**Status:** done · validated by the Navigator 2026-11-09 ("CR222 e CR223 validadas. Funcionou perfeitamente.") · on Core CR207 (mirror-mind 0.44.0)
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

## Built (2026-11-09)

Built with CR222, on the same word and the same pin.

- **Two doors, one act.** "Delete persona…" at the start of the persona screen's actions closes
  the screen and opens the confirmation; the row's new ⋯ (CR221 left it out while Open was its only
  item) offers Open and "Delete persona…". The menu opens under its row, inside the list, because
  the list scrolls and a floating menu was clipped by it. A press anywhere else closes it.
- **The confirmation** (`PersonaDeletionDialog.tsx`) is titled with the persona's name under
  "Delete persona", in CR205's ink, and lists from the Core's preview:
  - will be deleted: its definition, its generated descriptor, its identity integrations and
    extension bindings when there are any, and its image on this device;
  - will be cleared: the default persona of each Journey that names it, by the Journey's name,
    and Mirror's remembered default persona;
  - will be kept, as history, with the persona's id: its Conversations, memories and runtime
    sessions; and a line saying a bubble it signed keeps its name and colour.
- **An heir refuses**, naming the personas that inherit from it, and the button stays off.
- **Confirmed**, Mirror deletes behind its named backup (`backups/pre-persona-deletion-…`), then
  Nautilus removes the image. The persona leaves the list, its image and its screen at once. Its
  kept name stays in `persona-names.json`, so earlier bubbles still read. An image that could not
  be removed is said in the section, not as a failure: Mirror already deleted the persona.
- **Stale.** A persona changed between preview and confirmation is refused with "What this persona
  holds changed since the list was shown. Review the new list and confirm again.", and the list is
  read again.
- **Native:** `preview_persona_deletion` adds whether an image is kept; `delete_persona` sends the
  digest (64 hex digits or refused here) and answers the backup's path and any problem. The census
  goes from 116 to 119 commands, all serialised and off the main thread.

**Departure.** Cancel from the screen's door does not reopen the screen; the person opens it again
from the list.

**Evidence.** In CR222's: the spec, the mutations and the rendering. Through the real Core 0.44.0
(`real_host_reads_and_edits_a_persona_in_the_shapes_the_app_reads`): the preview read in the shape
the confirmation reads, a stale digest refused with the sentence above, the deletion's backup on
disk, and the persona gone from the list.

**Not run.** The Core's preview counts were checked against the schema by Core CR207's own tests;
on a real home, they are the Navigator's to see in the field.

## Validation

Validated by the Navigator in `npm run tauri:dev` on 2026-11-09 ("CR222 e CR223 validadas.
Funcionou perfeitamente."). Code `7a5eb88e`; record `b298d3b7`. Published in v0.4.0-alpha.11 (2026-11-09).
