import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import quitStorageSource from "../app/desktopQuitStorage.ts?raw";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const backendSource = readFileSync("src-tauri/src/main.rs", "utf8");

// Windows has no Dock to bring a hidden window back from, and Nautilus keeps no tray icon, so
// CR085's hidden window is an app still running where nobody can see it. On Windows closing the
// window quits, through the same confirmation File → Exit already uses; macOS keeps CR085.
describe("Windows: closing the window quits the app", () => {
  it("asks the native side which platform rule applies, and decides it there", () => {
    expect(backendSource).toContain("fn close_quits_app(target_os: &str) -> bool");
    expect(backendSource).toContain("fn desktop_close_quits_app() -> bool");
    expect(backendSource).toContain("desktop_close_quits_app,");
    expect(quitStorageSource).toContain('invoke<boolean>("desktop_close_quits_app")');
  });

  it("routes a close through the quit request where it quits, and hides elsewhere", () => {
    const closeHandler = appSource.slice(
      appSource.indexOf("appWindow.onCloseRequested"),
      appSource.indexOf("Could not install the Composer draft close boundary."),
    );
    expect(closeHandler).toContain("closeQuitsAppRef.current");
    expect(closeHandler).toContain("navigatorQuitRequestRef.current()");
    expect(closeHandler).toContain("hideWindowAfterDraftFlush");
  });

  it("warns before ending a turn that is running or not yet saved, as File → Exit does", () => {
    const decision = appSource.slice(
      appSource.indexOf("const handleNavigatorQuitRequest"),
      appSource.indexOf("navigatorQuitRequestRef.current = handleNavigatorQuitRequest"),
    );
    expect(decision).toContain("hasActiveOrFinalizingJourneyRuntime(journeyRuntimeStateRef.current)");
    expect(decision).toContain("setCloseConfirmationOpen(true)");
    expect(decision).toContain("quitAfterDraftFlush()");
    const quitListener = appSource.slice(
      appSource.indexOf("void listenForDesktopQuitRequest("),
      appSource.indexOf("Could not install the quit confirmation boundary."),
    );
    expect(quitListener).toContain("navigatorQuitRequestRef.current()");
  });

  it("tells the Navigator how to keep agents working when closing would end them", () => {
    expect(appSource).toContain("To keep agents working, minimize the window instead of closing it.");
    expect(appSource).toContain("Closing the window instead only hides it and never interrupts an agent.");
  });
});
