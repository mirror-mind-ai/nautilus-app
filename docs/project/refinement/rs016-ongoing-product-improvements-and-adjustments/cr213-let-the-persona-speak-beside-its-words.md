[< RS016](index.md)

# CR213: Let the Persona Speak Beside Its Words

**Status:** in_progress
**Driver:** assistant
**Delivery:** `main` (`a05abf83`), built with CR212
**Reported:** Navigator, 2026-11-07
**Mockup:** [cr213-mockup.html](cr213-mockup.html), all four cards and the three themes

## Friction

- The persona is named in the card's header, and many Agent Actions sit between it and the
  comments the Navigator reads, so what is said and who says it never meet.
- On the light themes the persona's name has no contrast: `.message.speaker-persona .message-role`
  sets the dark theme's `#d7c5ff`, and its specificity beats the light themes'
  `:where(.message-role)` rule.
- The avatar shows two initials from the id ("PD"), a placeholder until personas have images of
  their own, as Journeys do.

## Direction

- The agent's comments (trail and closing) are shown as speech: the persona's avatar and name sit
  beside them, and the comments sit in a bubble that points to the avatar, as in a forum.
- Until personas have images, the avatar is the ◇ on a colour taken from the persona's id: stable,
  distinct between personas, nothing to configure. On the light themes the colour is darkened until
  the white ◇ and the name reach 4.5:1 against every light surface. The image, when it exists,
  takes the same place.
- A turn with no persona (Core CR202) is spoken by the agent, π, in the same bubble.
- A persona that changed from the previous turn says so, quietly, beside its name.
- The header no longer names the speaker; its place goes to CR212's turn line.
- The Navigator's own messages take the same shape, mirrored: avatar and name on the right, the
  bubble pointing to them, so the transcript reads as a conversation. The agent's turn loses its
  card, as the Navigator's message has none.
- Each bubble, the Navigator's and the agent's, carries its own copy action, shown only on hover or
  keyboard focus (Navigator, 2026-11-07).
- The persona's name is the one the Core holds in its metadata; while it has none, the id made
  readable ("product-designer" reads "Product Designer").

## Change

- `Speech` (new) draws a speaker beside a bubble: the agent's on the left, the Navigator's mirrored
  on the right with the time of day. Neither side is a card any more. Progress notes stay inside
  the bubble, quieter, as the Navigator chose.
- Each bubble holds its own copy action, hidden until hover or keyboard focus, and kept visible
  while it reports copied or failed.
- `personaColour.ts` takes the hue from the id (FNV-1a, golden angle). The dark themes draw it in
  CSS from `--persona-hue`; the light themes get `--persona-light`, darkened until it reads at
  4.5:1 on every light surface and raised surface. The lilac `#d7c5ff` that beat the light themes
  is gone.
- A change of persona from the previous run reads "before: <name>" beside the name.
- None crosses from the Core: a delivered context without a signing clause (session record) or with
  a null persona (live run) records `null` in `responsePersonas`, and the agent speaks, π, whatever
  the model signed. A turn the context never reached still falls back to the signature.

## Field fix

- 2026-11-07, Navigator ("o conteudo vazou do bubble do agente"): a code block in a progress note
  pushed the note past the bubble. The grids inside the bubble had no declared column, so an
  implicit `auto` track grew to the block's widest line. They are now `minmax(0, 1fr)`, and the
  code block scrolls inside the bubble.

## Known limits

- **Colours collide.** Hashing cannot separate 28 personas on a 360° wheel: on the production home
  five pairs land within a few degrees (pensadora and professora share 64°). The name always
  disambiguates; telling them apart by colour alone needs a decision (see Check).
- **Names.** Until Core CR203 hands over the persona's own name, the id is made readable, so
  `ai-engineer` reads "Ai Engineer".

## Falsifier

On every theme the Navigator can tell, from the comments alone, who is speaking, and read the name
at 4.5:1 or better. Two personas never share a colour that reads the same. A turn the Core gives no
persona shows π, never a name read from the model's own signature.

## Check

In `npm run tauri:dev`, on a dark and a light theme: who speaks is clear from the bubble alone, the
copy action appears on hover in both bubbles, and a change of persona says so. Open for the
Navigator: whether colour collisions matter enough to resolve them per Conversation.
