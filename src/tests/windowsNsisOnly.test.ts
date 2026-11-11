import { describe, expect, it } from "vitest";
import stableConfig from "../../src-tauri/tauri.conf.json";
import windowsConfig from "../../src-tauri/tauri.windows.conf.json";

// "all" made a Windows build also try the MSI target, which refuses a non-numeric pre-release
// (`0.4.0-alpha.11`) and failed the build after the NSIS installer had been compiled. Tauri merges
// tauri.windows.conf.json into every Windows build, so the channel scripts need no flag for it.
describe("Windows builds only the NSIS installer", () => {
  it("keeps every target elsewhere and only NSIS on Windows", () => {
    expect(stableConfig.bundle.targets).toBe("all");
    expect(windowsConfig.bundle.targets).toEqual(["nsis"]);
    expect(Object.keys(windowsConfig)).toEqual(["$schema", "bundle"]);
    expect(Object.keys(windowsConfig.bundle)).toEqual(["targets"]);
  });
});
