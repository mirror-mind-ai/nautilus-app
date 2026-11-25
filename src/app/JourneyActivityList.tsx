import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  activityAgoLabel,
  ACTIVITY_HOLD_MS,
  activityElapsedLabel,
  activityGroupOf,
  activityLine,
  groupJourneyActivity,
  holdActivityLayout,
  layoutOfActivity,
  type ActivityLayout,
  type JourneyActivityInput,
} from "../domain/journeyActivity";

type JourneyActivityListProps = {
  journeys: readonly JourneyActivityInput[];
  selectedJourneyId: string;
  /** The clock the rest of the sidebar reads its relative times from. */
  relativeTimeNow: number;
  renderVisual: (journeyId: string) => ReactNode;
  /** The Journey's accent name, as the sidebar's `accent-*` classes know it. */
  accentOf: (journeyId: string) => string;
  /** The status glyph the rest of the sidebar uses, so a state reads by its shape here too. */
  renderStatus: (journey: JourneyActivityInput) => ReactNode;
  /** The whole row is given, so the app can lead to the conversation at work instead of the Journey. */
  onSelect: (journey: JourneyActivityInput, intent: "pointer" | "keyboard-enter" | "keyboard-space") => void;
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

/**
 * The Activity view of the Journey sidebar: Need you, Working, Idle. A row selects its Journey,
 * or the conversation inside it that is at work, and opens the same menu a Journey row does;
 * everything it shows is state the sidebar already had.
 */
export const JourneyActivityList = memo(function JourneyActivityList({
  journeys, selectedJourneyId, relativeTimeNow, renderVisual, accentOf, renderStatus, onSelect, onOpenMenu, menuJourneyId, emptyTitle, emptyHint,
}: JourneyActivityListProps) {
  const current = groupJourneyActivity(journeys);
  const now = useSecondsClock(current.some((group) => group.id === "working"));
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
            const when = activityGroupOf(journey) === "working" ? activityElapsedLabel(journey.startedAt, now) : activityAgoLabel(journey.lastWorkedAt, relativeTimeNow);
            const selected = journey.id === selectedJourneyId;
            return (
              <div
                key={journey.id}
                className={`journey-activity-row is-${group.id} accent-${accentOf(journey.id)} ${selected ? "selected" : ""} ${journey.pinned ? "is-pinned" : ""}`}
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
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    const intent = event.key === "Enter" ? "keyboard-enter" : "keyboard-space";
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
            );
          })}
        </section>
      ))}
    </div>
  );
});
