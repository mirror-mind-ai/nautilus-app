import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JourneyDocumentationSurface } from "../app/JourneyDocumentationBrowser";
import { briefingBodyOf, sanitizeJourneyBriefing } from "../domain/journeyBriefing";
import type { DocumentationTree } from "../domain/journeyDocumentation";
import appSource from "../app/App.tsx?raw";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";
import storageSource from "../app/journeyBriefingStorage.ts?raw";

// The shape of a Journey with a field: the content the runtime delivers, whole, in neutral words.
const FIELD_JOURNEY = [
  "# Sample Root",
  "**Status:** active",
  "**Stage:** Starting",
  "",
  "## Description",
  "",
  "A root that groups initiatives.",
  "",
  "It does no work of its own.",
  "",
  "## Campo Agêntico",
  "",
  "The root of the field is `~/sample/`.",
  "",
  "- `first/`: the first place.",
  "- `second/`: the second place.",
  "",
  "## Trilhas",
  "",
  "- Hierarchy: one child is registered.",
  "",
  "## Current focus",
  "",
  "Clarify the next movement.",
  "",
].join("\n");

const tree: DocumentationTree = { status: "ready", rootLabel: "sample", items: [] };

function render(overrides: Partial<Parameters<typeof JourneyDocumentationSurface>[0]> = {}): string {
  return renderToStaticMarkup(
    <JourneyDocumentationSurface
      tree={tree}
      expandedPaths={new Set()}
      content={{ status: "idle" }}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      briefingSelected
      {...overrides}
    />,
  );
}

const viewer = (html: string) => html.slice(html.indexOf("journey-documentation-briefing"));

describe("CR263: what the briefing shows of a Journey's content", () => {
  it("drops the title, Status and Stage ahead of the first section, which the app shows elsewhere", () => {
    const body = briefingBodyOf(FIELD_JOURNEY);
    expect(body.startsWith("## Description")).toBe(true);
    expect(body).not.toContain("# Sample Root");
    expect(body).not.toContain("**Status:**");
    expect(body).not.toContain("**Stage:**");
  });

  it("keeps every section, the list and the paragraph breaks as stored", () => {
    const body = briefingBodyOf(FIELD_JOURNEY);
    for (const heading of ["## Description", "## Campo Agêntico", "## Trilhas", "## Current focus"]) {
      expect(body).toContain(heading);
    }
    expect(body).toContain("A root that groups initiatives.\n\nIt does no work of its own.");
    expect(body).toContain("- `first/`: the first place.\n- `second/`: the second place.");
    expect(body.endsWith("Clarify the next movement.")).toBe(true);
  });

  it("keeps a Status line that sits inside a section, because that is content", () => {
    const content = "# T\n**Status:** active\n\n## Notes\n\n**Status:** a line the author wrote here.\n";
    expect(briefingBodyOf(content)).toBe("## Notes\n\n**Status:** a line the author wrote here.");
  });

  it("shows a Journey that has only a Description as it was, with its paragraphs apart", () => {
    const content = "# Small\n**Status:** active\n\n## Description\n\nOne paragraph.\n\nAnother paragraph.\n";
    expect(briefingBodyOf(content)).toBe("## Description\n\nOne paragraph.\n\nAnother paragraph.");
  });

  it("keeps text written before the first section, since it is not a title or a status line", () => {
    expect(briefingBodyOf("# T\n\nA lead paragraph.\n\n## Description\n\nBody.")).toBe("A lead paragraph.\n\n## Description\n\nBody.");
    expect(briefingBodyOf("# T\nJust a sentence under the title.")).toBe("Just a sentence under the title.");
  });

  it("reads line endings of any kind and answers nothing for a content with no body", () => {
    expect(briefingBodyOf("# T\r\n**Status:** active\r\n\r\n## Description\r\n\r\nBody.\r\n")).toBe("## Description\n\nBody.");
    expect(briefingBodyOf("")).toBe("");
    expect(briefingBodyOf("# Only a title\n**Status:** active\n**Stage:** Starting\n")).toBe("");
  });
});

describe("CR263: the panel renders the whole briefing as markdown", () => {
  it("shows the four sections as headings under the panel title and the paths as a list, without title, Status or Stage", () => {
    const html = viewer(render({ journeyBriefing: FIELD_JOURNEY }));
    for (const heading of ["Description", "Campo Agêntico", "Trilhas", "Current focus"]) {
      // The app's markdown reader turns `##` into the level below the panel's own `h2` title.
      expect(html).toMatch(new RegExp(`<h3>${heading}</h3>`));
    }
    expect(html).toMatch(/<ul>[\s\S]*<li>[\s\S]*first\/[\s\S]*<\/li>[\s\S]*<li>[\s\S]*second\/[\s\S]*<\/li>[\s\S]*<\/ul>/);
    expect(html).toContain("<p>A root that groups initiatives.</p>");
    expect(html).toContain("<p>It does no work of its own.</p>");
    expect(html).not.toContain("Sample Root");
    expect(html).not.toContain("Status:");
    expect(html).not.toContain("Stage:");
  });

  it("keeps the panel title, and says so when the Journey records no briefing text", () => {
    expect(render({ journeyBriefing: undefined })).toContain("This Journey records no briefing text yet.");
    expect(render({ journeyBriefing: "" })).toContain("This Journey records no briefing text yet.");
    expect(render({ journeyBriefing: "# T\n**Status:** active\n" })).toContain("This Journey records no briefing text yet.");
    expect(render({ journeyBriefing: FIELD_JOURNEY })).toContain('<h2 class="journey-documentation-briefing-title">Journey Briefing</h2>');
  });

  it("says it is reading, and says why it could not, instead of showing a partial briefing", () => {
    const reading = viewer(render({ briefingStatus: "loading", journeyBriefing: "Stale text from before." }));
    expect(reading).toContain("Reading the briefing from Mirror");
    expect(reading).not.toContain("Stale text from before.");
    const failed = viewer(render({ briefingStatus: "failed", briefingError: "Journey no longer exists in Mirror.", journeyBriefing: "" }));
    expect(failed).toContain("Mirror could not give this briefing.");
    expect(failed).toContain("Journey no longer exists in Mirror.");
    expect(failed).not.toContain("This Journey records no briefing text yet.");
  });
});

describe("CR263: where the briefing is read from", () => {
  it("reads one Journey's content through its own command, not from the tree's description", () => {
    expect(storageSource).toContain('invoke<unknown>("read_journey_briefing"');
    expect(appSource).not.toMatch(/<JourneyDocumentationBrowser[\s\S]{0,300}journeyBriefing=\{selectedJourneyItem\.description\}/);
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,400}journeyBriefing=\{journeyBriefingRead\.journeyId === selectedJourneyItem\.id \? journeyBriefingRead\.content : ""\}/);
  });

  it("leaves the canvas surface's language anchor on the description", () => {
    expect(appSource).toMatch(/<JourneyCanvasSurface[\s\S]{0,300}journeyBriefing=\{selectedJourneyItem\.description\}/);
  });

  it("reloads the briefing from Mirror when the panel is reloaded, so an edit shows without a restart", () => {
    expect(browserSource).toMatch(/function reloadField\(\) \{[\s\S]*if \(briefingSelected\) onReloadBriefing\(\);[\s\S]*void loadTree\(true\);/);
    expect(appSource).toMatch(/<JourneyDocumentationBrowser[\s\S]{0,900}onReloadBriefing=\{\(\) => setJourneyBriefingReadNonce\(\(nonce\) => nonce \+ 1\)\}/);
    expect(appSource).toMatch(/useEffect\(\(\) => \{[\s\S]{0,500}readJourneyBriefing\(journeyId\)[\s\S]{0,800}\}, \[[^\]]*journeyBriefingReadNonce[^\]]*\]\)/);
  });

  it("drops an answer that arrives after the Journey changed", () => {
    expect(appSource).toMatch(/readJourneyBriefing\(journeyId\)[\s\S]{0,600}if \(cancelled\) return;/);
  });
});

describe("CR263: the answer Mirror gives", () => {
  it("takes the Journey's id, name, content and updatedAt, and refuses anything else", () => {
    const answer = { id: "sample", name: "Sample Root", content: FIELD_JOURNEY, updatedAt: "2026-11-21T10:00:00Z" };
    expect(sanitizeJourneyBriefing(answer)).toEqual(answer);
    expect(sanitizeJourneyBriefing({ ...answer, content: "" })).toEqual({ ...answer, content: "" });
    for (const bad of [null, undefined, "text", [], { ...answer, content: 7 }, { ...answer, id: "" }, { name: "x" }]) {
      expect(sanitizeJourneyBriefing(bad)).toBeUndefined();
    }
  });
});
