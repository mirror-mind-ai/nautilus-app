[< RS016](index.md)

# CR298: Stop the App's Own Node Processes Before an Update Installs

**Status:** captured 2026-11-26
**Driver:** Navigator
**Requested:** on 2026-11-26, from the Windows 11 virtual machine, updating alpha.27 to alpha.28: the installer stopped with "Error opening file for writing: ...\Nautilus for Mirror\mirror-host\node\node.exe" and the choice Abort, Retry or Ignore. The Navigator pressed Retry after waiting a few seconds and the installation went on ("O Repetir e esperar funcionou, era isso mesmo"). The same update from alpha.26 to alpha.27 had run without the error.

## Friction

The installer cannot overwrite `mirror-host\node\node.exe` while a process runs from it, and the app starts
several: the Mirror host, a long-lived Node process that exits when its stdin closes, and the Pi
invocations, which run through the same embedded Node. An ordinary quit stops the Pi invocations
(`shutdown_pi_invocations` runs on `RunEvent::ExitRequested`), but the Windows updater does not quit: after its
`on_before_exit` hook, which only calls `cleanup_before_exit()`, it exits the process with
`std::process::exit(0)`, and `ExitRequested` never fires. The installer starts at once and reaches
`node.exe` while a child may still be closing. A person who meets the dialog can only guess that waiting and
pressing Retry is the answer; one who presses Abort leaves a half-updated install, and Ignore leaves an old
Node beside the new app.

What is known and what is not. Known: the file was in use at that moment and a wait and a Retry cleared it, so
it was a matter of time. Not known: which process held it. The Navigator did not look at the Task Manager
before pressing Retry, so the host, an idle Pi process or something outside the app (a scanner reading the
new file) are not told apart. The account of the updater's exit path is read from the plugin's source
(`tauri-plugin-updater` 2.11.0) and from `main.rs`, not observed.

## Planned

Options, none chosen:

- **A. The app stops what it started, then installs.** The JS flow splits the plugin's `downloadAndInstall`
  into `download()`, a native command that runs `shutdown_pi_invocations`, stops the Mirror host and waits
  a bounded time for them to be gone, and then `install()`. It fixes the cause, is testable in Rust, and does
  not touch the installer. It protects only an update started from the app.
- **B. The installer stops them.** A pre-install hook of the NSIS installer ends `node.exe` processes whose
  path is under the install folder (PowerShell filtering on the path, not on the image name, so another
  Node on the machine is left alone). It protects every route, including `get.ps1` and an installer run by
  hand over a running app, but it is a new piece in the installer that has to be built on the Windows route
  and tried on a machine.
- **C. Both,** A as the cause and B as the net.

The recommendation is A first, with the bounded wait and a test that a stuck child does not block the update
forever, and B only if the error is seen again on a route A does not cover.

## What Changed

Nothing yet.

## Falsifier

On the Windows virtual machine, with the app opened, a message sent and answered (so Pi has run), an update
from one alpha to the next installs without the "Error opening file for writing" dialog. If the dialog
appears again, this CR reopens; if it appears with no Pi or host running, the cause is elsewhere.

## Evaluation

To be written with the change. First, a test that the update path stops the Pi invocations and the host before
the install is called.

## Validation Route

After the release that carries it, on the Windows virtual machine: open the app, send a message, then update
to the next alpha and read what the installer shows.
