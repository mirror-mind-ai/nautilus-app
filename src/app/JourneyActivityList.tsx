import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  activityAgoLabel,
  ACTIVITY_HOLD_MS,
  activityElapsedLabel,
  activityGroupOf,
  activityLine,
  conversationActivityGroupOf,
  conversationActivityLine,
  groupJourneyActivity,
  holdActivityLayout,
  layoutOfActivity,
  type ActivityLayout,
  type JourneyActivityConversationLine,
  type JourneyActivityInput,
} from "../domain/journeyActivity";

type SelectionIntent = "pointer" | "keyboard-enter" | "keyboard-space";

type JourneyActivityListProps = {
  journeys: readonly JourneyActivityInput[];
  selectedJourneyId: string;
  /** The thread of the conversation the person is in, so its line is marked. */
  selectedThreadId?: string;
  /** The clock the rest of the sidebar reads its relative times from. */
  relativeTimeNow: number;
  renderVisual: (journeyId: string) => ReactNode;
  /** The Journey's accent name, as the sidebar's `accent-*` classes know it. */
  accentOf: (journeyId: string) => string;
  /** The status glyph the rest of the sidebar uses, so a state reads by its shape here too. */
  renderStatus: (journey: JourneyActivityInput) => ReactNode;
  /** The same glyph for a conversation's line (CR301). */
  renderConversationStatus: (line: JourneyActivityConversationLine) => ReactNode;
  /** A row leads to its Journey's own conversation. */
  onSelect: (journey: JourneyActivityInput, intent: SelectionIntent) => void;
  /** A conversation's line leads to that conversation (CR301). */
  onSelectConversation: (line: JourneyActivityConversationLine, intent: SelectionIntent) => void;
  onOpenMenu: (journeyId: string, trigger: HTMLElement, x: number, y: number) => void;
  menuJourneyId?: string;
  emptyTitle: string;
  emptyHint: string;
};

/** A clock for the Working rows only: it ticks while something is at work and stops otherwise. */
function useSecondsClock(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

const selectionIntentOf = (key: string): SelectionIntent | undefined => (
  key === "Enter" ? "keyboard-enter" : key === " " ? "keyboard-space" : undefined
);

/**
 * The Activity view of the Journey sidebar: Need you, Working, Idle. A row selects its Journey and
 * opens the same menu a Journey row does; under it, each conversation CR301's rule chooses has its
 * own line, which leads there. Everything it shows is state the sidebar already had.
 */
export const JourneyActivityList = memo(function JourneyActivityList({
  journeys, selectedJourneyId, selectedThreadId, relativeTimeNow, renderVisual, accentOf, renderStatus, renderConversationStatus,
  onSelect, onSelectConversation, onOpenMenu, menuJourneyId, emptyTitle, emptyHint,
}: JourneyActivityListProps) {
  const current = groupJourneyActivity(journeys);
  const now = useSecondsClock(current.some((group) => group.id === "working"
    || group.rows.some((row) => row.conversations?.some((line) => conversationActivityGroupOf(line) === "working"))));
  // CR289: choosing a row changes its state, and the list used to follow at once, so the row left the
  // click. The order the person saw is kept for a few seconds, renewed by every choice.
  const [heldLayout, setHeldLayout] = useState<ActivityLayout>();
  const releaseTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);
  const groups = heldLayout ? holdActivityLayout(current, heldLayout) : current;
  const hold = () => {
    setHeldLayout((held) => held ?? layoutOfActivity(groups));
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => setHeldLayout(undefined), ACTIVITY_HOLD_MS);
  };
  if (groups.length === 0) {
    return (
      <div className="journey-activity" aria-label="Journey activity">
        <div className="journey-empty-state"><strong>{emptyTitle}</strong><small>{emptyHint}</small></div>
      </div>
    );
  }
  return (
    <div className="journey-activity" aria-label="Journey activity">
      {groups.map((group) => (
        <section key={group.id} className={`journey-activity-group is-${group.id}`} aria-label={`${group.label}, ${group.rows.length}`}>
          <h3 className="journey-activity-heading"><span>{group.label}</span><span className="journey-activity-count">{group.rows.length}</span></h3>
          {group.rows.map((journey) => {
            const line = activityLine(journey);
            // The clock of work in a conversation is on that conversation's line.
            const when = activityGroupOf(journey) === "working"
              ? journey.inside ? undefined : activityElapsedLabel(journey.startedAt, now)
              : activityAgoLabel(journey.lastWorkedAt, relativeTimeNow);
            const selected = journey.id === selectedJourneyId;
            return (
              <Fragment key={journey.id}>
                <div
                  className={`journey-activity-row is-${group.id} accent-${accentOf(journey.id)} ${selected ? "selected" : ""} ${journey.pinned ? "is-pinned" : ""}${journey.inside ? " has-conversation-state" : ""}`}
                  role="button"
                  tabIndex={0}
                  data-journey-id={journey.id}
                  data-activity-group={group.id}
                  aria-current={selected ? "true" : undefined}
                  aria-haspopup="menu"
                  aria-expanded={menuJourneyId === journey.id}
                  aria-label={[journey.name, group.label, line, when].filter(Boolean).join(", ")}
                  title={[journey.name, line].filter(Boolean).join(" — ")}
                  onClick={() => { hold(); onSelect(journey, "pointer"); }}
                  onContextMenu={(event) => {
                    event.preventDefault(); event.stopPropagation();
                    onOpenMenu(journey.id, event.currentTarget, event.clientX, event.clientY);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                      event.preventDefault(); event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onOpenMenu(journey.id, event.currentTarget, rect.left + 24, rect.top + 24);
                    } else {
                      const intent = selectionIntentOf(event.key);
                      if (!intent) return;
                      event.preventDefault();
                      hold();
                      onSelect(journey, intent);
                    }
                  }}
                >
                  <span className="journey-activity-visual" aria-hidden="true">{renderVisual(journey.id)}</span>
                  <span className="journey-activity-name">{journey.name}</span>
                  {journey.waitingCount > 0 ? (
                    <span className="journey-activity-waiting" aria-hidden="true">{journey.waitingCount}</span>
                  ) : null}
                  {when ? <span className="journey-activity-when">{when}</span> : null}
                  <span className="journey-activity-status">{renderStatus(journey)}</span>
                  {line ? <span className="journey-activity-line">{line}</span> : null}
                  {group.id === "working" ? <span className="journey-activity-progress" aria-hidden="true" /> : null}
                </div>
                {journey.conversations?.map((conversation) => {
                  const lineGroup = conversationActivityGroupOf(conversation);
                  const said = conversationActivityLine(conversation);
                  const title = conversation.title ?? "A conversation";
                  const lineWhen = lineGroup === "working"
                    ? activityElapsedLabel(conversation.startedAt, now)
                    : activityAgoLabel(conversation.lastWorkedAt, relativeTimeNow);
                  const lineSelected = selected && conversation.threadId === selectedThreadId;
                  const choose = (intent: SelectionIntent) => { hold(); onSelectConversation(conversation, intent); };
                  return (
                    <div
                      key={conversation.threadId}
                      className={`journey-activity-conversation is-${lineGroup}${lineSelected ? " selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      data-journey-id={journey.id}
                      data-thread-id={conversation.threadId}
                      aria-current={lineSelected ? "true" : undefined}
                      aria-label={[title, `in ${journey.name}`, said, lineWhen].filter(Boolean).join(", ")}
                      title={[title, said].filter(Boolean).join(": ")}
                      onClick={() => choose("pointer")}
                      onKeyDown={(event) => {
                        const intent = selectionIntentOf(event.key);
                        if (!intent) return;
                        event.preventDefault();
                        choose(intent);
                      }}
                    >
                      <span className="journey-activity-conversation-status">{renderConversationStatus(conversation)}</span>
                      <span className="journey-activity-conversation-title">{title}</span>
                      {lineWhen ? <span className="journey-activity-when">{lineWhen}</span> : null}
                      {said ? <span className="journey-activity-conversation-line">{said}</span> : null}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
});
