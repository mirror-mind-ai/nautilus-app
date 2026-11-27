[< RS016](index.md)

# CR305: Attach a File Copied in Explorer by Its Own Path

**Status:** in_progress 2026-11-27 (merge `724c2a88`); not in any release; not yet seen in the app by the Navigator
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #35](https://github.com/mirror-mind-ai/nautilus-app/pull/35), stacked on
[PR #34](https://github.com/mirror-mind-ai/nautilus-app/pull/34); merged on the Navigator's word, 2026-11-27
("Execute o merge", with #34 and #36 in the same batch), after the evaluation below.
Merge commit `724c2a88`.

## Friction

A paste hands the page a copied file's bytes and its name, never where the file is. With
[CR304](cr304-attach-an-image-pasted-into-the-composer.md) alone, an image file copied in the file manager
would be kept as a copy under `pasted/`, and any other file could not be pasted at all.

## What Changed

On Windows, a file copied in Explorer and pasted into the Composer is attached where it is, as a dropped file
is: the same inspection, thumbnail and limit of files, nothing copied and nothing written. Two files copied at
once are both attached. A screen capture, which has no file, is still kept as in CR304. A pasted file with no
path behind it that is not an image is refused in words: "This file could not be attached by pasting. Use the
paperclip, or drop the file on the window. Nothing was attached."

Commits:

- **The file list** (`15c2ece5`, the author's): `src-tauri/src/clipboard_files.rs`, a native command
  `inspect_clipboard_files`, serialised and off the main thread and counted in the census (131 → 132). It
  reads the clipboard's `CF_HDROP` block, parses it by hand (`paths_in_drop_block`, pure, so it is tested
  without a clipboard) and keeps the paths whose names are the names the paste carried, every one of them
  or none (`paths_named`), so a clipboard that changed between the paste and the read attaches nothing by
  path. The paths go to `inspect_file_attachments_at`, the route of dropped files. `src-tauri/Cargo.toml`
  turns on three more modules of `windows-sys`, already in the tree; `Cargo.lock` is unchanged. In the
  renderer, `filesInPaste` replaces `imagesInPaste`, and `attachPastedFiles` asks for the paths first, then
  refuses, then keeps images.
- **CR304's correction** (`473699cd`, a merge by the assistant): the branch takes `6a463054`, so its CI ran
  with the code that was merged and neither branch's history was rewritten.

## Noted at Review

- **Windows only, by design.** `clipboard_drop_block` answers nothing outside Windows, so on macOS a pasted
  file falls back to CR304. What a file copied in Finder gives the page there was not observed: if the system
  WebKit hands its bytes, an image is kept as a copy under `pasted/` and another file gets the refusal above;
  if it hands only the name as text, the name is pasted into the field. Giving macOS the same behaviour means
  reading the pasteboard's file URLs; that would be its own CR.
- **The one `unsafe` block** opens the clipboard with a short retry, copies the block while it is locked,
  unlocks and closes it on every path that opened it, and refuses a block over 4 MB. It reads paths only and
  answers only with those the paste itself named.
- **No new authority.** A file attached by its own path is read by the agent where it is, as a dropped file
  already is.
- **Left as it is.** The comment on `paths_in_drop_block` says a block cut short answers with what could be
  read whole, or nothing; it answers nothing, as its test says.

## Falsifier

On Windows, in a dev build: a PDF copied in Explorer and pasted into the Composer is attached with its own
path and nothing is written under `pasted/`; two files copied at once are both attached; a screen capture is
kept and attached as in CR304; pasted text stays text. On macOS a paste from Finder does not break the field:
it attaches, refuses in words, or pastes text. If any of these fails, this CR reopens.

## Evaluation

Diff read in full, against PR #34. Tried merged with CR304 and
[CR306](cr306-drop-the-context-reading-a-compaction-overtook.md) onto `main` at `fa765ca4`; the results are
in CR304. The four Rust tests of `clipboard_files` are pure and pass on macOS; the clipboard read compiles
only on Windows, where the PR's CI passed on `473699cd`, as did macOS. The Windows path cannot be exercised on
the assistant's Mac and was not. The author's evidence is on Windows: paste events dispatched on the input,
and a real Ctrl+V reported by the person testing for a PDF, two files at once and a screen capture.

## Validation Route

1. On Windows, `npm run tauri:dev`; in Explorer copy a PDF, then paste into the Composer: attached, with its
   own path; nothing new under `pasted/`.
2. Copy two files at once and paste: both attached.
3. Win+Shift+S, then paste: kept under `pasted/` and attached.
4. On macOS, copy a file in Finder and paste into the Composer; note what happens.
