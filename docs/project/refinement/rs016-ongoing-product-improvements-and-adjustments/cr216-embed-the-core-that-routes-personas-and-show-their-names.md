[< RS016](index.md)

# CR216: Embed the Core That Routes Personas, and Show Their Names

**Status:** done
**Driver:** assistant
**Delivery:** `main` (`885ab085`)
**Requested:** Navigator, 2026-11-08 ("construa a CR216"), after asking what it takes for Nautilus to
use the new Core; follows [CR213](cr213-let-the-persona-speak-beside-its-words.md) and
[CR189](../rs022-mirror-core-debts/cr189-route-the-persona-by-what-the-turn-is-about.md)

## Friction

The Core released Core CR203 (a turn's persona routed by its subject, or none) and Core CR204 (the
persona's own name beside its id) together as `mirror-mind@0.41.0`. The terminal had it; Nautilus
did not, because it embeds the Core it pins, and the pin named `0.40.0-next.1`. Installing the
Core on the machine does not reach the app.

And the bubble named a persona by its id made readable (CR213): `analista-sql` read "Analista Sql",
though the person named it "Analista SQL".

## Delivered on `main` (`885ab085`)

- **The pin** names `release: v0.41.0`, commit `1c95a812`, and the tarball npm serves, by its
  sha256 and the registry's sha512. The runtime is rematerialized. No migration. The host's contract
  test now expects `personaName` in every `deliverMirrorContext` answer.
- **The name, live.** `mirror_context.rs` reads `personaName` when the answer names a persona id: a
  string, trimmed, 1 to 80 characters, no control character. The `mirror_context` event carries it as
  `personaName`, and the stream hands it to the surface with the persona.
- **The name, read again.** A Pi transcript keeps only the id (the first line's `sign ◇ <id>`), so
  a Conversation reopened had no name to show. Each delivery keeps the name for the home, by id, in
  `persona-names.json` in the home's state folder: owner-only, replaced whole, never through a link;
  a persona the Core hands without a name loses the one kept. `load_persona_names` gives the surface
  that list at launch; a live turn adds its own.
- **The bubble** shows the kept name, and "before:" says it too. A persona without one keeps the
  readable id. None stays π, as CR213 reads it: Core 0.41.0's first line for none has no signing
  clause.

Measured before the build, through the materialized runtime on a copy of the production home: a SQL
question gave `analista-sql` with `Analista SQL`; a greeting gave `null` with `null`, and a first
line with no `sign ◇`.

## Validation

- Spec first, `src/tests/cr216PersonaNameFromTheCore.test.tsx` (8), and three Rust tests in
  `mirror_context.rs` (`cr216_*`). The front's four failed before the change, for its reason.
- 19 mutations, each caught; the one that first survived (the 80-character bound, in the front)
  gained its case.
- `tsc` clean; vitest 330 files, 2,815 passed, 1 skipped; cargo 509 passed. The real-host tests
  pass against the 0.41.0 runtime (7 of 10; the other three are voice and fixture spikes that need
  their own variables).
- Changed specs: CR188's source pins on the event line and on `runSpeaker`, for the added argument;
  the host contract, for `personaName`.

## Acceptance

In `npm run tauri:dev`, on a rehearsal home:

1. A question in one persona's domain is answered under that persona's own name.
2. A turn no persona fits is answered as π, unsigned.
3. Reopening the Conversation keeps the names.

## Not in Scope

- Setting a Journey's `default_persona` (a Core follow-up).
- The wording of the Core's no-persona clause.
- Persona colour collisions.
