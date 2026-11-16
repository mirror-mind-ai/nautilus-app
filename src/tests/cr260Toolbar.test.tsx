import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import type { DocumentationNode, DocumentationTree } from "../domain/journeyDocumentation";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const plan: DocumentationNode = {
  relativePath: "docs/plan.md", name: "plan.md", kind: "file", previewKind: "markdown", children: [],
};
const docs: DocumentationNode = {
  relativePath: "docs", name: "docs", kind: "folder", previewKind: "unavailable", childrenLoaded: true, children: [plan],
};
const tree: DocumentationTree = { status: "ready", rootLabel: "sample-journey", items: [docs] };

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface
      tree={tree}
      expandedPaths={new Set(["docs"])}
      content={{ status: "idle" }}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

function toolbar(html: string): string {
  const start = html.indexOf('class="agentic-field-toolbar"');
  expect(start, "toolbar").toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf('id="journey-artifact-workspace-tree"'));
}

describe("CR260 iteration 2: a toolbar across the Agentic Field", () => {
  it("sits above both panels as a labelled toolbar with back and forward", () => {
    const html = render({ canGoBack: true, canGoForward: false });
    expect(html.indexOf("agentic-field-toolbar")).toBeLessThan(html.indexOf("journey-artifact-workspace-tree"));
    const bar = toolbar(html);
    expect(bar).toContain('role="toolbar"');
    expect(bar).toMatch(/aria-label="Back"[^>]*>|<button[^>]*aria-label="Back"/);
    expect(bar).not.toMatch(/<button[^>]*aria-label="Back"[^>]*disabled/);
    expect(bar).toMatch(/<button[^>]*aria-label="Forward"[^>]*disabled/);
  });

  it("names the place shown: a folder or a file; the briefing names itself in the viewer", () => {
    expect(toolbar(render({ briefingSelected: true, journeyBriefing: "Ground." }))).not.toContain("<h2>");
    expect(toolbar(render({ selectedNode: docs, content: { status: "folder", relativePath: "docs", entries: docs.children } }))).toContain("<h2>docs</h2>");
    expect(toolbar(render({ selectedNode: plan, content: { status: "loading", relativePath: "docs/plan.md" } }))).toContain("<h2>plan.md</h2>");
  });

  it("holds the open actions for the place, and none for the briefing", () => {
    const folder = toolbar(render({ selectedNode: docs, content: { status: "folder", relativePath: "docs", entries: docs.children } }));
    expect(folder).toContain("Open folder");
    expect(folder).not.toContain("Open file");
    const file = toolbar(render({ selectedNode: plan, content: { status: "ready", relativePath: "docs/plan.md", previewKind: "markdown", content: "Plan." } as never }));
    expect(file).toContain("Open file");
    expect(file).not.toContain("Open folder");
    const briefing = toolbar(render({ briefingSelected: true }));
    expect(briefing).not.toContain("Open file");
    expect(briefing).not.toContain("Open folder");
  });

  it("carries Expand preview, so the viewer no longer spends a row on it", () => {
    const html = render({ selectedNode: plan, content: { status: "idle" } });
    expect(toolbar(html)).toContain("Expand preview");
    expect(html).not.toContain("artifact-preview-layout-toolbar");
  });

  it("names the place once, in the toolbar for a file or folder, in the viewer for the briefing", () => {
    const html = render({ selectedNode: docs, content: { status: "folder", relativePath: "docs", entries: docs.children } });
    expect(html.match(/<h2>docs<\/h2>/g)).toHaveLength(1);
    expect(render({ briefingSelected: true }).match(/<h2[^>]*>Journey Briefing<\/h2>/g)).toHaveLength(1);
  });

  it("is wired to the history: selections visit places, back and forward replay them", () => {
    expect(browserSource).toContain("visitFieldPlace");
    expect(browserSource).toContain("fieldHistoryBack");
    expect(browserSource).toContain("fieldHistoryForward");
    expect(browserSource).toContain("setHistory(startFieldHistory())");
  });

  it("keeps the new toolbar controls readable on the light families", () => {
    const exclusion = css.slice(css.indexOf(":where(button:not(.secondary-button"), css.indexOf("color: #ffffff;", css.indexOf(":where(button:not(.secondary-button")));
    expect(exclusion).toContain(".agentic-field-nav-button");
    expect(css).toMatch(/\) \.agentic-field-nav-button,\n/);
    expect(css).toContain(".agentic-field-place h2");
  });
});
