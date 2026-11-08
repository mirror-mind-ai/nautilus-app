[< RS016](index.md)

# CR215: Read a Table Whose First Header Cell Is Empty

**Status:** captured
**Driver:** assistant
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

## Acceptance

- The 2026-11-08 answer's table renders as a table, its first header cell blank.
- Existing table specs (CR162, CR179) unchanged.
