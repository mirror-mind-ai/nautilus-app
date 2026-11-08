[< RS016](index.md)

# CR219: Embed the Core That Delivers an Edited Persona Again

**Status:** captured
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
