import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MACOS_FLOOR, checkWhisperCliMacos, parseLoadCommands } from "../../scripts/check_whisper_cli_macos.mjs";

// What `otool -l` and `otool -L` say about the two binaries CR278 is about. The first is the one
// published as whisper-cli-v1.8.3-macos-x64, which a Mac on macOS 12 could not start; the second is
// the one built without the Accelerate framework.
const published = {
  minos: "26.0",
  libraries: ["/usr/lib/libSystem.B.dylib", "/System/Library/Frameworks/Accelerate.framework/Versions/A/Accelerate", "/usr/lib/libc++.1.dylib"],
  undefinedSymbols: ["_cblas_sgemm$NEWLAPACK$ILP64", "_malloc"],
};
const portable = {
  minos: "12.0",
  libraries: ["/usr/lib/libSystem.B.dylib", "/usr/lib/libc++.1.dylib"],
  undefinedSymbols: ["_malloc", "_memcpy"],
};

describe("whisper-cli for macOS 12", () => {
  it("accepts a binary that asks for macOS 12.0 and only the system's own libraries", () => {
    expect(checkWhisperCliMacos(portable)).toEqual({ ok: true, problems: [] });
  });

  it("refuses the binary that was published: it asks for macOS 26 and a symbol macOS 12 does not have", () => {
    const { ok, problems } = checkWhisperCliMacos(published);
    expect(ok).toBe(false);
    expect(problems.join("\n")).toContain("macOS 26.0");
    expect(problems.join("\n")).toContain("Accelerate");
    expect(problems.join("\n")).toContain("_cblas_sgemm$NEWLAPACK$ILP64");
  });

  it("refuses a higher floor on its own, and a library outside the system's", () => {
    expect(checkWhisperCliMacos({ ...portable, minos: "12.1" }).ok).toBe(false);
    expect(checkWhisperCliMacos({ ...portable, minos: "11.0" }).ok).toBe(true);
    const stray = checkWhisperCliMacos({ ...portable, libraries: [...portable.libraries, "/opt/homebrew/lib/libomp.dylib"] });
    expect(stray.ok).toBe(false);
    expect(stray.problems.join("\n")).toContain("/opt/homebrew/lib/libomp.dylib");
  });

  it("refuses a binary that names no floor at all", () => {
    expect(checkWhisperCliMacos({ ...portable, minos: null }).ok).toBe(false);
  });

  it("is the floor the app declares", () => {
    const declared = JSON.parse(readFileSync(new URL("../../config/runtime-compatibility.json", import.meta.url), "utf8")).minimumMacOS;
    expect(`${MACOS_FLOOR}.0`).toBe(declared);
  });

  it("reads the floor from either kind of load command", () => {
    expect(MACOS_FLOOR).toBe("12.0");
    const modern = "Load command 9\n      cmd LC_BUILD_VERSION\n  cmdsize 32\n platform 1\n    minos 12.0\n      sdk 26.2\n   ntools 1";
    const legacy = "Load command 9\n      cmd LC_VERSION_MIN_MACOSX\n  cmdsize 16\n  version 10.15\n      sdk 11.0";
    expect(parseLoadCommands(modern)).toBe("12.0");
    expect(parseLoadCommands(legacy)).toBe("10.15");
    expect(parseLoadCommands("no version here")).toBeNull();
  });
});
