[< RS016](index.md)

# CR291: Move the Prompt Cache Option to an Advanced Settings Tab

**Status:** in_progress 2026-11-25 (`db896fdd`); on main, awaiting a look in a dev build on macOS
**Driver:** Navigator
**Requested:** on 2026-11-25, after validating CR289 and CR290: "Eu quero mover a configuração do cache para uma nova aba chamada Advanced. Há alguma outra setting que poderia ir pra lá também além dessa?" After the assessment below: "ok, concordo em deixar o invocation mode para uma CR separada em outra release. Implemente."

## Friction

[CR285](cr285-say-what-the-next-message-will-cost-before-a-pause.md) put its option in an Advanced section
at the bottom of Settings › You, which holds the person's name, avatar and appearance: what is seen every
day. An option a person turns on only when they want it sat among them.

## What Changed

Settings has an eighth tab, **Advanced**, between Updates and Diagnostics (id `advanced`). The Prompt cache
notices option and its note moved there unchanged; You no longer has the section. The tab grid has four
columns, so eight tabs fill two rows. Behaviour, storage (per runtime channel) and the notices themselves
are as in CR285. No Rust.

## Noted at Review

The assessment that led here looked at every Settings panel. The one other option that fits "optional,
rarely needed, and changing it unawares alters the app" is Invocation mode (Models › Global defaults).
It was left out on purpose: today it is saved with the model and the thinking level by one button and
restored by "Restore Nautilus defaults", so moving it means saving it on change and keeping the restore
covering it. That is [CR292](cr292-move-the-invocation-mode-to-the-advanced-tab.md), for a later release. Not
moved, and why: Provider order (part of a panel that reads whole), Choose Mirror home (it sits beside the
home it changes), the OpenRouter key (a capability: it lets Mirror learn), the Layout and the Activity view
(daily).

## Falsifier

Settings has an Advanced tab holding the Prompt cache notices option, You does not, the option still turns
the notices on and off, and a choice made before the move is still honoured (the storage key did not change).
If any of these fails, this CR reopens.

## Evaluation

Test first (six tests red, then green): the tab list and its keyboard order in `settingsTabList.test.tsx`
and `cr175SettingsByIntent.test.tsx`, the option's place in `promptCacheNotice.test.tsx`, the tab count in
`turnCompletionSound.test.ts`. Full suites in a clean environment: vitest 390 files, 3264 passed, 4
skipped; `tsc` clean. Not run in a dev build by the assistant.

## Validation Route

1. `npm run tauri:dev`; Settings: eight tabs, Advanced between Updates and Diagnostics.
2. Advanced: Prompt cache notices, with its note; You: no Advanced section.
3. Turn the option on and off and see the notice appear and go in a conversation over 50K tokens.
4. A choice made before the move is still honoured on opening.
