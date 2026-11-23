[< RS016](index.md)

# CR276: Follow Several Journeys at Work From the Sidebar

**Status:** done 2026-11-23 (`f701682c`); validated by the Navigator in a dev build on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #26](https://github.com/mirror-mind-ai/nautilus-app/pull/26); merged on the Navigator's word, 2026-11-23 ("quero integrar a PR #26 antes de gerar a nova release").
Merge commit `f701682c`.

## Friction

With several Journeys at work, the sidebar does not say which one needs the person. Every Journey is a
card of the same weight, few fit on a screen, and a Journey whose answer waits to be read differs from
an idle one by a single icon. Above the conversation, the header takes four lines.

## What Changed

Two additions, both optional; the app opens as it did.

- **Activity**, a fourth view beside Recent, Pinned and Tree. Every Journey grouped as Need you (the
  last turn failed or was interrupted, an answer not opened yet, a message held), Working (the
  operation running now and for how long) and Idle (the rest, most recent first). It reads the Journey
  agent status and the waiting queue the app already keeps, through the same derivations a Journey row
  uses, and adds no state. The rule is the pure module `src/domain/journeyActivity.ts`, the inputs
  `src/app/journeyActivityInputs.ts`, the list `src/app/JourneyActivityList.tsx`.
- **Compact**, a layout chosen in Settings, You, Appearance, Layout: Journeys as lines, a one-line
  header, the answer as running text. CSS only, in `src/styles/presentation.css`; every rule of the
  layout sits under `[data-application-layout="compact"]`.

Both choices are kept per runtime channel in the renderer's storage
(`src/app/sidebarPresentationStorage.ts`), not in the Journey preferences file, so an older build reading
that file does not discard the Navigator's pins, recents and theme.

## Noted at Review

- **The Activity button shows in every layout.** The view bar now has four buttons, a little narrower,
  in Classic too. The view itself is only shown when chosen.
- The two unscoped rules of `presentation.css` only declare its own `--p-*` tokens (dark by default,
  overridden for the light families daylight, mist and parchment); `app.css` uses none of them.
- The Activity list derives its inputs inline on each render of `App` while it is shown, so its `memo`
  does not hold. Cheap for a handful of Journeys; worth a `useMemo` if the list grows.
- A Working row names the running tool and its target (`bash npm test`), bounded to 120 characters;
  the same text the conversation already shows.
- The row's tooltip joins the name and the line with a long dash, against the house writing rule; left
  as contributed.

## Falsifier

With two Journeys, start a turn in one and leave a finished answer unopened in the other: Activity
shows the first under Working with its operation and a running clock, the second under Need you. Opening
the answer moves it to Idle. Choosing Compact turns the cards into lines and choosing Classic brings them
back. If the Classic layout or the three older views look different apart from the fourth button, this
CR reached further than it says.

## Evaluation

Read in full. The PR was opened on `87739476`, before CR275; tested as merged onto `8863b9d3` in a
throwaway worktree: vitest 3159 passed (377 files, 1 skipped), `tsc` clean. No Rust change. 26 new tests
in `journeyActivity.test.ts` and `journeyActivityView.test.tsx`, including source guards that every
Compact rule sits under the layout attribute and names nothing of Settings, dialogs or menus. The PR's
Windows and macOS CI were green.

## Validation Route

1. `npm run tauri:dev` from the repository root (no pin change since CR275).
2. In the sidebar, choose Activity: the groups, the counts, a Working row's clock, a Need you row's line.
3. Select a Journey from Activity and open its menu with a right click.
4. Settings, You, Appearance, Layout: Compact, then Classic, in a dark and a light theme.
5. Recent, Pinned and Tree look as before, apart from the fourth button.

## Validation Evidence

Validated by the Navigator in a dev build on macOS, 2026-11-23 ("Deu certo. Está validada."), after
running two Journeys at once with long commands, cancelling one and leaving the other's answer unread.
Closed as done; not yet in a release.
