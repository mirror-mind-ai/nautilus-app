import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import { FIELD_TREE_COLLAPSE_WIDTH, fieldTreeCollapses, MIN_FIELD_TREE_WIDTH } from "../domain/fieldDivider";
import type { DocumentationNode, DocumentationTree } from "../domain/journeyDocumentation";
import appSource from "../app/App.tsx?raw";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";
import dividerSource from "../app/AgenticFieldDivider.tsx?raw";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const plan: DocumentationNode = { relativePath: "docs/plan.md", name: "plan.md", kind: "file", previewKind: "markdown", children: [] };
const tree: DocumentationTree = { status: "ready", rootLabel: "sample", items: [plan] };

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface tree={tree} expandedPaths={new Set()} content={{ status: "idle" }} onToggle={vi.fn()} onSelect={vi.fn()} {...overrides} />,
  );
}

function part(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  expect(from, start).toBeGreaterThanOrEqual(0);
  return html.slice(from, html.indexOf(end, from));
}

const toolbar = (html: string) => part(html, 'class="agentic-field-toolbar"', 'id="journey-artifact-workspace-tree"');
const sidebar = (html: string) => part(html, 'id="journey-artifact-workspace-tree"', "operational-artifact-document-viewer");

describe("CR260 iteration 5: dragging the divider to the left edge folds the tree away", () => {
  it("folds once the pointer passes half the tree's minimum width", () => {
    expect(FIELD_TREE_COLLAPSE_WIDTH).toBe(MIN_FIELD_TREE_WIDTH / 2);
    expect(fieldTreeCollapses(FIELD_TREE_COLLAPSE_WIDTH - 1)).toBe(true);
    expect(fieldTreeCollapses(FIELD_TREE_COLLAPSE_WIDTH)).toBe(false);
    expect(fieldTreeCollapses(MIN_FIELD_TREE_WIDTH)).toBe(false);
  });

  it("asks to collapse from the drag instead of resizing below the minimum", () => {
    expect(dividerSource).toContain("fieldTreeCollapses(offset)");
    expect(dividerSource).toContain("onCollapse()");
  });

  it("folds into the same state Expand preview sets, so the button brings the tree back", () => {
    expect(browserSource).toContain("onCollapse={() => onPreviewExpandedChange(true)}");
    const html = render({ previewExpanded: true });
    expect(html).toContain("Show workspace tree");
    expect(html).not.toContain("agentic-field-divider");
  });
});

describe("CR260 iteration 5: reload and the Journey Briefing move to the toolbar", () => {
  it("puts reload beside back and forward, as a browser does", () => {
    const nav = part(toolbar(render()), 'class="agentic-field-nav"', 'class="agentic-field-place"');
    expect(nav).toMatch(/aria-label="Back"[\s\S]*aria-label="Forward"[\s\S]*aria-label="Reload"/);
    expect(sidebar(render())).not.toContain('aria-label="Reload');
  });

  it("disables reload while a reload is running", () => {
    expect(toolbar(render({ treeReloading: true }))).toMatch(/<button[^>]*aria-label="Reload"[^>]*disabled=""/);
  });

  it("offers the Journey Briefing as a toolbar button, pressed while it is shown, and not in the tree", () => {
    const shown = toolbar(render({ briefingSelected: true }));
    expect(shown).toMatch(/<button[^>]*class="agentic-field-nav-button agentic-field-briefing-button"[^>]*aria-pressed="true"/);
    expect(toolbar(render({ selectedNode: plan }))).toMatch(/class="agentic-field-nav-button agentic-field-briefing-button"[^>]*aria-pressed="false"/);
    expect(sidebar(render())).not.toContain("Journey Briefing");
    expect(browserSource).not.toContain("agent-field-briefing-entry");
  });

  it("reloads both panels: the tree and the place shown, the briefing from Mirror", () => {
    expect(browserSource).toMatch(/function reloadField\(\) \{[\s\S]*if \(briefingSelected\) onReloadBriefing\(\);[\s\S]*void loadTree\(true\);/);
    // CR263: the briefing has its own read from Mirror, so its Reload asks for that read again.
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,900}onReloadBriefing=\{\(\) => setJourneyBriefingReadNonce\(\(nonce\) => nonce \+ 1\)\}/);
  });

  it("keeps the new button legible on the light families and drops the old entry's styles", () => {
    const exclusion = css.slice(css.indexOf(":where(button:not(.secondary-button"), css.indexOf("color: #ffffff;", css.indexOf(":where(button:not(.secondary-button")));
    expect(exclusion).toContain(".agentic-field-briefing-button");
    expect(exclusion).not.toContain(".agent-field-briefing-entry");
    expect(css).not.toContain(".agent-field-briefing-entry");
    expect(css).not.toMatch(/\.artifact-tree-reload(?!ing)/);
    expect(css).not.toContain(".operational-artifacts-tree-toolbar");
  });
});

describe("CR260 iteration 5, revised: the briefing button is an icon, the viewer carries the title", () => {
  it("shows only the glyph, named for assistive technology and the tooltip, like the buttons beside it", () => {
    const button = part(toolbar(render()), 'class="agentic-field-nav-button agentic-field-briefing-button"', "</button>");
    expect(button).toContain('aria-label="Journey Briefing"');
    expect(button).toContain('title="Journey Briefing"');
    expect(button).not.toContain("<span>Journey Briefing</span>");
  });

  it("leaves the place beside the button empty and titles the preview instead", () => {
    const html = render({ briefingSelected: true, journeyBriefing: "Ground." });
    expect(part(html, 'class="agentic-field-place"', 'class="agentic-field-actions"')).not.toContain("Journey Briefing");
    const viewer = part(html, "operational-artifact-document-viewer", "agentic-field-pathbar");
    expect(viewer).toMatch(/<h2 class="journey-documentation-briefing-title">Journey Briefing<\/h2>[\s\S]*Ground\./);
  });

  it("drops the labelled look and keeps a pressed state on the navigation button", () => {
    expect(css).not.toMatch(/\.agentic-field-briefing-button(:hover|:focus-visible)?,\s*\n?\.artifact-preview-layout-toggle|\.artifact-preview-layout-toggle(:hover|:focus-visible)?,\s*\.agentic-field-briefing-button/);
    expect(css).toMatch(/\.agentic-field-nav-button\[aria-pressed="true"\] \{/);
  });
});

