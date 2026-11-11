// What a test may assume of the platform. The product runs on macOS and Windows; some tests
// exercise POSIX facts that Windows does not have — permission bits, symlinks without Developer
// Mode, lsof, /bin/sleep — and those are skipped there rather than failing for the wrong reason.
// Everything else runs on both, including tar: Windows ships bsdtar in System32, and the Git Bash
// tar that may sit first on a developer's PATH reads `C:\…` as a remote host.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const windows = process.platform === "win32";

/** The archive tool the tests shell out to: System32's tar on Windows, /usr/bin/tar elsewhere. */
export function systemTar() {
  if (!windows) return "/usr/bin/tar";
  const system = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  return existsSync(system) ? system : "tar";
}

/** Why a POSIX-only test is skipped on Windows; appended to the test name by `posixOnly`. */
export const POSIX_ONLY = "POSIX only: permission bits, symlinks or lsof";
