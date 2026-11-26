[< RS016](index.md)

# CR294: Say With a Class What :has() Said

**Status:** in_progress 2026-11-26 (`d944009b`); built and tested, waits for a look in a dev build and then on the macOS 12 Mac
**Driver:** Navigator
**Requested:** on 2026-11-26, in the same request as [CR293](cr293-keep-the-narrow-form-where-the-engine-has-no-container-queries.md): "Vamos registrar e implementar as duas CRs pequenas e montar o plano da CR292." It is the second of the two, taken from the same Not Done list of [CR281](cr281-keep-surfaces-opaque-where-color-mix-is-unknown.md).

## Friction

Two rules read `:has()`, which arrived in WebKit 15.4, after the 15.0 of the macOS 12.0 floor; an engine that does not know it drops the rule without a sound:

- `.journey-menu:has(.journey-menu-reason)` widened the Journey menu to 260 px when an item shows the reason it is unavailable (Chapters…, with no chapter yet), so the reason does not wrap in a narrow column;
- `.compaction-notice:has(> .compaction-notice-dismiss)` put the Dismiss button of a compaction notice under its statement, right aligned and spaced from it, so it does not compete with the reason for room.

Where the rule is dropped the menu keeps its natural width and the button sits where the notice's flow leaves it. Read from the stylesheet; not seen on WebKit 15.

## What Changed

- The Journey menu carries `has-reason` when it holds the reason, which is the same test that renders it (`conversationChapters.length === 0`), and the rule reads `.journey-menu.has-reason`.
- The compaction notice carries `has-dismiss` when it renders the button (`compactionNoticeIsDismissible`), and the rule reads `.compaction-notice.has-dismiss`.
- Both selectors keep the specificity of the ones they replace and their place in the stylesheet, so a current engine draws the same. The declarations are unchanged.
- The stylesheet gate of CR293 fails on any `:has(` in `app.css` or `presentation.css`.

## Noted at Review

The element knowing its own state is a better home for the fact than a selector that infers it from a child: the class is set by the same condition that renders the child, so the two cannot drift. A `:has()` can still be used where the missing rule is harmless; the gate would then ask for the reason to be written, as the container rules do.

## Falsifier

In a dev build on a current Mac, the Journey menu of a Conversation with no chapter shows its reason and is as wide as before, and a compaction notice with a Dismiss button shows it under the statement, right aligned. On a Mac whose WebKit predates 15.4 they do too. If either differs, this CR reopens.

## Evaluation

Test first, in `legacyWebKitStyles.test.tsx` (three tests for this CR, all red before the change): no `:has(` in a stylesheet, the menu's class in the source and its rule, the notice's class in the rendered markup (present when dismissible, absent while the compaction runs) and its rule. The suites that read the notice and the menu (`compactionNoticeLifecycle`, `chapterIndexPanel`, `cr190PersonInHeader`) pass, `tsc` is clean, and the frontend build holds no `:has(`. The full suites belong to the release's `prepare`.

## Validation Route

1. `npm run tauri:dev`. In a Conversation with no chapter, open the ⋯ menu of the header: "Chapters…" shows its reason and the menu is as wide as before.
2. Optional: run a compaction in a throwaway Conversation; the notice that follows shows Dismiss under its statement, right aligned. The render test covers it; this is only to see it.
3. After the next release, on the macOS 12 Mac, the same two places look the same.
