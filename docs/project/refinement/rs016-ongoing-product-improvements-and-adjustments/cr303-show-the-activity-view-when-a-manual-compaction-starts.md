[< RS016](index.md)

# CR303: Show the Activity View When a Manual Compaction Starts

**Status:** done 2026-11-27 (`12ce59e8`), validated by the Navigator
**Driver:** Navigator
**Requested:** on 2026-11-27, in this Journey: "Dessa vez, eu gostaria que a ação manual de compactação também fizesse com que a aba activity seja mostrada, seguindo o mesmo comportamento quando enviamos um turno."

## Friction

Sending a turn switches the sidebar to the Activity view, so the work can be followed without choosing the view
by hand (CR290). A manual compaction is work of the same kind and is followed in the same place, but it does not
switch anything: the person who closes a chapter from the Tree or Recents has to open Activity by hand to watch
it.

What is read from the code (not observed in a running app):

- **Compaction is already drawn as work in Activity.** The Journey's row takes `compacting` from
  `compactingJourneyId` and says "Compacting the conversation" (`deriveJourneyActivityInputs` in
  `src/app/journeyActivityInputs.ts`). What is missing is only the switch.
- **The turn's switch is one line** in `generatePacket` (`src/app/App.tsx`): `setActivityView(true)`, after
  the run starts, only for a live turn that is not released from a queue, and through the setter that does
  not save. A collapsed sidebar stays collapsed because the Activity view is shown only when the sidebar is
  not collapsed (`activityShown`).
- **The manual compaction** is `compactSelectedConversationNow` in the same file. After its guards (a ready
  conversation with a session file that can send, and no compaction already running) it records the Journey's
  activity, starts the Journey's attention and sets the running "Context compaction" operation, and does not
  touch the view.

## Planned

One change, the same three choices as CR290, which is the behaviour the Navigator asked to follow:

- the switch is **not saved**: the view the person keeps by choice comes back on the next launch (the
  unsaved setter, not `chooseActivityView`);
- a **collapsed sidebar stays collapsed**, by construction;
- it happens **when the compaction starts**, after the guards, beside the other things that mark the start, so
  a click that the guards refuse switches nothing.

Two things to say before it is built, neither needing a decision now. The switch happens at the start, so a
compaction that ends at once with "Already compacted. There is nothing new to close into a chapter." has shown
Activity for a moment; that mirrors a turn that fails quickly, and the notice stays in the conversation. And
only the manual action is in scope: a compaction Pi runs by itself happens inside a turn, which has already
switched the view, and a message released from the queue after a compaction still switches nothing (CR290).

Test first, as CR290 did: a source guard in `journeyActivityView.test.tsx` that the call sits inside
`compactSelectedConversationNow` after the guards and the start of the operation, and that it does not use
the saving setter.

## What Changed

Built in `12ce59e8`, no Rust. One call, `setActivityView(true);`, in `compactSelectedConversationNow`
(`src/app/App.tsx`), after the guards and after the marks of the start (the Journey's activity and its
attention), and before the running "Context compaction" operation is set and the compaction awaited. It uses
the setter that does not save, as CR290 does, so the saved choice of view returns on the next launch, and a
collapsed sidebar stays collapsed because the Activity view is shown only when the sidebar is open.

Test: a source guard in `journeyActivityView.test.tsx` (two tests): the call appears once, after the guards
and the start marks and before the compaction is awaited; and the function does not use `chooseActivityView`
or `saveJourneyActivityView`. The first was seen failing before the line existed; the second passed from the
start, since it only forbids the saving setter. Whole suite: 399 files, 3337 tests passing; `tsc` clean.

## Noted at Review

- **Not seen in a running app.** What is tested is where the call sits and which setter it uses, not that the
  sidebar changes on a real compaction.
- As said in Planned, a compaction that ends at once with "Already compacted" has shown Activity for a moment.
- A compaction started while the Activity view is already shown changes nothing, and the Journey's row there
  says it is compacting from the same state as before.

## Falsifier

With the sidebar open on the Tree or Recents view, start a manual compaction: the sidebar shows Activity and the
Journey's row says it is compacting. With the sidebar collapsed, start one: it stays collapsed. After relaunching,
the view saved by choice is back. A click on the compaction that the guards refuse (the conversation busy, or a
compaction already running) switches nothing. If any of these fails, this CR reopens.

## Evaluation

The source guard holds the position and the setter, and the Navigator validated the change.

## Validation Route

In a dev build (`npm run tauri:dev`), with the sidebar on the Tree view and a conversation that has something to
compact: start the manual compaction from the conversation's menu and see the sidebar switch to Activity with the
Journey compacting. Collapse the sidebar and start another: it stays collapsed. Quit and relaunch: the view saved
by choice returns.

## Closing

Closed on 2026-11-27 on the Navigator's report: "cr validada. Pode fechar." It was two words and did not say
which build was run, nor whether the collapsed sidebar and the relaunch were tried. What stands behind the
closing is that report, the two source tests, the whole suite (399 files), a clean `tsc` and the CI green on
`97dcb31b`. Not exercised, as far as the report tells: a collapsed sidebar staying collapsed, the saved view
returning after a relaunch, and a click the guards refuse switching nothing. If the falsifier fails, this CR
reopens.
