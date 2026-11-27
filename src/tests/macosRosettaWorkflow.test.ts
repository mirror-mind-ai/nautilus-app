import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const workflow: string = readFileSync(new URL("../../.github/workflows/macos-rosetta.yml", import.meta.url), "utf8");
const macos: string = readFileSync(new URL("../../.github/workflows/macos.yml", import.meta.url), "utf8");

// CR299: nobody on the team has an Apple Silicon Mac, so the question of whether the x64 runtime the
// app ships runs under Rosetta is answered by a job on GitHub's arm64 runner that only a person starts.
describe("the macOS Rosetta workflow", () => {
  it("runs by hand only, on the arm64 runner, with a read-only token", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(workflow).toContain("runs-on: macos-latest");
    expect(workflow).toMatch(/permissions:\n\s+contents: read/);
  });

  it("pins every third-party action by the same commit macos.yml uses", () => {
    const uses = workflow.match(/uses: \S+@[0-9a-f]{40}/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(4);
    for (const line of uses) expect(macos).toContain(line);
    expect(workflow).not.toMatch(/uses: \S+@(?![0-9a-f]{40}\b)/);
  });

  it("lays out the x64 runtime, proves it is translated, then runs the real tests against it", () => {
    const rosetta = workflow.indexOf("Make sure Rosetta is present");
    const materialize = workflow.indexOf("materialize --platform darwin-x64");
    const translated = workflow.indexOf("The runtime's Node is x64 and runs translated");
    const real = workflow.indexOf("real_host real_pi_install real_pi_auth");
    expect(rosetta).toBeGreaterThan(-1);
    expect(materialize).toBeGreaterThan(rosetta);
    expect(translated).toBeGreaterThan(materialize);
    expect(real).toBeGreaterThan(translated);
    expect(workflow).toContain("softwareupdate --install-rosetta --agree-to-license");
    expect(workflow).toContain("MIRROR_HOST_RUNTIME");
    expect(workflow).toContain("--target x86_64-apple-darwin");
  });

  it("only counts a run as translated when the host is arm64 and the runtime Node reports x64", () => {
    expect(workflow).toContain('test "$host" = arm64');
    expect(workflow).toContain('test "$reported" = "$EXPECTED_ARCH"');
    expect(workflow).toContain("process.arch");
  });

  it("can be made to fail on purpose, so a green run means something", () => {
    expect(workflow).toContain("falsifier:");
    expect(workflow).toContain("missing-runtime");
    expect(workflow).toContain("expect-arm64");
  });
});
