import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import { documentationRootNode, type DocumentationTree } from "../domain/journeyDocumentation";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const tree: DocumentationTree = {
  status: "ready",
  rootLabel: "mirror-desktop",
  items: [{ relativePath: "docs", name: "docs", kind: "folder", previewKind: "unavailable", childrenLoaded: true, children: [] }],
};

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface
      tree={tree}
      expandedPaths={new Set()}
      content={{ status: "idle" }}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CR156: the workspace root is a selectable folder", () => {
  it("builds the root as a folder node over the top-level items", () => {
    const root = documentationRootNode(tree.rootLabel, tree.items);

    expect(root).toMatchObject({ relativePath: "", name: "mirror-desktop", kind: "folder" });
    expect(root.children).toBe(tree.items);
  });

  it("renders the root as a button, not a bare label", () => {
    const markup = render();

    expect(markup).toMatch(/<button[^>]*class="journey-documentation-root[^"]*"[^>]*>/);
  });

  it("marks the root selected when it is the selected node", () => {
    const root = documentationRootNode(tree.rootLabel, tree.items);
    const markup = render({
      selectedNode: root,
      content: { status: "unavailable", relativePath: "", previewKind: "unavailable", reason: "folder" },
    });

    expect(markup).toMatch(/journey-documentation-root[^"]*is-selected/);
    expect(markup).toContain("Journey root");
  });
});

describe("CR156: light themes keep the surface's own text legible", () => {
  // A transparent text button is painted white in the light families unless it is excluded.
  it("excludes the root button from the white-ink rule", () => {
    const rule = css.slice(css.indexOf(":where(button:not("));
    expect(rule.slice(0, rule.indexOf("{"))).toContain(".journey-documentation-root");
  });

  it("gives the Preview unavailable heading the light-theme text colour", () => {
    const at = css.indexOf("  .journey-documentation-detail h2,");
    const list = css.slice(at, css.indexOf("{", at));
    expect(list).toContain(".journey-documentation-unavailable strong");
  });
});
