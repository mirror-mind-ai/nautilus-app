[< RS016](index.md)

# CR295: Say Before an Update Closes the App That It Will Come Back by Itself

**Status:** done 2026-11-28 (`76904479`); released in alpha.28 on 2026-11-26 on macOS and Windows; validated by the Navigator on 2026-11-28
**Driver:** Navigator
**Requested:** on 2026-11-26, after the first Windows update: "Abra a CR mas ajuste a mensagem para" the sentence below, in English.

## Friction

On Windows the update runs outside the app. `downloadAndInstall` of the updater plugin downloads and verifies
the archive, starts the NSIS installer with `/P /UPDATE /R` and exits the process at once; the installer
reopens the app when it finishes. Between the app disappearing and the installer's window showing there is a
silent gap (the installer is an unsigned file of about 33 MB that Windows has to check and unpack), and
nothing on screen says that the app is coming back.

Seen on 2026-11-26 in the Windows 11 virtual machine: the update from alpha.26 to alpha.27 was offered,
downloaded and installed, and the app opened by itself afterwards. In the gap the Navigator opened the app
again from its desktop shortcut (target `...\Nautilus for Mirror\mirror-desktop.exe`) and then saw the
installer's window, which looked like a second installation started by that click. It was the update's own
installer, not a second one (the Navigator confirmed the order of events); the code has no path from
launching the app to running an installer. The defect is the silence, which invites the second launch.

What the app says today while an update installs: "Downloading verified update…" with the byte count in the
version chip's popover, "Preparing verified update…" in Settings › Updates, and "Installing update…" when the
download ends. On Windows the process exits inside the plugin's call, so the last message has at most an
instant to show. Read from `SelfUpdateNotification.tsx`, `SelfUpdatePanel.tsx` and the plugin source; the
instant is not measured.

## What Changed

One sentence, shown from the click on Update until the app closes, in both places that start an update (the
chip's popover and Settings › Updates), as a note beside the progress text:

> Nautilus will close and reopen by itself in a few minutes. There is no need to open the app again until this process finishes.

The wording is the Navigator's. It is true on macOS too (the app closes and relaunches), so it is not
limited to Windows. It lives in one component, `UpdateRestartNote`, with the sentence as one exported constant, used by both
surfaces, so the two cannot drift. It renders beside the progress text, inside the branch that already
renders it only while the state is `installing`; the progress texts are unchanged. Requested on the same
turn as the capture and built on the Navigator's "implemente a CR295" (2026-11-26).

## Noted at Review

The sentence disappears with the window, so it can only be read during the download. On a fast connection
that is seconds; it cannot stay on screen after the app closes, and the installer's own window is the only
thing left then. A line inside the installer would need a customised NSIS template, which is a larger change
and is not proposed here.

## Falsifier

On the next Windows update of an installed app, the sentence is visible from the click on Update, in the
chip and in Settings › Updates, and the person does not open the app again while the installer runs. If the
app closes before the sentence can be read, or the person still opens it again, this CR reopens and the
gap needs a different answer.

## Evaluation

Test first, `cr295UpdateRestartNote.test.tsx` (4 tests, red while the component did not exist): the
constant is the sentence above and has no dash; the component renders it as a status note; the notification
and the panel each render it once, inside their `installing` branch (the `installing` state is internal to
both, so this is asserted on the source, as the suites of this repository do for such states); neither
surface renders it in the `available` state. The suites of the two surfaces and of the update recheck pass
and `tsc` is clean. The full suites belong to the release's `prepare`.

## Validation Route

1. Not possible in a dev build, which has no update channel to install from; the render tests cover it.
2. After the release that carries it, on the Windows virtual machine with the previous alpha installed, click
   Update and read the sentence while the download runs; do not open the app again; confirm it reopens by
   itself.

## Closing

Closed on 2026-11-28 on the Navigator's report for CR295 to CR299, with CR298 excluded: "Da CR 295 até a 299 foram todas verificadas e estão funcionando", then "exceto a 298". CR298 has no build and stays captured. What stands behind the closing is that report and the release in alpha.28 on macOS and Windows. The report does not say which steps of the Validation Route were run, or on which system. Not stated, so not exercised as far as the report tells: the sentence read during a Windows update's download, and whether the app was opened again in that gap. If the falsifier fails, this CR reopens.
