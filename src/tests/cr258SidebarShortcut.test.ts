import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import {
  keyboardPlatformFrom,
  matchesSidebarToggleShortcut,
} from "../app/journeySidebarPresentation";

type Combo = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean };
const press = (combo: Combo) => ({
  key: combo.key,
  metaKey: combo.metaKey ?? false,
  ctrlKey: combo.ctrlKey ?? false,
  altKey: combo.altKey ?? false,
  shiftKey: combo.shiftKey ?? false,
});

describe("CR258: a key toggles the Journey sidebar", () => {
  it("reads the primary modifier from the platform", () => {
    expect(keyboardPlatformFrom({ platform: "MacIntel" })).toBe("mac");
    expect(keyboardPlatformFrom({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" })).toBe("mac");
    expect(keyboardPlatformFrom({ platform: "Win32" })).toBe("other");
    expect(keyboardPlatformFrom({ platform: "Linux x86_64" })).toBe("other");
    expect(keyboardPlatformFrom({})).toBe("other");
  });

  it("toggles on Cmd+B on macOS and Ctrl+B elsewhere", () => {
    expect(matchesSidebarToggleShortcut(press({ key: "b", metaKey: true }), "mac")).toBe(true);
    expect(matchesSidebarToggleShortcut(press({ key: "B", metaKey: true }), "mac")).toBe(true);
    expect(matchesSidebarToggleShortcut(press({ key: "b", ctrlKey: true }), "other")).toBe(true);
    expect(matchesSidebarToggleShortcut(press({ key: "B", ctrlKey: true }), "other")).toBe(true);
  });

  it("stays out of the way of other modifiers and keys", () => {
    // Ctrl+B on macOS moves the text cursor, so it is deliberately not ours there.
    expect(matchesSidebarToggleShortcut(press({ key: "b", ctrlKey: true }), "mac")).toBe(false);
    // Cmd+B is not the primary modifier away from macOS.
    expect(matchesSidebarToggleShortcut(press({ key: "b", metaKey: true }), "other")).toBe(false);
    expect(matchesSidebarToggleShortcut(press({ key: "b", metaKey: true, shiftKey: true }), "mac")).toBe(false);
    expect(matchesSidebarToggleShortcut(press({ key: "b", metaKey: true, altKey: true }), "mac")).toBe(false);
    expect(matchesSidebarToggleShortcut(press({ key: "b", metaKey: true, ctrlKey: true }), "mac")).toBe(false);
    expect(matchesSidebarToggleShortcut(press({ key: "a", metaKey: true }), "mac")).toBe(false);
    expect(matchesSidebarToggleShortcut(press({ key: "b" }), "mac")).toBe(false);
  });

  it("is wired in App.tsx to the same toggle the button runs", () => {
    expect(appSource).toContain("keyboardPlatformFrom(navigator)");
    expect(appSource).toContain("matchesSidebarToggleShortcut(event, platform)");
    expect(appSource).toContain("toggleSidebarPresentationRef.current()");
    expect(appSource).toContain('window.addEventListener("keydown", toggleOnShortcut)');
  });
});
