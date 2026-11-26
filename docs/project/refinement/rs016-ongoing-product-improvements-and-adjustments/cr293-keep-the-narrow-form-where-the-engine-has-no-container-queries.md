[< RS016](index.md)

# CR293: Keep the Narrow Form Where the Engine Has No Container Queries

**Status:** done 2026-11-26 (`d944009b`); validated by the Navigator in a dev build on macOS, which can show only that nothing changed; the effect on WebKit 15 is not seen; a failed falsifier reopens it
**Driver:** Navigator
**Requested:** on 2026-11-26, after the assessment that followed alpha.26: "Vamos registrar e implementar as duas CRs pequenas e montar o plano da CR292." The assessment had named two small items. One was a voice message, which reading the records showed already done by [CR279](cr279-say-why-a-local-transcription-failed.md) and [CR280](cr280-notice-a-voice-component-that-cannot-start.md); the other is this one, and its sibling [CR294](cr294-say-with-a-class-what-has-said.md) took the second place.

## Friction

[CR281](cr281-keep-surfaces-opaque-where-color-mix-is-unknown.md) listed two `@container` rules in its Not Done, and the alpha.24 note repeated it as a known limit. The floor in `config/runtime-compatibility.json` is macOS 12.0, whose WebKit is 15.0 until Safari is updated; container queries arrived in WebKit 16.0, and an engine drops a rule it cannot parse without a sound. Two rules hide something in a narrow column:

- the words Collapse and Expand in the Tree tools, under 232 px of the row ([CR220](cr220-move-settings-beside-the-version-and-new-journey-into-the-tree.md) measured 229 px with the words and 211 available at the narrowest sidebar);
- the "last worked" time on a Journey line of the Compact layout, under 300 px of the list, which gives its room to the name.

Where the rule is dropped the words stay, so the three tools no longer fit on one line at the narrowest sidebar and the row wraps; the time stays and takes room from the name. Read from the stylesheets and CR220's measurements. Not seen on WebKit 15.

## What Changed

- Each of the two `@container` rules is repeated under `@supports not (container-type: inline-size)`: an engine that does not know container queries uses the narrow form at every width, because it is the form that always fits. The container rules stay, so on a current engine nothing changes: the words show above 232 px and the time above 300 px. Names stay in the title and the accessible name; the Activity view carries the time.
- A gate, `src/tests/legacyWebKitStyles.test.tsx`, the stylesheet sibling of the script gate from [CR265](cr265-open-on-macos-12-without-a-black-window.md): it fails when a rule inside a container query has no copy under `@supports not` in the same stylesheet, and it checks that it finds the app's container queries so it is never empty. CR294 adds the `:has()` check to the same file.
- `journeyActivityView.test.tsx` treats an `@supports` wrapper as it treats `@container` and `@media`: opened and forgotten, so that the rules inside are what is checked.

## Noted at Review

The cost is that on an old engine the words and the time are gone at every width in those two places, not only at the narrow ones. The alternative is to measure the row in script (`ResizeObserver`, WebKit 13.1) and set a class, which behaves the same on every engine, at the price of a state and an observer in `App.tsx` for a cosmetic difference. It was not chosen; it is the next step if the always-narrow form proves too bare on the macOS 12 Mac.

The assessment of 2026-11-26 described this rule as unguarded and listed a voice message as open. Both were corrected by reading: CR279 and CR280 are done, and CR281 had recorded `@container` and `:has()` already.

## Falsifier

On a Mac whose WebKit lacks container queries (the macOS 12 Mac), the Tree tools show on one line with Collapse and Expand as icons at the narrowest sidebar and at a wider one, and a Journey line of the Compact layout shows no time. On a current Mac both look as before: the words above 232 px, the time above 300 px. If either is different, this CR reopens.

## Evaluation

Test first: `legacyWebKitStyles.test.tsx` has six tests, four red before the change (one for this CR) and all green after. The neighbouring suites that read these selectors (`cr220SidebarActions`, `chapterIndexPanel`, `compactionNoticeLifecycle`, `cr190PersonInHeader`, `journeyActivityView`, `legacyWebKitSource`, `colorMixFallback`, `cr221PersonaSidebar`, `sidebarProgressLegibility`) pass, and `tsc` is clean. The frontend build keeps both `@supports not` blocks and both container rules. The full suites were not run: they belong to the release's `prepare`. Not seen on a real WebKit 15: the fallback rests on the text of the stylesheet and on the rule that an engine drops what it does not know, as in CR281.

## Validation Route

1. `npm run tauri:dev` on a current Mac. Tree view: Collapse and Expand show their words at the default sidebar width and only their icons at the narrowest, as before.
2. Settings › Appearance, Compact layout: a Journey line shows its time in a wide sidebar and not in a narrow one, as before.
3. After the next release, on the macOS 12 Mac: the Tree tools show icons only and the Compact layout's lines show no time, at any width.

## Closing

Closed on 2026-11-26 on the Navigator's report: on 2026-11-26 the Navigator ran the dev build and reported "ok, agora consegui validar. Está funcionando." The first window opened was an old bundled Dev app of 2026-11-23 (alpha.21), which has no Advanced tab and no code of these CRs; the report is of `npm run tauri:dev`, which loads the current code. It was one sentence for CR292, CR293 and CR294 together and did not go step by step. A current Mac draws the container queries as it always did, so what the report can
stand for here is that nothing changed. What stands behind the closing is that report, the stylesheet gate
and its neighbours, a clean `tsc`, the built stylesheet that keeps both `@supports not` blocks, and the
CI green on `6ba3181f`. Not seen: any WebKit before 16.0, which is where this CR does its work. The
falsifier on the macOS 12 Mac, icons only in the Tree tools at any width and no time on the Compact
layout's lines, stays open until someone looks there; if it fails, this CR reopens.
