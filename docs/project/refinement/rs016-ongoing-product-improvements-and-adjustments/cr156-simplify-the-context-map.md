[< RS016](index.md)

# CR156: Simplify the Context Map

**Status:** in_progress (pulled 2026-11-13; iterating in small steps, iterations through dev; paused machinery removed)
**Driver:** —
**Delivery:** —
**Navigator priority:** 8 of 8 (intake 2026-10-12)

## Friction

**Navigator report (2026-10-12):** *"simplificação do context map"*

## What the Surface Is Today

`Context Map` is the operational surface whose persisted id is still `artifacts`
(`OperationalWorkspaceSwitcher.tsx:16`). It renders `JourneyDocumentationBrowser`
(`App.tsx:5967`) with ten props: the Journey's id, name, root path and briefing, the conversation
name, an `admissionAuthority`, a requested relative path, a request id, an `expandPreviewOnReveal`
flag, and a settle callback.

Three of those exist to serve navigation requests arriving from elsewhere in the application, each
guarded by the same `artifactNavigationRequest?.journeyId === selectedJourneyItem.id` comparison
repeated four times.

## This Reverses the Direction CR105 Chose

CR105 built this surface by moving in the opposite direction, deliberately:

> The Artifact tab is a file-oriented surface. The desired surface is an Agentic Map: a navigable map
> of the agent's working field rather than a passive list of artifacts.

Its own comment in the switcher records the same intent: *"the surface stopped being a list of
artifacts and became a partial view of what effectively entered the agent's context."*

So the request is not to finish CR105 — it is to pull back from part of it after living with it.
**That is the most valuable kind of report and the easiest kind to implement wrongly**, because the
thing to remove is the thing someone argued for.

## What I Deliberately Do Not Know

**"Simplification" has no established meaning here yet, and I am not going to supply one.** The
surface could be too dense, too deep, too slow, showing the wrong things, or showing the right things
in the wrong order — and those lead to four different and partly incompatible changes. Choosing on my
own would be me redesigning the Navigator's working surface from a one-line brief.

So this CR is captured with its First Investigation beginning at the Navigator rather than at the
code. That is the honest state of it, and the reason it sits last in their own ordering is consistent
with it being the least specified.

## Outcome

The Context Map shows what the Navigator actually uses it for, with whatever it does not earn its
place by removed — and the removals are named, because removing a view is a real loss of visibility.

## First Investigation

- **The Navigator names it — deferred to selection (2026-10-12).** Asked up front, the answer was
  *"São várias coisas. Melhor definirmos o escopo no pull da CR."* That is the right call and is
  recorded rather than treated as an unanswered question: the scope is set when this CR is pulled,
  not now. **This CR must not be selected before that conversation happens**, because every slice
  below depends on it.
- **Is it a density problem or a performance problem?** *"Simplificação"* can mean both, and this
  session has an open CR about a surface feeling slow for a mechanical reason
  ([CR149](cr149-keep-the-composer-responsive-while-a-turn-is-finishing.md)). If the Context Map is
  slow rather than busy, the repair is not a redesign and the premise above is wrong.
- **What does `admissionAuthority` buy?** CR105 added it so the map can tell availability from
  admission, and says that without it *"the map honestly says it has none."* Whether that distinction
  is one the Navigator uses decides whether a large part of the surface is load-bearing or ceremony.
- **Can the four repeated navigation guards collapse?** The same comparison appears four times for
  one concept. That is a simplification of the code with no effect on screen, and it can be done
  independently of every product question above — which makes it the one slice that is safe to do
  first.
- **Does the persisted id stay `artifacts`?** It is selection state, and CR105 kept it on purpose.
  Renaming it would be a migration for a cosmetic gain.

## Boundaries

Does not touch `Agent's Canvas`, `Ariad` or `Conversation`. Does not change what enters the agent's
context, how attachments are admitted, or how files are read — this is about presentation. Does not
remove the surface. Every removal must be named rather than quietly dropped.

## Provenance

`OperationalWorkspaceSwitcher.tsx:10`–`:22` and `App.tsx:5967`–`:5991` read on 2026-10-12, with
CR105's framing quoted from its own document. The desire to simplify is the Navigator's report; **no
criterion for it has been established**, and this document does not invent one.

## Parked (2026-11-03)

Parked by the Navigator: a future demand, not yet recorded, will absorb this CR. Unpark it
when that demand is captured, and merge it there.

The demand that absorbs it is [CV-012](../../roadmap/cv-012-a-canonical-core-and-extensions/index.md) (Navigator, 2026-11-03).

## Pulled (2026-11-13)

The Navigator pulled this CR to define its scope, which is what the First Investigation asked for
before any slice. It leaves the park because the demand it was parked for, CV-012, has since
delivered its first Delivery Story, and that changed the surface this CR is about:

- The surface is no longer called Context Map or Artifacts in the interface. It is **Agent Field**
  (`OperationalWorkspaceSwitcher.tsx:20`), and it is an **extension, off by default**
  (`agentField: false` in `DEFAULT_APP_EXTENSIONS`), turned on in Settings, Extensions
  (CV-012.DS-001, alpha.14). A person who never enables it never meets it.
- Its code is the same one this CR describes: `JourneyDocumentationBrowser.tsx`, 758 lines.

So "simplify" now has a sharper question to answer first: simplify what the Navigator sees when the
extension is on, or what it costs the app to carry it. The scope conversation starts there. Nothing
is decided, and no slice is selected until it happens.

## Iteration 1 (2026-11-16, `d6ee88af`)

The Navigator chose to iterate on this CR instead of listing the scope first: one small change, look
at it, then the next, all under CR156. The first one removes text that restated what the screen
already shows, with no change to what the surface does:

- the standing note under the tree toolbar ("Private and high-volume generated internals are hidden;
  release bundles remain available"), and its styles;
- the labels "Artifact content" and "Details and metadata" above an artifact's own title.

Kept: the tree's label "Workspace structure", the reload control, the Expand preview toggle and the
admission panel. The hidden internals stay hidden; only the sentence saying so is gone.

Tests: `cr156FirstSimplification` (red before the change), and the older reload test now asserts the
note is absent. vitest 364 files, 3037 passed, 1 skipped; `tsc` clean.

Next: the Navigator looks at it in dev (Settings, Extensions, Agent Field on) and says what to
change next.

## Iteration 2 (2026-11-16, `cf1aee18`)

The Navigator asked to hide two things, as a `software-engineer` turn: the whole **Context** header
at the top of the surface, and the whole **Admitted context** section inside the left card. Both are
now hidden at their render sites in `JourneyDocumentationSurface`; the surface is the workspace tree
and the artifact viewer.

What this leaves unreachable, named rather than silently dropped: `AgenticMapHeader`,
`AgentFieldRegion` and, because the only way to pick a territory was that section, the `TerritoryPage`
detail that showed on the right when a territory was selected. The components and the
`selectedTerritory` state are left in place and still work when given props (their tests now render
them directly), so restoring or trimming them in a later iteration is a small diff. If the next looks
confirm the direction, a follow-up removes the dead machinery in one deliberate commit.

Tests: `cr156Simplification` guards that the surface renders neither component; `agenticMap` asserts
the surface hides both the header and the section, and keeps the component logic under direct-render
tests. vitest 364 files, 3040 passed, 1 skipped; `tsc` clean. No Rust changed.

## Iteration 3 (2026-11-16, `540e6953`)

Reading the Agentic Field concept in the Nautilus Agentic Framework (Journey
`vida-criativa/nautilus/agentic-method`, `docs/method/agentic-field.md`): the field is the composed
working space where human and agent keep context, artifacts, decisions and constraints available to
conduct value, and the first materiality it lists is the Journey description. The briefing is the
ground of the field, not chrome. Hiding the Admitted context section in iteration 2 removed the only
path to it, so this iteration brings the briefing back on its own terms.

A fixed **Briefing** entry sits at the top of the left card, above the file workspace, selected when
the surface opens. It renders in the same viewer as a file, as markdown, with **no presence marker**
(the Navigator's choice: the briefing is the ground of the field, not material that enters and leaves
it) and none of the old admitted-context notes. Selecting a file still takes the viewer; a changed
Conversation returns it to the briefing. The other three territories stay paused as before.

A light-theme contrast fix came with it. The entry is a transparent text button, and the light
families paint every such button white unless it is on an exclusion list. The Briefing label was
white on a light surface until it joined that list and the light-text list, exactly the failure
CR105 and CR151 recorded. Caught by a dev look and a before/after screenshot, not by the suite; the
`themeTokenContract` guard only derives controls coloured with a `var(--text…)` token, and this one
carries a literal, so the guard did not require it.

Tests: `agenticMap` renders the Briefing entry without a marker, opens on the briefing as markdown
without the notes, and shows a selected file instead; the old briefing page stays covered by a
direct-render test on the paused TerritoryPage; `cr156Simplification` guards the default and the
wiring. vitest 364 files, 3046 passed, 1 skipped; `tsc` clean. No Rust changed.

## Iteration 4 (2026-11-16, `77400ff3`)

Two findings from the Navigator's look in dev.

The workspace root folder was not selectable. Its label was a bare element while every other folder
is a button. It now selects a root folder node (empty relative path, shown as "Journey root" in the
metadata) and survives a tree reload.

The "Preview unavailable" heading had no contrast in the light themes: it kept its dark-theme
near-white colour because `.journey-documentation-unavailable strong` was missing from the light-text
list. Fixed there. The new root button is a transparent text button, so it joined the white-ink
exclusion list too, the third time this pattern has caught a new control.

Tests: `cr156RootAndPreviewContrast` covers the root node, the button, the selected state and both
stylesheet lists. The stylesheet guards read the file with `readFileSync`, since `?raw` hands vitest a
processed stylesheet. Both were confirmed red without the CSS change. vitest 365 files, 3051 passed,
1 skipped; `tsc` clean.

## Iteration 5 (2026-11-16, `f15dd274`)

The presence marker beside each file and the "Context presence" panel in the file viewer were the
last of the admission surface still visible after iterations 1 to 4. Both are hidden at the
Navigator's request. Nothing admission-related renders on the surface now: no Context header, no
Admitted context section, no tree markers, no viewer panel. The workspace is a plain file tree with
a Briefing entry on top.

The machinery is paused, not deleted, like the chrome before it: ContextPresenceMarker and
AdmissionPanel in `AgenticMapField`, the `presenceByRelativePath` and `selectedRead` plumbing, and the
`admittedContext` derivation all stay in place for an easy revert and for the single cleanup commit
that will remove the whole paused admission surface at once. The one genuinely dead local, the per
node presence computation, is gone.

The paused components keep their coverage through direct renders in `agenticMap`: ContextPresenceMarker
for the three presence shapes and labels, and AdmissionPanel for a read during a turn, a read lost to
compaction, and an artifact never opened. New guards assert the surface renders neither the marker nor
the panel. vitest 365 files, 3053 passed, 1 skipped; `tsc` clean. No Rust changed.

With the admission surface now fully dark, the next deliberate step is one commit that removes the
paused machinery, deciding explicitly what, if anything, the three paused territory pages and the
admitted-context derivation should become.

## Iteration 6 (2026-11-16, `50abcfd7`)

Two folder requests from the Navigator. Clicking a folder showed "Preview unavailable" instead of
what the folder holds, and a folder had no counterpart to the file viewer's "Open file" button.

A selected folder now opens as a listing of its own entries in the viewer, folders first then files,
the order normalization already guarantees. Each entry is a button that selects like a tree node, so
the viewer browses one level at a time. A folder collapsed in the tree loads its children first,
under the same content request counter that guards a file read, and an empty folder says so rather
than leaving the viewer blank.

The viewer gains an "Open folder" button beside "Open file". A new `open_journey_folder` command
resolves the bounded folder through the artifact resolver, or the workspace root for the empty path
the root entry carries, and hands it to the OS file manager with `open_path`. It stays on the main
thread with the other hand-off commands (`open_journey_document`, `reveal_journey_artifact`) and takes
its place in the command census (121 to 122).

The folder entry is another transparent text button, so it joined the light-text and white-ink
exclusion lists before it could appear white on a light surface; the "Open folder" button reuses the
already-excluded open-action styling. Both themes were checked by computed colour, the entry reading
`#1f2937` on daylight and `#cfe0e4` on a dark family.

Tests: `journeyDocumentationBrowser` renders the listing, the empty-folder note and the Open folder
action and guards the wiring; `journeyDocumentationStorage` covers the new command; a Rust test covers
`resolve_journey_folder_at` for a folder, the root and a rejected file. vitest 365 files, 3057 passed,
1 skipped; cargo 550 passed, 11 ignored; `tsc` clean.

## Cleanup (2026-11-16, `ec69c066`)

The direction held through six iterations, so the paused admission and context-map machinery is now
removed rather than kept for a revert. `src/app/AgenticMapField.tsx` (the Context header, the field
region, the admission panel, the presence marker and the four territory pages) and the
`src/domain/admittedContext.ts` derivation are deleted, with their tests `agenticMap`,
`agenticMapLegibility` and `admittedContext`.

`JourneyDocumentationBrowser` no longer derives admission from the Conversation's session, threads a
presence map through the tree, or carries a territory state. The Agent Field is now a Briefing entry
above a plain file tree, and the viewer shows the briefing, a selected file or a selected folder.
What was a four-value `selectedTerritory` is a `briefingSelected` boolean, and the
`admissionAuthority`, `journeyRoot` and `conversationName` props are gone; `App` stops computing the
admission authority. `inspectDedicatedPiTranscript` stays, since `App` still uses it for other reads.

The change is 40 lines added against about 2046 removed. vitest 362 files, 3005 passed, 1 skipped;
`tsc` clean; no Rust changed. The `cr156Simplification` guard now asserts the admission names never
return to the surface, and `cv013` drops the two checks that guarded the deleted envelope display
while keeping the backend marker-reading contract.

CR156 is ready to close as done once the Navigator confirms the cleaned field in dev.

## Naming (2026-11-16, `505baa05`)

Two Navigator renames. The briefing entry and its viewer title now read "Journey Briefing" on both
panels. The tab and the Settings extensions section now read "Agentic Field", the Nautilus framework's
own name for the surface, correcting the 2026-11-04 "Agent Field". The persisted `agentField` extension
key and the `artifacts` selection id are untouched, since they are state rather than labels. A render
test guards the briefing wording; the extension and switcher tests now expect "Agentic Field". vitest
362 files, 3006 passed, 1 skipped; `tsc` clean; no Rust changed.

## Settings copy (2026-11-16, `d1021a10`)

The Agentic Field extension description in Settings still named the admission view the cleanup
removed. It now reads "The Journey's briefing and the files in its workspace, the ground the agent
works from.", matching what the surface became. No test pinned the old copy; vitest 362 files, 3006
passed, 1 skipped.

