import { describe, expect, it } from "vitest";
import channelLauncher from "../../scripts/mirror_desktop_channel.mjs?raw";
import stableConfig from "../../src-tauri/tauri.conf.json";
import developmentConfig from "../../src-tauri/tauri.dev.conf.json";
import developmentWindowsConfig from "../../src-tauri/tauri.dev.windows.conf.json";

// Both channels installed mirror-desktop.exe on Windows, and the NSIS installer ends any running
// process of its executable's name: installing the development app closed the daily-use one.
describe("Windows: the development channel has its own executable name", () => {
  it("names the development executable apart from the stable one", () => {
    expect(developmentWindowsConfig.mainBinaryName).toBe("mirror-desktop-dev");
    expect("mainBinaryName" in stableConfig).toBe(false);
    expect("mainBinaryName" in developmentConfig).toBe(false);
  });

  it("applies the name only to development builds on Windows, so macOS bundles are unchanged", () => {
    expect(channelLauncher).toContain(
      'process.platform === "win32" && selected.channel === "development"\n  ? ["--config", "src-tauri/tauri.dev.windows.conf.json"]',
    );
    expect(channelLauncher).toContain("...selected.args, ...platformArgs, ...bundledRuntime");
  });
});
