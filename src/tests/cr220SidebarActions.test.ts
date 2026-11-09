// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import { journeyEmptyState } from "../domain/journeyEmptyState";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`missing ${end}`);
  return source.slice(from, to);
}

describe("CR220: Settings beside the version", () => {
  it("opens Settings from the brand block, beside the button that collapses the sidebar", () => {
    const brand = between(appSource, '<div className="brand-block">', "<JourneySearchControl");
    const controls = between(brand, '<div className="brand-controls">', 'className="sidebar-toggle-button"');
    expect(controls).toContain('aria-label="Open settings"');
    expect(controls).toContain("onClick={() => setSettingsOpen(true)}");
    expect(cssSource).toMatch(/\.sidebar-compact \.brand-controls \{[^}]*flex-direction: column/);
  });

  it("has no footer", () => {
    expect(appSource).not.toContain('className="sidebar-footer"');
    expect(appSource).not.toContain('className="sidebar-action-button"');
    expect(cssSource).not.toMatch(/(^|\n)\.sidebar-footer \{/);
  });
});

describe("CR220: New Journey in the Tree tools", () => {
  it("is the first Tree tool, with the footer's default parent and its refusal", () => {
    const tools = between(appSource, 'aria-label="Journey tree tools"', "onClick={collapseAllJourneys}");
    expect(tools).toContain('aria-label="Create new Journey"');
    expect(tools).toContain("openCreateJourney(defaultNewJourneyParentId(journeyListOrder, pinnedOnly, selectedJourney))");
    expect(tools).toContain('disabled={!treeOperation("create").allowed}');
    expect(tools).toContain("New Journey");
  });

  it("shortens Collapse all and Expand all to fit, keeping their names as titles", () => {
    const tools = between(appSource, "onClick={collapseAllJourneys}", "journey-tree-inactive-toggle");
    expect(tools).toContain('title="Collapse all"');
    expect(tools).toContain('aria-label="Collapse all"');
    expect(tools).toContain('<span className="journey-tree-tool-label">Collapse</span>');
    expect(tools).toContain('title="Expand all"');
    expect(tools).toContain('<span className="journey-tree-tool-label">Expand</span>');
    expect(tools).not.toMatch(/> Collapse all|> Expand all/);
  });

  it("keeps the three tools on one line at the sidebar's narrowest width", () => {
    // Measured 2026-11-08: the three with their words need 229 px; at the narrowest sidebar the tools
    // get 211. Under 232 px Collapse and Expand keep only their icons, their names in the title.
    expect(cssSource).toMatch(/\.journey-tree-tools-slot \{[^}]*container-type: inline-size/);
    expect(cssSource).toMatch(/@container \(max-width: 232px\) \{\s*\.journey-tree-tool-label \{\s*display: none;/);
    expect(cssSource).toMatch(/\.journey-tree-tools button \{[^}]*white-space: nowrap/);
  });
});

describe("CR220: an empty tree offers creation", () => {
  it("offers to create a Journey in every view when there is none, and keeps the filters' own words", () => {
    for (const pinnedOnly of [false, true]) {
      expect(journeyEmptyState({ hasJourneys: false, pinnedOnly, search: "" })).toEqual({
        title: "No Journeys yet",
        hint: "Create a Journey to begin.",
        offersCreation: true,
      });
    }
    expect(journeyEmptyState({ hasJourneys: true, pinnedOnly: true, search: "" })).toEqual({
      title: "No pinned Journeys",
      hint: "Pin a Journey to make it available in this filter.",
      offersCreation: false,
    });
    expect(journeyEmptyState({ hasJourneys: true, pinnedOnly: true, search: "atlas" })).toEqual({
      title: "No pinned Journeys found for “atlas”",
      hint: "Try another search or clear the Pinned filter.",
      offersCreation: false,
    });
    expect(journeyEmptyState({ hasJourneys: true, pinnedOnly: false, search: " atlas " })).toEqual({
      title: "No Journeys found for “atlas”",
      hint: "Try another search or switch the Journey list order.",
      offersCreation: false,
    });
    // Journeys exist, and the tree leaves every one out as inactive.
    expect(journeyEmptyState({ hasJourneys: true, pinnedOnly: false, search: "" })).toEqual({
      title: "No active Journeys",
      hint: "Show the inactive ones from the Tree tools.",
      offersCreation: false,
    });
  });

  it("asks the registry whether any Journey exists", () => {
    const empty = between(appSource, '<div className="journey-empty-state">', "</div>");
    expect(empty).toContain("journeyEmptyState({ hasJourneys: journeyRegistry.roots.length > 0, pinnedOnly, search: journeySearch })");
    expect(empty).toContain("offersCreation ?");
    expect(appSource).not.toContain("Reload the Journey tree after adding a Journey in Mirror.");
  });
});
