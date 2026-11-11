import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const workflow: string = readFileSync(new URL("../../.github/workflows/windows.yml", import.meta.url), "utf8");
const smoke: string = readFileSync(new URL("../../scripts/windows_install_smoke.ps1", import.meta.url), "utf8");

// The Windows job compiled the installer and kept it, which proves the compiler ran. It now runs
// the installer as an update or a scripted install would, and checks what a person would meet.
describe("Windows CI installs what it builds", () => {
  it("installs, launches and uninstalls the development installer after bundling it", () => {
    const bundle = workflow.indexOf("Bundle the development channel (NSIS)");
    const install = workflow.indexOf("Install, launch and uninstall the development installer");
    const keep = workflow.indexOf("Keep the installer");
    expect(bundle).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(bundle);
    expect(keep).toBeGreaterThan(install);
    expect(workflow).toContain("./scripts/windows_install_smoke.ps1 -Installer $installer -ProductName 'Nautilus for Mirror Dev' -Identifier 'ai.mirrormind.nautilus.dev' -Version $version");
    expect(workflow).toContain("shell: powershell");
  });

  it("checks the registered version, the executable, the shortcut, a live start and a clean uninstall", () => {
    expect(smoke).toContain("-ArgumentList '/S' -PassThru -Wait");
    expect(smoke).toContain("$entry.DisplayVersion -eq $Version");
    expect(smoke).toContain("Join-Path $installDir $entry.MainBinaryName");
    expect(smoke).toContain("mirror-host\\node\\node.exe");
    expect(smoke).toContain("-not $app.HasExited");
    expect(smoke).toContain("Check 'app data kept' (Test-Path $marker)");
    expect(smoke).toContain("Check 'registration removed' (-not (Test-Path $uninstallKey))");
    expect(smoke).toContain("exit 1");
  });
});
