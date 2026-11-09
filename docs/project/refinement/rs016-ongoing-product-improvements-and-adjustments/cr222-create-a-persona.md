[< RS016](index.md)

# CR222: Create a Persona

**Status:** done · validated by the Navigator 2026-11-09 ("CR222 e CR223 validadas. Funcionou perfeitamente.") · on Core CR207 (mirror-mind 0.44.0)
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

## Built (2026-11-09)

Built on the Navigator's word ("faça o merge do PR #77 e construa a CR222 e a CR223"), with CR223,
after Core CR207 shipped as `mirror-mind@0.44.0` (Core PRs #75 and #76; npm `stable` and `latest`).

- **The pin** moves to 0.44.0, the tarball npm serves, checked by both hashes; the host gains
  `createPersona`, `previewPersonaDeletion` and `deletePersona` (DS-005's record has the entry).
- **The section's ＋**, beside its heading and only while it is open, opens "New persona"
  (`NewPersonaScreen` in `PersonaScreen.tsx`). The fields are the edit's, plus the **id**: proposed
  from the name as a slug (accents dropped, every other run of characters a hyphen, at most 80),
  following the name until the person types it, then kept. The note under it says it cannot change
  once the persona exists, and the screen says an image comes after creation.
- **What is checked here:** a name, an id in the identity layer's grammar and a prompt, plus the
  edit's bounds. The Core checks again and names its refusal; `persona_exists` and
  `invalid_persona_id` read as sentences (`persona_admin.rs`).
- **Created**, it is listed at once in its place, its name is kept for the bubbles (CR216), and
  the screen becomes its edit screen, where an image can be chosen.
- **Native:** `create_persona` checks the request's shape (an id, a name and a prompt as text, a
  description and keywords as text when given, nothing else) and sends it to the Core.

**Departures.**
- **The router question was the Core's.** Core CR207 found that CR203's router reads a persona's
  description first, so a created persona is routable from the next turn with no descriptor
  generated; the falsifier "a turn whose subject fits the description can be routed to it" is the
  Navigator's to try in the field.
- **Name required.** The Core's `createPersona` takes a name; a persona without one can still be
  made in the terminal.

**Evidence.**
- Spec `src/tests/cr222cr223PersonaLifecycle.test.tsx` (24 tests with CR223's), red on the missing
  modules; `cr221PersonaSidebar` now expects the ＋ when open.
- Rust: the creation's shape, the new refusals, and the real Core 0.44.0 through
  `real_host_reads_and_edits_a_persona_in_the_shapes_the_app_reads`: a persona created, a taken id
  refused in the Navigator's words. The host's end-to-end test (`cv010MirrorHost`) does the same.
- Mutations with CR223's: 34 on the surface (`.tmp/cr222-mutations.py`), all caught after one
  survivor led to a case; 13 native (`.tmp/cr222-rust-mutations.py`), all caught.
- Rendered with the app's stylesheet in the dark and Daylight themes.

## Validation

Validated by the Navigator in `npm run tauri:dev` on 2026-11-09 ("CR222 e CR223 validadas.
Funcionou perfeitamente."). Code `7a5eb88e`; record `b298d3b7`. Published in v0.4.0-alpha.11 (2026-11-09).
