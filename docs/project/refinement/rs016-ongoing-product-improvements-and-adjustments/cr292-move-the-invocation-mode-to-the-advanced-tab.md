[< RS016](index.md)

# CR292: Move the Invocation Mode to the Advanced Tab

**Status:** done 2026-11-26 (`6523e450`); validated by the Navigator in a dev build on macOS; a failed falsifier reopens it
**Driver:** Navigator
**Requested:** on 2026-11-25, in the assessment of CR291: "concordo em deixar o invocation mode para uma CR separada em outra release." Planned on 2026-11-26 ("montar o plano da CR292"), and built the same day on the Navigator's "ok, siga com sua recomendação", which chose the option named A below.

## Friction

Invocation mode (Models › Global defaults, "Mirror runtime Pi" or "Raw local Pi") is the most advanced
option in Settings, and by what the code does with it (below) it decides how the turn is built and how Pi
is spoken to: a person who changes it unawares may lose what the app is for. It sat among the model and
the thinking level, which people change daily.

## What Was Found

Traced in the code on 2026-11-26.

- **What Raw local Pi is.** The mode is a route, not a label. In `mirror` the text sent to Pi is the
  Journey authority block and the person's own message (`createMirrorRuntimePrompt`), and the process
  runs in Pi's RPC mode (`rpcMode` is on only for `mirror`, and not in safe test mode). In `raw` the text
  is the older task packet: instructions to return one fenced JSON mission draft, then the packet as JSON
  (`createRawPiInvocationPrompt`), with RPC mode off. `mirror` is the default, in the defaults of
  `agentProfile.ts` and in the path that saves a model chosen in setup.
- **Where it lives.** Global only. `resolveAgentProfile` takes the mode from `globalProfile` whatever the
  Journey and the Conversation say: their overrides carry the model and the thinking level alone. It is
  stored with them in the agent settings file (`globalProfile.invocationMode`, validated in
  `src-tauri/src/agent_settings.rs`) and read at send time through the effective profile, so a change
  applies from the next message.
- **Restore.** "Restore Nautilus defaults" replaces the whole settings object with the defaults
  (`restoreDefaultAgentSettings`), so it already puts the mode back to `mirror` wherever the select sits,
  as long as the select reads `agentSettings` and not a draft of its own.
- **Diagnostics.** The panel labelled "Current session invocation controls" (heading "Current session
  controls") does not hold the mode. It holds Command, Arguments, stdin and safe test mode: process
  settings of the session, never persisted, a different concern. It did not move. Safe test mode
  disables the select, as it did in Models.

## Decision

How the setting is saved. It was saved with the model and the thinking level, by one button. The options
put to the Navigator were A, on change like the prompt cache option; B, a draft with a Save button of its
own in Advanced; C, leave it in Models and close this CR. A was recommended and chosen: Advanced is a tab
of switches, and a mode that needed a Save button would have been the odd one.

Whether Raw should still be offered at all is a separate question, outside this CR: it speaks the
mission-draft protocol of the Nautilus Harness era, and the Models select is the only place in the app
that names it. It is kept.

## What Changed

- The field left Models › Global defaults and is in Settings › Advanced, under the Prompt cache notices
  option, with the same two labels and values.
- It is saved as it changes. `chooseInvocationMode` shows the choice at once, saves it through
  `persistAgentSettings` with a new pure function, `setInvocationMode` (`agentProfile.ts`), which replaces
  that one field and leaves the model, the thinking level and every override as they were, and puts the
  select back on the stored mode, with the error under it, when the save fails.
- "Save global defaults" now saves the model and the thinking level only and keeps the stored mode
  (`current.globalProfile.invocationMode`), so a draft that went stale cannot undo a choice made in
  Advanced. "Restore Nautilus defaults" is unchanged and the select follows it.
- Two notes sit under the select. One is always there: "Saved as soon as you choose, and applied from the
  next message." The other shows while Raw local Pi is chosen and says what it is: it hands Pi a task
  packet, asks for a JSON mission draft and runs without Pi's RPC mode, where Mirror runtime Pi sends the
  message under the Journey's authority. The wording is for the Navigator to settle.
- The select is disabled in safe test mode, as before, and while a save is running.
- No Rust, no schema change, no new native command.
- The CR158 census of the places that write the agent settings rose from ten to eleven (ten callers and
  the declaration). The new caller supplies an update function, which is what that guard asks.

## Noted at Review

The plan had named "Restore Nautilus defaults" as the way back from Raw. The note does not say so: that
button replaces the whole profile, every model choice included, and the way back is the select itself. The
button still covers the mode, and a test says so.

## Falsifier

In a dev build: Models shows the model and the thinking level and no Invocation mode; Advanced shows it;
choosing Raw and reopening the app still shows Raw; changing the model and pressing Save global defaults
leaves it Raw; Restore Nautilus defaults brings back Mirror runtime Pi. Any difference reopens this CR.

## Evaluation

Test first. `agentProfile.test.ts` has four tests for `setInvocationMode` (three red before it existed):
it replaces the global mode alone, leaves the settings it was given untouched, reaches every Journey and
conversation, and the default is `mirror`. `cr292InvocationModeAdvanced.test.ts` has nine tests over the
source of `App.tsx`: the field is out of Models and in Advanced with its labels, its disabled rule and its
two notes, a failed save is shown there, the mode is written alone, the select returns to the stored mode
on a failed save, Save global defaults keeps the stored mode, and Restore still covers it. They failed
before the change as a suite, since the handler they read did not exist. The suites around it
(`promptCacheNotice`, `cr175SettingsByIntent`, `settingsTabList`, `agentProfileSettings`, `providerConfig`,
`mirrorMediatedInvocation`, `piProcessStream`, `conversationSpaceStorage`) pass after the census update,
and `tsc` is clean. The full suites belong to the release's `prepare`. Not seen running: the app was not
opened in a dev build, and no turn was sent in either mode.

## Validation Route

1. `npm run tauri:dev`; Settings › Models has no Invocation mode; Settings › Advanced has it, under the
   prompt cache option.
2. Choose Raw local Pi: the note about the task packet appears. Close Settings and reopen: still Raw.
3. In Models, change the thinking level and press Save global defaults; Advanced still shows Raw.
4. Choose Mirror runtime Pi again: the note goes. Restore Nautilus defaults also brings it back from Raw.
5. Optional: send a message in each mode and see that Raw answers in the older shape.

## Closing

Closed on 2026-11-26 on the Navigator's report: on 2026-11-26 the Navigator ran the dev build and reported "ok, agora consegui validar. Está funcionando." The first window opened was an old bundled Dev app of 2026-11-23 (alpha.21), which has no Advanced tab and no code of these CRs; the report is of `npm run tauri:dev`, which loads the current code. It was one sentence for CR292, CR293 and CR294 together and did not go step by step. What stands behind the closing is that report, the
tests listed under Evaluation, a clean `tsc`, and the CI of macOS and Windows green on `6ba3181f`. Not
exercised: a message sent in each mode, a save that fails, and Windows; and the wording of the two notes
under the select was not discussed, so it stands as written. It reaches people with the next alpha. If the
falsifier fails there, this CR reopens.
