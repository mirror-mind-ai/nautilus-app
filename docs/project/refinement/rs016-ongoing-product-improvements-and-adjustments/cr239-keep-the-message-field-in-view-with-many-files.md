[< RS016](index.md)

# CR239: Keep the Message Field in View With Many Files

**Status:** validated in dev on macOS 2026-11-11 by the Navigator ("dev validado"); not published
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #13](https://github.com/mirror-mind-ai/nautilus-app/pull/13); merged on
the Navigator's word, 2026-11-11 ("faça o merge dos quatro"). Merge commit `a3ed2f48`.

## Friction

With eight forwarded e-mails selected, the list of pending files grew without bound and pushed the
message field and Send below the window; they could be reached only with Tab. Each file took up to
four lines.

## What Changed

`.pending-file-list` scrolls inside `max-height: min(28vh, 196px)`, about three and a half files,
with `overscroll-behavior: contain`; the header stays above it and the field below it. Each file
takes two lines: the name with an ellipsis (full name in its title), then the path and size. Two
specs in `pendingFilesKeepComposer.test.tsx`.

## Noted at Review

Exercised on Windows only. In a short window the conversation above keeps little room while files
are pending; it returns when they are sent or cleared.

## Falsifier

On macOS, select eight or more files in a window of ordinary height: the list scrolls, the field and
Send stay visible and clickable, and a long file name ends in an ellipsis on one line.

## Evaluation

Evaluated with CR236 to CR238; see CR236's Evaluation.
