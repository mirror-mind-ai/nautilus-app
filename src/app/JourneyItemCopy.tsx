import type { JourneyAgentStatus } from "./journeyAgentStatus";

type JourneyItemCopyProps = {
  layout: "card" | "tree";
  journeyName: string;
  description: string;
  lastWorkedLabel?: string;
  agentStatusLabel?: string;
  /** CR106: lets the label carry the same register as its icon, so Ready reads as completion. */
  agentStatusKind?: JourneyAgentStatus;
  pinned?: boolean;
  /** CR259: messages waiting in one of the Journey's conversations to be sent. */
  waitingCount?: number;
};

export function JourneyItemCopy({
  layout,
  journeyName,
  description,
  lastWorkedLabel,
  agentStatusLabel,
  agentStatusKind,
  pinned = false,
  waitingCount = 0,
}: JourneyItemCopyProps) {
  const waitingTitle = `${waitingCount} ${waitingCount === 1 ? "message" : "messages"} waiting to be sent`;
  const content = (
    <>
      <strong className="journey-name">
        {journeyName}
        {pinned ? <span className="journey-pinned-marker" aria-label="Pinned" title="Pinned">◆</span> : null}
        {waitingCount > 0 ? (
          <span className="journey-waiting-count" aria-label={waitingTitle} title={waitingTitle}>{waitingCount}</span>
        ) : null}
      </strong>
      <small className="journey-context">{description}</small>
      {agentStatusLabel || lastWorkedLabel ? (
        <small className={`journey-last-worked${agentStatusLabel ? " agent-status" : ""}${agentStatusLabel && agentStatusKind ? ` ${agentStatusKind}` : ""}`}>
          {agentStatusLabel ?? lastWorkedLabel}
        </small>
      ) : null}
    </>
  );
  return layout === "tree" ? <span className="journey-copy">{content}</span> : content;
}
