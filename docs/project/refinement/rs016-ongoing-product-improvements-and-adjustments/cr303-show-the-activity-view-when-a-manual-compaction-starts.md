[< RS016](index.md)

# CR303: Show the Activity View When a Manual Compaction Starts

**Status:** captured 2026-11-27
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

Nothing yet.

## Noted at Review

Not yet reviewed.

## Falsifier

With the sidebar open on the Tree or Recents view, start a manual compaction: the sidebar shows Activity and the
Journey's row says it is compacting. With the sidebar collapsed, start one: it stays collapsed. After relaunching,
the view saved by choice is back. A click on the compaction that the guards refuse (the conversation busy, or a
compaction already running) switches nothing. If any of these fails, this CR reopens.

## Evaluation

Not yet evaluated.

## Validation Route

In a dev build (`npm run tauri:dev`), with the sidebar on the Tree view and a conversation that has something to
compact: start the manual compaction from the conversation's menu and see the sidebar switch to Activity with the
Journey compacting. Collapse the sidebar and start another: it stays collapsed. Quit and relaunch: the view saved
by choice returns.
