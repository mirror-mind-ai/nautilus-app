import { useMemo, useState } from "react";
import type { ConversationMessage } from "../agent/piTaskPacket";
import type { MessageSpeaker } from "./conversationPresentation";
import type { AgentTurnPresentation } from "./conversationTurnPresentation";
import { projectAgentActionGroups } from "./agentActionProjection";
import type { AssistantTurnProximity } from "./turnProximity";
import type { ResponseModelBadge } from "./responseModelAttribution";
import { ImportedActivity } from "./ImportedActivity";
import { LiveRuntimeActivity } from "./LiveRuntimeActivity";
import { MessageAttachmentProvenance } from "./MessageAttachmentProvenance";
import { MessageContent } from "./MessageContent";
import { MessageFileAttachments } from "./MessageFileAttachments";
import { Speech } from "./Speech";
import { SteeringMessages } from "./SteeringMessages";
import type { SteeringEvidence } from "../domain/journeyConversation";

/**
 * CR111: an earlier assistant message of the same run. Its comment is a point on the shared
 * trail rather than a card of its own, while its identity, model and detail stay its own.
 */
export type AgentRunTrailPart = {
  messageId: string;
  presentation: AgentTurnPresentation;
  /** Annotated only where the model changed inside the run. */
  model?: ResponseModelBadge;
};

type AgentTurnProps = {
  message: ConversationMessage;
  speaker: MessageSpeaker;
  presentation: AgentTurnPresentation;
  /** CR111: the run's earlier messages, in order. Empty for an ordinary single-message turn. */
  trailParts?: readonly AgentRunTrailPart[];
  proximity?: AssistantTurnProximity;
  basePath?: string;
  onLocalPathClick?: (path: string) => void;
  highlightQuery?: string;
  /** CR091: the model Pi recorded for this answer, absent where none was attributed. */
  responseModel?: ResponseModelBadge;
  /** CR111: keeps each grouped message reachable by conversation search and the chapter index. */
  registerMessageElement?: (messageId: string, element: HTMLElement | null) => void;
  activeSearchMessageId?: string;
  /**
   * CR117: corrections the Navigator sent while this run was working, in the order they were sent.
   * They are drawn here because they acted on this run's work — and because the prompt they used
   * to hang under is the one part of the turn certain to be out of view by the time one is sent.
   */
  corrections?: readonly SteeringEvidence[];
  /** CR213: who spoke the previous turn, said quietly when it was someone else. */
  previousSpeakerLabel?: string;
};

const NO_TRAIL_PARTS: readonly AgentRunTrailPart[] = [];
const NO_CORRECTIONS: readonly SteeringEvidence[] = [];

export function AgentTurn({
  message,
  speaker,
  presentation,
  trailParts = NO_TRAIL_PARTS,
  proximity = "latest_completed",
  basePath,
  onLocalPathClick,
  highlightQuery,
  responseModel,
  registerMessageElement,
  activeSearchMessageId,
  corrections = NO_CORRECTIONS,
  previousSpeakerLabel,
}: AgentTurnProps) {
  const hasContent = Boolean(
    trailParts.length > 0
    || presentation.agentActions
    || presentation.systemSurfaces.length > 0
    || presentation.agentComment
    || presentation.interruptedFragment
    // A run can be corrected before it has said anything, and the correction must still show.
    || corrections.length > 0,
  );
  // Unset until the Navigator opens or closes the line; until then a turn that ended badly is open.
  const [historicalDetailToggled, setHistoricalDetailOpen] = useState<boolean | undefined>(undefined);
  // CR111: the run's detail, in run order. Each part keeps its own projection because operation
  // ids only resolve inside the projection that recorded them.
  const detailParts = useMemo(
    () => [...trailParts.map((part) => part.presentation), presentation],
    [trailParts, presentation],
  );
  const runSurfaces = useMemo(
    () => detailParts.flatMap((part) => part.systemSurfaces),
    [detailParts],
  );
  const suppressedSurfaceContents = runSurfaces
    .map((surface) => surface.content)
    .filter((content): content is string => Boolean(content));
  const actionSections = useMemo(
    () => detailParts
      .map((part) => part.agentActions)
      .filter((projection): projection is NonNullable<typeof projection> => Boolean(projection))
      .map((projection) => ({ projection, groups: projectAgentActionGroups(projection) })),
    [detailParts],
  );
  const actionCount = actionSections.reduce((total, section) => total + section.groups.length, 0);
  // CR212: a turn that failed or was cancelled is not noise. Its line says how it ended and opens
  // by itself, so the outcome is never folded away, even when the turn took no action.
  const endedBadly = actionSections
    .map(({ projection }) => projection.status)
    .find((status): status is "failed" | "cancelled" => status === "failed" || status === "cancelled");
  const historicalDetailOpen = historicalDetailToggled ?? Boolean(endedBadly);
  const hasHistoricalDetail = actionCount > 0 || runSurfaces.length > 0 || Boolean(endedBadly);
  // CR111: one Agent Actions region for the whole run, as the Navigator chose, rather than one
  // disclosure per comment.
  const actions = actionSections.length > 0 ? (
    <section className="agent-turn-region agent-actions" aria-label="Agent Actions">
      <span className="runtime-region-label">Agent Actions</span>
      {actionSections.map((section, index) => (
        <LiveRuntimeActivity
          key={index}
          projection={section.projection}
          basePath={basePath}
          suppressedSurfaceContents={suppressedSurfaceContents}
          showRegionLabel={false}
          showSuccessfulTerminalStatus={false}
          actionGroups={section.groups}
        />
      ))}
    </section>
  ) : null;
  const surfaces = runSurfaces.length > 0 ? (
    <section className="agent-turn-region system-surfaces" aria-label="System Surfaces">
      <span className="runtime-region-label">System Surfaces</span>
      <ImportedActivity events={runSurfaces} basePath={basePath} />
    </section>
  ) : null;
  const renderComment = (content: string) => (
    <MessageContent
      content={content}
      basePath={basePath}
      onLocalPathClick={onLocalPathClick}
      copyCodeBlocks
      highlightQuery={highlightQuery}
    />
  );
  // CR083: notes the agent left while it was still working read as a trail, and the comment that
  // closed the turn keeps the weight of an answer. Both stay visible; neither hides behind a click.
  // CR111: the trail now spans the whole run, so a settled run reads the way it did while live.
  const ownTrail = presentation.commentTrail ?? [];
  // A message whose own presentation already made it a note has no closing prose of its own.
  const ownClosing = presentation.closingComment
    ?? (ownTrail.length > 0 ? undefined : presentation.agentComment);
  const trailPoints = [
    ...trailParts.map((part) => ({
      key: part.messageId,
      messageId: part.messageId as string | undefined,
      content: part.presentation.agentComment,
      model: part.model,
    })),
    ...ownTrail.map((note, index) => ({
      key: `own-${index}`,
      messageId: undefined as string | undefined,
      content: note,
      model: undefined as ResponseModelBadge | undefined,
    })),
  ].filter((point) => point.content.trim());
  const trail = trailPoints.length > 0 ? (
    <ol className="agent-comment-trail" aria-label="Agent progress notes">
      {trailPoints.map((point) => (
        <li
          key={point.key}
          className={point.messageId && point.messageId === activeSearchMessageId
            ? "agent-comment-note conversation-message-search-current"
            : "agent-comment-note"}
          {...(point.messageId ? { "data-conversation-message-id": point.messageId } : {})}
          ref={point.messageId
            ? (element) => registerMessageElement?.(point.messageId as string, element)
            : undefined}
        >
          {point.model?.changed ? (
            <span className="response-model-badge is-changed" title={`Continued by ${point.model.label}`}>
              {point.model.label}
            </span>
          ) : null}
          {renderComment(point.content)}
        </li>
      ))}
    </ol>
  ) : null;
  const closing = ownClosing ? renderComment(ownClosing) : null;
  const comments = trail || closing ? (
    <section className="agent-turn-region agent-comments" aria-label="Agent Comments">
      <span className="runtime-region-label">Agent Comments</span>
      {trail}
      {closing}
    </section>
  ) : null;
  const running = proximity === "active";
  // CR089: what had already arrived when the Navigator interrupted the turn. It is shown as an
  // unfinished fragment, never as an answer, because the agent never finished saying it.
  const interruptedFragments = detailParts
    .map((part) => part.interruptedFragment)
    .filter((fragment): fragment is string => Boolean(fragment));
  // CR117: kept out of the historical disclosure — that a correction was sent is part of what the
  // turn was, not a detail of how it ran.
  const sentCorrections = corrections.length > 0
    ? <SteeringMessages evidence={corrections} />
    : null;
  const interrupted = interruptedFragments.length > 0 ? (
    <section className="agent-turn-region agent-interrupted-fragment" aria-label="Interrupted response">
      <span className="runtime-region-label">Interrupted</span>
      {interruptedFragments.map((fragment, index) => (
        <div key={index}>{renderComment(fragment)}</div>
      ))}
    </section>
  ) : null;
  // CR111: copying a grouped run yields the narration the Navigator can actually see.
  const copyBody = [...trailParts.map((part) => part.presentation.agentComment), presentation.agentComment]
    .filter((text) => text.trim())
    .join("\n\n");

  // CR213: the persona speaks its comments, the interrupted fragment included, beside its name.
  const speech = comments || interrupted ? (
    <Speech
      side="agent"
      speaker={speaker}
      meta={previousSpeakerLabel && previousSpeakerLabel !== speaker.label
        ? `before: ${previousSpeakerLabel}`
        : undefined}
      {...(copyBody ? { copyBody } : {})}
      anchorMessageId={message.id}
      registerElement={(element) => registerMessageElement?.(message.id, element)}
      highlighted={message.id === activeSearchMessageId}
    >
      {comments}
      {interrupted}
    </Speech>
  ) : null;
  const model = responseModel ? (
    <span
      className={`response-model-badge${responseModel.changed ? " is-changed" : ""}`}
      title={`Answered by ${responseModel.label}`}
    >
      {responseModel.label}
    </span>
  ) : null;
  const counts = turnLineCounts(actionCount, runSurfaces.length);
  const outcome = endedBadly ? [endedBadly === "failed" ? "Failed" : "Cancelled"] : [];
  // CR212: what the turn did is one line. While it runs, the line is live and the actions stay open
  // above the speech, where the work happens; once it ends they fold into the line, under the speech,
  // a footer for what the reader may have skipped.
  const liveLine = (
    <div className="agent-turn-line is-live">
      {["Working", ...counts].join(" · ")}
      {model ? <> · {model}</> : null}
    </div>
  );
  const turnLine = hasHistoricalDetail ? (
    <details
      className="agent-turn-line historical-turn-disclosure"
      open={historicalDetailOpen}
      onToggle={(event) => setHistoricalDetailOpen(event.currentTarget.open)}
    >
      <summary>
        {[...outcome, ...counts].join(" · ")}
        {model ? <> · {model}</> : null}
      </summary>
      {historicalDetailOpen ? (
        <div className="historical-turn-detail-body">
          {actions}
          {surfaces}
        </div>
      ) : null}
    </details>
  ) : model ? <div className="agent-turn-line">{model}</div> : null;
  const anchoredOnSpeech = Boolean(speech);

  return (
    <div className="message-cluster">
      {hasContent ? (
        <article
          className={!anchoredOnSpeech && message.id === activeSearchMessageId
            ? `message assistant speaker-${speaker.kind} conversation-message-search-current`
            : `message assistant speaker-${speaker.kind}`}
          {...(anchoredOnSpeech ? {} : { "data-conversation-message-id": message.id })}
          ref={anchoredOnSpeech ? undefined : (element) => registerMessageElement?.(message.id, element)}
        >
          {running ? (
            <>
              {liveLine}
              {actions}
              {surfaces}
              {speech}
              {sentCorrections}
            </>
          ) : (
            <>
              {speech}
              {sentCorrections}
              {turnLine}
            </>
          )}
          <MessageFileAttachments attachments={message.attachments} />
          <MessageAttachmentProvenance attachments={message.attachments} />
        </article>
      ) : null}
      <ImportedActivity events={presentation.remainingActivity} basePath={basePath} />
    </div>
  );
}

function turnLineCounts(actionCount: number, surfaceCount: number): string[] {
  return [
    actionCount > 0 ? `${actionCount} ${actionCount === 1 ? "action" : "actions"}` : undefined,
    surfaceCount > 0 ? `${surfaceCount} ${surfaceCount === 1 ? "surface" : "surfaces"}` : undefined,
  ].filter((part): part is string => Boolean(part));
}
