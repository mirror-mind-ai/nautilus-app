import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeWindowsInstaller,
  githubInstallerAssetName,
  latestWindowsChecksumsUrl,
  latestWindowsDownloadManifestUrl,
  latestWindowsInstallerUrl,
  renderWindowsConfirmation,
  renderWindowsPublicationEvidence,
  selectWindowsReleaseRun,
  stageWindowsPublication,
  verifyPublishedWindowsEndpoints,
  verifyUpdaterSignature,
  verifyWindowsInstallerDescriptor,
  windowsChecksums,
  windowsChecksumsName,
  windowsConfirmationPayload,
  windowsDescriptorName,
  windowsInstallerArtifact,
  windowsInstallerName,
  windowsInstallerUrl,
  windowsManifestFor,
  windowsManifestPaths,
  windowsPublicationCommands,
  windowsReleaseWorkflow,
  windowsTargets,
} from "../../scripts/windows_release.mjs";
import { CURRENT_RELEASE_LINE } from "../../scripts/release_line.mjs";

// The Windows half of a release. The installer is built in CI without the updater key; the route
// signs it on the publisher's machine and publishes what installed Windows applications poll.

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Made by the Tauri CLI itself (`tauri signer generate`, `tauri signer sign`) with a key created
// for this fixture and discarded: it is what proves the check reads the real format.
const fixture = {
  data: Buffer.from("Nautilus updater signature fixture: these bytes stand in for an installer.\n"),
  pubkey: "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENGNjU1MDRGNEQzOTBCOUMKUldTY0N6bE5UMUJsejkvRHlMdDkxQ2hiSC9mNHY1ZzF6SWplcGs4Z0RDUFhQc0c5OURmdHF6SGYK",
  signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVTY0N6bE5UMUJseit1aUprV0dEWjVmVWJndXVRcjhMbjJnUkx3dWovaGxNRjhIZVhiSGQyZ1ZXYUtvaHdrT1NUMmxRaWsxWVpqMmwyMHoyTWdlclMyS3pqT3hKZEp4clFvPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzk1NTU5MTcxCWZpbGU6aW5zdGFsbGVyLWZpeHR1cmUuYmluCklneVB2T2JNaTBVUTg0a3NXdlgzVUtFVjdOTnRCWXhrUmtpRWRlaUsrUWNSakJlaW0wS296UnRYcllCZWNVYzk0VHlIRkRtM1dTeTltMU8ydUVRQ0JnPT0K",
};
const applicationPubkey = JSON.parse(read(CURRENT_RELEASE_LINE.updaterConfig)).plugins.updater.pubkey;

const version = "0.1.1-test.1";
const revision = "a".repeat(40);
const base = "https://updates.mirrormind.sh/nautilus";
const installerBytes = Buffer.from("installer bytes");
const installerName = "Nautilus for Mirror_0.1.1-test.1_x64-setup.exe";

const temporaryRoots = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function temporaryPath() {
  const root = mkdtempSync(join(tmpdir(), "nautilus-windows-release-"));
  temporaryRoots.push(root);
  return root;
}

describe("what a Windows release publishes", () => {
  it("names the installer as Tauri bundles it, and addresses it where the macOS artifacts are", () => {
    expect(windowsInstallerName(version)).toBe(installerName);
    expect(windowsInstallerUrl(version)).toBe(`${base}/artifacts/Nautilus%20for%20Mirror_0.1.1-test.1_x64-setup.exe`);
    expect(latestWindowsInstallerUrl()).toBe(`${base}/downloads/windows/nautilus-latest-setup.exe`);
    expect(latestWindowsDownloadManifestUrl()).toBe(`${base}/downloads/windows/latest.json`);
    expect(latestWindowsChecksumsUrl()).toBe(`${base}/downloads/windows/SHA256SUMS`);
  });

  // As the Mirror installer publishes it: one sha256sum line beside the file, naming it as it is named there.
  it("writes SHA256SUMS for each place the installer is downloaded from, under the name it has there", () => {
    expect(windowsChecksumsName).toBe("SHA256SUMS");
    expect(windowsChecksums({ name: "nautilus-latest-setup.exe", sha256: "a".repeat(64) })).toBe(`${"a".repeat(64)}  nautilus-latest-setup.exe\n`);
    expect(() => windowsChecksums({ name: "x.exe", sha256: "abc" })).toThrow(/real SHA-256/);
    // GitHub replaces an asset's spaces with periods; the installer is uploaded under that name.
    expect(githubInstallerAssetName(version)).toBe("Nautilus.for.Mirror_0.1.1-test.1_x64-setup.exe");
  });

  // `{{target}}` is the operating system alone unless the application names another target.
  it("writes a manifest for every path an installed Windows application can poll", () => {
    expect([...windowsTargets]).toEqual(["windows", "windows-x86_64"]);
    expect(windowsManifestPaths({ currentVersions: ["0.1.1-test.0", version] })).toEqual([
      "windows/0.1.1-test.0/latest.json",
      "windows/0.1.1-test.1/latest.json",
      "windows-x86_64/0.1.1-test.0/latest.json",
      "windows-x86_64/0.1.1-test.1/latest.json",
    ]);
  });

  it("gives the updater the installer itself, with the fields the macOS manifest has", () => {
    expect(windowsManifestFor({ version, signature: " abc\n", pubDate: "2026-11-24T12:00:00Z" })).toEqual({
      version,
      notes: `${base}/releases/v0.1.1-test.1.md`,
      pub_date: "2026-11-24T12:00:00Z",
      url: `${base}/artifacts/Nautilus%20for%20Mirror_0.1.1-test.1_x64-setup.exe`,
      signature: "abc",
    });
  });
});

describe("the installer is the one built from the tag", () => {
  const descriptor = describeWindowsInstaller({ version, revision, name: installerName, bytes: installerBytes });

  it("is described by CI with its version, revision, size and digest, and as not signed", () => {
    expect(descriptor).toMatchObject({
      schemaVersion: "1.0.0",
      identifier: "ai.mirrormind.nautilus",
      version,
      tag: "v0.1.1-test.1",
      revision,
      installer: { name: installerName, bytes: installerBytes.length, sha256: sha256(installerBytes) },
    });
    expect(descriptor.updaterSignature).toMatch(/^not signed/);
    expect(() => describeWindowsInstaller({ version, revision: "abc", name: installerName, bytes: installerBytes })).toThrow(/full Git SHA/);
    expect(() => describeWindowsInstaller({ version, revision, name: "Nautilus for Mirror Dev_0.1.1-test.1_x64-setup.exe", bytes: installerBytes })).toThrow(/must be named/);
    expect(() => describeWindowsInstaller({ version, revision, name: installerName, bytes: Buffer.alloc(0) })).toThrow(/empty/);
  });

  it("is accepted when the descriptor, the tag and the downloaded bytes agree", () => {
    expect(verifyWindowsInstallerDescriptor({ descriptor, version, revision, bytes: installerBytes }))
      .toEqual({ name: installerName, sha256: sha256(installerBytes), bytes: installerBytes.length });
  });

  it("is refused when it was built from another revision, as another version, for another channel, or is not these bytes", () => {
    const refuse = (patch, bytes = installerBytes) => () => verifyWindowsInstallerDescriptor({ descriptor: { ...descriptor, ...patch }, version, revision, bytes });
    expect(refuse({ revision: "b".repeat(40) })).toThrow(/built from b{40}, not the tag's a{40}/);
    expect(refuse({ version: "0.1.1-test.0" })).toThrow(/built as 0\.1\.1-test\.0/);
    expect(refuse({ identifier: "ai.mirrormind.nautilus.dev" })).toThrow(/built for ai\.mirrormind\.nautilus\.dev/);
    expect(refuse({}, Buffer.from("other bytes"))).toThrow(/the downloaded installer is/);
    expect(refuse({ schemaVersion: "9" })).toThrow(/unknown descriptor schema/);
    expect(() => verifyWindowsInstallerDescriptor({ descriptor: undefined, version, revision, bytes: installerBytes })).toThrow(/not the one built from this release/);
  });

  it("is looked for in the workflow run of the tag's revision, and nothing else is signed in its place", () => {
    const run = (patch) => ({ databaseId: 1, headSha: revision, status: "completed", conclusion: "success", url: "https://github.com/o/r/actions/runs/1", event: "push", ...patch });
    expect(selectWindowsReleaseRun([run({ databaseId: 2, conclusion: "failure" }), run()], revision).databaseId).toBe(1);
    expect(() => selectWindowsReleaseRun([run({ status: "in_progress", conclusion: null })], revision)).toThrow(/still running/);
    expect(() => selectWindowsReleaseRun([run({ conclusion: "failure" })], revision)).toThrow(/did not succeed.*Nothing was signed/s);
    expect(() => selectWindowsReleaseRun([run({ headSha: "c".repeat(40) })], revision)).toThrow(/No Windows release workflow run exists/);
  });
});

describe("the updater signature is checked before publication, as the application will check it", () => {
  it("accepts a signature the Tauri CLI made over these bytes with the trusted key", () => {
    expect(verifyUpdaterSignature(fixture)).toEqual({ keyId: "CF65504F4D390B9C", trustedComment: "timestamp:1795559171\tfile:installer-fixture.bin" });
  });

  it("refuses bytes that are not the signed ones", () => {
    expect(() => verifyUpdaterSignature({ ...fixture, data: Buffer.concat([fixture.data, Buffer.from("x")]) })).toThrow(/does not match the installer/);
  });

  // The failure this exists for: signing with a key other than the one installed applications carry.
  it("refuses a signature made by a key the application does not trust, naming both keys", () => {
    expect(() => verifyUpdaterSignature({ ...fixture, pubkey: applicationPubkey })).toThrow(/made by key CF65504F4D390B9C, not by FB7517E14B8B586C/);
  });

  it("refuses an altered trusted comment and anything that is not a signature", () => {
    const text = Buffer.from(fixture.signature, "base64").toString("utf8").replace("installer-fixture.bin", "another-name.bin");
    expect(() => verifyUpdaterSignature({ ...fixture, signature: Buffer.from(text).toString("base64") })).toThrow(/trusted comment was altered/);
    expect(() => verifyUpdaterSignature({ ...fixture, signature: "" })).toThrow(/not a minisign document/);
    expect(() => verifyUpdaterSignature({ ...fixture, pubkey: Buffer.from("untrusted comment: x\nAAAA\n").toString("base64") })).toThrow(/not an Ed25519 minisign key/);
  });
});

describe("staging and publishing", () => {
  function staged() {
    const root = temporaryPath();
    writeFileSync(join(root, installerName), installerBytes);
    writeFileSync(join(root, `${installerName}.sig`), "signature-text\n");
    return stageWindowsPublication({
      version,
      currentVersions: ["0.1.1-test.0", version],
      installer: join(root, installerName),
      signature: join(root, `${installerName}.sig`),
      stageDir: join(root, "stage"),
      pubDate: "2026-11-24T12:00:00Z",
    });
  }

  it("stages the installer, its signature, the stable download and the manifests, publishing nothing", () => {
    const plan = staged();
    const at = (...parts) => join(plan.stageDir, ...parts);
    expect(readFileSync(at("artifacts", installerName))).toEqual(installerBytes);
    expect(readFileSync(at("artifacts", `${installerName}.sig`), "utf8")).toBe("signature-text\n");
    expect(readFileSync(at("downloads", "windows", "nautilus-latest-setup.exe"))).toEqual(installerBytes);
    expect(JSON.parse(readFileSync(at("downloads", "windows", "latest.json"), "utf8"))).toEqual({
      version,
      installer: `${base}/downloads/windows/nautilus-latest-setup.exe`,
      artifact: `${base}/artifacts/Nautilus%20for%20Mirror_0.1.1-test.1_x64-setup.exe`,
      sha256: sha256(installerBytes),
      bytes: installerBytes.length,
      releaseNotes: `${base}/releases/v0.1.1-test.1.md`,
    });
    for (const path of ["windows/0.1.1-test.0", "windows/0.1.1-test.1", "windows-x86_64/0.1.1-test.0", "windows-x86_64/0.1.1-test.1"]) {
      expect(JSON.parse(readFileSync(at("manifests", path, "latest.json"), "utf8"))).toMatchObject({
        version,
        url: `${base}/artifacts/Nautilus%20for%20Mirror_0.1.1-test.1_x64-setup.exe`,
        signature: "signature-text",
        release_reading: { version, release_notes_url: `${base}/releases/v0.1.1-test.1.md` },
      });
    }
    expect(readFileSync(at("downloads", "windows", "SHA256SUMS"), "utf8")).toBe(`${sha256(installerBytes)}  nautilus-latest-setup.exe\n`);
    // For the GitHub release: the installer under the name GitHub gives it, and its SHA256SUMS.
    expect(readFileSync(at("github", "Nautilus.for.Mirror_0.1.1-test.1_x64-setup.exe"))).toEqual(installerBytes);
    expect(readFileSync(at("github", "SHA256SUMS"), "utf8")).toBe(`${sha256(installerBytes)}  Nautilus.for.Mirror_0.1.1-test.1_x64-setup.exe\n`);
    expect(plan.githubAssets.map((path) => path.replace(/\\/g, "/").split("/").pop())).toEqual(["Nautilus.for.Mirror_0.1.1-test.1_x64-setup.exe", "SHA256SUMS"]);
    // Nothing of the macOS publication is staged, so publishing this cannot overwrite it.
    expect(existsSync(at("downloads", "macos"))).toBe(false);
    expect(existsSync(at("manifests", "darwin"))).toBe(false);
    expect(plan.webRoot).toBe("/var/www/mirror-desktop-updates/nautilus");
  });

  it("uploads the installer before any manifest names it, to the folders the macOS publication uses", () => {
    const commands = windowsPublicationCommands({ stageDir: "/stage", sshHost: "host", webRoot: "/var/www/mirror-desktop-updates/nautilus", manifestPaths: ["windows/0.1.1-test.1/latest.json"] });
    const text = commands.map(([command, args]) => `${command} ${args.join(" ")}`);
    const index = (destination) => text.findIndex((line) => line.includes(`host:/var/www/mirror-desktop-updates/nautilus/${destination}`));
    expect(index("artifacts/")).toBeGreaterThan(-1);
    expect(index("downloads/windows/")).toBeGreaterThan(-1);
    expect(index("windows/0.1.1-test.1/latest.json")).toBeGreaterThan(Math.max(index("artifacts/"), index("downloads/windows/")));
    expect(text.join("\n")).not.toMatch(/downloads\/macos|darwin/);
  });
});

describe("post-publication verification is blocking", () => {
  const retainedVersions = ["0.1.1-test.0", version];
  const signature = "confirmed-signature";
  const manifest = { version, url: windowsInstallerUrl(version, base), signature };
  const alias = { version, installer: latestWindowsInstallerUrl(base), sha256: sha256(installerBytes) };
  const verify = ({ json = {}, binary = {} } = {}) => verifyPublishedWindowsEndpoints({
    baseUrl: base, version, retainedVersions, expectedInstallerSha256: sha256(installerBytes), expectedSignature: signature,
    fetchJson: async (url) => {
      const override = Object.entries(json).find(([part]) => url.includes(part))?.[1];
      if (override instanceof Error) throw override;
      return override ?? (url.endsWith("/downloads/windows/latest.json") ? alias : manifest);
    },
    fetchBinary: async (url) => Object.entries(binary).find(([part]) => url.includes(part))?.[1]
      ?? (url.endsWith("/SHA256SUMS") ? Buffer.from(windowsChecksums({ name: "nautilus-latest-setup.exe", sha256: sha256(installerBytes) })) : installerBytes),
  });

  it("passes when every polled URL, the update artifact and the stable download serve this release", async () => {
    const result = await verify();
    expect(result.status).toBe("verified");
    expect(result.checks.map((check) => check.url)).toEqual([
      `${base}/windows/0.1.1-test.0/latest.json`, `${base}/windows/0.1.1-test.1/latest.json`,
      `${base}/windows-x86_64/0.1.1-test.0/latest.json`, `${base}/windows-x86_64/0.1.1-test.1/latest.json`,
    ]);
    expect(result.artifact).toEqual({ url: windowsInstallerUrl(version, base), sha256: sha256(installerBytes), bytes: installerBytes.length });
    expect(result.downloadAlias).toEqual({
      url: `${base}/downloads/windows/latest.json`, version,
      installerUrl: `${base}/downloads/windows/nautilus-latest-setup.exe`, sha256: sha256(installerBytes), bytes: installerBytes.length,
      checksumsUrl: `${base}/downloads/windows/SHA256SUMS`,
    });
  });

  it("fails on a stale manifest, another signature, another address, other bytes, or a stale download", async () => {
    await expect(verify({ json: { "windows/0.1.1-test.0": { ...manifest, version: "0.1.1-test.0" } } })).rejects.toThrow(/serves 0\.1\.1-test\.0 instead of 0\.1\.1-test\.1/);
    await expect(verify({ json: { "windows-x86_64/0.1.1-test.1": { ...manifest, signature: "other" } } })).rejects.toThrow(/a signature other than the confirmed one/);
    await expect(verify({ json: { "windows/0.1.1-test.1": { ...manifest, url: "https://elsewhere/x.exe" } } })).rejects.toThrow(/points at https:\/\/elsewhere\/x\.exe/);
    await expect(verify({ json: { "windows/0.1.1-test.1": new Error("HTTP 404") } })).rejects.toThrow(/unreachable: HTTP 404/);
    await expect(verify({ binary: { "/artifacts/": Buffer.from("tampered") } })).rejects.toThrow(/artifacts.*instead of the confirmed/);
    await expect(verify({ binary: { "/downloads/windows/nautilus-latest": Buffer.from("old installer") } })).rejects.toThrow(/nautilus-latest-setup\.exe serves/);
    // A stale SHA256SUMS would make get.ps1 refuse the new installer, or accept an old one.
    await expect(verify({ binary: { "/SHA256SUMS": Buffer.from(`${"b".repeat(64)}  nautilus-latest-setup.exe\n`) } })).rejects.toThrow(/SHA256SUMS does not name nautilus-latest-setup\.exe with the confirmed digest/);
    await expect(verify({ binary: { "/SHA256SUMS": Buffer.from(`${sha256(installerBytes)}  another.exe\n`) } })).rejects.toThrow(/SHA256SUMS does not name/);
    await expect(verify({ json: { "/downloads/windows/latest.json": { ...alias, version: "0.1.1-test.0" } } })).rejects.toThrow(/announces 0\.1\.1-test\.0/);
  });

  it("cannot run without the confirmed digest and signature", async () => {
    await expect(verifyPublishedWindowsEndpoints({ baseUrl: base, version, retainedVersions, expectedSignature: signature })).rejects.toThrow(/confirmed installer digest/);
    await expect(verifyPublishedWindowsEndpoints({ baseUrl: base, version, retainedVersions, expectedInstallerSha256: sha256(installerBytes) })).rejects.toThrow(/confirmed updater signature/);
  });
});

describe("one confirmation, over what was fetched and signed", () => {
  const input = {
    version, tag: "v0.1.1-test.1", revision, baseUrl: `${base}/`,
    workflowRun: { id: 7, url: "https://github.com/o/r/actions/runs/7", event: "push" },
    installer: { name: installerName, sha256: sha256(installerBytes), bytes: installerBytes.length },
    signature: { keyId: "FB7517E14B8B586C", value: "sig" },
    manifestPaths: ["windows/0.1.1-test.1/latest.json"],
    actions: ["add the installer to the GitHub release", "publish"],
  };

  it("shows the run, the installer's digest, the key and every action", () => {
    const text = renderWindowsConfirmation(windowsConfirmationPayload(input));
    for (const expected of ["PREPARED — one confirmation required", "v0.1.1-test.1 at " + revision, "actions/runs/7", sha256(installerBytes), "public key FB7517E14B8B586C", `${base}\n`, "windows/0.1.1-test.1/latest.json", "  - publish"]) {
      expect(text).toContain(expected);
    }
  });

  it("is refused without a real digest, a verified signature, the run or the tag of this version", () => {
    expect(() => windowsConfirmationPayload({ ...input, installer: { ...input.installer, sha256: "x" } })).toThrow(/real SHA-256/);
    expect(() => windowsConfirmationPayload({ ...input, signature: { value: "sig" } })).toThrow(/verified updater signature/);
    expect(() => windowsConfirmationPayload({ ...input, workflowRun: {} })).toThrow(/workflow run/);
    expect(() => windowsConfirmationPayload({ ...input, tag: "v0.1.1-test.0" })).toThrow(/Release tag must be/);
  });

  it("records what was verified, and says the installer is not code-signed", () => {
    const evidence = renderWindowsPublicationEvidence({
      ...input, date: "2026-11-24", baseUrl: base, githubReleaseUrl: "https://github.com/o/r/releases/tag/v0.1.1-test.1",
      verification: {
        checks: [{ url: `${base}/windows/0.1.1-test.1/latest.json`, version, signatureBytes: 3 }],
        artifact: { url: windowsInstallerUrl(version, base), sha256: sha256(installerBytes), bytes: installerBytes.length },
        downloadAlias: { url: latestWindowsDownloadManifestUrl(base), version, installerUrl: latestWindowsInstallerUrl(base), sha256: sha256(installerBytes), bytes: installerBytes.length },
      },
    });
    expect(evidence).toContain("# Windows Release Publication — v0.1.1-test.1");
    expect(evidence).toContain(`| \`${base}/windows/0.1.1-test.1/latest.json\` | \`${version}\` | 3 |`);
    expect(evidence).toContain("Not code-signed");
    expect(evidence).toContain("was not given to CI");
  });
});

// The way in that needs no code signature, as the Mirror installer does it: a file PowerShell
// downloads carries no mark of the web, and the SHA-256 check takes the place of SmartScreen's.
describe("get.ps1, the one-line install", () => {
  const script = read("get.ps1");
  const windowsOnly = it.skipIf(process.platform !== "win32");

  it("reads the stable download the route publishes and verifies, and nothing else", () => {
    expect(script).toContain(`"${base}/downloads/windows"`);
    expect(script).toContain(`$name = "${CURRENT_RELEASE_LINE.windowsDownloadAlias}"`);
    expect(script).toContain("irm https://raw.githubusercontent.com/mirror-mind-ai/nautilus-app/main/get.ps1 | iex");
    expect(read("README.md")).toContain("irm https://raw.githubusercontent.com/mirror-mind-ai/nautilus-app/main/get.ps1 | iex");
    // Windows PowerShell 5.1 reads a file without a BOM as ANSI: the script stays ASCII.
    expect(/^[\x00-\x7F]*$/.test(script)).toBe(true);
    expect(script).not.toMatch(/-Verb\s+RunAs|Set-ExecutionPolicy/i);
  });

  async function serving(files, run) {
    const requests = [];
    const server = createServer((request, response) => {
      const name = decodeURIComponent(request.url.split("/").pop());
      requests.push(name);
      if (!(name in files)) { response.writeHead(404).end(); return; }
      response.writeHead(200, { "content-type": "application/octet-stream" }).end(files[name]);
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    try {
      return await run(`http://127.0.0.1:${server.address().port}/downloads/windows/`, requests);
    } finally {
      await new Promise((done) => server.close(done));
    }
  }
  const get = (url) => new Promise((done) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(repositoryRoot, "get.ps1")], {
      env: { ...process.env, NAUTILUS_INSTALLER_URL: url, NAUTILUS_INSTALLER_DOWNLOAD_ONLY: "1" }, encoding: "utf8",
    }, (error, stdout, stderr) => done({ code: error?.code ?? 0, stdout, stderr }));
  });
  const downloaded = (stdout) => stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.endsWith("nautilus-latest-setup.exe")).pop();
  const temporaryFolders = () => readdirSync(process.env.TEMP).filter((entry) => entry.startsWith("Nautilus-Setup-")).sort();
  const sums = (bytes, name = "nautilus-latest-setup.exe") => windowsChecksums({ name, sha256: sha256(bytes) });

  windowsOnly("downloads what SHA256SUMS names, checks it and hands it over without the mark of the web", async () => {
    const result = await serving({ "SHA256SUMS": sums(installerBytes), "nautilus-latest-setup.exe": installerBytes, "latest.json": JSON.stringify({ version }) }, get);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Nautilus for Mirror ${version}`);
    const path = downloaded(result.stdout);
    expect(readFileSync(path)).toEqual(installerBytes);
    expect(existsSync(`${path}:Zone.Identifier`)).toBe(false);
    await rm(dirname(path), { recursive: true, force: true });
  }, 60000);

  windowsOnly("runs nothing and keeps nothing when the bytes are not the published ones", async () => {
    const before = temporaryFolders();
    const result = await serving({ "SHA256SUMS": sums(installerBytes), "nautilus-latest-setup.exe": Buffer.from("something else") }, get);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/SHA-256 mismatch for nautilus-latest-setup\.exe/);
    expect(result.stderr).toContain("Nothing was run.");
    expect(downloaded(result.stdout)).toBeUndefined();
    expect(temporaryFolders()).toEqual(before);
  }, 60000);

  windowsOnly("refuses a SHA256SUMS that names anything but the stable download, before downloading it", async () => {
    const before = temporaryFolders();
    for (const body of [sums(installerBytes, "evil.exe"), sums(installerBytes) + sums(installerBytes, "evil.exe"), "not a checksum file"]) {
      const result = await serving({ "SHA256SUMS": body, "nautilus-latest-setup.exe": installerBytes, "evil.exe": installerBytes }, async (url, requests) => ({ ...(await get(url)), requests }));
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("does not name nautilus-latest-setup.exe alone. Nothing was run.");
      expect(result.requests).toEqual(["SHA256SUMS"]);
      expect(temporaryFolders()).toEqual(before);
    }
  }, 90000);
});

describe("how the pieces are wired", () => {
  const workflow = read(`.github/workflows/${windowsReleaseWorkflow}`);
  const channel = read("scripts/mirror_desktop_channel.mjs");
  const packageJson = JSON.parse(read("package.json"));

  it("builds the user channel as it is installed, with the updater endpoint and key, and no signature", () => {
    // Derived from the user build, so it cannot drift from it: only the overlay and the key differ.
    const mode = channel.slice(channel.indexOf('channels["build-user-unsigned"] = {'), channel.indexOf("function cleanLaunchEnvironment"));
    expect(mode).toContain('...channels["build-user"],');
    expect(mode).toContain('args: [...channels["build-user"].args, "--config", "src-tauri/tauri.user-unsigned.conf.json"],');
    expect(mode).toContain("requiresUpdaterSigning: false,");
    expect(JSON.parse(read("src-tauri/tauri.user-unsigned.conf.json")).bundle).toEqual({ createUpdaterArtifacts: false });
    // The overlay turns off the signature only: the application still knows where to look and whom to trust.
    expect(JSON.parse(read("src-tauri/tauri.user-unsigned.conf.json")).plugins).toBeUndefined();
    expect(packageJson.scripts["tauri:build:user:unsigned"]).toBe("node scripts/mirror_desktop_channel.mjs build-user-unsigned");
    expect(packageJson.scripts["release:windows"]).toBe("node scripts/windows_release.mjs");
  });

  it("runs on a release tag, keeps the updater key out of CI and its token read-only", () => {
    expect(workflow).toMatch(/on:\n  push:\n    tags: \["v\*"\]\n  workflow_dispatch:/);
    expect(workflow).toMatch(/permissions:\n  contents: read\n/);
    expect(workflow).not.toMatch(/secrets\.|TAURI_SIGNING|contents: write/);
    expect(workflow).toContain("npm run tauri:build:user:unsigned -- --bundles nsis");
    expect(workflow).toContain("-ProductName 'Nautilus for Mirror' -Identifier 'ai.mirrormind.nautilus'");
    for (const uses of workflow.match(/uses: .+/g)) expect(uses).toMatch(/@[0-9a-f]{40} # /);
  });

  it("hands the route the artifact and the descriptor it asks for, built from the revision of the run", () => {
    expect(workflow).toContain(`name: ${windowsInstallerArtifact}`);
    expect(workflow).toContain('node scripts/windows_release.mjs describe --installer');
    expect(workflow).toContain('--revision "${{ github.sha }}"');
    expect(workflow).toContain("does not name the version in the tree");
    expect(windowsDescriptorName).toBe("windows-release.json");
  });

  it("keeps the macOS route as it was", () => {
    const deploy = read("scripts/release_deploy.mjs");
    expect(deploy).toContain('const defaultTargets = ["darwin", "darwin-x86_64", "darwin-aarch64"];');
    expect(deploy).not.toContain("windows_release");
    expect(CURRENT_RELEASE_LINE.downloadAlias).toBe("nautilus-latest.dmg");
    expect(CURRENT_RELEASE_LINE.windowsDownloadAlias).toBe("nautilus-latest-setup.exe");
  });
});
