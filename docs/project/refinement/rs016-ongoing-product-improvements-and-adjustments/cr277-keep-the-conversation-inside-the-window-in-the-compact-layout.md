[< RS016](index.md)

# CR277: Keep the Conversation Inside the Window in the Compact Layout

**Status:** implemented 2026-11-23 (`93cb7768`); awaiting the Navigator's validation
**Driver:** the Navigator, field report on v0.4.0-alpha.22
**Requested:** 2026-11-23, with a screenshot: after switching to the Compact layout (CR276), the
sidebar broke as soon as the agent began to render its answer, and neither resizing the window nor
changing the sidebar's view repaired it; the portrait at the top was cut.

## Friction

The whole app moved left. The sidebar lost its left edge (the app's name, the first view button,
the start of every Journey's name) and the header's last action, the person's portrait, was cut at
the window's right edge. It stayed that way after the turn ended.

## Cause

Two things together, both reproduced in a browser with the app's own stylesheet.

- In the Compact layout the header lays the Journey's name, its status, its folder path, the three
  workspaces and the actions on one line. The conversation column (`.chat-shell`) had no declared
  column, so its implicit `auto` track took that line's full width, with the path at its natural
  length, as its floor. On a window of 1500 px with the sidebar at 292 px, a long path made the column
  1339 px in an area of 1208: 131 px past the window. Classic stacks the header, so its floor fits.
- When an answer streams, the conversation follows its end with `scrollIntoView`. That scrolls every
  scrollable ancestor, and `.app-shell` is one: `overflow: hidden` removes the scrollbar, not the
  scroll. The shell scrolled 131 px sideways, and nothing in the app scrolls it back; a resize keeps
  the offset, and so does a change of view.

## What Changed

- `.chat-shell` declares `grid-template-columns: minmax(0, 1fr)`: the column is the space the shell
  gives it, and the header's parts shrink inside it, the path ending in an ellipsis.
- `.app-shell` adds `overflow: clip` after `overflow: hidden`. A clipped box is not a scroll
  container, so no script can scroll it. WebKit before 16 (macOS 12 without a Safari update) ignores
  `clip` and keeps `hidden`; there the column rule alone prevents the overflow.

Test: `src/tests/cr277CompactLayoutWidth.test.ts`.

## Falsifier

In the Compact layout, on the Journey whose folder path is long, send a message whose answer streams.
The change is false if the sidebar or the header moves sideways at any point, or if the portrait or
the first view button is cut.

## Evaluation

- vitest: 380 files, 3163 passed, 1 skipped; `tsc` clean. No Rust change.
- In a browser at 1500 x 840 with the dev server and mocked native commands, Compact layout, a long
  folder path inserted in the header: before the change the shell overflowed by 131 px and a
  `scrollIntoView` of the conversation's end left it scrolled 131 px after a resize; after it, the
  column is 1208 px, the overflow is 0, the scroll stays at 0, the path ends in an ellipsis and the
  last action ends at 1436 px.
- Not exercised: a real streaming turn, and WebKit (the browser check ran in Chromium).

## Validation Route

In a dev build (`npm run tauri:dev`) or the next release: choose Settings, You, Appearance, Layout,
Compact; open the Nautilus App Journey; send a message that runs for a while (for example
`Liste os arquivos da pasta com ls -la, depois rode sleep 30 e, por fim, responda só: pronto.`) and
watch the sidebar and the header while the answer streams and after it ends. Then narrow the window.

## Validation Evidence

Pending.

## Recovering the Installed App

An app already in this state is repaired by switching Settings, You, Appearance, Layout to Classic and
back: Classic has no overflow, so the offset falls to zero. Restarting the app also repairs it until
the next streamed answer.
