import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import type { DocumentationTree } from "../domain/journeyDocumentation";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";

const tree: DocumentationTree = { status: "ready", rootLabel: "sample", items: [] };

describe("CR260: the tree's root opens the same context menu as its folders", () => {
  it("announces a menu on the root button", () => {
    const html = renderToStaticMarkup(
      <JourneyDocumentationSurface tree={tree} expandedPaths={new Set()} content={{ status: "idle" }} onToggle={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(html).toMatch(/<button[^>]*class="journey-documentation-root[^"]*"[^>]*aria-haspopup="menu"/);
  });

  it("opens the menu for the root node by pointer and by keyboard, through the shared handlers", () => {
    const root = browserSource.slice(browserSource.indexOf('className={`journey-documentation-root'), browserSource.indexOf('<ul className="journey-documentation-tree"'));
    expect(root).toContain("onContextMenu={contextMenuOpeners(rootNode, onOpenContextMenu).fromPointer}");
    expect(root).toContain("onKeyDown={contextMenuOpeners(rootNode, onOpenContextMenu).fromKeyboard}");
  });
});
