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
  /** Where the Journey sits: its parents, for an Idle row with nothing else to say. */
  context?: string;
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
  if (journey.status === "idle" || (journey.status === "finished" && journey.answerSeen)) return "idle";
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

const waitingText = (count: number): string => `${count} ${count === 1 ? "message" : "messages"} waiting to be sent`;

/** One line under the Journey's name: what it does, or what it waits for. */
export function activityLine(journey: JourneyActivityInput): string | undefined {
  if (journey.status === "working") return journey.doing ?? "Working";
  if (journey.status === "finishing") return "Finishing the turn";
  const outcome = journey.status === "failed" ? "The last turn failed"
    : journey.status === "interrupted" ? "The last turn was interrupted"
      : journey.status === "finished" && !journey.answerSeen ? "Finished. Open it to read the answer"
        : undefined;
  const waiting = journey.waitingCount > 0 ? waitingText(journey.waitingCount) : undefined;
  if (outcome && waiting && journey.status !== "finished") return `${outcome} · ${waiting}`;
  return waiting ?? outcome ?? journey.context;
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
