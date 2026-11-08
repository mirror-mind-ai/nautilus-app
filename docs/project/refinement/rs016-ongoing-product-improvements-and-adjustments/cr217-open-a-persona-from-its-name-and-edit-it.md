[< RS016](index.md)

# CR217: Open a Persona From Its Name, and Edit It

**Status:** built, awaiting the Navigator's validation
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

## Delivered on `main` (`b85709a9`)

Built 2026-11-08 on the Navigator's word ("construa a CR217").

- **The pin** names `release: v0.42.0`, commit `702bf2e7`, and the tarball npm serves, by its
  sha256 and the registry's sha512 (DS-005). The runtime is rematerialized. No migration.
- **The host** serves `listPersonas`, `readPersona` and `updatePersona`, and names a
  `PersonaCallRejectedError` by its reason.
- **The native side** (`src-tauri/src/persona_admin.rs`) adds `read_persona` and `update_persona`.
  They check only the request's shape (a persona id, the reading it was opened at, at least one of
  the four writable fields and no other), leave every value to the Core, and put each refusal in a
  sentence that names the field. A saved name is kept in `persona-names.json` (CR216); a removed one
  is forgotten there.
- **The way in.** A persona's name beside an answer is a button, "Open the persona <name>"; the
  agent's π stays a label. The app provides the opener through a React context, so every bubble,
  live or read again, opens the same screen.
- **The screen** (`src/app/PersonaScreen.tsx`, the Journey dialog's look, wider) edits the name,
  the description, the prompt and the routing keywords (one text, split by commas or lines), and
  shows the id, the default model and the inheritance read-only. It sends only the fields that
  changed, with the `updatedAt` it read; Save stays off until something changed and nothing is
  wrong. A refusal is shown as the Core gave it. A saved name changes every bubble of that persona
  at once.

Where the build departs from the capture, and why:

- **No briefing.** The Core does not offer it (Core CR205): nothing reads a metadata `briefing`,
  and the seed puts a YAML briefing into the prompt. The screen shows what takes effect.
- **No image.** CR218 adds it to this screen.
- **The screen says where an edited prompt takes effect.** A Conversation where the persona already
  spoke keeps the prompt it was given until it is compacted: the Core delivers a persona's prompt
  once per session. Core CR206 (captured, PR #69) delivers it again when it changed; this line goes
  when Nautilus embeds it.

## Validation

- Spec first: `src/tests/cr217PersonaScreen.test.tsx` (13), red on the missing modules; the host
  contract (`cv010MirrorHost.test.mjs`), red on the method list and on a real-core round trip; four
  Rust tests in `persona_admin.rs`, red on `todo!()`, and one real-host test.
- 32 mutations, each caught: 20 in the front (the domain rules, the way in, the Save gate, the read-
  only fields) and 12 in `persona_admin.rs`. Not covered by a unit test: the two lines of
  `update_persona` that keep the saved name, a composition of `remember_persona_name_in` (CR216's
  tests) behind an `AppHandle`.
- `tsc` clean; vitest 331 files, 2,829 passed, 1 skipped; cargo 513 passed. The real-host tests
  pass against the 0.42.0 runtime, the persona one included (8 of 11 with the real `HOME`; the
  other three are the voice and fixture spikes).
- Changed specs: the host contract's method list. A comment in `host.mjs` was reworded because
  `cv010HostPin`'s tamper check looks for the word "edited".
- A probe through the materialized runtime, on a copy of the production home: 28 personas, all
  named; a name saved with the prompt, the keywords and `briefing` kept; a stale edit refused.
  Production untouched.

## Acceptance

In `npm run tauri:dev`, on a rehearsal home:

1. Clicking a persona's name beside an answer opens its screen with its name, description, prompt,
   keywords, default model and inheritance. The π opens nothing.
2. Renaming the persona and saving changes its name in every bubble at once, and after a relaunch.
3. Emptying the prompt keeps Save off and says why.
4. An edit from a screen opened before another change to the same persona is refused, saying to
   reopen it.
5. A changed prompt is followed in a new Conversation.

