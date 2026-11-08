[< RS016](index.md)

# CR215: Read a Table Whose First Header Cell Is Empty

**Status:** done
**Driver:** assistant
**Delivery:** `main` (`975cd536`), published in v0.4.0-alpha.7
**Validated:** Navigator, 2026-11-08, in production ("cr215 validada")
**Reported:** Navigator, 2026-11-08 ("Essa tabela ficou desformatada. Vale uma CR."), with a
screenshot of an answer whose comparison table was drawn as one paragraph of pipes; follows CR179

## Friction

A comparison table often leaves its first header cell empty, because the first column holds row
labels. GitHub-flavoured Markdown reads that as a table. Nautilus draws it as a paragraph:

```
| | certos | errados | perdidos |
|---|---|---|---|
| eval de 11-07 | 94 | 2 | 4 |
```

`createTableBlock` in `src/app/MessageContent.tsx` refuses any header with an empty cell
(`headers.some((header) => !header)`). Measured on `main` with the reported table: an empty first
header cell gives `paragraph`; the same table with `run` in that cell gives `table`. The rows and the
text after them then join the paragraph, as in CR179.

The guard has a likely reason: the compact reader (`parseCompactTable`) finds rows in a one-line
table by splitting on `| |`, which is also how an empty cell looks. Lifting the guard for both
readers would let an empty cell split a compact table in the wrong place.

## Direction (proposed)

- The canonical reader (one row per line) accepts empty header cells, and empty body cells, as GFM
  does.
- The compact reader keeps refusing them, so `| |` stays a row boundary there.
- Spec first, with the reported table; controls that a compact table still reads as before and that
  a header with every cell empty is still not a table.

## Delivered on `main` (`975cd536`)

- `createTableBlock` takes `allowEmptyHeaderCells`. The canonical reader passes `true`: a header
  cell may be empty, and body cells already could. A header whose every cell is empty is still not
  a table. The compact reader passes `false`.
- The compact reader's refusal is held by a control that reaches it: `| a || c | |---|---|---| …`,
  whose `||` the `| |` split leaves whole. The first control written (`| | CR | …`) was refused
  before the flag mattered, and the mutation that dropped it survived; the second catches it.
- Spec first, `src/tests/cr215TableEmptyHeaderCell.test.tsx` (5), with the reported answer parsed
  and rendered (`<th>` blank, three rows). 3 mutations, each caught. CR179's and the older table
  specs unchanged.
- `tsc` clean; vitest 329 files, 2,808 passed, 1 skipped.

## Acceptance

- The 2026-11-08 answer's table renders as a table, its first header cell blank.
- Existing table specs (CR162, CR179) unchanged.
