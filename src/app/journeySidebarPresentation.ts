import type { JourneyListOrder } from "../domain/journeyRegistry";

export function defaultNewJourneyParentId(
  journeyListOrder: JourneyListOrder,
  pinnedOnly: boolean,
  selectedJourneyId: string,
): string {
  return journeyListOrder === "tree" && !pinnedOnly ? selectedJourneyId : "";
}

export type JourneySidebarViewState = {
  sidebarCompact: boolean;
  journeyListOrder: JourneyListOrder;
  pinnedOnly: boolean;
};

export function toggleJourneySidebar(state: JourneySidebarViewState): JourneySidebarViewState {
  if (!state.sidebarCompact && state.journeyListOrder === "tree" && !state.pinnedOnly) {
    return { sidebarCompact: true, journeyListOrder: "recent", pinnedOnly: false };
  }
  return { ...state, sidebarCompact: !state.sidebarCompact };
}

export function activateJourneyTree(): JourneySidebarViewState {
  return { sidebarCompact: false, journeyListOrder: "tree", pinnedOnly: false };
}

export function sidebarToggleLabel(sidebarCompact: boolean): string {
  return sidebarCompact ? "Expand Journey sidebar" : "Collapse Journey sidebar";
}

export type KeyboardPlatform = "mac" | "other";

/** CR258: which modifier is primary for app shortcuts here. macOS uses the Command key. */
export function keyboardPlatformFrom(probe: { platform?: string; userAgent?: string }): KeyboardPlatform {
  const text = `${probe.platform ?? ""} ${probe.userAgent ?? ""}`;
  return /mac|iphone|ipad/i.test(text) ? "mac" : "other";
}

/**
 * CR258: the key that expands or collapses the Journey sidebar, the same move the toggle button
 * runs: Command+B on macOS, Ctrl+B elsewhere. Ctrl+B on macOS moves the text cursor, so it is
 * deliberately not ours there, and a second modifier or another key is never a match.
 */
export function matchesSidebarToggleShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  platform: KeyboardPlatform,
): boolean {
  if (event.altKey || event.shiftKey) return false;
  if (event.key !== "b" && event.key !== "B") return false;
  return platform === "mac" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
