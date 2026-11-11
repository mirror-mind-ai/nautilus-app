[< RS016](index.md)

# CR235: Show a Medal Only After a Choice

**Status:** validated on macOS 2026-11-11 by the Navigator ("CR235 validada"); not published
**Driver:** Navigator, following review of PR #4
**Implementation:** `549e1ca9`

## Decision

A persona id matching a bundled medal filename is not an appearance choice. Automatic lookup also makes presentation depend on naming conventions and prevents removing the implicit image. Keep the gallery from CR234, but never infer a persona's image from its id. This adjustment was agreed with the Navigator and announced in [PR #4](https://github.com/mirror-mind-ai/nautilus-app/pull/4#issuecomment-6799126883) before merging.

## Change

`PersonaSidebarSection`, `Speech` and `PersonaForm` show only the saved persona image. Without one they retain the diamond, even for a known medal id. The gallery, allowlisted native command and per-home persistence remain unchanged. Removing a chosen medal uses the existing image removal path and returns to the diamond. The Remove image button's existing saved-image enablement now agrees with the preview. Corrected the gallery callback's indentation.

No data migration, Core change or production-home mutation is required. Previously chosen medals and imported images remain saved choices.

## Evidence

TDD: two new behavior assertions failed against the original PR's automatic defaults before implementation. The focused suite passes 23 tests across medal, image and sidebar specs. Three mutations reintroducing an automatic image independently in preview, sidebar and speech were all caught. TypeScript clean; full vitest 348 files, 2,948 passed and 1 skipped; build passed. This checkout has the materialized runtime, unlike the earlier evaluation worktree, so two preflight tests now run. Rust code is unchanged from the evaluated merges.

## Falsifier and Dev Validation

Run the canonical dev command from the main checkout, not the earlier evaluation worktree. Open a persona whose id matches a bundled medal name: without a saved image it must show the diamond in the sidebar, speech and preview. Choose a medal from the gallery, confirm it appears consistently and survives reopening, then remove it and confirm the diamond returns. Imported images remain usable and other personas remain unchanged. The Navigator confirmed dev validation on macOS: "CR235 validada". This closes CR235's field validation, not CR233's Windows checks or release publication.
