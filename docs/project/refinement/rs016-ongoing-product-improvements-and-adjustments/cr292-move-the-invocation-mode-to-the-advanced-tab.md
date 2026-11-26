[< RS016](index.md)

# CR292: Move the Invocation Mode to the Advanced Tab

**Status:** planned 2026-11-26; waits for the Navigator's choice on how the setting is saved (Decision, below), then for a place in a release
**Driver:** Navigator
**Requested:** on 2026-11-25, in the assessment of CR291: "concordo em deixar o invocation mode para uma CR separada em outra release." Planned on 2026-11-26: "montar o plano da CR292."

## Friction

Invocation mode (Models › Global defaults, "Mirror runtime Pi" or "Raw local Pi") is the most advanced
option in Settings, and by what the code does with it (below) it decides how the turn is built and how Pi
is spoken to: a person who changes it unawares may lose what the app is for. It sits among the model and
the thinking level, which people change daily.

## What Was Found

Traced in the code on 2026-11-26; the app was not run.

- **What Raw local Pi is.** The mode is a route, not a label. In `mirror` the text sent to Pi is the
  Journey authority block and the person's own message (`createMirrorRuntimePrompt`), and the process
  runs in Pi's RPC mode (`rpcMode` is on only for `mirror`, and not in safe test mode). In `raw` the text
  is the older task packet: instructions to return one fenced JSON mission draft, then the packet as JSON
  (`createRawPiInvocationPrompt`), with RPC mode off. `mirror` is the default, in the defaults of
  `agentProfile.ts` and in the path that saves a model chosen in setup.
- **Where it lives.** Global only. `resolveAgentProfile` takes the mode from `globalProfile` whatever the
  Journey and the Conversation say: their overrides carry the model and the thinking level alone. It is
  stored with them in the agent settings file (`globalProfile.invocationMode`, validated in
  `src-tauri/src/agent_settings.rs`), written by `saveGlobalAgentProfile` ("Save global defaults") and
  read at send time through the effective profile.
- **Restore.** "Restore Nautilus defaults" replaces the whole settings object with the defaults
  (`restoreDefaultAgentSettings`), so it already puts the mode back to `mirror` wherever the select sits,
  as long as the select reads `agentSettings` and not a draft of its own.
- **Diagnostics.** The panel labelled "Current session invocation controls" (heading "Current session
  controls") does not hold the mode. It holds Command, Arguments, stdin and safe test mode: process
  settings of the session, never persisted, a different concern. It does not move. Safe test mode
  disables the select today and keeps doing so.

## What Would Change

The field leaves Models › Global defaults and appears in Settings › Advanced, under the prompt cache
option, with the same two labels. Nothing changes on the native side: the schema, its validation and the
`invocationMode` key stay as they are.

## Decision for the Navigator

How the setting is saved. It saves today with the model and the thinking level, by one button.

- **A. On change, like the prompt cache option (recommended).** Advanced is a tab of switches, and a mode
  that needs a Save button of its own would be the odd one. The cost: a save that can fail has to show
  it (the select goes back and says why), and a slip would switch the route at once. So a note under the
  select says what Raw changes while it is selected, and "Restore Nautilus defaults" is the way back.
- **B. A draft with its own Save button in Advanced.** Nothing applies by accident; one more button on a
  tab that has none.
- **C. Leave it in Models** and close this CR.

Whether Raw should still be offered at all is a separate question, outside this CR: it speaks the
mission-draft protocol of the Nautilus Harness era, and the Models select is the only place in the app
that names it. The plan keeps it.

## Plan

Test first, in `cr175SettingsByIntent.test.tsx`, `settingsTabList.test.tsx` and a new CR292 spec:

- Models holds no "Invocation mode" field; Advanced holds it, with "Mirror runtime Pi" and "Raw local Pi".
- (Option A) choosing an option writes `globalProfile.invocationMode` alone, through `persistAgentSettings`,
  and leaves the model, the thinking level and the Journey and Conversation overrides as they were.
- "Save global defaults" no longer writes the mode: it keeps the stored one, so a stale draft cannot undo
  a choice made in Advanced.
- "Restore Nautilus defaults" returns the select to "Mirror runtime Pi".
- Safe test mode still disables the select; a failed save puts the select back and shows the message.
- While `raw` is selected a note says what it changes. Wording to settle with the Navigator; a first
  reading: "Raw local Pi sends Pi a task packet and asks for a JSON mission draft, without Pi's RPC mode.
  Restore Nautilus defaults returns to Mirror runtime Pi."

Then the code: take the field and the `providerInvocationMode` draft out of Models, read the select from
`agentSettings.globalProfile.invocationMode`, add the on-change handler and the note. No Rust.

## Falsifier

In a dev build: Models shows the model and the thinking level and no Invocation mode; Advanced shows it;
choosing Raw and reopening the app still shows Raw; changing the model and pressing Save global defaults
leaves it Raw; Restore Nautilus defaults brings back Mirror runtime Pi. Any difference reopens this CR.
(Under option B the second step is a Save in Advanced.)

## Validation Route

1. `npm run tauri:dev`; Settings › Models has no Invocation mode; Settings › Advanced has it.
2. Choose Raw local Pi; close Settings and reopen: still Raw, with the note.
3. In Models, change the thinking level and press Save global defaults; Advanced still shows Raw.
4. Restore Nautilus defaults; Advanced shows Mirror runtime Pi.
5. Optional: send a turn in each mode and see that Raw answers in the older shape.
