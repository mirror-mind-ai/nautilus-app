import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageContent, parseMessageBlocks } from "../app/MessageContent";

// CR215: a comparison table leaves its first header cell empty, because the first column names the
// rows. GFM reads that as a table; the reader refused any empty header cell and drew a paragraph.

const typesOf = (content: string) => parseMessageBlocks(content).map((block) => block.type);

const reported = [
  "Rodei os seus 100 turnos privados pelo código do Core:",
  "",
  "| | certos | errados | perdidos |",
  "|---|---|---|---|",
  "| eval de 11-07 | 94 | 2 | 4 |",
  "| Core, primeira versão | 91 | **6** | 3 |",
  "| **Core, corrigido** | **93** | **3** | 4 |",
  "",
  "A primeira versão errou o dobro do eval.",
].join("\n");

describe("a table whose header has an empty cell", () => {
  it("reads the 2026-11-08 answer as a table, its first header cell blank, and the text around it apart", () => {
    const blocks = parseMessageBlocks(reported);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "table", "paragraph"]);
    expect(blocks[1]).toMatchObject({
      headers: ["", "certos", "errados", "perdidos"],
      rows: [
        ["eval de 11-07", "94", "2", "4"],
        ["Core, primeira versão", "91", "**6**", "3"],
        ["**Core, corrigido**", "**93**", "**3**", "4"],
      ],
    });
  });

  it("draws the blank header cell as an empty column heading", () => {
    const html = renderToStaticMarkup(<MessageContent content={reported} />);
    const head = html.match(/<thead>(.*?)<\/thead>/)?.[1] ?? "";
    expect([...head.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((cell) => cell[1])).toEqual([
      "",
      "certos",
      "errados",
      "perdidos",
    ]);
    expect(html.match(/<tbody>(.*?)<\/tbody>/)?.[1].match(/<tr>/g)).toHaveLength(3);
  });

  it("accepts an empty cell anywhere in the header or the rows", () => {
    expect(typesOf("| a | | c |\n|---|---|---|\n| 1 | | 3 |")).toEqual(["table"]);
  });

  it("is not a table when every header cell is empty", () => {
    expect(typesOf("| | |\n|---|---|\n| 1 | 2 |")).not.toContain("table");
  });

  it("keeps a one-line table's rows apart: there an empty cell would be a row boundary", () => {
    expect(typesOf("| # | CR | |--:|---| | 1 | x |")).toEqual(["table"]);
    expect(typesOf("| | CR | |---|---| | 1 | x |")).not.toContain("table");
    // `||` is an empty cell the split leaves whole: one line stays too ambiguous to read it.
    expect(typesOf("| a || c | |---|---|---| | 1 | 2 | 3 |")).not.toContain("table");
  });
});
