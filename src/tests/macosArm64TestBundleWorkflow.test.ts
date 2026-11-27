import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/macos-arm64-test-bundle.yml");
const pinned = [read(".github/workflows/macos.yml"), read(".github/workflows/windows.yml")].join("\n");
const guide = read("docs/alpha/apple-silicon-test-bundle.md");
const verify = read("scripts/verify_macos_bundle.sh");

// CR300: nobody on the team has an Apple Silicon Mac, so a native arm64 bundle for a tester is built on
// GitHub's arm64 runner by a job that only a person starts, and handed over by hand.
describe("the macOS arm64 test bundle workflow", () => {
  it("runs by hand only, on the arm64 runner, with a read-only token and no secret", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(workflow).toContain("runs-on: macos-latest");
    expect(workflow).toMatch(/permissions:\n\s+contents: read/);
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
  });

  it("stops unless the runner is arm64", () => {
    expect(workflow).toContain('test "$(uname -m)" = arm64');
  });

  it("pins every third-party action by a commit the other workflows already use", () => {
    const uses = workflow.match(/uses: \S+@[0-9a-f]{40}/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const line of uses) expect(pinned).toContain(line);
    expect(workflow).not.toMatch(/uses: \S+@(?![0-9a-f]{40}\b)/);
  });

  it("builds the evaluation channel, which has no updater, and never the user channel", () => {
    expect(workflow).toContain("npm run tauri:build:eval");
    expect(workflow).not.toContain("tauri:build:user");
    expect(workflow).not.toContain("tauri:build:dev");
  });

  it("checks the bundle before it is signed and packed", () => {
    const build = workflow.indexOf("npm run tauri:build:eval");
    const check = workflow.indexOf("scripts/verify_macos_bundle.sh");
    const sign = workflow.indexOf("codesign --force --sign -");
    const pack = workflow.indexOf("ditto -c -k --keepParent");
    const upload = workflow.indexOf("actions/upload-artifact@");
    expect(build).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(build);
    expect(sign).toBeGreaterThan(check);
    expect(pack).toBeGreaterThan(sign);
    expect(upload).toBeGreaterThan(pack);
    expect(workflow).toMatch(/verify_macos_bundle\.sh[^\n]*ai\.mirrormind\.nautilus[^\n]*Nautilus Eval[^\n]*arm64 darwin-arm64/);
  });

  it("records the signature before and after the ad hoc signing, and verifies it", () => {
    expect(workflow).toContain("codesign -dv");
    expect(workflow).toContain("codesign --verify --strict");
  });

  it("publishes the zip with its checksum and keeps it only a week", () => {
    expect(workflow).toContain("shasum -a 256");
    expect(workflow).toContain("retention-days: 7");
  });
});

describe("the bundle verification script", () => {
  it("reads identity, version, both architectures and the runtime receipt, and stops on any mismatch", () => {
    for (const key of ["CFBundleIdentifier", "CFBundleName", "CFBundleShortVersionString", "CFBundleExecutable"]) {
      expect(verify).toContain(key);
    }
    expect(verify).toContain("Contents/Resources/mirror-host/node/bin/node");
    expect(verify).toContain("Contents/Resources/mirror-host/pin-receipt.json");
    expect(verify).toMatch(/platform\\": \\"\$PLATFORM\\"/);
    expect(verify).toContain("a single architecture was expected");
    expect(verify).toContain("set -euo pipefail");
  });

  it("changes nothing: it neither signs, installs nor writes", () => {
    expect(verify).not.toMatch(/\b(codesign|xattr|cp|mv|rm|ditto)\b/);
  });
});

describe("the Apple Silicon test bundle guide", () => {
  it("tells the tester what the build shares with the installed app, and how to open it", () => {
    expect(guide).toContain("same app data");
    expect(guide).toContain("Quit Nautilus");
    expect(guide).toContain("Open Anyway");
    expect(guide).toContain("xattr -dr com.apple.quarantine");
    expect(guide).toContain("~/Applications");
  });

  it("says what is not in it, so a working build is not read as a release", () => {
    expect(guide).toContain("not a release");
    expect(guide).toContain("voice");
    expect(guide).toContain("no updater");
  });
});
