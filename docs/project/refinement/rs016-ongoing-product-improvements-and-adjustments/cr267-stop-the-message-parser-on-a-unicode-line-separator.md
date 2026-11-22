[< RS016](index.md)

# CR267: Stop the Message Parser Looping on a Unicode Line Separator

**Status:** validated 2026-11-22 (`e3c90e56`, `5dd681f5`); published in v0.4.0-alpha.21, opened and used by the Navigator on the macOS 12 Mac
**Driver:** Navigator
**Requested:** on 2026-11-21. A user's message, pasted into the Journey `operacao-natal`, froze the app; after a force-quit the Journey no longer opened, on the old app and on Nautilus alike.

## Friction

One message froze the window and every later opening of that Journey. Memory grew to over a gigabyte
with the processor busy and nothing on screen. The Navigator could not read the Journey, send to it,
or tell why.

## Cause

The message held 19 U+2028 characters (text pasted from a phone brings them): inside list items such as
`- 1 kit Reis Magos: R$ 95` followed by U+2028 and a remark. In `parseMessageBlocks`
(`src/app/MessageContent.tsx`) the list, numbered-list and quote branches detect a line with a
pattern, then read its item with `(.+)`. `trim` leaves an inner U+2028, and `.` does not cross it, so
the line was recognised and not consumed. The index never advanced and empty blocks were appended
until memory ran out.

It was found by rendering the Journey's real transcript outside the app and then one message at a time:
the 31st message, the user's text, was the one that did not return.

## What was done

- The three item patterns take the `s` flag. A test with U+2028 in a list item, a numbered item and a
  quote ran the process out of memory before the change and passes after it (`e3c90e56`). The
  whole conversation renders in about 70 ms.
- A guard (`5dd681f5`): a pass that leaves the index where it found it reads the line as text and
  drops the empty list it left. With the list fix removed by hand, one test fails and nothing hangs.
- Headings take the `s` flag too. A sweep over every recognised start of line, with U+2028, U+2029,
  U+0085, vertical tab, form feed, no-break space, BOM and zero-width space at the start, inside and
  at the end, checks that the parser ends and keeps every word.

## Still open

- Whether the composer should normalise U+2028 and U+2029 on paste is a separate decision; the text is
  stored as the person sent it.

## Acceptance

- A message with U+2028 or U+2029 in a list, numbered list, quote, table row or paragraph renders and
  does not freeze the window.
- A line recognised by any branch of the parser always advances the index.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The cleaned copy of the user's text is kept
beside the original in the Journey's `recuperado/` folder.
