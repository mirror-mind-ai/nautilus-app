[< RS016](index.md)

# CR221: List the Personas in the Sidebar

**Status:** captured
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
