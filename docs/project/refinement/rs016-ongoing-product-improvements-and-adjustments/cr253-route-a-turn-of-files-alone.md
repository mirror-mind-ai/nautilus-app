[< RS016](index.md)

# CR253: Route a Turn of Files Alone

**Status:** implemented 2026-11-12 (`287cf528`); validated in dev on macOS by the Navigator 2026-11-12; published in v0.4.0-alpha.13 (2026-11-12)
**Driver:** Navigator, at the dev check of CR252
**Requested:** "repare como o nome da persona vazou na resposta e nao foi usado para mudar a
persona do turno", 2026-11-12.

## Friction

A turn of files alone (CR250) was answered under "Agent", and the answer ended with the persona's
signature on its own line of text ("… de um livro. ◇ escritora"). The Pi session showed why: turns
with text carried a delivered Mirror context signing as the routed persona; the two turns of files
alone carried none. Nautilus gives the doorman what the person typed, which was empty, and the Core
refuses an empty prompt (`invalid_request`), so the turn ran with no Mirror context and no
persona. The model then imitated the signatures of earlier turns, on the same line as its answer,
where the signature filter, which looks for a line of its own, did not take it off.

## What Changed

`doorman_prompt` gives the doorman what was typed, or, when nothing was, `Files sent without a
message: <names>`, the display names of the selected files and never their folders. The Core then
routes and delivers as for any turn; it is unchanged. On the surface, a signature at the end of
the answer's last line, after the sentence ends (`.`, `!`, `?`, `…`, `)`), is taken off the
text but names no speaker: only the delivered context names the persona (CR188), and a guessed
persona is worse than none. A diamond the sentence itself uses stays, as CR188 asks. The bubble of
a message of files alone now opens with its files, without the empty space and rule above them
(CR252). Specs: a Rust test of `doorman_prompt`, `cr253InlineSignature.test.ts`, and the bubble
spec in `cr252AttachmentOnlyBubble.test.tsx`.

## Noted

Which persona a file name routes to is the Core's to decide; a name like `978-65-02-40807-0.jpeg`
says little, and the Core may route to none or keep the Conversation's. That is still a delivered
context, so the model is told how to sign instead of guessing.

## Falsifier

In dev, in a Conversation with a routed persona, send a file with the field empty: the answer is
attributed to the persona the Core routed, or to none, and no `◇ <persona>` shows in its text. The
bubble opens with the file.
