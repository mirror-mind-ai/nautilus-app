[< RS016](index.md)

# CR219: Embed the Core That Delivers an Edited Persona Again

**Status:** built, awaiting the Navigator's validation
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("capture e construa a CR que embute o Core 0.43.0");
follows [CR217](cr217-open-a-persona-from-its-name-and-edit-it.md), whose screen edits a prompt

## Friction

The persona screen (CR217) saves a changed prompt to Mirror, but the Core Nautilus embeds,
`mirror-mind@0.42.0`, delivers a persona's prompt once per conversation and remembers only its
id. In a conversation where the persona already spoke, the edit has no effect until the
conversation is compacted, and the screen has to say so under the prompt.

## Desired

- **The pin moves to `mirror-mind@0.43.0`**, which carries Core CR206: the next turn routed to a
  persona whose prompt changed since its delivery puts the new text into the conversation, under
  a header saying it replaces the earlier one. A change to the name or description alone delivers
  nothing.
- **The screen's note says what is now true:** a changed prompt reaches every Conversation the
  next time this persona speaks there. The caveat about compaction goes.
- Nothing else in Nautilus changes: the delivery is the Core's.

## Field falsifier

Core CR206's four cases, through the embedded Core:

1. A persona delivered, its prompt edited, the next turn routed to it: the revised section is
   delivered once, and the model follows it (a visible instruction, such as a fixed signature).
2. Only the name or description edited: the next turn delivers nothing new.
3. An edit, then a compaction, then a turn: the full load delivers the current text.
4. A session written by the 0.42.0 Core: no persona is delivered again until one is edited.

The delivery half of each case runs through `mirror-host/host.mjs` on a throwaway home with a
real key; the model half (case 1's instruction followed) is the Navigator's acceptance in
`npm run tauri:dev`.

## Delivered on `main` (`7f1a3de0`)

Built 2026-11-08 on the Navigator's word, the same turn as the capture.

- **The pin** names `mirror-mind@0.43.0`, release `v0.43.0`, commit `7cad67c2`, and carries the
  tarball npm serves (sha256 `10ad2c65…`, the registry's sha512 `cEFHovZO…`, both checked on
  download). The 0.42.0 tarball is removed; DS-005 records the pin. The host is unchanged: the
  redelivery happens inside `deliverMirrorContext`.
- **The prompt's note** reads "A changed prompt reaches each Conversation the next time this
  persona speaks there, open ones included."

## Validation

- Spec first: `src/tests/cr219EditedPersonaDelivered.test.tsx` (2), red on the 0.42.0 pin and on
  the old note.
- Changed spec: `cr217PersonaScreen.test.tsx` pinned the old note; it now looks for the new one.
- `tsc` clean; vitest 334 files, 2,843 passed, 1 skipped; cargo 517 passed; the real-host tests
  8 of 11, the three known spikes failing as before.
- **Field falsifier, delivery half**, through the materialized runtime's `host.mjs` on a
  throwaway home, with the Navigator's OpenRouter key and the live router (the home template's
  `financial` persona, chosen by the router on every turn):
  1. After a full load, a delta delivers nothing; the prompt edited with a fixed signature line,
     the next turn delivers `=== persona/financial (revised: replaces the earlier
     persona/financial in this conversation) ===` with the new text, and the turn after it
     nothing. PASS.
  2. Name and description edited: the next turn delivers nothing. PASS.
  3. Prompt edited, then `forgetMirrorContext`: the next turn is full, delivers the current text
     under the ordinary header, never "revised". PASS.
  4. A session's map replaced with a 0.42.0 id list: the next turn delivers nothing; an edit after
     it is delivered as revised. PASS.
- The model half (case 1's instruction followed) is the acceptance below.

## Acceptance

In `npm run tauri:dev`, on a rehearsal home:

1. In a Conversation where a persona has spoken, open it from its name and add to its prompt a
   visible instruction (for example, "End every answer with the line: -- revised").
2. Ask that persona something in the same Conversation: the answer follows the instruction.
3. The prompt's note no longer mentions compaction.

