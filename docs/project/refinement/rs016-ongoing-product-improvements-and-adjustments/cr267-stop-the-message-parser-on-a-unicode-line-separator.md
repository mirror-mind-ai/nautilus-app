[< RS016](index.md)

# CR267: Stop the Message Parser Looping on a Unicode Line Separator

**Status:** captured 2026-11-22; the fix is already a local commit (`e3c90e56`); validated by the Navigator on the user's Mac (the Journey opens and shows the message)
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
  quote ran the process out of memory before the change and passes after it.
- The whole conversation renders in about 70 ms.

## Still open

- A loop that cannot advance is a class of defect, not this one pattern: `parseMessageBlocks` has other
  branches (`while` over lines) and a guard that always moves the index would make a future pattern
  slip fail as a refused block, not as a frozen window.
- The text itself is stored with the separators. Whether the product should normalise U+2028 and U+2029
  on the way in (composer paste) is a separate decision.
- Other parsers of user text that split or match by line (`ImportedActivity`,
  `agentActionProjection`, `piResponseNormalizer`) were read, not audited.

## Acceptance

- A message with U+2028 or U+2029 in a list, numbered list, quote, table row or paragraph renders and
  does not freeze the window.
- A line recognised by any branch of the parser always advances the index.

## Provenance

Raised by the Navigator in the `mirror-desktop` Journey. The cleaned copy of the user's text is kept
beside the original in the Journey's `recuperado/` folder.
