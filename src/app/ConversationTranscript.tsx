import type { PersonaNames } from "../domain/personaNames";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { ConversationMessage } from "../agent/piTaskPacket";
import type { JourneyConversation, SteeringEvidence } from "../domain/journeyConversation";
import { AgentTurn, type AgentRunTrailPart } from "./AgentTurn";
import { projectTranscriptRenderItems } from "./agentRunGrouping";
import {
  extractMirrorModeEventsFromContent,
  extractMirrorSurfaceEventsFromContent,
  ImportedActivity,
  mergeImportedActivityEvents,
  stripMirrorModeBlocks,
  stripMirrorSurfaceBlocks,
  type groupImportedActivityByMessage,
} from "./ImportedActivity";
import { MessageAttachmentProvenance } from "./MessageAttachmentProvenance";
import { MessageContent } from "./MessageContent";
import { MessageFileAttachments } from "./MessageFileAttachments";
import { Speech } from "./Speech";
import { SteeringMessages } from "./SteeringMessages";
import { MessageSpeakerAvatar } from "./UserAvatar";
import {
  inferMessageSpeaker,
  personaSpeaker,
  stripMessageSpeakerSignature,
  type MessageSpeaker,
} from "./conversationPresentation";
import type { Person } from "../domain/personName";
import { projectAgentTurnPresentation } from "./conversationTurnPresentation";
import type { RuntimeProjectionState } from "./runtimeActivityModel";
import type { AssistantTurnProximity } from "./turnProximity";
import { buildConversationTranscriptIndex } from "./conversationTranscriptModel";
import { ChapterDividerRow } from "./ChapterDividerRow";
import { ChapterIndexPanel } from "./ChapterIndexPanel";
import type { ConversationChapter } from "../domain/compactionChapters";
import { projectResponseModelBadges, type ResponseModelBadge } from "./responseModelAttribution";
import {
  clampConversationNavigationIndex,
  createConversationTurnNavigationItems,
  findConversationSearchMatches,
} from "./conversationSearchNavigation";

type GroupedImportedActivity = ReturnType<typeof groupImportedActivityByMessage>;
const EMPTY_ACTIVITY: GroupedImportedActivity["unlinked"] = [];
const EMPTY_STEERING: SteeringEvidence[] = [];

const NO_PERSONA_NAMES: PersonaNames = {};

type ConversationTranscriptProps = {
  messages: ConversationMessage[];
  conversation: JourneyConversation;
  importedActivity: GroupedImportedActivity;
  assistantTurnProximity: ReadonlyMap<string, AssistantTurnProximity>;
  runtimeProjection: RuntimeProjectionState;
  runtimeProjectionMessageId?: string;
  basePath?: string;
  userAvatar?: string;
  /** CR190: whose turns these are, for their name and initial. */
  person?: Person;
  /** CR216: the names the Core keeps for this home's personas, by id. */
  personaNames?: PersonaNames;
  onLocalPathClick: (path: string) => void;
  searchOpen?: boolean;
  turnNavigatorOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  onTurnNavigatorOpenChange?: (open: boolean) => void;
  /** CR080: the chapter index, derived from the Segment manifest and the surface. */
  chaptersOpen?: boolean;
  chapters?: readonly ConversationChapter[];
  onChaptersOpenChange?: (open: boolean) => void;
  /**
   * CR114: how many earlier chapters exist but are not loaded. Search already declared that it
   * reads loaded content; that is only an honest statement if the surface also says when
   * something is deliberately not loaded. The count is the Segment manifest's, which is the same
   * boundary under its internal name.
   */
  earlierSegmentCount?: number;
  onLoadEarlierHistory?: () => void;
  earlierHistoryState?: "idle" | "loading" | "error";
  /** CR091: model captured on the live run, for the answer Pi has not recorded yet. */
  liveResponseModel?: { messageId: string; label: string };
};

type ConversationMessageRowProps = {
  message: ConversationMessage;
  linkedActivity: GroupedImportedActivity["unlinked"];
  proximity?: AssistantTurnProximity;
  exactRuntimeProjection?: RuntimeProjectionState;
  basePath?: string;
  userAvatar?: string;
  person?: Person;
  onLocalPathClick: (path: string) => void;
  highlightQuery?: string;
  responseModel?: ResponseModelBadge;
  /** CR083: set when this restored comment did not close its turn. */
  commentRole?: "trail";
  /** CR089: prose that had arrived when this turn was interrupted. */
  interruptedFragment?: string;
};

/** CR111: everything one assistant message contributes to the run it belongs to. */
type AgentRunMessagePart = {
  message: ConversationMessage;
  linkedActivity: GroupedImportedActivity["unlinked"];
  exactRuntimeProjection?: RuntimeProjectionState;
  commentRole?: "trail";
  interruptedFragment?: string;
  responseModel?: ResponseModelBadge;
};

type AgentRunRowProps = {
  parts: AgentRunMessagePart[];
  speaker: MessageSpeaker;
  /** CR213: who spoke the previous run. */
  previousSpeakerLabel?: string;
  proximity?: AssistantTurnProximity;
  basePath?: string;
  onLocalPathClick: (path: string) => void;
  highlightQuery?: string;
  registerMessageElement: (messageId: string, element: HTMLElement | null) => void;
  activeSearchMessageId?: string;
  /** CR117: corrections sent against this run, in send order, drawn inside the run's own card. */
  corrections?: readonly SteeringEvidence[];
  /** CR214: the Navigator, who speaks those corrections. */
  person?: MessageSpeaker;
  userAvatar?: string;
};

/**
 * CR111: one agent run is one card. Each message keeps its own presentation, model attribution
 * and detail; only the reading surface is shared, so nothing is merged that Pi recorded apart.
 */
const AgentRunRow = memo(function AgentRunRow({
  parts,
  speaker,
  previousSpeakerLabel,
  proximity,
  basePath,
  onLocalPathClick,
  highlightQuery,
  registerMessageElement,
  activeSearchMessageId,
  corrections,
  person,
  userAvatar,
}: AgentRunRowProps) {
  const presentations = parts.map((part) => projectAgentTurnPresentation({
    messageId: part.message.id,
    content: part.message.content,
    createdAt: part.message.createdAt,
    linkedActivity: part.linkedActivity,
    ...(part.exactRuntimeProjection ? { runtimeProjection: part.exactRuntimeProjection } : {}),
    ...(part.commentRole ? { commentRole: part.commentRole } : {}),
    ...(part.interruptedFragment ? { interruptedFragment: part.interruptedFragment } : {}),
  }));
  const closingIndex = parts.length - 1;
  const closing = parts[closingIndex];
  const trailParts: AgentRunTrailPart[] = parts.slice(0, closingIndex).map((part, index) => ({
    messageId: part.message.id,
    presentation: presentations[index],
    ...(part.responseModel ? { model: part.responseModel } : {}),
  }));

  return (
    <AgentTurn
      message={closing.message}
      speaker={speaker}
      presentation={presentations[closingIndex]}
      {...(trailParts.length > 0 ? { trailParts } : {})}
      proximity={proximity}
      basePath={basePath}
      onLocalPathClick={onLocalPathClick}
      highlightQuery={highlightQuery}
      {...(closing.responseModel ? { responseModel: closing.responseModel } : {})}
      registerMessageElement={registerMessageElement}
      {...(activeSearchMessageId ? { activeSearchMessageId } : {})}
      {...(corrections && corrections.length > 0 ? { corrections } : {})}
      {...(previousSpeakerLabel ? { previousSpeakerLabel } : {})}
      {...(person ? { person } : {})}
      {...(userAvatar ? { userAvatar } : {})}
    />
  );
});

/** CR188: a run speaks as the persona delivered with its closing answer's request. */
function runSpeaker(closing: ConversationMessage, responsePersona: string | null | undefined, personaNames: PersonaNames): MessageSpeaker {
  return personaSpeaker({
    ...closing,
    content: stripMirrorModeBlocks(stripMirrorSurfaceBlocks(closing.content)),
  }, responsePersona, personaNames);
}

/** CR213: the Navigator's turn is spoken at a time of day, beside their name. */
function timeOfDay(createdAt: string): string | undefined {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ConversationMessageRow = memo(function ConversationMessageRow({
  message,
  linkedActivity,
  proximity,
  exactRuntimeProjection,
  commentRole,
  interruptedFragment,
  basePath,
  userAvatar,
  person,
  onLocalPathClick,
  highlightQuery,
  responseModel,
}: ConversationMessageRowProps) {
  const contentWithoutSurfaces = stripMirrorSurfaceBlocks(message.content);
  const renderedContent = stripMirrorModeBlocks(contentWithoutSurfaces);
  const speaker = inferMessageSpeaker({ ...message, content: renderedContent }, person);

  if (message.role === "assistant") {
    const presentation = projectAgentTurnPresentation({
      messageId: message.id,
      content: message.content,
      createdAt: message.createdAt,
      linkedActivity,
      ...(exactRuntimeProjection ? { runtimeProjection: exactRuntimeProjection } : {}),
      ...(commentRole ? { commentRole } : {}),
      ...(interruptedFragment ? { interruptedFragment } : {}),
    });
    return (
      <AgentTurn
        message={message}
        speaker={speaker}
        presentation={presentation}
        proximity={proximity}
        basePath={basePath}
        onLocalPathClick={onLocalPathClick}
        highlightQuery={highlightQuery}
        responseModel={responseModel}
      />
    );
  }

  const renderTimeActivity = [
    ...extractMirrorSurfaceEventsFromContent({
      content: message.content,
      messageId: message.id,
      createdAt: message.createdAt,
    }),
    ...extractMirrorModeEventsFromContent({
      content: contentWithoutSurfaces,
      messageId: message.id,
      createdAt: message.createdAt,
    }),
  ];
  const messageActivity = mergeImportedActivityEvents(linkedActivity, renderTimeActivity);
  const bodyContent = stripMessageSpeakerSignature(renderedContent);

  return (
    <div className="message-cluster">
      {bodyContent ? (
        <article className={`message ${message.role} speaker-${speaker.kind}`}>
          <Speech
            side="person"
            speaker={speaker}
            {...(userAvatar ? { userAvatar } : {})}
            meta={timeOfDay(message.createdAt)}
            copyBody={bodyContent}
          >
            <MessageContent
              content={bodyContent}
              basePath={basePath}
              onLocalPathClick={onLocalPathClick}
              preserveParagraphLineBreaks
              highlightQuery={highlightQuery}
            />
            <MessageFileAttachments attachments={message.attachments} />
            <MessageAttachmentProvenance attachments={message.attachments} />
          </Speech>
        </article>
      ) : null}
      <ImportedActivity events={messageActivity} basePath={basePath} />
    </div>
  );
});

export const ConversationTranscript = memo(function ConversationTranscript({
  messages,
  conversation,
  importedActivity,
  assistantTurnProximity,
  runtimeProjection,
  runtimeProjectionMessageId,
  basePath,
  userAvatar,
  person,
  personaNames = NO_PERSONA_NAMES,
  onLocalPathClick,
  searchOpen = false,
  turnNavigatorOpen = false,
  chaptersOpen = false,
  chapters,
  onSearchOpenChange,
  onTurnNavigatorOpenChange,
  onChaptersOpenChange,
  earlierSegmentCount = 0,
  onLoadEarlierHistory,
  earlierHistoryState,
  liveResponseModel,
}: ConversationTranscriptProps) {
  const index = useMemo(() => buildConversationTranscriptIndex(conversation), [conversation]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const responseModelBadges = useMemo(
    () => projectResponseModelBadges({
      messages,
      ...(conversation.responseModels ? { responseModels: conversation.responseModels } : {}),
      ...(liveResponseModel ? { liveAttribution: liveResponseModel } : {}),
    }),
    [messages, conversation.responseModels, liveResponseModel],
  );
  const searchMatches = useMemo(() => findConversationSearchMatches(messages, searchQuery), [messages, searchQuery]);
  const turnItems = useMemo(() => createConversationTurnNavigationItems(messages), [messages]);
  const activeMatch = searchMatches[clampConversationNavigationIndex(currentMatchIndex, searchMatches.length)];

  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  // CR111: consecutive assistant messages are one run, so the trail they formed while live is
  // still one trail at rest.
  const renderItems = useMemo(
    () => projectTranscriptRenderItems(messages, {
      chapterDividerMessageIds: new Set(Object.keys(conversation.chapterDividers ?? {})),
    }),
    [messages, conversation.chapterDividers],
  );

  // CR213: each run's speaker, and who spoke the run before it, so a change of persona is said.
  // CR214: the Navigator speaks their corrections as they speak their turns.
  const navigatorSpeaker = useMemo(() => inferMessageSpeaker({ role: "user", content: "" }, person), [person]);
  const runSpeakers = useMemo(() => {
    const result = new Map<string, { speaker: MessageSpeaker; previousSpeakerLabel?: string }>();
    let previousSpeakerLabel: string | undefined;
    for (const item of renderItems) {
      if (item.kind !== "agent_run") continue;
      const closing = [...item.messageIds].reverse().map((id) => messagesById.get(id)).find(Boolean);
      if (!closing) continue;
      const speaker = runSpeaker(closing, conversation.responsePersonas?.[closing.id], personaNames);
      result.set(closing.id, { speaker, ...(previousSpeakerLabel ? { previousSpeakerLabel } : {}) });
      previousSpeakerLabel = speaker.label;
    }
    return result;
  }, [renderItems, messagesById, conversation.responsePersonas, personaNames]);

  const scrollToMessage = useCallback((messageId: string) => {
    messageRefs.current.get(messageId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  // Every grouped message stays individually reachable by search and the chapter index.
  const registerMessageElement = useCallback((messageId: string, element: HTMLElement | null) => {
    if (element) messageRefs.current.set(messageId, element);
    else messageRefs.current.delete(messageId);
  }, []);

  const moveSearch = useCallback((direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      return;
    }
    const nextIndex = clampConversationNavigationIndex(currentMatchIndex + direction, searchMatches.length);
    setCurrentMatchIndex(nextIndex);
    scrollToMessage(searchMatches[nextIndex].messageId);
  }, [currentMatchIndex, scrollToMessage, searchMatches]);

  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, []);

  const searchStatus = !searchQuery.trim()
    ? "Search is scoped to loaded content in this Conversation."
    : searchMatches.length === 0
      ? "No matches in loaded Conversation content."
      : `Match ${clampConversationNavigationIndex(currentMatchIndex, searchMatches.length) + 1} of ${searchMatches.length} in loaded Conversation content.`;

  return (
    <>
      {messages.length > 0 && searchOpen ? (
        <section className="conversation-search-panel" role="search" aria-label="Search loaded Conversation content">
          <button
            type="button"
            className="conversation-panel-close"
            onClick={() => onSearchOpenChange?.(false)}
            aria-label="Close conversation search"
            title="Close"
          >
            ×
          </button>
          <label>
            <span>Search loaded Conversation content</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
              placeholder="Find text in this Conversation"
              autoFocus
            />
          </label>
          <p role="status">{searchStatus}</p>
          {earlierSegmentCount > 0 ? (
            <p className="conversation-search-scope">
              {earlierSegmentCount === 1
                ? "1 earlier chapter is not loaded, so it is outside this search."
                : `${earlierSegmentCount} earlier chapters are not loaded, so they are outside this search.`}
              {onLoadEarlierHistory ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={onLoadEarlierHistory}
                  disabled={earlierHistoryState === "loading"}
                >
                  {earlierHistoryState === "loading" ? "Loading earlier history…" : "Load earlier history"}
                </button>
              ) : null}
            </p>
          ) : null}
          <div className="conversation-search-controls">
            <button type="button" className="secondary-button" disabled={searchMatches.length === 0} onClick={() => moveSearch(-1)}>Previous</button>
            <button type="button" className="secondary-button" disabled={searchMatches.length === 0} onClick={() => moveSearch(1)}>Next</button>
          </div>
        </section>
      ) : null}
      {chaptersOpen ? (
        <ChapterIndexPanel
          chapters={chapters ?? []}
          onSelect={(messageId) => scrollToMessage(messageId)}
          onClose={() => onChaptersOpenChange?.(false)}
          {...(onLoadEarlierHistory ? { onLoadEarlierHistory } : {})}
          {...(earlierHistoryState ? { earlierHistoryState } : {})}
        />
      ) : null}
      {messages.length > 0 && turnNavigatorOpen ? (
        <aside className="conversation-turn-panel" aria-label="Conversation turns">
          <button
            type="button"
            className="conversation-panel-close"
            onClick={() => onTurnNavigatorOpenChange?.(false)}
            aria-label="Close turn navigator"
            title="Close"
          >
            ×
          </button>
          <p>User turns, from newest to oldest.</p>
          <ol>
            {turnItems.map((item) => (
              <li key={item.messageId}>
                <button type="button" onClick={() => scrollToMessage(item.messageId)} aria-label={`Go to user turn ${item.ordinal}: ${item.snippet}`}>
                  <MessageSpeakerAvatar speakerKind="user" fallback={person?.initial ?? "Y"} userAvatar={userAvatar} />
                  <q>{item.snippet}</q>
                  <span className="conversation-turn-number" aria-hidden="true">{item.ordinal}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
      <ImportedActivity events={importedActivity.unlinked} variant="summary" basePath={basePath} />
      {renderItems.map((item) => {
        const messageIds = item.kind === "agent_run" ? item.messageIds : [item.messageId];
        const leadId = messageIds[0];
        // CR080: derived from the Pi session on every projection, so a chapter that closed
        // months ago still shows its divider on reload. CR111 breaks a run at that divider, so
        // it is always carried by the first message of the item.
        const chapterDivider = conversation.chapterDividers?.[leadId];
        const divider = chapterDivider ? <ChapterDividerRow divider={chapterDivider} /> : null;

        if (item.kind === "agent_run") {
          const parts: AgentRunMessagePart[] = messageIds.flatMap((messageId) => {
            const message = messagesById.get(messageId);
            if (!message) return [];
            const commentRole = conversation.agentCommentRoles?.[messageId];
            const interruptedFragment = conversation.interruptedFragments?.[messageId];
            const responseModel = responseModelBadges[messageId];
            return [{
              message,
              linkedActivity: importedActivity.byMessageId.get(messageId) ?? EMPTY_ACTIVITY,
              ...(runtimeProjectionMessageId === messageId
                ? { exactRuntimeProjection: runtimeProjection }
                : (() => {
                  const projection = index.terminalEvidenceByAssistantMessageId.get(messageId)?.projection
                    ?? index.reconstructedProjectionByAssistantMessageId.get(messageId);
                  return projection ? { exactRuntimeProjection: projection } : {};
                })()),
              ...(commentRole ? { commentRole } : {}),
              ...(interruptedFragment ? { interruptedFragment } : {}),
              ...(responseModel ? { responseModel } : {}),
            }];
          });
          if (parts.length === 0) return null;
          const runSpeech = runSpeakers.get(parts[parts.length - 1].message.id);
          if (!runSpeech) return null;
          // The run's proximity is its closing message's: the run is as recent as its last word.
          const proximity = assistantTurnProximity.get(parts[parts.length - 1].message.id);
          // CR117: a correction is recorded against the turn's own assistant message, which may be
          // any part of a grouped run, so the run claims every correction its parts carry and
          // presents them in send order.
          const corrections = parts
            .flatMap((part) => index.steeringByAssistantMessageId.get(part.message.id) ?? EMPTY_STEERING)
            .sort((left, right) => left.sequence - right.sequence);
          return (
            <div key={leadId} className="conversation-row">
              {divider}
              <AgentRunRow
                parts={parts}
                speaker={runSpeech.speaker}
                {...(runSpeech.previousSpeakerLabel ? { previousSpeakerLabel: runSpeech.previousSpeakerLabel } : {})}
                {...(corrections.length > 0 ? { corrections, person: navigatorSpeaker } : {})}
                {...(userAvatar ? { userAvatar } : {})}
                proximity={proximity}
                basePath={basePath}
                onLocalPathClick={onLocalPathClick}
                highlightQuery={searchOpen ? searchQuery : undefined}
                registerMessageElement={registerMessageElement}
                {...(activeMatch?.messageId ? { activeSearchMessageId: activeMatch.messageId } : {})}
              />
            </div>
          );
        }

        const message = messagesById.get(item.messageId);
        if (!message) return null;
        return (
          <div
            key={message.id}
            ref={(element) => registerMessageElement(message.id, element)}
            className={`conversation-row${activeMatch?.messageId === message.id ? " conversation-message-search-current" : ""}`}
            data-conversation-message-id={message.id}
          >
            {divider}
            <ConversationMessageRow
              message={message}
              linkedActivity={importedActivity.byMessageId.get(message.id) ?? EMPTY_ACTIVITY}
              basePath={basePath}
              userAvatar={userAvatar}
              person={person}
              onLocalPathClick={onLocalPathClick}
              highlightQuery={searchOpen ? searchQuery : undefined}
            />
          </div>
        );
      })}
    </>
  );
});
