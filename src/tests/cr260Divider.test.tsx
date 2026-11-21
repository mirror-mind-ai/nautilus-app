import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import { loadFieldTreeShare, saveFieldTreeShare } from "../app/agenticFieldDividerStorage";
import {
  clampFieldTreeShare,
  DEFAULT_FIELD_TREE_SHARE,
  MIN_FIELD_TREE_WIDTH,
  MIN_FIELD_VIEWER_WIDTH,
} from "../domain/fieldDivider";
import type { DocumentationTree } from "../domain/journeyDocumentation";
import appSource from "../app/App.tsx?raw";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";
import dividerSource from "../app/AgenticFieldDivider.tsx?raw";

// `?raw` hands vitest a processed stylesheet, so the source is read as written.
const css: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

describe("CR260 iteration 4: the tree's share of the surface", () => {
  it("starts where the fixed columns were", () => {
    expect(DEFAULT_FIELD_TREE_SHARE).toBe(0.375);
  });

  it("keeps both panels at their minimum widths", () => {
    expect(clampFieldTreeShare(0.05, 1000)).toBe(MIN_FIELD_TREE_WIDTH / 1000);
    expect(clampFieldTreeShare(0.95, 1000)).toBe(1 - MIN_FIELD_VIEWER_WIDTH / 1000);
    expect(clampFieldTreeShare(0.5, 1000)).toBe(0.5);
  });

  it("falls back to the default for a share it cannot read", () => {
    expect(clampFieldTreeShare(Number.NaN, 1000)).toBe(DEFAULT_FIELD_TREE_SHARE);
  });

  it("keeps a reasonable share when the surface width is unknown or too narrow", () => {
    expect(clampFieldTreeShare(0.9, 0)).toBe(0.7);
    expect(clampFieldTreeShare(0.05, 0)).toBe(0.2);
    expect(clampFieldTreeShare(0.9, 400)).toBeGreaterThanOrEqual(0.2);
  });
});

describe("CR260 iteration 4: the share is remembered per person, across Journeys", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  it("saves per runtime channel and loads it back", () => {
    saveFieldTreeShare("development", 0.5);
    expect(loadFieldTreeShare("development")).toBe(0.5);
    expect(loadFieldTreeShare("user")).toBe(DEFAULT_FIELD_TREE_SHARE);
  });

  it("ignores a stored value outside any sensible share", () => {
    window.localStorage.setItem("mirror-desktop:agentic-field-tree-share:v1:development", "7");
    expect(loadFieldTreeShare("development")).toBe(DEFAULT_FIELD_TREE_SHARE);
  });
});

const tree: DocumentationTree = { status: "ready", rootLabel: "sample", items: [] };

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface tree={tree} expandedPaths={new Set()} content={{ status: "idle" }} onToggle={vi.fn()} onSelect={vi.fn()} {...overrides} />,
  );
}

describe("CR260 iteration 4: a divider between the tree and the viewer", () => {
  it("is a keyboard-operable separator between the two panels", () => {
    const html = render({ treeShare: 0.42 });
    const divider = html.indexOf('class="agentic-field-divider"');
    expect(divider).toBeGreaterThan(html.indexOf('id="journey-artifact-workspace-tree"'));
    expect(divider).toBeLessThan(html.indexOf("operational-artifact-document-viewer"));
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-label="Resize workspace tree"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("--agentic-field-tree-share:42%");
  });

  it("goes away while the preview is expanded, since there is no tree to size", () => {
    expect(render({ previewExpanded: true })).not.toContain("agentic-field-divider");
  });

  it("drags with pointer capture, steps with the keyboard and resets on double click", () => {
    expect(dividerSource).toContain("setPointerCapture(event.pointerId)");
    expect(dividerSource).toContain("onPointerCancel={stopResize}");
    expect(dividerSource).toMatch(/ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/);
    expect(dividerSource).toContain("onDoubleClick={() => onChange(DEFAULT_FIELD_TREE_SHARE)}");
  });

  it("loads and saves the share through the runtime channel the app knows", () => {
    expect(browserSource).toContain("loadFieldTreeShare(storageChannel)");
    expect(browserSource).toContain("saveFieldTreeShare(storageChannel");
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,800}storageChannel=\{runtimeChannel\?\.channel \?\? "checking"\}/);
  });

  it("sizes the tree column from the share and hides the divider where there is no side by side", () => {
    expect(css).toMatch(/\.operational-artifacts-layout \{[^}]*grid-template-columns: minmax\(180px, var\(--agentic-field-tree-share, 37\.5%\)\) 0 minmax\(320px, 1fr\);/);
    expect(css).toMatch(/\.operational-artifacts-layout\.is-preview-expanded \.agentic-field-divider[^{]*\{[^}]*display: none;/);
    const narrow = css.slice(css.indexOf(".operational-artifacts-layout:not(.is-preview-expanded) {\n    grid-template-columns: minmax(0, 1fr);"));
    expect(narrow.slice(0, 800)).toMatch(/\.agentic-field-divider \{\s*display: none;/);
  });
});
