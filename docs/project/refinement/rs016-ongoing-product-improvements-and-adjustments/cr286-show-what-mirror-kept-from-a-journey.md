[< RS016](index.md)

# CR286: Show What Mirror Kept from a Journey

**Status:** done 2026-11-25 (`d08ac21b`); closed on the Navigator's report that the panel opened in a dev build on macOS, with the gaps below; a failed falsifier reopens it
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated, completed for the light themes and the command census, and merged by the assistant
**Requested:** contribution [PR #30](https://github.com/mirror-mind-ai/nautilus-app/pull/30); merged on the Navigator's word, 2026-11-25 ("pode começar pela correção e depois siga suas recomendações para o merge dos 3 prs"), after the evaluation and the corrections below.
Merge commit `d08ac21b`.

## Friction

Mirror learns from a Journey's conversations and hands what it kept back to later turns, and the person
had no place in the app to see any of it.

## What Changed

"View Journey Memory…" in a Journey's ⋯ menu opens a read-only panel, shaped like the chapter index: the
memories grouped by kind (commitments, decisions, learnings, insights, then the others), with counts,
an excerpt that opens to the whole text, and "Open the conversation" where the memory came from a
conversation the app knows. The panel changes nothing.

Commits:

- **The panel** (`bcf27824`, `9466853f`, the author's): `src/domain/journeyMemory.ts`,
  `src/app/JourneyMemoryPanel.tsx`, `journeyMemoryStorage.ts`, the wiring in `App.tsx`; a native
  command `list_journey_memories` in `src-tauri/src/journey_memory.rs`, serialised and off the main
  thread; and `listJourneyMemories` in `mirror-host/host.mjs`, which opens the home's database
  read-only through `node:sqlite` and queries `memories` for the Journey (200 by default, 1000 at
  most), with counts by type over all of them.
- **The light themes and the census** (`032729f1`, the assistant's): the panel was drawn in the dark
  themes' ink only and read as white on white on daylight, mist and parchment; "Open the conversation"
  vanished, since the light themes paint every button white unless it opts out, and the guard in
  `themeTokenContract.test.ts` looks only for transparent controls coloured `var(--text…)`. The panel
  takes the chapter index's light surface and the `--light-*` palette, and the link opts out.
  `journey_memory.rs` was missing from `SOURCES` in `native_command_serialization.rs`, so the census
  could not see its command; listed, 129 → 130. Guarded by `cr286JourneyMemoryLightThemes.test.ts`
  and the census test.
- **The merge with PR #31** (`8c4712a1`): both added imports at the same place in `App.tsx`; both kept.

## Noted at Review

- **The host reads the Core's table directly.** The Core offers no host read of memories, so the app
  now depends on the `memories` schema of `018_drop_hook_injected` outside the contract of the other
  host reads. Main already opens that database read-only for counts (`host.mjs`), so the pattern has
  precedent. The Core's CR218 asks for the read; when it exists, this query should go.
- **Nowhere to take a wrong memory.** The panel's source says a memory that no longer holds is a matter
  for Mirror. The Core's CR219 asks for forgetting one; a control here would be its own CR after that.
- The theme guard's blind spot (controls coloured with the accent) is left as it is; widening it would
  touch every such control in the stylesheet.

## Falsifier

From a Journey's ⋯ menu, View Journey Memory… lists the memories Mirror kept for that Journey and no
other's, the same memories `mirror memories --journey <id>` lists; "Open the conversation" opens the
conversation the memory came from; a Journey with none says so. In each light theme the panel and its
link are legible. If any of these fails, or the panel changes anything in the home, this CR reopens.

## Evaluation

Read in full. Tested merged with PR #31 onto `2ac03746` in a throwaway worktree (vitest 385 files, 3219
passed, 1 skipped; `tsc` clean), then again after the corrections, merged with `main` at `90a6c216`:
vitest 387 files, 3227 passed, 1 skipped (three tests that timed out while the Rust build ran in
parallel passed when run alone); `tsc` clean; `cargo test` 585 passed, 12 ignored. The panel was rendered
from the built stylesheet in the four themes, before and after. The PR's Windows and macOS CI were green
on `8c4712a1`, and the merged `main` has the same tree as the tested one. Not run against a real Mirror
home in a dev build by the assistant.

## Field Report

On 2026-11-25 the Navigator opened the panel in a dev build on macOS: "O painel abriu." The closing rests on that and on the evaluation above. Not exercised: reading the lists against the Journey's real memories, the link that opens the originating conversation, the truncation notice, the light themes of the panel, and Windows. If the falsifier fails in any of these, this CR reopens.

## Validation Route

1. `npm run tauri:dev`; a Journey with memories; ⋯ › View Journey Memory….
2. Compare the list with `mirror memories --journey <id>`; open a memory's conversation.
3. A Journey without memories says so.
4. Switch to daylight, mist and parchment: the panel and its links are legible.
