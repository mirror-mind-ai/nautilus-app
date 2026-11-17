import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adoptSettledSession, rememberSettledSession } from "../../mirror-host/anthropic/provider/src/settled-session.ts";

// The Desktop ends the Pi process with every turn, so the bridge's in-memory link between a pi
// session and its Claude Code session was lost at every turn: the next turn rebuilt a new Claude
// session and Claude rewrote the whole conversation to its prompt cache. settled-session.ts
// carries the link across the process boundary, and only when reusing it is exactly what the
// bridge would have done had the process lived.

const PI = "nautilus-projeto-alpha-g1-18e5e36f6aee0028";
const CWD = "C:\\Users\\João Çãõ Silva\\Mirror Journeys\\projeto-alpha";
const CLAUDE = "3d5565e1-0000-4000-8000-000000000001";

const message = (role, timestamp, content = `${role} ${timestamp}`) => ({ role, timestamp, content });
// A settled turn: two earlier messages, the turn's prompt, one tool round.
const before = [message("user", 1), message("assistant", 2)];
const prompt = [message("user", 3), message("user", 4, "mirror context")];
const tools = [message("assistant", 5), message("toolResult", 6)];
const answer = message("assistant", 7);
const settledContext = [message("system", 0), ...before, ...prompt];
// What the bridge holds when the turn settles: the cursor counts up to the last tool result.
const settledMirror = { sessionId: CLAUDE, cursor: before.length + prompt.length + tools.length, cwd: CWD, piSessionId: PI };
const nextTurn = [message("system", 0), ...before, ...prompt, ...tools, answer, message("user", 8), message("user", 9, "mirror context")];

describe("the Claude Code session a pi session settled on, across Pi processes", () => {
  let dir;
  let claudeFile;

  // One process: its own in-memory mirrors, as index.ts keeps them.
  const process_ = () => {
    const mirrors = new Map();
    const lines = [];
    return {
      mirrors,
      lines,
      hooks: {
        live: (id) => mirrors.get(id) ?? null,
        plant: (id, mirror) => mirrors.set(id, mirror),
        sessionPath: () => claudeFile,
        log: (...args) => lines.push(args.join(" ")),
      },
    };
  };
  const records = () => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")) : []);

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "settled-session-"));
    dir = join(root, "claude-sessions");
    claudeFile = join(root, `${CLAUDE}.jsonl`);
    writeFileSync(claudeFile, "{}\n");
    process.env.MIRROR_DESKTOP_CLAUDE_SESSIONS_DIR = dir;
  });

  afterEach(() => {
    delete process.env.MIRROR_DESKTOP_CLAUDE_SESSIONS_DIR;
  });

  it("is adopted by the next process when the next turn simply follows the settled one", () => {
    rememberSettledSession(settledMirror, settledContext);
    const next = process_();
    adoptSettledSession(PI, nextTurn, CWD, next.hooks);
    expect(next.mirrors.get(PI)).toEqual({ sessionId: CLAUDE, cursor: settledMirror.cursor, cwd: CWD, piSessionId: PI });
  });

  it("is taken once: adopting removes the record, so a turn that then dies leaves nothing behind", () => {
    rememberSettledSession(settledMirror, settledContext);
    expect(records()).toHaveLength(1);
    adoptSettledSession(PI, nextTurn, CWD, process_().hooks);
    expect(records()).toHaveLength(0);
    const afterACrash = process_();
    adoptSettledSession(PI, nextTurn, CWD, afterACrash.hooks);
    expect(afterACrash.mirrors.size).toBe(0);
  });

  it("is not remembered for a turn that did not settle cleanly", () => {
    rememberSettledSession({ ...settledMirror, needsRebuild: true }, settledContext);
    rememberSettledSession({ ...settledMirror, forceRotate: true }, settledContext);
    rememberSettledSession({ ...settledMirror, piSessionId: undefined }, settledContext);
    rememberSettledSession(null, settledContext);
    expect(records()).toHaveLength(0);
  });

  it("is dropped when pi rewrote the history, as a compaction does", () => {
    rememberSettledSession(settledMirror, settledContext);
    const compacted = [message("system", 0), message("user", 100, "summary of what came before"), ...prompt, ...tools, answer, message("user", 8)];
    const next = process_();
    adoptSettledSession(PI, compacted, CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
    expect(next.lines.join("\n")).toMatch(/rewritten|shorter/);
    expect(records()).toHaveLength(0);
  });

  it("is dropped when the history is shorter than the settled turn", () => {
    rememberSettledSession(settledMirror, settledContext);
    const next = process_();
    adoptSettledSession(PI, [message("system", 0), ...before, message("user", 8)], CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
  });

  it("is dropped when the history moved past the settled answer, as a turn on another provider does", () => {
    rememberSettledSession(settledMirror, settledContext);
    const otherProvider = [message("system", 0), ...before, ...prompt, ...tools, answer, message("user", 8), message("assistant", 9), message("user", 10)];
    const next = process_();
    adoptSettledSession(PI, otherProvider, CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
    expect(next.lines.join("\n")).toMatch(/moved past/);
  });

  it("is dropped when the turn the answer belonged to never reached pi's history", () => {
    // Settled with tools, but pi's file holds the prompt only: the next prompt follows it directly.
    rememberSettledSession(settledMirror, settledContext);
    const next = process_();
    adoptSettledSession(PI, [message("system", 0), ...before, ...prompt, message("user", 8)], CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
  });

  it("is dropped when the Journey's folder changed", () => {
    rememberSettledSession(settledMirror, settledContext);
    const next = process_();
    adoptSettledSession(PI, nextTurn, "C:\\outra\\pasta", next.hooks);
    expect(next.mirrors.size).toBe(0);
    expect(next.lines.join("\n")).toMatch(/folder changed/);
  });

  it("is dropped when Claude Code's session file is gone", () => {
    rememberSettledSession(settledMirror, settledContext);
    rmSync(claudeFile);
    const next = process_();
    adoptSettledSession(PI, nextTurn, CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
    expect(next.lines.join("\n")).toMatch(/session file is gone/);
  });

  it("never replaces the mirror a living process already has, and still takes the record", () => {
    rememberSettledSession(settledMirror, settledContext);
    const same = process_();
    const live = { sessionId: "live-session", cursor: 99, cwd: CWD, piSessionId: PI };
    same.mirrors.set(PI, live);
    adoptSettledSession(PI, nextTurn, CWD, same.hooks);
    expect(same.mirrors.get(PI)).toBe(live);
    expect(records()).toHaveLength(0);
  });

  it("belongs to one pi session: another session adopts nothing and takes nothing", () => {
    rememberSettledSession(settledMirror, settledContext);
    const next = process_();
    adoptSettledSession("nautilus-outra-jornada-g1-0000000000000000", nextTurn, CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
    expect(records()).toHaveLength(1);
  });

  it("is dropped when the record under this session's name speaks of another session", () => {
    rememberSettledSession(settledMirror, settledContext);
    const [name] = records();
    const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
    writeFileSync(join(dir, name), JSON.stringify({ ...record, piSessionId: "nautilus-outra-jornada-g1-0000000000000000" }));
    const next = process_();
    adoptSettledSession(PI, nextTurn, CWD, next.hooks);
    expect(next.mirrors.size).toBe(0);
  });

  it("treats a damaged record, or none, or no pi session, as no record", () => {
    mkdirSync(dir, { recursive: true });
    rememberSettledSession(settledMirror, settledContext);
    const [name] = records();
    writeFileSync(join(dir, name), "{ not json");
    const next = process_();
    expect(() => adoptSettledSession(PI, nextTurn, CWD, next.hooks)).not.toThrow();
    expect(() => adoptSettledSession(PI, nextTurn, CWD, next.hooks)).not.toThrow();
    expect(() => adoptSettledSession(null, nextTurn, CWD, next.hooks)).not.toThrow();
    expect(next.mirrors.size).toBe(0);
  });

  it("never fails a turn when the record cannot be written", () => {
    const blocker = join(dir, "..", "a-file");
    writeFileSync(blocker, "");
    process.env.MIRROR_DESKTOP_CLAUDE_SESSIONS_DIR = join(blocker, "inside-a-file");
    expect(() => rememberSettledSession(settledMirror, settledContext)).not.toThrow();
  });

  it("keeps nothing of the conversation in the record: ids, a count and a digest", () => {
    rememberSettledSession(settledMirror, settledContext);
    const [name] = records();
    const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
    expect(Object.keys(record).sort()).toEqual(["covered", "cursor", "cwd", "fingerprint", "piSessionId", "schemaVersion", "sessionId", "settledAt"]);
    expect(JSON.stringify(record)).not.toContain("mirror context");
    expect(name).not.toContain("projeto-alpha");
  });
});
