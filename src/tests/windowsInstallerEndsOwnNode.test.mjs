import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// An update can start while a Node process of the install folder has not left yet: the Mirror host, the
// learning host (a second host, a minute after launch and every ten minutes) and the Pi invocations all
// run `mirror-host\node\node.exe`. The installer then stops at "Error opening file for writing" in its
// default mode, or leaves the old node.exe in place without a word in the silent one. The installer ends
// those processes, and only those, before it writes its files.
//
// What the real installer does is checked by the Windows CI job (scripts/windows_install_smoke.ps1). Here:
// the wiring, the rules of the step as text, and the step compiled alone where an NSIS compiler is at hand.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const hooksPath = config.bundle.windows.nsis.installerHooks;
const hooksFile = join(root, "src-tauri", hooksPath ?? "missing");
const hooks = existsSync(hooksFile) ? readFileSync(hooksFile, "utf8") : "";
const code = hooks.split(/\r?\n/).filter((line) => !line.trimStart().startsWith(";")).join("\n");

describe("The Windows installer ends the install folder's Node processes before writing", () => {
  it("is given its hooks by the configuration every Windows build reads", () => {
    expect(hooksPath).toBe("windows/installer-hooks.nsh");
    expect(code).toContain("!macro NSIS_HOOK_PREINSTALL");
    expect(config.bundle.windows.nsis.installerIcon).toBe("icons/icon.ico");
  });

  it("ends a process only after its executable's full path matched this install folder's Node", () => {
    expect(code).toContain('StrCpy $OwnNodePath "$INSTDIR\\mirror-host\\node\\node.exe"');
    const asked = code.indexOf("kernel32::QueryFullProcessImageNameW");
    const compared = code.indexOf("${If} $OwnNodeImage == $OwnNodePath");
    const ended = code.indexOf("kernel32::TerminateProcess");
    expect(asked).toBeGreaterThan(-1);
    expect(compared).toBeGreaterThan(asked);
    expect(ended).toBeGreaterThan(compared);
    expect(code.match(/TerminateProcess/g)).toHaveLength(1);
    // Nothing is ended by its name alone, the way taskkill or the bundler's KillProcess would.
    expect(code).not.toMatch(/taskkill|KillProcess/i);
  });

  it("starts no other program to do it", () => {
    // PowerShell cost seconds of every installation, and a 32-bit one (the installer is a 32-bit process)
    // reads no path of a 64-bit process through Get-Process: it matched nothing and reported nothing.
    expect(code).not.toMatch(/powershell|nsExec|ExecWait|ExecShell|cmd\.exe/i);
  });

  it("waits a bounded time for each process and leaves the registers it borrows as they were", () => {
    expect(code).toMatch(/WaitForSingleObject\(p \$OwnNodeHandle, i 10000\)/);
    expect(code.indexOf("Push $R8")).toBeLessThan(code.indexOf("Pop $R8"));
    expect(code.indexOf("Push $R9")).toBeLessThan(code.indexOf("Pop $R9"));
  });

  const makensis = join(process.env.LOCALAPPDATA ?? "", "tauri", "NSIS", "makensis.exe");
  it.skipIf(process.platform !== "win32" || !existsSync(makensis))(
    "compiled alone, ends the Nodes running from the install folder and leaves a Node from elsewhere alone",
    async () => {
      const scratch = mkdtempSync(join(tmpdir(), "nautilus-installer-hook-"));
      const installed = join(scratch, "installed", "mirror-host", "node", "node.exe");
      const elsewhere = join(scratch, "elsewhere", "mirror-host", "node", "node.exe");
      for (const copy of [installed, elsewhere]) {
        mkdirSync(dirname(copy), { recursive: true });
        copyFileSync(process.execPath, copy);
      }
      // The step alone, as a silent program whose "install folder" comes from the environment.
      writeFileSync(
        join(scratch, "step.nsi"),
        [
          "Unicode true",
          `!include "${hooksFile}"`,
          'Name "step"',
          'OutFile "step.exe"',
          "RequestExecutionLevel user",
          "SilentInstall silent",
          "Section",
          "  ReadEnvStr $INSTDIR NAUTILUS_STEP_INSTALL_DIR",
          "  !insertmacro NSIS_HOOK_PREINSTALL",
          "SectionEnd",
          "",
        ].join("\r\n"),
      );
      const compiled = spawnSync(makensis, ["/V2", join(scratch, "step.nsi")], { encoding: "utf8" });
      expect(compiled.status, compiled.stdout + compiled.stderr).toBe(0);
      expect(compiled.stdout).not.toMatch(/warning/i);

      const idle = ["-e", "setInterval(() => {}, 1000)"];
      const own = [spawn(installed, idle, { stdio: "ignore" }), spawn(installed, idle, { stdio: "ignore" })];
      const other = spawn(elsewhere, idle, { stdio: "ignore" });
      const left = own.map((child) => new Promise((resolve) => child.once("exit", () => resolve(true))));
      const within = (ms) => new Promise((resolve) => setTimeout(() => resolve(false), ms));
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const ran = spawnSync(join(scratch, "step.exe"), [], {
          env: { ...process.env, NAUTILUS_STEP_INSTALL_DIR: join(scratch, "installed") },
        });
        expect(ran.status).toBe(0);
        expect(await Promise.race([Promise.all(left), within(5000)])).toEqual([true, true]);
        expect(other.exitCode).toBeNull();
        expect(other.signalCode).toBeNull();
      } finally {
        for (const child of [...own, other]) child.kill();
        await new Promise((resolve) => setTimeout(resolve, 500));
        rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      }
    },
    90000,
  );
});
