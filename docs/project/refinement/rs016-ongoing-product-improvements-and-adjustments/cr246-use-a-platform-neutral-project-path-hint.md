[< RS016](index.md)

# CR246: Use a Platform-Neutral Project Path Hint

**Status:** merged 2026-11-12; validated in dev on macOS by the Navigator 2026-11-12; not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #19](https://github.com/mirror-mind-ai/nautilus-app/pull/19); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `760755e2`.

## Friction

The Journey dialog's Project path field showed `/absolute/path/to/project`, a POSIX example that reads wrong on Windows. Noted at the review of PR #1 and deferred.

## What Changed

The placeholder reads "Full path to project folder". A guardrail test pins it.

## Noted at Review

Text only; the Choose… button and path validation are unchanged.

## Falsifier

Open New Journey: the Project path field shows the neutral hint on macOS and Windows.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
