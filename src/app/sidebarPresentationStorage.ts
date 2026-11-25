/**
 * Choices about how the app looks and what it says, kept in the renderer's own storage like the Agentic Field
 * split (`agenticFieldDividerStorage`), and deliberately NOT in the Journey preferences file: that
 * file is discarded whole when a field it knows holds a value it does not, so a build without
 * these choices would reset the Navigator's pins, recents, theme and Journey icons on reading
 * them. Here an older build simply never looks.
 */

export type ApplicationLayout = "classic" | "compact";

const ACTIVITY_KEY = "mirror-desktop:journey-activity-view:v1";
const LAYOUT_KEY = "mirror-desktop:application-layout:v1";
const PROMPT_CACHE_KEY = "mirror-desktop:prompt-cache-notices:v1";

export function loadJourneyActivityView(channel: string): boolean {
  try {
    return window.localStorage.getItem(`${ACTIVITY_KEY}:${channel}`) === "on";
  } catch {
    return false;
  }
}

export function saveJourneyActivityView(channel: string, shown: boolean): void {
  try {
    window.localStorage.setItem(`${ACTIVITY_KEY}:${channel}`, shown ? "on" : "off");
  } catch {
    // The choice in memory remains usable when persistence is unavailable.
  }
}

/** Prompt cache notices (Settings › Advanced): an advanced reading, off until asked for. */
export function loadPromptCacheNotices(channel: string): boolean {
  try {
    return window.localStorage.getItem(`${PROMPT_CACHE_KEY}:${channel}`) === "on";
  } catch {
    return false;
  }
}

export function savePromptCacheNotices(channel: string, shown: boolean): void {
  try {
    window.localStorage.setItem(`${PROMPT_CACHE_KEY}:${channel}`, shown ? "on" : "off");
  } catch {
    // The choice in memory remains usable when persistence is unavailable.
  }
}

export function parseApplicationLayout(value: unknown): ApplicationLayout {
  return value === "compact" ? "compact" : "classic";
}

export function loadApplicationLayout(channel: string): ApplicationLayout {
  try {
    return parseApplicationLayout(window.localStorage.getItem(`${LAYOUT_KEY}:${channel}`));
  } catch {
    return "classic";
  }
}

export function saveApplicationLayout(channel: string, layout: ApplicationLayout): void {
  try {
    window.localStorage.setItem(`${LAYOUT_KEY}:${channel}`, layout);
  } catch {
    // The choice in memory remains usable when persistence is unavailable.
  }
}
