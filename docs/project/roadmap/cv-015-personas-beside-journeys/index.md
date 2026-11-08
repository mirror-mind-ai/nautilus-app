[< Roadmap](../index.md)

# CV-015 - Personas Beside Journeys

**Status:** 🟡 Candidate. Captured from the Navigator on 2026-11-07 ("vamos remover essa DS-3 do
CV-8 e criar um novo CV específico para falar com personas e gerenciá-las"); back to design, not
planned.

## Outcome

A persona is a first-class place in Nautilus, beside the Journeys: it lives in the sidebar as they
do, it can be created, opened, pinned, searched and given its own image, and clicking it opens the
same experience a Journey has today, a continuous conversation with that persona, specific
conversations inside it, and its own Field and Canvas.

## Why (Navigator, 2026-11-07)

Some conversations begin with the relationship itself, not with a project: talking with the
Strategist, the Writer, the Treasurer. Today a persona is only a lens the Mirror picks per turn
inside a Journey, and the person cannot choose it, keep it, or find it again.

## The Desires (Navigator, 2026-11-07)

**Personas in the sidebar, the way Journeys are.**

- **Recent** lists the personas talked to recently.
- **Pinned** holds the personas the person pins.
- **Tree** shows the personas in or as a tree, in a form still to be designed.
- **Search** filters personas as it filters Journeys.
- **"+"** also creates a persona, through a new tab in the creation form.
- **A context menu** on a persona shows its data.
- **Each persona has its own icon or custom image.**

**Talking with a persona, the way one talks in a Journey.**

- Clicking a persona gives the experience a Journey gives today: one continuous conversation with
  that persona.
- Specific conversations can be created inside that persona's context.
- The persona has a **Field** and a **Canvas**, as a Journey has.

## What We Know Today (review of 2026-11-07)

These are facts read in the code and the production home, not decisions.

- **The Core owns personas.** They are rows of the `identity` table (`layer = 'persona'`), 28 in
  production, several of them personal (health, family, finances). The Core has no icon, image,
  pin or eligibility for a persona; those would be Nautilus's, as a Journey's appearance already is.
- **The Core switches persona on its own.** Each turn the doorman scores the prompt by keywords and
  moves to a persona that scores higher (`decideDoorman`, `ts/src/mirror/doorman.ts`). A persona
  cannot be held for a conversation today. The Mirror load already accepts an explicit persona;
  the host call `deliverMirrorContext` does not pass one. **Talking with a persona needs a Core
  change**, whatever the design.
- **A conversation's Journey is optional in the Core** (`conversations.journey` may be empty), so a
  conversation that belongs to a persona and to no Journey is representable. What that does to
  memory extraction, which is tagged by Journey, is not yet known.
- **Creating or editing a persona writes the Core's identity**, with its routing keywords and
  descriptor. The host has no call for it today.
- **The first design is set aside.** CV-008.DS-003 proposed one hidden Journey per persona. Its text
  is kept as [superseded-cv-008-ds-003.md](superseded-cv-008-ds-003.md). Its premises no longer hold:
  conversations are now the unit (CV-008.DS-004), Journeys are visible and deletable from the tree
  (RS028), and Mirror history is out of the app (CR206).

## Decided: The List Comes First, in Its Final Place (Navigator, 2026-11-08)

The Navigator asked for the person to manage their personas now (list, create, edit, delete),
before the persona conversation is designed. A list placed elsewhere would later move to the
sidebar; a list in the sidebar must live there before a click can open a conversation.

**The place is final, what a click does grows.** The Personas section is born in the sidebar, under
the Journeys and closed by default, and a click opens the persona screen CR217 built. When DS-003
arrives, the same click opens the persona's conversation too. Nothing changes place. The footer's
two buttons leave to make room, so no two ＋ sit together. Mockup approved 2026-11-08 ("aprovado,
capture as CRs"): [cr221-mockup.html](../../refinement/rs016-ongoing-product-improvements-and-adjustments/cr221-mockup.html).

| CR | What | Core |
|----|------|------|
| [CR220](../../refinement/rs016-ongoing-product-improvements-and-adjustments/cr220-move-settings-beside-the-version-and-new-journey-into-the-tree.md) | ⚙ beside the version, ＋ New Journey in the Tree tools, no footer | none |
| [CR221](../../refinement/rs016-ongoing-product-improvements-and-adjustments/cr221-list-the-personas-in-the-sidebar.md) | The Personas section, opening the persona screen | none (`listPersonas` exists) |
| [CR222](../../refinement/rs016-ongoing-product-improvements-and-adjustments/cr222-create-a-persona.md) | The section's ＋ creates a persona | `createPersona` |
| [CR223](../../refinement/rs016-ongoing-product-improvements-and-adjustments/cr223-delete-a-persona-after-showing-what-goes.md) | Delete, after a list of what goes and what stays | a preview and a deletion |

This answers part of "Creating, editing and deleting a persona" and of "Recent and Pinned with two
kinds of item" below: two sections, not one mixed list. The rest stays open.

## Open Before Planning

- **What a persona conversation is about.** With no Journey, with a Journey chosen per conversation,
  or both. This decides memory, the working folder and what "Working in" says.
- **Whether the persona is held.** Fixed for the whole conversation, or only the first, with the
  Mirror free to route after it.
- **The tree.** Personas as their own branch, grouped (work, life, writing), or nested in some
  other way; the Core has no persona hierarchy.
- **Which personas appear.** All 28, or those the person chooses; hiding a persona from the
  sidebar without deleting it from the Mirror.
- **The Field and the Canvas of a persona.** What they show when there is no project folder: the
  persona's definition, its recent conversations, what the Mirror has learned with it.
- **Creating, editing and deleting a persona.** What the form asks (name, description, routing
  keywords, prompt), and what the Core must offer as calls; deletion follows RS028's rule of
  showing what will go.
- **Recent and Pinned with two kinds of item.** One list mixing Journeys and personas, or two
  sections.
- **The relation with CV-012**, which names persona management and persona conversations as part
  of the canonical app.

## Candidate Delivery Stories

The first story is design only (Navigator, 2026-11-07: "quero voltar à prancheta e ao design").
The rest are placeholders until it closes, and will be rewritten by it.

| Code | Delivery Story | Outcome | Status |
|------|----------------|---------|--------|
| CV-015.DS-001 | The Design on Paper | The open questions above are answered with the Navigator, with sketches of the sidebar, the persona's conversation surface and the creation form, and the Core changes are listed | 🟡 Candidate |
| CV-015.DS-002 | Personas in the Sidebar | Personas appear in Recent, Pinned, Tree and search, with their image and a context menu showing their data | 🟡 Candidate |
| CV-015.DS-003 | Talking With a Persona | Clicking a persona opens its continuous conversation, held to that persona, with specific conversations inside it | 🟡 Candidate |
| CV-015.DS-004 | A Persona's Field and Canvas | The Field and the Canvas exist for a persona, with what DS-001 decides they show | 🟡 Candidate |
| CV-015.DS-005 | Creating and Editing Personas | "+" creates a persona and its menu edits it, through new Core calls | 🟡 Candidate |

## Boundary

This CV does not move persona definitions out of the Mirror Core, does not create hidden Journeys,
and does not bring back Mirror history (CR206). Every Core change goes through the Core's own gates
and release train.
