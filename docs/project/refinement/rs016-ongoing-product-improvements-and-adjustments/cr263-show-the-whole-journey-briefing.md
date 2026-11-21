[< RS016](index.md)

# CR263: Show the Whole Journey Briefing

**Status:** done 2026-11-21 (`adee5a2a`, `825e0884`); design approved by the Navigator ("Desenho aprovado. vamos começar. Pode manter o título."), Core CR217 released as `mirror-mind@0.44.2`, validated in a dev build by the Navigator
**Driver:** Navigator
**Requested:** a change request on 2026-11-21: the Journey Briefing panel of the Agentic Field must show the Journey's whole briefing, rendered as markdown, "o mesmo texto que o runtime entrega ao agente a cada turno".

## Friction

The panel showed one flattened line. A Journey whose `identity` carries a description, a field, its
trails and a current focus showed only its description, with the paragraph breaks gone, so the
panel could not be used to read or check what the agent is given.

## Cause

`App.tsx` passed `selectedJourneyItem.description` to the panel as the briefing. In the Core,
`readJourneyTree` builds `description` from the `## Description` or `## Descrição` section alone,
cuts it at the next `## ` and collapses it to one line (`ts/src/journey/journeyTree.ts`). No call
answered with the rest of the content, although `getIdentityContent(db, "journey", key)` is what
the runtime delivers on every turn.

## Plan

Checked first, as the request asked: no read the host already used returned a Journey's `identity`
content (`readPersona` exists for personas; for Journeys there was only the tree). So the smallest
extension of the CV24.DS3 contract was designed and approved before any code:

- **Core CR217 (`mirror-mind@0.44.2`).** `readJourney(dbPath, { journeyId })` answers
  `{ id, name, content, updatedAt }`, with `content` the identity row uncut. Read-only, additive,
  `readJourneyTree` and `description` untouched, `DESKTOP_API_VERSION` stays 1. A separate read and
  not a field on every tree node, because the tree is read on the turn path, on every sidebar
  reload and on deletion and is cached in full each time, while the 67 Journeys' contents add up to
  about 160 KB that only this panel needs.
- **The app.** The pin moves to 0.44.2, the host exposes `readJourney`, a new command
  `read_journey_briefing` answers one Journey's content, and the panel renders that content with the
  markdown reader it already uses for a file.
- **What the panel leaves out.** Only the title line and the `**Status:**` and `**Stage:**` lines
  that come before the first `## ` section: the Journey's name is in the header and its status and
  stage are shown by the app elsewhere. The same lines inside a section are the author's text and
  stay. The cut is made in the app, not in the Core, because the Core must answer the text the
  agent receives and what a screen shows is a screen's decision.
- **The `Description` heading stays**, also for a Journey that has only a Description, for the same
  look in every Journey (the Navigator's choice).
- **Empty and failing.** A Journey with nothing left to show keeps "This Journey records no briefing
  text yet." A read that fails says so and why, and never falls back to the description, so a
  partial briefing is not shown as if it were whole.

## What Changed

- **Pin** (`mirror-host/pin.json`, `vendor/mirror-host/mirror-mind-0.44.2.tgz`): `mirror-mind@0.44.2`,
  commit `4ceb76d9`, sha256 `8a6d482f…`, the registry's sha512 `Ta2dQje1…` checked on download. The
  0.44.1 tarball is removed. DS-005 records the pin.
- **Host and bridge.** `mirror-host/host.mjs` gains `readJourney`. `src-tauri/src/journey_briefing.rs`
  has the command `read_journey_briefing` (serialised and off the main thread, the id sanitised
  before Mirror is asked, an unknown Journey refused in words), listed in the command census
  (126 to 127), with a test through the real Core.
- **Domain and storage.** `src/domain/journeyBriefing.ts` (`briefingBodyOf`,
  `sanitizeJourneyBriefing`, `BriefingReadStatus`) and `src/app/journeyBriefingStorage.ts`.
- **Panel.** `JourneyDocumentationBrowser.tsx` renders the content cut by `briefingBodyOf`, and
  says "Reading the briefing from Mirror…" or "Mirror could not give this briefing." with the
  reason instead of showing an old or partial text.
- **App.** `App.tsx` reads the briefing when the Field is shown and when the Journey changes, keyed
  also on a nonce the panel's Reload bumps, so an edit made with `mirror identity set` shows
  without a restart. An answer that arrives after the Journey changed is dropped. The canvas
  surface keeps `description` as its language anchor, and so do the sidebar and the search.
- **Tests.** `cr263JourneyBriefing.test.tsx` (14: the cut, a several-section briefing rendered as
  headings, paragraphs and a list, the states, the reads and the reload), `cv010MirrorHost.test.mjs`
  (the method and an end-to-end read), the Rust tests, and the test of CR260 iteration 5 whose
  Reload wiring changed.

## Conscious Exclusions

- **Editing the briefing from the panel.** It is read only; `mirror identity set` stays the way.
- **Watching Mirror for a change.** The read is a gesture: opening the Field, changing the
  Journey, Reload.
- **Changing `description`** in the tree or any surface that uses it.
- **The sidebar's description after the panel's Reload.** The panel's Reload now asks only for the
  briefing; the sidebar's own Reload still refreshes the registry.

## Falsifier

In a Journey whose `identity` has several sections, the panel shows each section and a list as a
list. After `mirror identity set journey <id>` the panel's Reload shows the edit with no restart.
If the panel shows only the description, shows the title, Status or Stage ahead of the sections,
or shows a briefing after the read failed, this CR did not do its work.
