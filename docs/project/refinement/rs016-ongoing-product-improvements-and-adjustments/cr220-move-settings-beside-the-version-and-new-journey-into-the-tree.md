[< RS016](index.md)

# CR220: Move Settings Beside the Version, and New Journey Into the Tree

**Status:** built, awaiting the Navigator's validation
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("O único problema que vi é o botão “+” das journeys ao lado do
botao para o settings. Ficou estranho ter dois botões “+” um proximo do outro"; "Pensei se nao
faria sentido levar o settings pro topo (perto da versao) e o nova journey para dentro da aba
tree"; "aprovado, capture as CRs"); prepares the sidebar for
[CR221](cr221-list-the-personas-in-the-sidebar.md), toward
[CV-015](../../roadmap/cv-015-personas-beside-journeys/index.md)

## Friction

The sidebar ends in a footer with two buttons, ＋ New Journey and ⚙ Settings. Neither belongs
there:

- **Settings is about the whole app**, and the top of the sidebar already speaks for the app: its
  name, its version and the update notice. That notice opens a Settings tab, so the person reads
  the notice at the top and then travels to the bottom to reach the place it points to.
- **Creating a Journey is placing it in the tree**, and only the Tree view shows where it goes.
  The creation already half-lives there: the Tree button's context menu has "Create Journey…" and
  each Journey's menu creates a child.
- **CR221 puts a Personas section at the bottom of the sidebar**, with a ＋ of its own. Beside the
  footer's ＋, two creation buttons would sit one above the other, and nothing would say which
  creates what.

## Desired

Mockup: [cr221-mockup.html](cr221-mockup.html), frames A to D.

- **⚙ Settings beside the version**, in the brand block, next to the button that collapses the
  sidebar. Same label, same title, same act.
- **＋ New Journey in the Tree tools**, first in the row that holds Collapse and Expand and that
  shows only in the Tree view (CR200). Collapse all and Expand all shorten to "Collapse" and
  "Expand", their full names kept as titles, so the three fit the sidebar's narrowest width.
  The new Journey's default parent stays what the footer's ＋ chose
  (`defaultNewJourneyParentId`).
- **The footer goes.** The tree takes back its height.
- **The empty tree offers creation.** With no Journey at all, the empty state offers "Create a
  Journey" in every view, instead of today's "Reload the Journey tree after adding a Journey in
  Mirror".
- **The compact sidebar (72 px).** The ⚙ stacks under the expand button, as the brand block already
  stacks in that mode. The Tree tools stay hidden there, as today; New Journey is reached through
  the Tree button's context menu, which already offers it.

## Not in Scope

- The Personas section: [CR221](cr221-list-the-personas-in-the-sidebar.md).
- A New Journey button in Recent or Pinned. Creating a Journey is rare and is a tree act; the
  release note says where it went.

## Falsifiers

- Settings opens from the brand block, in the full and the compact sidebar, and from the update
  notice as before.
- ＋ New Journey shows only in the Tree view, opens the same creation form with the same default
  parent, and is disabled with the same reason when tree operations are refused.
- No footer is rendered.
- An empty Journey list offers creation in Recent, Pinned and Tree; a search or Pinned filter that
  finds nothing keeps its own message.
- The three Tree tools fit at the sidebar's minimum width without wrapping.

## Built (2026-11-08)

Built on the Navigator's word ("construa a CR220 e a CR221"), with CR221.

- **⚙ beside the version.** The brand block ends in `.brand-controls`: Settings, then the button
  that collapses the sidebar. Settings takes that button's look (`sidebar-toggle-button
  sidebar-settings-button`), so the light themes already cover it. In the compact sidebar the two
  stack, the expand button on top (`column-reverse`).
- **＋ New Journey, first of the Tree tools**, in the accent, with the footer's default parent and
  its refusal. Like the other tools it shows only in the Tree view with no search typed (CR200's
  rule for the row).
- **Collapse and Expand.** Measured 2026-11-08: the three tools with their words need 229 px; the
  narrowest sidebar (240 px) gives the row 211. The row is a size container, and under 232 px
  Collapse and Expand keep only their icons, their names in the title and the accessible name.
  From the default width up they read as in the mockup.
- **No footer.** Its rules and its two classes are gone, from the light themes' lists too.
- **The empty sidebar** (`journeyEmptyState`). With no Journey at all, every view says "No Journeys
  yet" and offers "Create a Journey". Pinned and search keep their own words. A departure found on
  the way: when Journeys exist and the tree leaves every one out as inactive, it says "No active
  Journeys" and points at the Tree tools, instead of the old "No Journeys available".

**Evidence.** Spec `src/tests/cr220SidebarActions.test.ts` (7 tests); `sidebarSettingsAccess` and
`journeyTreePresentation` updated where they read the footer and the moved words. The tools' widths
were measured with the app's stylesheet at 240, 296 and 360 px. Mutations: run with CR221's
(`.tmp/cr221-mutations.py`); every CR220 mutation caught.
