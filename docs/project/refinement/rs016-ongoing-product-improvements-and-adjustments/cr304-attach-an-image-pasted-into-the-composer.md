[< RS016](index.md)

# CR304: Attach an Image Pasted into the Composer

**Status:** done 2026-11-27 (merge `4fdcd7c0`), validated by the Navigator; not in a release when closed
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated, completed so that pasted images stay out of Git, and merged by the assistant
**Requested:** contribution [PR #34](https://github.com/mirror-mind-ai/nautilus-app/pull/34); merged on the Navigator's word, 2026-11-27 ("Execute o merge"), after the evaluation, with the corrections as commits on the contributor's branch and the light-theme commit kept inside this CR.
Merge commit `4fdcd7c0`.

## Friction

A screenshot, or an image copied from another program, could not be attached. An attachment is a file the
agent reads by its path, so the image had to be saved by hand and then picked with the paperclip.

## What Changed

Ctrl+V of an image in the Composer keeps it as a file and attaches it like any other file. The file is
`pasted/pasted-<YYYYMMDD>-<HHMMSS>.<ext>` in the folder the Journey works in, the one the header shows after
"Working in", resolved natively as a turn resolves it. A paste that carries plain text stays text, also when a
picture of the same content comes with it. Limits are said before anything is written.

Commits:

- **The paste** (`624b437a`, the author's): `src-tauri/src/pasted_image.rs`, a native command
  `save_pasted_image`, serialised and off the main thread and counted in the census (130 → 131). The name is
  made natively, the file is opened with `create_new` so nothing is replaced, the extension is what the bytes
  are and the dimensions must read, and images over 20 MB are refused, by the base64's length before
  decoding too. In the renderer: `src/domain/pastedImage.ts`, `savePastedImage` in
  `src/app/fileAttachmentStorage.ts`, an `onPaste` through `src/app/ComposerDraftInput.tsx` and the handler
  in `App.tsx`; `fileAttachmentLimitMessage` in `src/domain/fileAttachments.ts` gives every route one
  sentence for the limit of files.
- **The attachment error in the light themes** (`a9fec075`, the author's): `.context-attachment-error`, also
  the voice error line, joins the error lines that take the light themes' red; it read at 1.68:1 to 1.75:1.
  Guarded by `src/tests/attachmentErrorLightThemes.test.ts`.
- **Out of Git** (`6a463054`, the assistant's): a Journey's folder is often a Git repository, some of them
  public, and `pasted/` was an ordinary folder, so a pasted screenshot stayed there as an untracked file that
  `git add -A` would commit. The folder made for pasted images now carries a `.gitignore` holding `*`, so Git
  does not see the folder at all; a `pasted/` folder the person made is left as it is, and deleting the file
  lets the images be committed. When that file cannot be written the folder is removed, so the next paste
  makes both again. Test `the_folder_it_makes_is_kept_out_of_git_and_one_the_person_made_is_left_as_it_is`,
  seen failing first.

## Noted at Review

- **The app now writes inside the Journey's folder.** Before this it only read there. The PR asked for the
  call; the name `pasted/`, the file name, the 20 MB limit, and a removed attachment staying on disk are
  taken as the author proposed.
- **What the `.gitignore` also does.** Tools that honour it, a search through ripgrep for instance, skip the
  folder. An attached image is read by its path, so the attachment itself is not affected. Read from the
  code, not observed with an agent.
- **macOS.** Nothing in this change is Windows-only: the Composer's paste event fires on Cmd+V, the app's
  default menu has Edit › Paste, and the write uses the `image` crate on every platform. Whether the system
  WebKit hands a pasted screenshot to the page as a file, as WebView2 does, was not observed.
- **Left as they are.** While a previous paste is still being written, a second one says "Paste again once
  the agent has finished", which names the wrong reason. The comment on `save_pasted_image_at` says the
  Journey's folder is never created; that holds for the function, while the command resolves the workspace
  as a turn does and so makes the default folder when it is missing.

## Falsifier

In a dev build, a screen capture pasted into the Composer (Ctrl+V on Windows, Cmd+V on macOS) is kept as
`pasted/pasted-<moment>.png` in the folder the header names after "Working in", shows as a pending file with
its thumbnail, and reaches the agent, which can say what is in it. Pasted text stays text. In a Journey whose
folder is a Git repository, `git status` shows nothing for `pasted/`. An attachment error reads in the light
themes. If any of these fails, this CR reopens.

## Evaluation

Diff read in full. Tried merged with [CR305](cr305-attach-a-file-copied-in-explorer-by-its-own-path.md) and
[CR306](cr306-drop-the-context-reading-a-compaction-overtook.md) onto `main` at `fa765ca4` in a throwaway
worktree, with no conflict. Before the corrections: vitest 399 files, 3353 passed, 6 skipped; `tsc` clean;
`cargo test` 597 passed, 12 ignored; the frontend build for the macOS 12 target passed. After them: vitest
399 files, 3354 passed, 6 skipped; `tsc` clean; `cargo test` 598 passed, 12 ignored; the build passed. The
`.gitignore` content was checked with Git itself: `git status` and `git add -A` see nothing in the folder,
and after deleting the file the image shows as untracked. The PR's Windows and macOS CI passed on
`6a463054`. Not seen by the assistant in a running app; the author's checks were on Windows with a DEV build,
by paste events dispatched on the input and by a real Ctrl+V of a screen capture.

## Closing

Closed on 2026-11-27 on the Navigator's report: "Todas as 3 CRs validadas." It covered CR304, CR305 and CR306
together and did not say which build was run or what was tried in each. What stands behind the closing is that
report, the evaluation above (the three merged and tried on `main` with the whole suite, a clean `tsc` and
`cargo test`) and the CI green on the merged `main` (`a83b0f1c`). Not exercised, as far as the report tells: which system the paste was tried on (macOS WebKit handing a
pasted screenshot to the page as a file is the open question), `git status` showing nothing for `pasted/`
in a Journey whose folder is a Git repository, and the light-theme error line. If the falsifier fails, this CR reopens.

## Validation Route

1. `npm run tauri:dev`; open a Journey whose folder is a Git repository.
2. Take a screen capture to the clipboard and paste it into the Composer: a pending file with its thumbnail;
   the file is under `pasted/` in the folder named after "Working in".
3. Send a turn asking what the image shows.
4. In that folder, `git status` shows nothing for `pasted/`.
5. Paste a line of text: it goes into the field. Optional: switch to Daylight and paste while the agent
   works, so the refusal line shows in the light theme.
