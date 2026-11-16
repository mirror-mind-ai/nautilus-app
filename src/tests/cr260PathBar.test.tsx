import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import { documentationLocation, type DocumentationNode, type DocumentationTree } from "../domain/journeyDocumentation";
import appSource from "../app/App.tsx?raw";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

describe("CR260 iteration 3: where a place is, composed from the Journey's registered folder", () => {
  it("joins the registered folder and the workspace path, shortening the home folder", () => {
    expect(documentationLocation("/Users/ana/journeys/sample", "docs/plan.md", "/Users/ana")).toEqual({
      shown: "~/journeys/sample/docs/plan.md",
      full: "/Users/ana/journeys/sample/docs/plan.md",
    });
  });

  it("names the root itself when the place is the Journey root", () => {
    expect(documentationLocation("/Users/ana/journeys/sample/", "", "/Users/ana")).toEqual({
      shown: "~/journeys/sample",
      full: "/Users/ana/journeys/sample",
    });
  });

  it("expands a folder registered from the home folder for the full path", () => {
    expect(documentationLocation("~/journeys/sample", "docs", "/Users/ana")).toEqual({
      shown: "~/journeys/sample/docs",
      full: "/Users/ana/journeys/sample/docs",
    });
  });

  it("keeps a Windows folder's separator", () => {
    expect(documentationLocation("C:\\Users\\ana\\sample", "docs/plan.md", "C:\\Users\\ana")).toEqual({
      shown: "C:\\Users\\ana\\sample\\docs\\plan.md",
      full: "C:\\Users\\ana\\sample\\docs\\plan.md",
    });
  });

  it("falls back to the workspace path when the folder is not known", () => {
    expect(documentationLocation(undefined, "docs/plan.md", undefined)).toEqual({ shown: "docs/plan.md", full: undefined });
    expect(documentationLocation("", "", undefined)).toEqual({ shown: "Journey root", full: undefined });
  });
});

const plan: DocumentationNode = { relativePath: "docs/plan.md", name: "plan.md", kind: "file", previewKind: "markdown", children: [] };
const docs: DocumentationNode = { relativePath: "docs", name: "docs", kind: "folder", previewKind: "unavailable", childrenLoaded: true, children: [plan] };
const tree: DocumentationTree = { status: "ready", rootLabel: "sample", items: [docs] };

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface
      tree={tree}
      expandedPaths={new Set(["docs"])}
      content={{ status: "idle" }}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      workspaceRoot="/Users/ana/journeys/sample"
      homeDirectory="/Users/ana"
      {...overrides}
    />,
  );
}

function pathbar(html: string): string {
  const start = html.indexOf('class="agentic-field-pathbar"');
  expect(start, "path bar").toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</footer>", start));
}

describe("CR260 iteration 3: a path bar at the foot of the field", () => {
  it("shows the selected place's full path, after both panels", () => {
    const html = render({ selectedNode: plan, content: { status: "loading", relativePath: "docs/plan.md" } });
    expect(html.indexOf("agentic-field-pathbar")).toBeGreaterThan(html.indexOf("operational-artifact-document-viewer"));
    const bar = pathbar(html);
    expect(bar).toContain("~/journeys/sample/docs/plan.md");
    expect(bar).toMatch(/title="\/Users\/ana\/journeys\/sample\/docs\/plan\.md(\n|&#10;|&#xA;)Open this file"/);
  });

  it("shows the Journey's folder when nothing in it is selected, and says where the briefing lives", () => {
    expect(pathbar(render())).toContain("~/journeys/sample");
    const briefing = pathbar(render({ briefingSelected: true }));
    expect(briefing).toContain("Journey Briefing");
    expect(briefing).not.toContain("~/journeys/sample");
  });

  it("drops the Path card from the viewer, since the foot now says it", () => {
    const html = render({ selectedNode: docs, content: { status: "folder", relativePath: "docs", entries: docs.children } });
    expect(html).not.toContain("<strong>Path</strong>");
    expect(html).toContain("<strong>Kind</strong>");
  });

  it("is given the Journey's registered folder and the home folder by the app", () => {
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,400}workspaceRoot=\{selectedJourneyItem\.projectPath\}/);
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,400}homeDirectory=\{homeDirectory\}/);
  });

  it("spans the surface as its last row and keeps its text readable on the light families", () => {
    expect(css).toMatch(/\.operational-artifacts-layout \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto;/);
    expect(css).toMatch(/\.agentic-field-pathbar \{[^}]*grid-column: 1 \/ -1;/);
    expect(css).toMatch(/\) :where\(\.agentic-field-pathbar\) \{/);
  });
});

describe("CR260 iteration 3: the path opens what it names", () => {
  it("is a button that opens the folder, the file, or the Journey's folder", () => {
    const folder = pathbar(render({ selectedNode: docs, content: { status: "folder", relativePath: "docs", entries: docs.children } }));
    expect(folder).toMatch(/<button[^>]*class="agentic-field-path"/);
    expect(folder).toContain("Open this folder");
    const file = pathbar(render({ selectedNode: plan, content: { status: "loading", relativePath: "docs/plan.md" } }));
    expect(file).toMatch(/<button[^>]*class="agentic-field-path"/);
    expect(file).toContain("Open this file");
    expect(pathbar(render())).toContain("Open this folder");
  });

  it("stays plain text for the briefing, which is not a file", () => {
    const briefing = pathbar(render({ briefingSelected: true }));
    expect(briefing).not.toContain("<button");
  });

  it("reuses the toolbar's open commands, with the root for an empty selection", () => {
    const footer = browserSource.slice(browserSource.indexOf('className="agentic-field-pathbar"'));
    expect(footer).toContain("onOpenFolder(");
    expect(footer).toContain("onOpen(");
    expect(browserSource).toContain("documentationRootNode(tree.rootLabel, tree.items)");
  });

  it("keeps the clickable path readable on the light families", () => {
    const exclusion = css.slice(css.indexOf(":where(button:not(.secondary-button"), css.indexOf("color: #ffffff;", css.indexOf(":where(button:not(.secondary-button")));
    expect(exclusion).toContain(".agentic-field-path");
  });
});
