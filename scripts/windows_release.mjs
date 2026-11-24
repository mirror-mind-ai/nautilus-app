#!/usr/bin/env node
// The Windows half of a release: the installer the Windows release workflow built from the tag is
// signed here, with the updater key that never leaves this machine, and published beside the
// macOS artifacts so that installed Windows applications are offered the update and the site has
// a stable download.
//
// It is a second route, run after `release:deploy publish`, and not a stage of it, for two
// reasons. The installer can only be built once the tag exists, on a Windows runner; and a
// Windows failure must neither block a macOS release nor leave one half published.
//
//   describe   (CI)          writes the descriptor that binds an installer to its tag and revision
//   plan                     dry run
//   prepare                  fetch from CI, check, sign, check the signature, stage, confirm
//   publish --yes            GitHub release asset, endpoint, blocking verification, evidence
import { spawnSync } from "node:child_process";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { parseSemver, releaseVersionAt } from "./release_candidate.mjs";
import { releaseNotesUrl, releaseReadingFromSource } from "./release_notes.mjs";
import { assertReleaseLine, CURRENT_RELEASE_LINE } from "./release_line.mjs";
import { defaultBaseUrl, manifestFor, manifestPaths, webRootForBaseUrl } from "./private_update_publish.mjs";
import { assertBaseUrlAgreement, deriveRetainedVersions, evidenceSlug } from "./release_deploy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSigningKey = `${process.env.HOME}/.mirror-desktop-updater/alpha/updater.key`;

// `{{target}}` is the operating system alone unless the application sets another target; the
// architecture-qualified path is published too, as it is for macOS.
export const windowsTargets = Object.freeze(["windows", "windows-x86_64"]);
export const windowsReleaseWorkflow = "windows-release.yml";
export const windowsInstallerArtifact = "nautilus-windows-x64-installer";
export const windowsDescriptorName = "windows-release.json";

const root = (baseUrl) => String(baseUrl).replace(/\/+$/, "");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/// The name Tauri gives the NSIS bundle of the user channel.
export function windowsInstallerName(version) {
  return `${CURRENT_RELEASE_LINE.productName}_${parseSemver(version)}_x64-setup.exe`;
}

/// What an installed application downloads: the installer itself is the Windows updater artifact.
export function windowsInstallerUrl(version, baseUrl = defaultBaseUrl) {
  return `${root(baseUrl)}/artifacts/${encodeURIComponent(windowsInstallerName(version))}`;
}

/// The stable address a site offers to someone who does not have the application yet.
export function latestWindowsInstallerUrl(baseUrl = defaultBaseUrl) {
  return `${root(baseUrl)}/downloads/windows/${CURRENT_RELEASE_LINE.windowsDownloadAlias}`;
}

export function latestWindowsDownloadManifestUrl(baseUrl = defaultBaseUrl) {
  return `${root(baseUrl)}/downloads/windows/latest.json`;
}

export function windowsManifestPaths({ currentVersions }) {
  return manifestPaths({ targets: [...windowsTargets], currentVersions });
}

/// Written by the workflow next to the installer. It is what lets the signing machine refuse an
/// installer that is not the one built from the tag being released.
export function describeWindowsInstaller({ version, revision, name, bytes }) {
  const releaseVersion = parseSemver(version);
  if (!/^[0-9a-f]{40}$/.test(revision ?? "")) throw new Error("The installer's source revision must be a full Git SHA.");
  if (name !== windowsInstallerName(releaseVersion)) {
    throw new Error(`The installer must be named ${windowsInstallerName(releaseVersion)}, not ${name}.`);
  }
  if (!bytes?.length) throw new Error("The installer is empty.");
  return {
    schemaVersion: "1.0.0",
    product: CURRENT_RELEASE_LINE.productName,
    identifier: CURRENT_RELEASE_LINE.identifier,
    version: releaseVersion,
    tag: `v${releaseVersion}`,
    revision,
    installer: { name, bytes: bytes.length, sha256: sha256(bytes) },
    updaterSignature: "not signed: the release route signs it on the publisher's machine",
  };
}

export function verifyWindowsInstallerDescriptor({ descriptor, version, revision, bytes }) {
  const releaseVersion = parseSemver(version);
  const problems = [];
  if (descriptor?.schemaVersion !== "1.0.0") problems.push(`unknown descriptor schema ${descriptor?.schemaVersion ?? "none"}`);
  if (descriptor?.identifier !== CURRENT_RELEASE_LINE.identifier) problems.push(`built for ${descriptor?.identifier ?? "no identifier"}, not ${CURRENT_RELEASE_LINE.identifier}`);
  if (descriptor?.version !== releaseVersion) problems.push(`built as ${descriptor?.version ?? "no version"}, not ${releaseVersion}`);
  if (descriptor?.revision !== revision) problems.push(`built from ${descriptor?.revision ?? "no revision"}, not the tag's ${revision}`);
  if (descriptor?.installer?.name !== windowsInstallerName(releaseVersion)) problems.push(`names ${descriptor?.installer?.name ?? "no installer"}, not ${windowsInstallerName(releaseVersion)}`);
  const digest = sha256(bytes);
  if (descriptor?.installer?.sha256 !== digest) problems.push(`describes ${descriptor?.installer?.sha256 ?? "no digest"} but the downloaded installer is ${digest}`);
  if (descriptor?.installer?.bytes !== bytes.length) problems.push(`describes ${descriptor?.installer?.bytes ?? "no size"} bytes but the downloaded installer has ${bytes.length}`);
  if (problems.length > 0) throw new Error(`The Windows installer is not the one built from this release:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  return { name: descriptor.installer.name, sha256: digest, bytes: bytes.length };
}

function decodeMinisignLines(value, label) {
  const text = Buffer.from(String(value ?? "").trim(), "base64").toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2 || !lines[0].startsWith("untrusted comment:")) throw new Error(`${label} is not a minisign document.`);
  return lines;
}

/// The check the updater plugin makes before it installs: the signature is over these bytes and
/// was made by the key whose public half the application carries. Run here so that a signature
/// from the wrong key is refused before publication instead of by every installed application.
export function verifyUpdaterSignature({ data, signature, pubkey }) {
  const keyLines = decodeMinisignLines(pubkey, "The updater public key");
  const key = Buffer.from(keyLines[1], "base64");
  if (key.length !== 42 || key.subarray(0, 2).toString("latin1") !== "Ed") throw new Error("The updater public key is not an Ed25519 minisign key.");
  const signatureLines = decodeMinisignLines(signature, "The updater signature");
  if (signatureLines.length < 4 || !signatureLines[2].startsWith("trusted comment: ")) throw new Error("The updater signature carries no trusted comment.");
  const signed = Buffer.from(signatureLines[1], "base64");
  const algorithm = signed.subarray(0, 2).toString("latin1");
  if (signed.length !== 74 || !["ED", "Ed"].includes(algorithm)) throw new Error("The updater signature is not an Ed25519 minisign signature.");
  const keyId = key.subarray(2, 10);
  const hex = (bytes) => Buffer.from(bytes).reverse().toString("hex").toUpperCase();
  if (!signed.subarray(2, 10).equals(keyId)) {
    throw new Error(`The signature was made by key ${hex(signed.subarray(2, 10))}, not by ${hex(keyId)}, the key installed applications trust.`);
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), key.subarray(10)]),
    format: "der",
    type: "spki",
  });
  const fileSignature = signed.subarray(10);
  // "ED" signs the BLAKE2b-512 digest of the file; "Ed" is the legacy form over the bytes themselves.
  const message = algorithm === "ED" ? createHash("blake2b512").update(data).digest() : data;
  if (!verifySignature(null, message, publicKey, fileSignature)) throw new Error("The updater signature does not match the installer.");
  const trustedComment = signatureLines[2].slice("trusted comment: ".length);
  const globalSignature = Buffer.from(signatureLines[3], "base64");
  if (!verifySignature(null, Buffer.concat([fileSignature, Buffer.from(trustedComment, "utf8")]), publicKey, globalSignature)) {
    throw new Error("The updater signature's trusted comment was altered.");
  }
  return { keyId: hex(keyId), trustedComment };
}

export function windowsManifestFor({ version, signature, baseUrl = defaultBaseUrl, pubDate, releaseReading }) {
  return { ...manifestFor({ version, signature, baseUrl, pubDate, releaseReading }), url: windowsInstallerUrl(version, baseUrl) };
}

export function stageWindowsPublication({ version, currentVersions, installer, signature, baseUrl = defaultBaseUrl, stageDir, releaseNote, pubDate }) {
  const releaseVersion = parseSemver(version);
  const installerBytes = readFileSync(installer);
  const signatureText = readFileSync(signature, "utf8").trim();
  const noteSource = readFileSync(releaseNote ?? resolve(repositoryRoot, "docs", "releases", `v${releaseVersion}.md`), "utf8");
  const releaseReading = releaseReadingFromSource({ version: releaseVersion, source: noteSource, baseUrl: `${root(baseUrl)}/releases` });
  const manifest = windowsManifestFor({ version: releaseVersion, signature: signatureText, baseUrl, pubDate, releaseReading });
  const paths = windowsManifestPaths({ currentVersions });
  const name = windowsInstallerName(releaseVersion);

  rmSync(stageDir, { recursive: true, force: true });
  const artifactsDir = resolve(stageDir, "artifacts");
  const downloadsDir = resolve(stageDir, "downloads", "windows");
  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(downloadsDir, { recursive: true });
  writeFileSync(resolve(artifactsDir, name), installerBytes);
  writeFileSync(resolve(artifactsDir, `${name}.sig`), `${signatureText}\n`);
  writeFileSync(resolve(downloadsDir, CURRENT_RELEASE_LINE.windowsDownloadAlias), installerBytes);
  writeFileSync(resolve(downloadsDir, "latest.json"), `${JSON.stringify({
    version: releaseVersion,
    installer: latestWindowsInstallerUrl(baseUrl),
    artifact: windowsInstallerUrl(releaseVersion, baseUrl),
    sha256: sha256(installerBytes),
    bytes: installerBytes.length,
    releaseNotes: releaseNotesUrl(`v${releaseVersion}`, `${root(baseUrl)}/releases`),
  }, null, 2)}\n`);
  const manifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
  for (const path of paths) {
    const destination = resolve(stageDir, "manifests", path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, manifestSource);
  }
  return {
    version: releaseVersion,
    baseUrl: root(baseUrl),
    stageDir,
    installerName: name,
    installerUrl: windowsInstallerUrl(releaseVersion, baseUrl),
    latestWindowsInstallerUrl: latestWindowsInstallerUrl(baseUrl),
    manifestPaths: paths,
    webRoot: webRootForBaseUrl(baseUrl),
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

/// The same host, folder scheme and permissions as the macOS publication. Manifests go last: until
/// they land, no installed application is told of an installer that is not there yet.
export function windowsPublicationCommands({ stageDir, sshHost = "szen-vps", webRoot = webRootForBaseUrl(defaultBaseUrl), manifestPaths: paths }) {
  const remoteDirs = ["artifacts", "downloads/windows", ...paths.map((path) => dirname(path))].map((path) => `${webRoot}/${path}`);
  return [
    ["ssh", [sshHost, `set -e; sudo mkdir -p ${remoteDirs.map(shellQuote).join(" ")}; sudo chown -R $USER:$USER ${shellQuote(webRoot)}`]],
    ["bash", ["-lc", `scp ${shellQuote(resolve(stageDir, "artifacts"))}/* ${shellQuote(`${sshHost}:${webRoot}/artifacts/`)}`]],
    ["bash", ["-lc", `scp ${shellQuote(resolve(stageDir, "downloads", "windows"))}/* ${shellQuote(`${sshHost}:${webRoot}/downloads/windows/`)}`]],
    ...paths.map((path) => ["scp", [resolve(stageDir, "manifests", path), `${sshHost}:${webRoot}/${path}`]]),
    ["ssh", [sshHost, `set -e; sudo find ${shellQuote(webRoot)} -type d -exec chmod 755 {} +; sudo find ${shellQuote(webRoot)} -type f -exec chmod 644 {} +`]],
  ];
}

/// Blocking, like the macOS verification: every URL a Windows installation polls or a person
/// downloads must serve this release, signed by the confirmed signature, with the confirmed bytes.
export async function verifyPublishedWindowsEndpoints({
  baseUrl, version, retainedVersions, expectedInstallerSha256, expectedSignature,
  fetchJson = defaultFetchJson, fetchBinary = defaultFetchBinary,
}) {
  const releaseVersion = parseSemver(version);
  if (!/^[0-9a-f]{64}$/.test(expectedInstallerSha256 ?? "")) throw new Error("Post-publication verification requires the confirmed installer digest.");
  if (!expectedSignature?.trim()) throw new Error("Post-publication verification requires the confirmed updater signature.");
  const checks = [];
  const failures = [];
  const artifactUrl = windowsInstallerUrl(releaseVersion, baseUrl);
  for (const path of windowsManifestPaths({ currentVersions: retainedVersions })) {
    const url = `${root(baseUrl)}/${path}`;
    try {
      const manifest = await fetchJson(url);
      if (manifest?.version !== releaseVersion) failures.push(`${url} serves ${manifest?.version ?? "no version"} instead of ${releaseVersion}.`);
      else if (manifest.url !== artifactUrl) failures.push(`${url} points at ${manifest.url ?? "nothing"} instead of ${artifactUrl}.`);
      else if (String(manifest.signature ?? "").trim() !== expectedSignature.trim()) failures.push(`${url} serves a signature other than the confirmed one.`);
      else checks.push({ url, version: manifest.version, signatureBytes: manifest.signature.trim().length });
    } catch (error) {
      failures.push(`${url} is unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const served = async (url) => {
    try {
      const bytes = await fetchBinary(url);
      const digest = sha256(bytes);
      if (digest !== expectedInstallerSha256) failures.push(`${url} serves ${digest} instead of the confirmed ${expectedInstallerSha256}.`);
      return { url, sha256: digest, bytes: bytes.length };
    } catch (error) {
      failures.push(`${url} is unreachable: ${error instanceof Error ? error.message : String(error)}`);
      return { url };
    }
  };
  const artifact = await served(artifactUrl);
  const aliasUrl = latestWindowsDownloadManifestUrl(baseUrl);
  let alias;
  try {
    alias = await fetchJson(aliasUrl);
    if (alias?.version !== releaseVersion) failures.push(`${aliasUrl} announces ${alias?.version ?? "no version"} instead of ${releaseVersion}.`);
    if (alias?.installer !== latestWindowsInstallerUrl(baseUrl)) failures.push(`${aliasUrl} points at ${alias?.installer ?? "nothing"} instead of ${latestWindowsInstallerUrl(baseUrl)}.`);
    if (alias?.sha256 !== expectedInstallerSha256) failures.push(`${aliasUrl} announces ${alias?.sha256 ?? "no digest"} instead of the confirmed ${expectedInstallerSha256}.`);
  } catch (error) {
    failures.push(`${aliasUrl} is unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const download = await served(latestWindowsInstallerUrl(baseUrl));
  if (failures.length > 0) throw new Error(`Post-publication verification failed:\n${failures.join("\n")}`);
  return { status: "verified", checks, artifact, downloadAlias: { ...download, url: aliasUrl, version: alias.version, installerUrl: download.url } };
}

async function defaultFetchJson(url) {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function defaultFetchBinary(url) {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export function windowsConfirmationPayload({ version, tag, revision, baseUrl, workflowRun, installer, signature, manifestPaths: paths, actions }) {
  parseSemver(version);
  if (tag !== `v${version}`) throw new Error(`Release tag must be v${version}.`);
  if (!/^[0-9a-f]{40}$/.test(revision ?? "")) throw new Error("The tag's revision must be a full Git SHA.");
  if (!/^[0-9a-f]{64}$/.test(installer?.sha256 ?? "")) throw new Error("The installer requires a real SHA-256 digest.");
  if (!signature?.keyId || !signature?.value?.trim()) throw new Error("A verified updater signature is required.");
  if (!workflowRun?.url) throw new Error("The workflow run that built the installer is required.");
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("Derived manifest paths are required.");
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("The confirmed action list is required.");
  return {
    decision: "publish-windows-release",
    version, tag, revision,
    baseUrl: root(baseUrl),
    workflowRun: { ...workflowRun },
    installer: { ...installer },
    signature: { ...signature },
    manifestPaths: [...paths],
    actions: [...actions],
  };
}

export function renderWindowsConfirmation(payload) {
  return [
    "Nautilus Windows release: PREPARED — one confirmation required",
    `Version: ${payload.version}`,
    `Tag: ${payload.tag} at ${payload.revision}`,
    `Built by: ${payload.workflowRun.url}`,
    `Installer: ${payload.installer.name}  sha256=${payload.installer.sha256}  ${payload.installer.bytes} bytes`,
    `Updater signature: made here, verified against the application's public key ${payload.signature.keyId}`,
    `Publication base URL (derived from the application updater endpoint): ${payload.baseUrl}`,
    `Manifest paths: ${payload.manifestPaths.join(", ")}`,
    "On confirmation, without further questions:",
    ...payload.actions.map((action) => `  - ${action}`),
  ].join("\n");
}

export function renderWindowsPublicationEvidence({ version, tag, revision, date, baseUrl, workflowRun, installer, signature, verification, githubReleaseUrl }) {
  return [
    "# Windows Release Publication — " + `v${version}`,
    "",
    `**Release:** \`${tag}\``,
    `**Date:** ${date}`,
    `**Tag target:** \`${revision}\``,
    `**Publication base URL (derived):** \`${baseUrl}\``,
    `**GitHub release:** ${githubReleaseUrl}`,
    "",
    "Generated by `scripts/windows_release.mjs` from the data the route actually used.",
    "",
    "## Installer",
    "",
    `- Built by ${workflowRun.url} from the tag's revision, without the updater key.`,
    `- \`${installer.name}\`, ${installer.bytes} bytes, SHA-256 \`${installer.sha256}\`.`,
    `- Updater signature made on the publisher's machine and verified against the application's public key \`${signature.keyId}\` before publication.`,
    "- Not code-signed: Windows shows its unknown-publisher warning on a downloaded installer.",
    "",
    "## Post-Publication Verification",
    "",
    "Every URL below is exactly what an installed Windows application polls. Each served the released version, the confirmed signature and the installer's address; any failure would have blocked the route.",
    "",
    "| Polled URL | Served version | Signature bytes |",
    "|------------|----------------|-----------------|",
    ...verification.checks.map((check) => `| \`${check.url}\` | \`${check.version}\` | ${check.signatureBytes} |`),
    "",
    "## Served Installer",
    "",
    "The bytes an update downloads and the bytes the site's stable address serves, each compared with the confirmed digest.",
    "",
    `- Update artifact \`${verification.artifact.url}\`: \`${verification.artifact.sha256}\`, ${verification.artifact.bytes} bytes`,
    `- Announced by \`${verification.downloadAlias.url}\`: \`${verification.downloadAlias.version}\``,
    `- Site download \`${verification.downloadAlias.installerUrl}\`: \`${verification.downloadAlias.sha256}\`, ${verification.downloadAlias.bytes} bytes`,
    "",
    "## Boundary",
    "",
    "The updater key signed on this machine and was not given to CI. No Mirror data or app data was mutated.",
    "",
  ].join("\n");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed${result.stderr ? `: ${String(result.stderr).trim()}` : ""}`);
  }
  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

const capture = (command, args, options = {}) => run(command, args, { ...options, stdio: "pipe" });

function workDirFor(version) {
  return resolve(repositoryRoot, ".tmp", "windows-release", `v${version}`);
}

function loadState(version) {
  const path = resolve(workDirFor(version), "state.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { version, stages: {} };
}

function saveState(state) {
  mkdirSync(workDirFor(state.version), { recursive: true });
  writeFileSync(resolve(workDirFor(state.version), "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

async function runStage(state, name, execute) {
  if (state.stages[name]?.status === "done") {
    console.log(`[windows-release] ${name}: already done, skipping`);
    return state.stages[name].detail;
  }
  console.log(`[windows-release] ${name}: running`);
  const detail = (await execute()) ?? null;
  state.stages[name] = { status: "done", completedAt: new Date().toISOString(), detail };
  saveState(state);
  return detail;
}

/// The workflow run that built this revision's installer. A run still going, or one that failed,
/// stops the route with what to do next instead of signing something else.
export function selectWindowsReleaseRun(runs, revision) {
  const ofRevision = runs.filter((candidate) => candidate.headSha === revision);
  const passed = ofRevision.find((candidate) => candidate.status === "completed" && candidate.conclusion === "success");
  if (passed) return passed;
  const running = ofRevision.find((candidate) => candidate.status !== "completed");
  if (running) throw new Error(`The Windows release workflow is still running for ${revision}: ${running.url}. Run prepare again when it has finished.`);
  if (ofRevision.length > 0) throw new Error(`The Windows release workflow did not succeed for ${revision}: ${ofRevision[0].url}. Nothing was signed.`);
  throw new Error(`No Windows release workflow run exists for ${revision}. It starts when the tag is pushed; it can also be started by hand: gh workflow run ${windowsReleaseWorkflow} --ref <tag>.`);
}

function context(options) {
  const version = releaseVersionAt(repositoryRoot);
  const tag = `v${version}`;
  const baseUrl = assertBaseUrlAgreement(defaultBaseUrl, options.baseUrl);
  const tauriConfig = JSON.parse(readFileSync(resolve(repositoryRoot, "src-tauri", "tauri.conf.json"), "utf8"));
  assertReleaseLine({ version, baseUrl, identifier: tauriConfig.identifier, productName: tauriConfig.productName });
  const tags = capture("git", ["tag", "--list", "v*"]).split("\n").filter(Boolean);
  const retainedVersions = deriveRetainedVersions({ version, tags });
  const updaterConfig = JSON.parse(readFileSync(resolve(repositoryRoot, CURRENT_RELEASE_LINE.updaterConfig), "utf8"));
  return {
    version, tag, baseUrl, tags, retainedVersions,
    pubkey: updaterConfig.plugins.updater.pubkey,
    paths: windowsManifestPaths({ currentVersions: retainedVersions }),
    work: workDirFor(version),
  };
}

function actionsFor(ctx) {
  return [
    `add ${windowsInstallerName(ctx.version)} to the GitHub release ${ctx.tag}`,
    `publish the installer, its signature, the stable download and the Windows manifests to ${ctx.baseUrl}`,
    "verify every polled Windows manifest URL and the served installer bytes (blocking)",
    "emit and commit publication evidence",
  ];
}

function plan(options) {
  const ctx = context(options);
  console.log([
    "Nautilus Windows release plan (dry run — nothing executes)",
    `Version: ${ctx.version}`,
    `Tag: ${ctx.tag}`,
    `Installer: ${windowsInstallerName(ctx.version)}, built by ${windowsReleaseWorkflow} on the tag`,
    `Publication base URL (derived from the application updater endpoint): ${ctx.baseUrl}`,
    `Retained current versions (derived from tags): ${ctx.retainedVersions.join(", ")}`,
    `Manifest paths: ${ctx.paths.join(", ")}`,
    `Stable download: ${latestWindowsInstallerUrl(ctx.baseUrl)}`,
    "Route: prepare (fetch the workflow's installer, check it against the tag, sign, check the signature, stage) → one confirmation → publish --yes (GitHub release asset, endpoint publish, blocking verification, evidence).",
  ].join("\n"));
}

async function prepare(options) {
  const ctx = context(options);
  if (!ctx.tags.includes(ctx.tag)) throw new Error(`Tag ${ctx.tag} does not exist. Publish the release first (release:deploy publish); the Windows installer is built from the tag.`);
  const revision = capture("git", ["rev-parse", `${ctx.tag}^{commit}`]);
  const signingKey = options.signingKey ?? process.env.MIRROR_DESKTOP_UPDATER_SIGNING_KEY ?? defaultSigningKey;
  if (!existsSync(signingKey)) throw new Error(`The updater signing key is unavailable at ${signingKey}.`);
  const state = loadState(ctx.version);
  if (state.revision && state.revision !== revision) throw new Error(`Prepared state is for ${state.revision}, but ${ctx.tag} is at ${revision}. Run reset first.`);
  state.revision = revision;

  const workflowRun = await runStage(state, "workflow-run", () => {
    const runs = JSON.parse(capture("gh", ["run", "list", "--workflow", windowsReleaseWorkflow, "--commit", revision, "--json", "databaseId,status,conclusion,headSha,url,event"]));
    const selected = selectWindowsReleaseRun(runs, revision);
    return { id: selected.databaseId, url: selected.url, event: selected.event };
  });
  const downloadDir = resolve(ctx.work, "ci");
  const installer = await runStage(state, "installer", () => {
    rmSync(downloadDir, { recursive: true, force: true });
    run("gh", ["run", "download", String(workflowRun.id), "--name", windowsInstallerArtifact, "--dir", downloadDir]);
    const name = windowsInstallerName(ctx.version);
    for (const required of [name, windowsDescriptorName]) {
      if (!existsSync(resolve(downloadDir, required))) throw new Error(`The workflow artifact holds no ${required} (found: ${readdirSync(downloadDir).join(", ") || "nothing"}).`);
    }
    return verifyWindowsInstallerDescriptor({
      descriptor: JSON.parse(readFileSync(resolve(downloadDir, windowsDescriptorName), "utf8")),
      version: ctx.version,
      revision,
      bytes: readFileSync(resolve(downloadDir, name)),
    });
  });
  const installerPath = resolve(downloadDir, installer.name);
  const signature = await runStage(state, "signature", () => {
    rmSync(`${installerPath}.sig`, { force: true });
    run(process.execPath, [resolve(repositoryRoot, "node_modules", "@tauri-apps", "cli", "tauri.js"), "signer", "sign", installerPath], {
      stdio: "pipe",
      env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: readFileSync(signingKey, "utf8"), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "" },
    });
    const value = readFileSync(`${installerPath}.sig`, "utf8").trim();
    const verified = verifyUpdaterSignature({ data: readFileSync(installerPath), signature: value, pubkey: ctx.pubkey });
    return { keyId: verified.keyId, value };
  });
  await runStage(state, "stage", () => {
    const staged = stageWindowsPublication({
      version: ctx.version,
      currentVersions: ctx.retainedVersions,
      installer: installerPath,
      signature: `${installerPath}.sig`,
      baseUrl: ctx.baseUrl,
      stageDir: resolve(ctx.work, "stage"),
    });
    return { stageDir: staged.stageDir, manifestPaths: staged.manifestPaths };
  });
  state.confirmation = windowsConfirmationPayload({
    version: ctx.version, tag: ctx.tag, revision, baseUrl: ctx.baseUrl,
    workflowRun, installer, signature, manifestPaths: ctx.paths, actions: actionsFor(ctx),
  });
  saveState(state);
  console.log(options.json ? JSON.stringify(state.confirmation, null, 2) : renderWindowsConfirmation(state.confirmation));
  console.log("\nBoundary: nothing was uploaded or published. Run `publish --yes` after confirmation.");
}

async function publish(options) {
  const ctx = context(options);
  const state = loadState(ctx.version);
  if (!state.confirmation) throw new Error("No prepared confirmation exists for this version. Run prepare first.");
  if (!options.yes) {
    console.log(renderWindowsConfirmation(state.confirmation));
    console.log("\nDry run: pass --yes after confirmation to execute the publication route.");
    return;
  }
  const { revision, installer, signature, workflowRun } = state.confirmation;
  const stageDir = resolve(ctx.work, "stage");
  const staged = resolve(stageDir, "artifacts", installer.name);
  if (sha256(readFileSync(staged)) !== installer.sha256) throw new Error("The staged installer is not the confirmed one. Run reset, then prepare again.");

  const githubReleaseUrl = await runStage(state, "github-release-asset", () => {
    run("gh", ["release", "upload", ctx.tag, staged, "--clobber"]);
    return capture("gh", ["release", "view", ctx.tag, "--json", "url", "-q", ".url"]);
  });
  await runStage(state, "endpoint-publish", () => {
    for (const [command, args] of windowsPublicationCommands({ stageDir, sshHost: options.sshHost ?? "szen-vps", webRoot: webRootForBaseUrl(ctx.baseUrl), manifestPaths: ctx.paths })) {
      run(command, args);
    }
    return { manifestPaths: ctx.paths };
  });
  const verification = await runStage(state, "verify-endpoints", () => verifyPublishedWindowsEndpoints({
    baseUrl: ctx.baseUrl,
    version: ctx.version,
    retainedVersions: ctx.retainedVersions,
    expectedInstallerSha256: installer.sha256,
    expectedSignature: signature.value,
  }));
  const date = new Date().toISOString().slice(0, 10);
  const evidencePath = await runStage(state, "publication-evidence", () => {
    const path = `docs/update/${evidenceSlug(ctx.version)}-windows-publication-${date}.md`;
    writeFileSync(resolve(repositoryRoot, path), renderWindowsPublicationEvidence({
      version: ctx.version, tag: ctx.tag, revision, date, baseUrl: ctx.baseUrl,
      workflowRun, installer, signature, verification, githubReleaseUrl,
    }));
    run("git", ["add", path]);
    run("git", ["commit", "-m", `Record ${ctx.tag} Windows publication evidence`]);
    run("git", ["push", "origin", "HEAD"]);
    return path;
  });
  console.log("\nNautilus Windows release: PUBLISHED AND VERIFIED");
  console.log(`Version: ${ctx.version}`);
  console.log(`GitHub release: ${githubReleaseUrl}`);
  console.log(`Verified polled URLs: ${verification.checks.length}`);
  console.log(`Stable download: ${verification.downloadAlias.installerUrl}`);
  console.log(`Publication evidence: ${evidencePath}`);
}

function describe(options) {
  if (!options.installer || !options.out) throw new Error("describe requires --installer and --out.");
  const version = releaseVersionAt(repositoryRoot);
  const revision = options.revision ?? capture("git", ["rev-parse", "HEAD"]);
  const installerPath = resolve(options.installer);
  const descriptor = describeWindowsInstaller({ version, revision, name: basename(installerPath), bytes: readFileSync(installerPath) });
  mkdirSync(resolve(options.out), { recursive: true });
  copyFileSync(installerPath, resolve(options.out, descriptor.installer.name));
  writeFileSync(resolve(options.out, windowsDescriptorName), `${JSON.stringify(descriptor, null, 2)}\n`);
  console.log(`${descriptor.installer.name}  sha256=${descriptor.installer.sha256}  ${statSync(installerPath).size} bytes  revision=${revision}`);
}

function parseArguments(argv) {
  const options = { command: undefined, json: false, yes: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["describe", "plan", "prepare", "publish", "reset"].includes(arg) && !options.command) options.command = arg;
    else if (arg === "--json") options.json = true;
    else if (arg === "--yes") options.yes = true;
    else if (["--base-url", "--ssh-host", "--signing-key", "--installer", "--out", "--revision"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value.`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else throw new Error(`Unsupported Windows release argument ${arg}.`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = (error) => {
    console.error(`Nautilus Windows release: BLOCKED\n${error.message}`);
    process.exit(1);
  };
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.command === "describe") describe(options);
    else if (options.command === "prepare") await prepare(options).catch(fail);
    else if (options.command === "publish") await publish(options).catch(fail);
    else if (options.command === "reset") {
      const version = releaseVersionAt(repositoryRoot);
      rmSync(workDirFor(version), { recursive: true, force: true });
      console.log(`Windows release state reset for v${version}.`);
    } else plan(options);
  } catch (error) {
    fail(error);
  }
}
