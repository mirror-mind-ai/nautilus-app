import { describe, expect, it } from "vitest";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";
import css from "../styles/app.css?raw";

// CR156, first iteration: text that said again what the screen already shows is gone.
describe("CR156 iteration 3: bring the briefing back as its own entry", () => {
  it("opens the surface on the briefing by default", () => {
    expect(browserSource).toContain('useState<AgenticMapTerritory | undefined>("briefing")');
  });

  it("renders the briefing in the viewer and offers its own left entry", () => {
    expect(browserSource).toContain("<BriefingDocument");
    expect(browserSource).toContain("agent-field-briefing-entry");
    // The briefing reads from the Journey registry, not from a workspace file.
    expect(browserSource).toContain("<ArtifactMarkdown content={briefing}");
  });
});

describe("CR156 iteration 2: hide the Context chrome", () => {
  it("stops rendering the Context header and the Admitted context section on the surface", () => {
    expect(browserSource).not.toContain("<AgenticMapHeader");
    expect(browserSource).not.toContain("<AgentFieldRegion");
  });
});

describe("CR156 iteration 1: the Agent Field stops restating itself", () => {
  it("drops the standing note under the tree toolbar", () => {
    expect(browserSource).not.toContain("operational-artifacts-visibility-note");
    expect(browserSource).not.toContain("Private and high-volume generated internals are hidden");
    expect(css).not.toContain("operational-artifacts-visibility-note");
  });

  it("drops the labels above an artifact's own title", () => {
    expect(browserSource).not.toContain("Artifact content");
    expect(browserSource).not.toContain("Details and metadata");
  });

  it("keeps the tree's own label and the reload control", () => {
    expect(browserSource).toContain("Workspace structure");
    expect(browserSource).toContain('aria-label="Reload workspace"');
  });
});
