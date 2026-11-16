[< RS016](index.md)

# CR156: Simplify the Context Map

**Status:** in_progress (pulled 2026-11-13; iterating in small steps, iteration 4 awaiting a look in dev)
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

