[< RS028](index.md)

# CR205: Make the Deletion List Legible and Name the Journey in the Title

**Status:** built, awaiting the Navigator's validation
**Driver:** @alissonvale
**Delivery:** `ce22f759`
**Group:** D, follow-up to CR204

## Friction

In v0.4.0-alpha.4, on a light theme, the Delete Journey dialog's list is almost unreadable: "Will be
deleted from Mirror:", its items, the paragraph about Nautilus's files and the project-folder line
are pale grey on white (Navigator, 2026-11-06, screenshot of deleting the Journey `nova`). The
Journey being deleted appears only inside the sentence "Permanently delete Journey nova and
everything that belongs to it", with the same weight as the rest, so the one thing the person must
check before an irreversible act is the easiest to miss.

## First Investigation

`.journey-deletion-list` in `src/styles/app.css` sets `color: #b9cbd0`, a fixed colour chosen
against the dark theme, instead of a theme variable; the light themes inherit it unchanged. The
dialog's `<h2>` in `App.tsx` reads only "Delete Journey" for the delete mode.

## Outcome

- The list uses the theme's text colours (`--text` for what will go, `--text-muted` for secondary
  lines), legible on every light and dark theme.
- The Journey's name is the dialog's emphasis, likely in the title: "Delete Journey *nova*" or the
  name as the heading with "Delete Journey" above it. The exact form is decided at build.

## Acceptance

- On each light theme and each dark theme, every line of the deletion list is readable (contrast
  checked, not only by eye).
- The title names the Journey that will be deleted; a long name wraps instead of being cut.
- No other Journey dialog changes its title.
- A test fails if `.journey-deletion-list` goes back to a fixed colour.

## Delivered on `main` (`ce22f759`)

Built 2026-11-08 on the Navigator's word ("construa a CR218 e a CR205"), beside RS016's CR218.

- **The list takes the theme's ink.** `.journey-deletion-list` uses `var(--text)` in place of
  `#b9cbd0`, so the light themes give it `--light-text`.
- **The title is the Journey.** The delete dialog reads "Delete Journey" above and the Journey's
  name as the heading, wrapped when long (`overflow-wrap: anywhere`). The heading comes from
  `journeyAdminHeading` in `src/domain/journeyMutation.ts`; Create, Edit and Move keep theirs.

Where the build departs from the outcome: the folder's notes ("The files are deleted, not moved to
the Trash…") use `--text`, not `--text-muted`. They are the warnings of an irreversible act, not
quieter lines, and Daylight's `--light-muted` reads 4.41:1 on `#f6f7f9`, under the floor. The muted
ink stays only on the loading line, measured on the dialog's own surface.

## Validation

- Spec first: `src/tests/cr205DeletionLegibility.test.ts` (4), red before the change. It reads the
  stylesheet, refuses a fixed colour on the list, and measures contrast: `--light-text` at 4.5:1 or
  more on each light theme's surface and on `#ffffff`, `#f6f7f9` and `#f4f1ea`; `--light-muted` on
  each light surface; the dark `--text` and `--text-muted` on the dark dialog.
- 7 mutations, each caught; the one that first survived (the App's eyebrow left unwired) gained its
  check.

## Acceptance (as captured)

- On each light and dark theme, every line of the deletion list is readable.
- The title names the Journey that will be deleted; a long name wraps.
- No other Journey dialog changes its title.

