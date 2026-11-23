[< RS016](index.md)

# CR273: Open a File the Agentic Field Omits From the Chat

**Status:** done 2026-11-23 (`483a4f16`); validated by the Navigator in a dev build on macOS
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #24](https://github.com/mirror-mind-ai/nautilus-app/pull/24); merged on the Navigator's word, 2026-11-23 ("mescle os dois, abra a CR275"), in a round with PR #22.
Merge commit `483a4f16`.

## Friction

Clicking a file path in the conversation failed with "Artifact path is outside the visible Journey
workspace." when the file was inside the Journey folder but under a folder the Agentic Field leaves out
of its tree: a dot folder (`.tmp`, `.github`), `node_modules`, `dist`, `build` and the rest, or a dot
file such as `.env.example`. The message was wrong, since the file is inside, and nothing in the chat
could open it. Agents write scratch and build output to exactly these folders and name the files.

## Cause

`classify_chat_local_reference` sends every path inside the Journey folder to the Agentic Field, and
the Field refuses what its tree omits (`omitted_workspace_component`).

## What Changed

A path inside the Journey folder that names something the Field omits now takes the route a file
outside the Journey folder already takes: `external_file`, opened in the system's default application.
Files the Field shows still open in it; a missing file, a folder and a path that steps out with `..`
are still refused. No frontend change.

## Noted at Review

- **The default application opens any extension.** On macOS a `.command` file runs. This already held
  for a file outside the Journey folder; this change extends it to the omitted folders. Refusing
  executable files on both routes is worth its own CR.
- The PR's Windows CI was red only on `legacyWebKitSource.test.ts`, which CR270 fixed; its base was
  older than that fix.

## Falsifier

Ask an agent to name a file inside `.tmp` of the Journey folder and click it: it opens in the default
application with no notice. A file the Field shows still opens in the Field. If the click still says
the file is outside the workspace, this CR did not do its work.

## Evaluation

Read in full. New Rust test `routes_files_the_field_omits_to_native_opening` (relative, full and `~/`
paths, a regular folder from the omitted list, a dot file, and the three refusals). Merged together with
PR #22 in a throwaway worktree on `df7df4ec`: vitest 3127 passed, `tsc` clean, cargo 567 passed. The
merged `main` has the same tree as the tested worktree.

Validated by the Navigator in a dev build on macOS, 2026-11-23 ("A validação deu certo"). Closed as done; not yet in a release.
