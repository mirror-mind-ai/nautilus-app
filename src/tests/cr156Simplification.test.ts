import { describe, expect, it } from "vitest";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";
import css from "../styles/app.css?raw";

// CR156, first iteration: text that said again what the screen already shows is gone.
describe("CR156 iteration 3: bring the briefing back as its own entry", () => {
  it("opens the surface on the briefing by default", () => {
    expect(browserSource).toContain("const [briefingSelected, setBriefingSelected] = useState(true)");
  });

  it("renders the briefing in the viewer and offers its own entry", () => {
    expect(browserSource).toContain("<BriefingDocument");
    // CR260 iteration 5 moved the entry from the tree to the toolbar.
    expect(browserSource).toContain("agentic-field-briefing-button");
    // The briefing reads from Mirror, not from a workspace file (CR263: the whole content, with the
    // title, Status and Stage that sit ahead of the first section left out).
    expect(browserSource).toContain("<ArtifactMarkdown content={body}");
  });
});

// CR156 cleanup: the paused admission surface is removed, not merely hidden.
describe("CR156 cleanup: the admission machinery is gone", () => {
  it("no longer imports or renders any admission or context-map component", () => {
    for (const gone of [
      "AgenticMapField",
      "admittedContext",
      "deriveAdmittedContext",
      "AdmissionPanel",
      "ContextPresenceMarker",
      "TerritoryPage",
      "AgenticMapHeader",
      "AgentFieldRegion",
      "selectedTerritory",
    ]) {
      expect(browserSource).not.toContain(gone);
    }
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
    // CR260 iteration 5 moved reload to the toolbar, where it reloads both panels.
    expect(browserSource).toContain('aria-label="Reload"');
  });
});
