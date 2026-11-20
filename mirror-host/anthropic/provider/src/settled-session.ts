/**
 * Mirror Desktop's own file; not part of upstream pi-claude-bridge.
 *
 * The bridge keeps, in memory, which Claude Code session a pi session's turns run on
 * (`sharedSessions` in index.ts). Reusing that session on the next turn is what keeps Claude's
 * prompt cache warm. The Desktop ends the Pi process with every turn, so the memory is gone by
 * the next one: each turn found no session, rebuilt a new one from pi's history, and Claude wrote
 * the whole conversation to its cache again. Measured on 69 turns that followed a finished
 * answer: 67 rewrote everything, 430k tokens on average.
 *
 * This file carries that one fact across the process boundary, and nothing else:
 *
 * - `rememberSettledSession` writes it when a turn settles cleanly, and only then.
 * - `adoptSettledSession` takes it at the next turn's sync. Taking removes the record, so it
 *   exists on disk only between a clean settle and the next turn. A turn that is aborted, fails
 *   or is killed leaves no record, and the next turn rebuilds as it always did.
 * - The record is adopted only when index.ts would go on to REUSE it: same folder, Claude's
 *   session file still there, pi's history up to the settled turn's prompt unchanged (a
 *   compaction or a tree move changes it), and nothing after the settled turn but its final
 *   answer. Anything else drops the record, which is today's behaviour: a rebuild.
 *
 * Every failure here (unreadable, unwritable, malformed) is the same thing: no record.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

interface Mirror {
	sessionId: string;
	cursor: number;
	cwd: string;
	piSessionId?: string;
	needsRebuild?: boolean;
	forceRotate?: boolean;
}

interface HistoryMessage {
	role: string;
	timestamp?: number;
	content?: unknown;
}

interface SettledRecord {
	schemaVersion: 1;
	piSessionId: string;
	sessionId: string;
	cursor: number;
	cwd: string;
	/** How many of pi's messages the fingerprint covers: the history up to the settled turn's prompt. */
	covered: number;
	fingerprint: string;
	settledAt: string;
}

export interface AdoptHooks {
	/** The in-memory mirror for a pi session, or null. */
	live: (piSessionId: string) => Mirror | null;
	/** Plant an in-memory mirror for a pi session. */
	plant: (piSessionId: string, mirror: Mirror) => void;
	/** Where Claude Code keeps the session with this id, for this folder. */
	sessionPath: (sessionId: string) => string;
	log?: (...args: unknown[]) => void;
}

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
let swept = false;

/** Beside the installed provider, in the app's data: `anthropic/claude-sessions`. */
function recordsDir(): string {
	return process.env.MIRROR_DESKTOP_CLAUDE_SESSIONS_DIR
		|| join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "claude-sessions");
}

function recordPath(piSessionId: string): string {
	return join(recordsDir(), `${createHash("sha256").update(piSessionId).digest("hex").slice(0, 40)}.json`);
}

function conversation(messages: readonly HistoryMessage[]): HistoryMessage[] {
	return messages.filter((message) => message.role !== "system");
}

function fingerprint(messages: readonly HistoryMessage[]): string {
	const hash = createHash("sha256");
	for (const message of messages) {
		const size = message.content === undefined ? 0 : typeof message.content === "string" ? message.content.length : JSON.stringify(message.content).length;
		hash.update(`${message.role}\u0000${message.timestamp ?? ""}\u0000${size}\n`);
	}
	return hash.digest("hex");
}

/** Read the record for a pi session and remove it. A record is taken once. */
function take(piSessionId: string): SettledRecord | null {
	const path = recordPath(piSessionId);
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch {
		return null;
	}
	try { unlinkSync(path); } catch { return null; } // a record that cannot be removed could be taken twice
	try {
		const record = JSON.parse(text) as Partial<SettledRecord>;
		if (record.schemaVersion !== 1 || record.piSessionId !== piSessionId) return null;
		if (typeof record.sessionId !== "string" || typeof record.cwd !== "string" || typeof record.fingerprint !== "string") return null;
		if (!Number.isInteger(record.cursor) || !Number.isInteger(record.covered)) return null;
		return record as SettledRecord;
	} catch {
		return null;
	}
}

/** Records nobody came back for. Once per process, and never in the way of a turn. */
function sweep(): void {
	if (swept) return;
	swept = true;
	try {
		const dir = recordsDir();
		const now = Date.now();
		for (const name of readdirSync(dir)) {
			if (!name.endsWith(".json")) continue;
			const path = join(dir, name);
			if (now - statSync(path).mtimeMs > KEEP_MS) unlinkSync(path);
		}
	} catch { /* nothing to sweep */ }
}

/**
 * A turn settled cleanly on `mirror`: leave that for the next process. `messages` is the context
 * the turn's query started from, so it ends with the turn's prompt.
 */
export function rememberSettledSession(mirror: Mirror | null, messages: readonly HistoryMessage[], log?: (...args: unknown[]) => void): void {
	if (!mirror?.piSessionId || mirror.needsRebuild || mirror.forceRotate) return;
	try {
		const history = conversation(messages);
		const record: SettledRecord = {
			schemaVersion: 1,
			piSessionId: mirror.piSessionId,
			sessionId: mirror.sessionId,
			cursor: mirror.cursor,
			cwd: mirror.cwd,
			covered: history.length,
			fingerprint: fingerprint(history),
			settledAt: new Date().toISOString(),
		};
		const path = recordPath(mirror.piSessionId);
		mkdirSync(dirname(path), { recursive: true });
		const partial = `${path}.${process.pid}.tmp`;
		writeFileSync(partial, JSON.stringify(record));
		renameSync(partial, path);
		log?.(`settled-session: remembered ${mirror.sessionId.slice(0, 8)} cursor=${mirror.cursor} covered=${history.length}`);
		sweep();
	} catch (error) {
		log?.("settled-session: could not remember:", error);
	}
}

/**
 * At a turn's sync, before index.ts reads the mirror: take what the previous process left for
 * this pi session and, when index.ts would REUSE it, plant it. `messages` is the turn's context.
 */
export function adoptSettledSession(piSessionId: string | null | undefined, messages: readonly HistoryMessage[], cwd: string, hooks: AdoptHooks): void {
	if (!piSessionId) return;
	try {
		const record = take(piSessionId);
		if (!record) return;
		const refuse = (why: string) => hooks.log?.(`settled-session: not adopting ${record.sessionId.slice(0, 8)}: ${why}`);
		if (hooks.live(piSessionId)) return refuse("this process already has a mirror");
		if (record.cwd !== cwd) return refuse("the folder changed");
		const history = conversation(messages);
		// index.ts: everything before the current user turn.
		let turnStart = history.length;
		while (turnStart > 0 && history[turnStart - 1].role === "user") turnStart--;
		const prior = history.slice(0, turnStart);
		if (prior.length < record.cursor || prior.length < record.covered) return refuse("pi's history is shorter than the settled turn");
		const missed = prior.slice(record.cursor);
		if (missed.length > 1 || (missed.length === 1 && missed[0].role !== "assistant")) return refuse("pi's history moved past the settled turn's answer");
		if (fingerprint(history.slice(0, record.covered)) !== record.fingerprint) return refuse("pi's history was rewritten");
		if (!existsSync(hooks.sessionPath(record.sessionId))) return refuse("Claude Code's session file is gone");
		hooks.plant(piSessionId, { sessionId: record.sessionId, cursor: record.cursor, cwd: record.cwd, piSessionId });
		hooks.log?.(`settled-session: adopted ${record.sessionId.slice(0, 8)} cursor=${record.cursor}`);
	} catch (error) {
		hooks.log?.("settled-session: could not adopt:", error);
	}
}
