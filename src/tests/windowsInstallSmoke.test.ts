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

  // An update can start before the install folder's Node has left. Only a real installer shows what it
  // does then: it is a 32-bit process, and its step is PowerShell started from NSIS.
  it("runs the installer again over a Node of the install folder, before the uninstall", () => {
    const held = smoke.indexOf("$held = Start-Process -FilePath $node");
    const again = smoke.indexOf("$again = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait");
    expect(held).toBeGreaterThan(smoke.indexOf("Stop-Process -Id $app.Id -Force"));
    expect(again).toBeGreaterThan(held);
    expect(smoke.indexOf("$uninstall = Start-Process")).toBeGreaterThan(again);
    expect(smoke).toContain("(Get-Item $node).LastWriteTime = $stale");
    expect(smoke).toContain("Check 'the install folder''s Node was ended' $held.HasExited");
    expect(smoke).toContain("Check 'node.exe was written again' ((Get-Item $node).LastWriteTime -ne $stale)");
    expect(smoke).toContain("Check 'another Node on the machine was left alone' (-not $other.HasExited)");
  });
});
