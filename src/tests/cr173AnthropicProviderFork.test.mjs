import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  claudeCodeSettings,
  loadConfig,
  markAskClaudeDeprecationNoticeShown,
  markStartupNoticeShown,
} from "../../mirror-host/anthropic/provider/src/config.ts";

// CR173: the Desktop's own Anthropic provider, a pinned fork of pi-claude-bridge 0.9.3. Its cuts:
// the person's Claude Code hooks never run inside a Desktop turn (CR167), and the person's bridge
// configuration is never read nor written, which also keeps AskClaude unregistered.

const SETTING_SOURCES_CUT = 'settingSources: ["user"] as SettingSource[], // Mirror Desktop, CR176';
// Every line the Desktop adds to index.ts ends with this mark and a reason. Lines are only added.
const DESKTOP_LINE = /\/\/ Mirror Desktop, [^\n]+$/;
// Files that are the Desktop's own, not upstream's.
const DESKTOP_FILES = ["src/settled-session.ts"];
const PROVIDER = join(dirname(fileURLToPath(import.meta.url)), "../../mirror-host/anthropic/provider");

describe("CR173 the Desktop's Anthropic provider", () => {
  let home;
  let previousHome;
  let previousAgentDir;

  beforeEach(() => {
    home = realpathSync(mkdtempSync(join(tmpdir(), "cr173-")));
    previousHome = process.env.HOME;
    previousAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.HOME = home;
    delete process.env.PI_CODING_AGENT_DIR;
  });

  afterEach(() => {
    process.env.HOME = previousHome;
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  });

  it("turns off every Claude Code hook in the turn, and Claude's auto-memory", () => {
    expect(claudeCodeSettings()).toEqual({ autoMemoryEnabled: false, disableAllHooks: true });
    // Even when a caller hands it the person's provider settings.
    expect(claudeCodeSettings({ autoMemoryEnabled: true })).toEqual({ autoMemoryEnabled: false, disableAllHooks: true });
  });

  it("starts every Claude invocation without the person's hooks", () => {
    const index = readFileSync(join(PROVIDER, "src/index.ts"), "utf8");
    // The turn and AskClaude load the person's settings sources, so they take the hook-free
    // settings. The one-off summary loads no source at all (`settingSources: []`), which was
    // measured on 2026-11-02 to run no plugin hook.
    const invocations = index.match(/settings: \{[^}]*\},?\s*\n(?:.*\n){0,3}/g) ?? [];
    expect(invocations).toHaveLength(3);
    for (const invocation of invocations) {
      const hookFree = invocation.includes("...claudeCodeSettings(") || /settingSources: \[\] as SettingSource\[\]/.test(invocation);
      expect(hookFree, invocation).toBe(true);
    }
  });

  it("reads neither the person's global nor project bridge configuration", () => {
    const person = {
      askClaude: { enabled: true },
      provider: { pathToClaudeCodeExecutable: "/elsewhere/claude", strictMcpConfig: false, plan: "max" },
    };
    mkdirSync(join(home, ".pi/agent"), { recursive: true });
    writeFileSync(join(home, ".pi/agent/claude-bridge.json"), JSON.stringify(person));
    const project = join(home, "project");
    mkdirSync(join(project, ".pi"), { recursive: true });
    writeFileSync(join(project, ".pi/claude-bridge.json"), JSON.stringify(person));

    const config = loadConfig(project);

    expect(config.askClaude?.enabled).not.toBe(true);
    expect(config.provider?.pathToClaudeCodeExecutable).toBeUndefined();
    expect(config.provider?.strictMcpConfig).not.toBe(false);
    expect(config.provider?.plan).toBeUndefined();
    // No first-run notice is queued, so nothing asks to write a marker.
    expect(config.startupNoticeShown).toBeTruthy();
  });

  it("never writes into the person's Pi folder", () => {
    markStartupNoticeShown();
    markAskClaudeDeprecationNoticeShown();
    expect(readdirSync(home)).toEqual([]);
  });

  it("changes no upstream file but config.ts and marked, added lines of index.ts", () => {
    const lines = readFileSync(join(PROVIDER, "UPSTREAM.sha256"), "utf8").trim().split("\n");
    const upstream = new Map(lines.map((line) => {
      const [hash, path] = line.split(/\s+/);
      return [path, hash];
    }));
    const present = readdirSync(join(PROVIDER, "src")).map((name) => `src/${name}`).sort();
    expect(present.filter((path) => !upstream.has(path))).toEqual(DESKTOP_FILES);
    const vendored = present.filter((path) => upstream.has(path));
    expect(vendored).toEqual([...upstream.keys()].sort());
    const changed = vendored.filter((path) =>
      createHash("sha256").update(readFileSync(join(PROVIDER, path))).digest("hex") !== upstream.get(path));
    expect(changed).toEqual(["src/config.ts", "src/index.ts"]);
    // index.ts is upstream's plus marked lines, so it stays a copy plus named additions: CR176's
    // one line, and the four that carry a settled session across Pi processes.
    const index = readFileSync(join(PROVIDER, "src/index.ts"), "utf8");
    const marked = index.split("\n").filter((line) => DESKTOP_LINE.test(line));
    expect(marked.filter((line) => line.includes(SETTING_SOURCES_CUT))).toHaveLength(1);
    expect(marked.map((line) => line.match(DESKTOP_LINE)[0]).sort()).toEqual([
      "// Mirror Desktop, CR176",
      "// Mirror Desktop, settled session",
      "// Mirror Desktop, settled session",
      "// Mirror Desktop, settled session",
      "// Mirror Desktop, settled session",
    ]);
    const withoutMarked = index.split("\n").filter((line) => !DESKTOP_LINE.test(line)).join("\n");
    expect(createHash("sha256").update(withoutMarked).digest("hex")).toBe(upstream.get("src/index.ts"));
  });

  it("adopts a settled session before the bridge reads its mirror, and remembers one only at a clean settle", () => {
    const index = readFileSync(join(PROVIDER, "src/index.ts"), "utf8").split("\n");
    const at = (text) => index.findIndex((line) => line.includes(text));
    // In the sync, immediately before the line that reads the mirror.
    const adopt = at("adoptSettledSession(piSessionId, messages, cwd,");
    expect(index[adopt + 1].trim()).toBe("const sharedSession = sessionStateFor(piSessionId);");
    // In the completion handler: after the abort branch has returned, in the branch that captures
    // the session id, right after the mirror is set. Never for a reentrant (sub-agent) query.
    const remember = at("rememberSettledSession(");
    expect(index[remember].trim().startsWith("if (!isReentrant) rememberSettledSession(sessionStateFor(queryCtx.piSessionId), context.messages")).toBe(true);
    expect(index[remember - 1]).toContain("setSessionStateFor(queryCtx.piSessionId, { ...state, sessionId, cursor, cwd,");
    expect(at("--- Abort detection in normal completion path ---")).toBeLessThan(remember);
    expect(index.filter((line) => line.includes("rememberSettledSession(") && !line.startsWith("import"))).toHaveLength(1);
  });

  it("starts the turn's Claude Code with the person's settings only, never a project's (CR176)", () => {
    // A project's .claude/settings.json can run a command (apiKeyHelper) and set the environment;
    // measured to run inside a Desktop turn once turns work in the Journey's folder.
    const index = readFileSync(join(PROVIDER, "src/index.ts"), "utf8");
    const options = index.slice(index.indexOf("const queryOptions: NonNullable<"), index.indexOf("systemPrompt: {", index.indexOf("const queryOptions: NonNullable<")));
    expect(options).toContain(SETTING_SOURCES_CUT);
  });

  it("records where it came from and what it changed", () => {
    const fork = readFileSync(join(PROVIDER, "FORK.md"), "utf8");
    expect(fork).toContain("pi-claude-bridge 0.9.3");
    expect(fork).toContain("874fa7c2678456336f23b64e784e2057e608d83e");
    expect(fork).toContain("sha512-5OM3X6QLX7Xsv86bD+yiWvQEHdlGdXnaY9DgZg6jG4jpnKiHQ2FZKYVRFHYmDAEccDPfeFwW+NFHnkb+BUM+6Q==");
    expect(readFileSync(join(PROVIDER, "LICENSE"), "utf8")).toContain("MIT");
  });
});
