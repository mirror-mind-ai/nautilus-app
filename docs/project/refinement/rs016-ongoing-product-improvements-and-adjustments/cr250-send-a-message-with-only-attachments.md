[< RS016](index.md)

# CR250: Send a Message With Only Attachments

**Status:** merged 2026-11-12; awaits a dev check on macOS; not released
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #17](https://github.com/mirror-mind-ai/nautilus-app/pull/17); merged on the Navigator's word, 2026-11-12 ("Pode seguir o caminho que voce propoe").
Merge commit `66a165e3`.

## Friction

A Journey message with files selected and no text could not be sent: Send stayed disabled and the admission refused an empty request.

## What Changed

Send and admission accept a turn with pending files and no text, and admission now also waits while files are still being read. The prompt keeps the authority envelope with an empty `User request:` followed by the file block, so the projection persists exactly what the Navigator typed (nothing) and never the envelope or the absolute paths. Steering still requires text. Tests cover the prompt shape, the native projection and the guards.

## Noted at Review

The conversation shows the turn with no typed text; the files reach Pi through the existing file block.

## Falsifier

In dev, select a file, leave the field empty and press Send: the turn runs, Pi reads the file, and the stored user message is empty, not the envelope.

## Evaluation

Evaluated with CR244 to CR250; see CR244's Evaluation.
