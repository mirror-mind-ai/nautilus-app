/**
 * The Activity view of the Journey sidebar: every Journey ordered by what its agent is doing, so
 * several Journeys at work can be followed without opening each one. It groups the states the app
 * already knows (the Journey agent status and the waiting queue); it invents none.
 */

/** The Journey agent status, as `journeyAgentStatus` derives it. Kept structural: the domain does not import the app. */
export type JourneyActivityStatus = "idle" | "working" | "finishing" | "finished" | "interrupted" | "failed";

export type JourneyActivityGroupId = "needs_you" | "working" | "idle";

export type JourneyActivityInput = {
  id: string;
  name: string;
  status: JourneyActivityStatus;
  /** The finished answer was opened; the Ready mark outlives that by a few seconds. */
  answerSeen?: boolean;
  /** Messages held for this Journey (CR259). */
  waitingCount: number;
  pinned: boolean;
  lastWorkedAt?: string;
  /** When the live run started, for the clock of a Working row. */
  startedAt?: string;
  /** What the live run does now, from `describeRunningOperation`. */
  doing?: string;
  /**
   * What the row reports belongs to a conversation inside the Journey, not to the Journey's own
   * (CR134's `inside`): the live work, or the turn that ended there and left an answer, an
   * interruption or a failure. Its owner, as the app's route to it takes it, and its title once
   * the Journey's conversation catalog has been read.
   */
  inside?: JourneyActivityConversation;
  /** Where the Journey sits: its parents, for an Idle row with nothing else to say. */
  context?: string;
  /** CR301: the conversations drawn under the row, as `activityConversationsOf` chooses them. */
  conversations?: JourneyActivityConversationLine[];
};

/** CR134's work owner, kept structural like the status, plus the conversation's title. */
export type JourneyActivityConversation = { journeyId: string; threadId: string; generation: number; mirrorConversationId: string; title?: string };

/**
 * CR301: a conversation drawn under its Journey's row, which leads to it. Its place, as the app's
 * route to a conversation takes it, its title when known, and what it does or waits for.
 */
export type JourneyActivityConversationLine = {
  journeyId: string;
  threadId: string;
  title?: string;
  status: JourneyActivityStatus;
  answerSeen?: boolean;
  doing?: string;
  startedAt?: string;
  /** When a turn was last sent in it, from the record of worked conversations. */
  lastWorkedAt?: string;
};

export type JourneyActivityGroup = { id: JourneyActivityGroupId; label: string; rows: JourneyActivityInput[] };

const GROUP_LABELS: Record<JourneyActivityGroupId, string> = { needs_you: "Need you", working: "Working", idle: "Idle" };
const GROUP_ORDER: JourneyActivityGroupId[] = ["needs_you", "working", "idle"];

/**
 * Live work is Working. Anything else whose next step is the person's is Need you: a turn that
 * failed or was interrupted, an answer not opened yet, a message held. A queue on a Journey at
 * work is not: it is sent when the turn ends.
 */
export function activityGroupOf(journey: JourneyActivityInput): JourneyActivityGroupId {
  if (journey.status === "working" || journey.status === "finishing") return "working";
  if (journey.waitingCount > 0) return "needs_you";
  return statusGroupOf(journey.status, journey.answerSeen);
}

/** A conversation's line reads its state as a row does; a queue belongs to the Journey, not to it. */
export function conversationActivityGroupOf(line: JourneyActivityConversationLine): JourneyActivityGroupId {
  return statusGroupOf(line.status, line.answerSeen);
}

function statusGroupOf(status: JourneyActivityStatus, answerSeen: boolean | undefined): JourneyActivityGroupId {
  if (status === "working" || status === "finishing") return "working";
  if (status === "idle" || (status === "finished" && answerSeen)) return "idle";
  return "needs_you";
}

/** Failed first, then interrupted, then a held message, then an answer waiting to be read. */
function urgency(journey: JourneyActivityInput): number {
  if (journey.status === "failed") return 0;
  if (journey.status === "interrupted") return 1;
  if (journey.waitingCount > 0) return 2;
  return 3;
}

const time = (value: string | undefined): number => {
  const parsed = value === undefined ? Number.NaN : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};
const recentFirst = (left: JourneyActivityInput, right: JourneyActivityInput): number => {
  const a = time(left.lastWorkedAt), b = time(right.lastWorkedAt);
  if (Number.isNaN(a) && Number.isNaN(b)) return left.name.localeCompare(right.name);
  if (Number.isNaN(a)) return 1;
  if (Number.isNaN(b)) return -1;
  return b - a || left.name.localeCompare(right.name);
};

export function groupJourneyActivity(journeys: readonly JourneyActivityInput[]): JourneyActivityGroup[] {
  const byGroup: Record<JourneyActivityGroupId, JourneyActivityInput[]> = { needs_you: [], working: [], idle: [] };
  for (const journey of journeys) byGroup[activityGroupOf(journey)].push(journey);
  byGroup.needs_you.sort((left, right) => urgency(left) - urgency(right) || recentFirst(left, right));
  // The longest-running first, so a row does not move as other Journeys start.
  byGroup.working.sort((left, right) => {
    const a = time(left.startedAt), b = time(right.startedAt);
    if (Number.isNaN(a) && Number.isNaN(b)) return left.name.localeCompare(right.name);
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b || left.name.localeCompare(right.name);
  });
  byGroup.idle.sort(recentFirst);
  return GROUP_ORDER.filter((id) => byGroup[id].length > 0).map((id) => ({ id, label: GROUP_LABELS[id], rows: byGroup[id] }));
}

/** How long the list keeps its order after a row was chosen, so the row does not leave the click. */
export const ACTIVITY_HOLD_MS = 4_000;

/** The order the person saw: each group and the rows in it. */
export type ActivityLayout = readonly { id: JourneyActivityGroupId; rowIds: readonly string[] }[];

export function layoutOfActivity(groups: readonly JourneyActivityGroup[]): ActivityLayout {
  return groups.map((group) => ({ id: group.id, rowIds: group.rows.map((row) => row.id) }));
}

/**
 * CR289: the groups as `layout` left them, with each row as it is now. Choosing a row usually changes
 * its state (an answer opened leaves Need you for Idle), and the list followed at once, moving the
 * row away from the click. A row the layout does not know goes to the end of its own group; one that
 * is gone is dropped.
 */
export function holdActivityLayout(groups: readonly JourneyActivityGroup[], layout: ActivityLayout): JourneyActivityGroup[] {
  const current = new Map<string, { row: JourneyActivityInput; group: JourneyActivityGroupId }>();
  for (const group of groups) for (const row of group.rows) current.set(row.id, { row, group: group.id });
  const rowsOf: Record<JourneyActivityGroupId, JourneyActivityInput[]> = { needs_you: [], working: [], idle: [] };
  const placed = new Set<string>();
  for (const held of layout) {
    for (const id of held.rowIds) {
      const entry = current.get(id);
      if (!entry || placed.has(id)) continue;
      rowsOf[held.id].push(entry.row);
      placed.add(id);
    }
  }
  for (const group of groups) for (const row of group.rows) if (!placed.has(row.id)) rowsOf[group.id].push(row);
  return GROUP_ORDER.filter((id) => rowsOf[id].length > 0).map((id) => ({ id, label: GROUP_LABELS[id], rows: rowsOf[id] }));
}

const waitingText = (count: number): string => `${count} ${count === 1 ? "message" : "messages"} waiting to be sent`;

/** One line under the Journey's name: what it does, or what it waits for. */
export function activityLine(journey: JourneyActivityInput): string | undefined {
  const waiting = journey.waitingCount > 0 ? waitingText(journey.waitingCount) : undefined;
  // CR301: what happens in a conversation is said on that conversation's line, under the row, so it
  // is neither read as the Journey's own nor said twice.
  if (journey.inside) return waiting ?? journey.context;
  const state = stateText(journey.status, journey.doing, journey.answerSeen);
  if (journey.status === "working" || journey.status === "finishing") return state;
  if (state && waiting && journey.status !== "finished") return `${state} · ${waiting}`;
  return waiting ?? state ?? journey.context;
}

/** What a conversation's line says: what it does or waits for, nothing when it is quiet. */
export function conversationActivityLine(line: JourneyActivityConversationLine): string | undefined {
  return stateText(line.status, line.doing, line.answerSeen);
}

function stateText(status: JourneyActivityStatus, doing: string | undefined, answerSeen: boolean | undefined): string | undefined {
  if (status === "working") return doing ?? "Working";
  if (status === "finishing") return "Finishing the turn";
  if (status === "failed") return "The last turn failed";
  if (status === "interrupted") return "The last turn was interrupted";
  if (status === "finished" && !answerSeen) return "Finished. Open it to read the answer";
  return undefined;
}

/** CR301: how long a conversation a turn was sent in stays under its Journey's row (the Navigator's choice). */
export const ACTIVITY_CONVERSATION_WINDOW_MS = 24 * 60 * 60_000;

/**
 * CR301: the conversations drawn under a Journey's row. What is in motion in them (live work, or a
 * turn that ended there and waits for the person) always; and every conversation a turn was sent in
 * during the last day, so one being worked between turns is reached without leaving the view. Never
 * the Journey's own conversation: the row itself leads there. What is in motion comes first, in the
 * order given, then the most recently worked, each conversation once.
 */
export function activityConversationsOf(input: {
  journeyId: string;
  inMotion: readonly JourneyActivityConversationLine[];
  worked: readonly { threadId: string; title?: string; lastWorkedAt: string }[];
  rootThreadId: string | undefined;
  nowMs: number;
}): JourneyActivityConversationLine[] {
  const lines = new Map<string, JourneyActivityConversationLine>();
  for (const line of input.inMotion) {
    if (line.threadId !== input.rootThreadId && !lines.has(line.threadId)) lines.set(line.threadId, line);
  }
  const recent: JourneyActivityConversationLine[] = [];
  for (const entry of [...input.worked].sort((left, right) => time(right.lastWorkedAt) - time(left.lastWorkedAt))) {
    if (entry.threadId === input.rootThreadId) continue;
    const moving = lines.get(entry.threadId);
    if (moving) {
      if (moving.lastWorkedAt === undefined) {
        lines.set(entry.threadId, { ...moving, title: moving.title ?? entry.title, lastWorkedAt: entry.lastWorkedAt });
      }
      continue;
    }
    if (!(input.nowMs - time(entry.lastWorkedAt) < ACTIVITY_CONVERSATION_WINDOW_MS)) continue;
    if (recent.some((line) => line.threadId === entry.threadId)) continue;
    recent.push({ journeyId: input.journeyId, threadId: entry.threadId, title: entry.title, status: "idle", lastWorkedAt: entry.lastWorkedAt });
  }
  return [...lines.values(), ...recent];
}

const LINE_MAX = 120;
const TARGET_KEYS = ["command", "path", "file_path", "filePath", "pattern", "query", "url"];

type RunningOperation = { name: string; status: string; arguments?: unknown };

/**
 * The operation running now, as its tool and its target on one bounded line: "bash npm test",
 * "read docs/plan.md". Undefined when no operation is running, which is the agent between tools.
 */
export function describeRunningOperation(operations: readonly RunningOperation[]): string | undefined {
  const running = [...operations].reverse().find((operation) => operation.status === "running" || operation.status === "preparing");
  if (!running) return undefined;
  const args = running.arguments && typeof running.arguments === "object" && !Array.isArray(running.arguments)
    ? running.arguments as Record<string, unknown>
    : undefined;
  const target = args ? TARGET_KEYS.map((key) => args[key]).find((value): value is string => typeof value === "string" && value.trim().length > 0) : undefined;
  const line = (target ? `${running.name} ${target}` : running.name).replace(/\s+/g, " ").trim();
  return line.length > LINE_MAX ? `${line.slice(0, LINE_MAX - 1)}…` : line;
}

/** How long ago a Journey was last worked, in few characters: now, 11 min, 2 h, 3 d, 6 mo. */
export function activityAgoLabel(lastWorkedAt: string | undefined, nowMs: number): string | undefined {
  const at = time(lastWorkedAt);
  if (Number.isNaN(at)) return undefined;
  const minutes = Math.floor((nowMs - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days < 60 ? `${days} d` : `${Math.floor(days / 30)} mo`;
}

/** A run's time as a clock: 0:48, 2:14, 1:02:10. */
export function activityElapsedLabel(startedAt: string | undefined, nowMs: number): string | undefined {
  const start = time(startedAt);
  if (Number.isNaN(start)) return undefined;
  const seconds = Math.max(0, Math.floor((nowMs - start) / 1000));
  const two = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}
