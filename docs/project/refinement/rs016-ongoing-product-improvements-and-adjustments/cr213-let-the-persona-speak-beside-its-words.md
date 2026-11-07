[< RS016](index.md)

# CR213: Let the Persona Speak Beside Its Words

**Status:** captured
**Driver:** assistant
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

## Falsifier

On every theme the Navigator can tell, from the comments alone, who is speaking, and read the name
at 4.5:1 or better. Two personas never share a colour that reads the same. A turn the Core gives no
persona shows π, never a name read from the model's own signature.
