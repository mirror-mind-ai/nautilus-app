import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";

describe("global sidebar actions", () => {
  // CR220 moved both out of the footer, which is gone: Settings beside the version, New Journey
  // into the Tree tools (cr220SidebarActions.test.ts). Both are still always one act away.
  it("keeps icon-only Settings and the New Journey action", () => {
    expect(appSource).toContain('onClick={() => setSettingsOpen(true)}');
    expect(appSource).toContain('aria-label="Open settings"');
    expect(appSource).toContain('aria-label="Create new Journey"');
    expect(appSource).toContain("defaultNewJourneyParentId(journeyListOrder, pinnedOnly, selectedJourney)");
  });

  it("exposes a persistent compact rail toggle", () => {
    expect(appSource).toContain('className="sidebar-toggle-button"');
    expect(appSource).toContain("sidebarToggleLabel(sidebarCompact)");
    expect(appSource).toContain('sidebarCompact ? "sidebar-compact" : ""');
  });
});
