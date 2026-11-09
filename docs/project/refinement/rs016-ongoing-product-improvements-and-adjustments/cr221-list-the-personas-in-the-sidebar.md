[< RS016](index.md)

# CR221: List the Personas in the Sidebar

**Status:** built, awaiting the Navigator's validation
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("terminar o que falta para que o usuário tenha autonomia de
gerenciamento das personas do seu mirror. Hoje ele só pode editar personas que aparecem no chat.
Mas ele precisaria ver a lista de personas em algum lugar e ter opções para incluir nova, excluir e
editar"; "aprovado, capture as CRs"); first slice of
[CV-015](../../roadmap/cv-015-personas-beside-journeys/index.md), after
[CR220](cr220-move-settings-beside-the-version-and-new-journey-into-the-tree.md)

## Friction

A persona can be opened and edited only from its name on a turn it answered (CR217). A persona
that has not spoken in a visible Conversation cannot be reached at all, and nothing in the app
shows which personas the Mirror holds.

## The Design Decision

CV-015 wants personas in the sidebar beside the Journeys, each opening a conversation of its own.
That conversation is not built now. The list is. The dilemma (Navigator, 2026-11-08): a list placed
elsewhere would later have to move to the sidebar, a discontinuity for the person; a list in the
sidebar must live there before it can hold a conversation.

**The place is final, what a click does grows.** Discontinuity is moving something the person has
learned to find; deepening what happens in the same place reads as the product growing. So the list
is born in the sidebar now, and a click opens the persona screen CR217 built. When CV-015.DS-003
arrives, the same click opens the persona's conversation as well, and the screen becomes a part of
it. Nothing changes place.

## Desired

Mockup: [cr221-mockup.html](cr221-mockup.html), frames A to D.

- **A Personas section under the Journeys**, at the bottom of the sidebar where the footer was
  (CR220). Closed by default: one line, "▸ Personas" and the count. The Journeys keep the sidebar
  for anyone who does not open it. Open or closed is remembered, as the sidebar's other
  preferences are.
- **Open, it takes about half the sidebar**, with its own scroll and a "Filter personas" field.
  Each row shows the persona's image (CR218) or its ◇ on its colour (CR213), its name, and the start
  of its description on a second line, which tells close personas apart (two writers, a
  journalist). Alphabetical by name, no grouping.
- **A click opens the persona screen** (CR217), unchanged. The row stays marked while the screen
  is open.
- **The row's ⋯** offers Open, and Delete once
  [CR223](cr223-delete-a-persona-after-showing-what-goes.md) exists.
- **The section's ＋ shows only when it is open**, at its top, far from any other ＋; it belongs
  to [CR222](cr222-create-a-persona.md) and is absent until then.
- **Compact sidebar (72 px)**: one ◇ with the count at the foot. A click expands the sidebar with
  the section open.
- **Read from the Core.** The list comes from the Core's `listPersonas` (id, name, description),
  through a host call, read when the app starts and again after a persona is saved, created or
  deleted. No persona data is kept by Nautilus beyond its image.

## Dependencies

- CR220, so the section has the footer's place and no second ＋ beside it.
- No Core change: `listPersonas` exists since Core 0.42.0.

## Not in Scope

- Talking with a persona, its Recent, Pinned and Tree views, its Field and Canvas: CV-015.
- Hiding a persona from the list without deleting it.
- Grouping personas by domain: the Core has no such field.

## Falsifiers

- With the section closed, the sidebar shows the Journeys as today plus one line.
- Opening it lists every persona the Core returns, alphabetically, with image or colour, name and
  description; a persona with no name shows its id.
- The filter matches name, id and description, ignoring case and accents.
- A click opens the persona screen; saving a new name there renames the row.
- A Core that cannot be read leaves the section with a legible message, and the Journeys work.
- The compact sidebar's ◇ opens the full sidebar on the section.
- Light themes keep the rule of 4.5:1 for every text in the section.

## Built (2026-11-08)

Built on the Navigator's word ("construa a CR220 e a CR221"), after CR220.

- **Read from the Core.** A native command, `list_personas` (`persona_admin.rs`), calls the host's
  `listPersonas` (Core 0.42.0) and keeps, of each entry, only a persona id, a name and a
  description, at most 512; an answer that is not a list is a failure. Serialised and off the main
  thread; the census goes from 115 to 116. The surface sorts by the name a person reads, accents and
  case aside, ties by id (`domain/personaList.ts`).
- **When it is read.** At launch, and again from "Try again" after a failure. A save on the persona
  screen renames the row at once, without a new reading.
- **The section** (`PersonaSidebarSection.tsx`), under the Journeys where the footer was: "▸
  Personas" and the count, closed by default and remembered (`personasSectionOpen`, CR133's rule: a
  bad value closes it and costs nothing else). Open, it takes up to 52% of the sidebar, with its own
  scroll and a filter over name, id and description. Each row: the image or the ◇ on the persona's
  colour, the name, the description on one line. The row of the persona whose screen is open is
  marked.
- **Compact sidebar.** One ◇ with the count; a click expands the sidebar with the section open.
- **Light themes.** The description's ink is `--light-text` mixed 25% into `--light-muted`, because
  `--light-muted` alone falls under 4.5:1 on Daylight's sidebar. Measured in the spec from the
  stylesheet's own tokens, on the sidebar, a hovered row and the surface of each light theme: the
  lowest is 5.8:1.

**Departure.** The row's ⋯ is not built. With Delete waiting on CR223, its only item would be Open,
which the click already does. It comes with CR223.

**Evidence.**
- Spec `src/tests/cr221PersonaSidebar.test.tsx` (12 tests) and a Rust case for the list's shape;
  `journeyPreferencePersistence` gains the new field.
- The real Core (0.43.0, the pinned runtime) through `real_host_reads_and_edits_a_persona_in_the_shapes_the_app_reads`:
  the list holds the template's personas and no prompt.
- Mutations: 31 on the surface (`.tmp/cr221-mutations.py`), 30 caught; the survivor, a filter
  guard for an empty query, is equivalent (`includes("")` is always true). Two survivors of the
  first run (a case-only tie, a description found only in the tooltip) led to stronger cases. 8 on
  the native side (`.tmp/cr221-rust-mutations.py`), all caught; the host method's name is caught by
  the real-host test, which now reads the command's own constant.
- Rendered with the app's stylesheet in the dark and Daylight themes, closed, open and compact.
