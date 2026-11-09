import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import { shouldReadJourneyWorkspace, workspacePreviewFor, type JourneyWorkspaceReading } from "../domain/journeyWorkingFolder";

// Found by the Navigator: back on a Journey whose turn was running, the header said "Working in" the
// folder of the Journey looked at before it, for the whole turn. The folder was kept without the
// Journey it was read for, and it is not read while a turn runs, so the other Journey's stayed.

const readFor = (journeyId: string, path: string): JourneyWorkspaceReading => ({ journeyId, preview: { path } });

describe("the folder shown is the selected Journey's", () => {
  it("shows a folder only for the Journey it was read for", () => {
    const sox = readFor("sox", "C:\\VSCode\\SOX");
    expect(workspacePreviewFor(sox, "sox")).toEqual({ path: "C:\\VSCode\\SOX" });
    expect(workspacePreviewFor(sox, "nautilus-windows")).toBeUndefined();
    expect(workspacePreviewFor(undefined, "sox")).toBeUndefined();
  });

  it("reads the folder of a Journey whose turn is running when the one kept is another's", () => {
    expect(shouldReadJourneyWorkspace({ journeyId: "nautilus-windows", streaming: true, readFor: "sox" })).toBe(true);
    expect(shouldReadJourneyWorkspace({ journeyId: "nautilus-windows", streaming: true, readFor: undefined })).toBe(true);
  });

  it("leaves a running turn's own folder alone, and reads it again once the turn has ended", () => {
    expect(shouldReadJourneyWorkspace({ journeyId: "nautilus-windows", streaming: true, readFor: "nautilus-windows" })).toBe(false);
    expect(shouldReadJourneyWorkspace({ journeyId: "nautilus-windows", streaming: false, readFor: "nautilus-windows" })).toBe(true);
  });

  it("reads nothing without a selected Journey", () => {
    expect(shouldReadJourneyWorkspace({ journeyId: "", streaming: false, readFor: undefined })).toBe(false);
  });

  it("is what App shows and reads with", () => {
    expect(appSource).toContain("describeWorkingFolder(workspacePreviewFor(journeyWorkspaceReading, selectedJourney), homeDirectory)");
    expect(appSource).toContain("shouldReadJourneyWorkspace({ journeyId: selectedJourney, streaming: isStreaming, readFor: journeyWorkspaceReadingRef.current?.journeyId })");
    expect(appSource).toContain("setJourneyWorkspaceReading({ journeyId: selectedJourney, preview })");
    expect(appSource).not.toContain("if (!selectedJourney || isStreaming) return;");
  });
});
