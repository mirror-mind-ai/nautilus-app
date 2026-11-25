[< RS016](index.md)

# CR290: Show the Activity View When a Turn Is Sent

**Status:** in_progress 2026-11-25 (`680322f9`); on main, awaiting a look in a dev build on macOS
**Driver:** Navigator
**Requested:** on 2026-11-25, with CR289: "Eu quero que o envio de um turno dispare uma mudança automática para tornar visível a aba activity na sidebar."

## Friction

Sending a turn starts work that is followed from the sidebar, and the view that shows work (Activity) had
to be chosen by hand each time.

## What Changed

A live turn sent from the composer switches the sidebar to the Activity view (`generatePacket` in
`src/app/App.tsx`). Three choices were made without asking, each one line to change:

- the switch is **not saved**: the view the person keeps by choice comes back on the next launch;
- a **collapsed sidebar stays collapsed**, since its toggle is a deliberate focus mode and the Activity tab
  itself would have expanded it;
- a message **released from a queue** after a compaction switches nothing: the person did not send it then.

No Rust.

## Falsifier

With the sidebar open on the Tree view, send a message: the sidebar shows Activity. With the sidebar
collapsed, send one: it stays collapsed. After relaunching, the view saved by choice is back. If any of
these fails, this CR reopens.

## Evaluation

Test first (red, then green) as a source guard in `journeyActivityView.test.tsx`: the call sits after the
run starts, only for a live turn that is not queued, and does not use the saving setter. Full suites as for
CR289. Not run in a dev build by the assistant.

## Validation Route

1. `npm run tauri:dev`, sidebar on Tree.
2. Send a message: the sidebar switches to Activity.
3. Collapse the sidebar and send another: it stays collapsed.
4. Quit and relaunch: the view saved by choice returns.
