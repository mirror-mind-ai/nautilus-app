[< RS016](index.md)

# CR274: Keep Claude's Prompt Cache From One Turn to the Next

**Status:** done 2026-11-23 (`4a5c60b2`); validated by the Navigator in a dev build on macOS; ships only with CR275
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #22](https://github.com/mirror-mind-ai/nautilus-app/pull/22); merged on the Navigator's word, 2026-11-23 ("mescle os dois, abra a CR275"), in a round with PR #24.
Merge commit `4a5c60b2`.

## Friction

With Claude through Claude Code, every new message made Claude write the whole conversation to its
prompt cache again, even seconds after the previous answer. Measured by the contributor on a production
home on Windows: of 69 turns that followed a finished answer, 67 rewrote everything, 431k tokens per
turn on average, 86% of all that provider's cache writes.

## Cause

The bridge keeps in memory which Claude Code session a Pi session's turns run on and reuses it on the
next turn, which keeps the cache warm. Nautilus ends the Pi process with every turn, so that memory is
gone by the next one and every turn rebuilds a new Claude Code session, a different request prefix.

## What Changed

`settled-session.ts`, a file of Nautilus's own in the vendored provider, carries that one fact across
the process boundary:

- **Written** only when a turn settles cleanly, never for a sub-agent query; **taken** once by the next
  turn, so it exists on disk only between a clean settle and the next turn.
- **Adopted** only when upstream's own reuse rule would accept it: same folder, Claude Code's session
  file present, Pi's history up to the settled prompt unchanged, nothing after the settled turn but its
  answer. Anything else drops it and the turn rebuilds as before.
- **Kept** in `anthropic/claude-sessions` in the app's data, beside the installed provider; ids, a
  count and a digest, nothing of the conversation; records older than 30 days are removed.

Four lines of `index.ts` marked `// Mirror Desktop, settled session` call it; the fork test now holds
that `index.ts` without its marked lines is upstream's file, and `FORK.md` says how to re-apply.

Measured by the contributor, first model call of a turn 30 s after the previous answer: `main` read
3.7k and wrote 69.2k tokens to the cache; the branch read 73.8k and wrote 0.5k, also after closing and
reopening the app.

## Noted at Review

- **The provider's source hash in `mirror-host/pin.json` changes.** After the update, everyone who uses
  Claude through Claude Code has to click Connect again (about 25 s, 142 MB), and until then a turn
  comes back with `Unknown provider "claude-bridge"`. This is the first such change since a person
  installed the provider. CR275 removes it; no release carries this CR before CR275.
- Run on Windows only, on one workstation.

## Falsifier

In a Journey on Claude through Claude Code, a second turn sent soon after the first reads the
conversation from the cache and writes almost nothing to it; after a stopped turn, a compaction or a
turn on another provider it rebuilds and answers correctly. If the second turn still rewrites the
conversation, or a turn answers from the wrong history, this CR did not do its work.

## Evaluation

Read in full. 15 tests in `claudeBridgeSettledSession.test.mjs`, one per guard, and the fork test pass.
Same combined run as CR273: vitest 3127 passed, `tsc` clean, cargo 567 passed. The private alpha
preflight refuses the runtime materialized from the old pin and passes (8 of 8) with one materialized
from the new pin.

## Validation on macOS

Validated by the Navigator in a dev build on macOS, 2026-11-23 ("A validação deu certo"). The dev
runtime was rematerialized from the new pin first; without that the dev app keeps the old provider and
does not exercise this change.

- **Connect** installed `anthropic-e519b37b3400-ea4895ef6832` and removed the earlier pin's install.
- **Cache**, Claude Haiku through Claude Code, same Journey: the first turn after Connect rebuilt and
  wrote 38,213 tokens to the cache; the next turn, 16 s later, read 59,601 and wrote 926.
- **The record** in `anthropic/claude-sessions` has a hashed name and only `schemaVersion`,
  `piSessionId`, `sessionId`, `cursor`, `cwd`, `covered`, `fingerprint` and `settledAt`.

Before Connect, the dev app showed Claude through Claude Code as disconnected and still answered turns
through the person's global `pi-claude-bridge`; that finding went to CR275. Closed as done; the release
boundary stays: no release carries this CR before CR275.
