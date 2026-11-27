import {
  activityConversationsOf,
  describeRunningOperation,
  type JourneyActivityConversationLine,
  type JourneyActivityInput,
} from "../domain/journeyActivity";
import type { FlattenedJourney } from "../domain/journeyRegistry";
import type { WorkedConversation } from "../domain/workedConversations";
import {
  deriveJourneyAgentStatus,
  type JourneyFinishedAttentionState,
  type JourneyTurnOutcome,
} from "./journeyAgentStatus";
import { selectJourneyRuntimeEntries, selectJourneyRuntimeOwnerPhase, type JourneyRuntimeState } from "./journeyRuntimeState";
import { deriveJourneyWorkLocus, type JourneyWorkOwner } from "./journeyWorkLocus";
import { isActivePiInvocationLease, type PiInvocationOccupancyState } from "./piInvocationOccupancy";

/**
 * What the Activity view shows for every Journey, derived exactly as a Journey row of the sidebar
 * derives its status (the same functions, the same inputs), plus what a live run is doing now,
 * which conversation the row's state belongs to when it is not the Journey's own, and the
 * conversations drawn under the row (CR301).
 * Kept out of App.tsx so the view adds no third derivation of the status there.
 */
export function deriveJourneyActivityInputs(input: {
  journeys: readonly FlattenedJourney[];
  runtimeState: JourneyRuntimeState;
  occupancy: PiInvocationOccupancyState;
  rootThreadIdOf: (journeyId: string) => string | undefined;
  finishedAttention: JourneyFinishedAttentionState;
  compactingJourneyId: string | undefined;
  turnOutcomes: Readonly<Record<string, JourneyTurnOutcome | undefined>>;
  /** The workspace of the turn each of `turnOutcomes` reports, as the turn journal names it. */
  turnOutcomeOwners: Readonly<Record<string, JourneyWorkOwner | undefined>>;
  waitingCountOf: (journeyId: string) => number;
  pinnedJourneyIds: readonly string[];
  lastWorkedAtByJourneyId: Readonly<Record<string, string | undefined>>;
  /** A conversation's title by its thread, when the Journey's conversation catalog has been read. */
  conversationTitleOf: (journeyId: string, threadId: string) => string | undefined;
  /** CR301: the conversations a turn was sent in, as the preferences keep them. */
  workedConversations: readonly WorkedConversation[];
  /** The time the last day of worked conversations is counted back from. */
  nowMs: number;
}): JourneyActivityInput[] {
  return input.journeys.map((journey) => {
    const rootThreadId = input.rootThreadIdOf(journey.id);
    const runtimePhase = selectJourneyRuntimeOwnerPhase(input.runtimeState, journey.id);
    const work = deriveJourneyWorkLocus({
      occupancy: input.occupancy,
      journeyId: journey.id,
      journeyRootThreadId: rootThreadId,
      runtimePhase: runtimePhase?.phase,
      runtimeIdentity: runtimePhase?.identity,
    });
    const compacting = input.compactingJourneyId === journey.id;
    // CR134: `inside` is claimed only when the owner is known not to be the Journey's own thread.
    const insideOwner = work?.locus === "inside" ? work.owner : undefined;
    const liveEntries = selectJourneyRuntimeEntries(input.runtimeState, journey.id)
      .filter((entry) => entry.isFinalizingTurn || entry.isStreaming || entry.agentRun.status === "running");
    // With several workspaces of a Journey at work, the line describes the one the row is about.
    const live = liveEntries.find((entry) => (
      entry.identity?.kind === "live" && work?.owner !== undefined && entry.identity.authority.threadId === work.owner.threadId
    )) ?? liveEntries[0];
    const status = deriveJourneyAgentStatus({
      runtimePhase: work?.phase,
      finishedAttention: input.finishedAttention[journey.id],
      compacting: compacting,
      turnOutcome: input.turnOutcomes[journey.id],
    });
    // A turn that ended is placed by the source its state was read from, and under the rule live
    // work follows: a conversation is claimed only when it is known not to be the Journey's own.
    const endedOwner = status === "finished" ? input.finishedAttention[journey.id]?.owner
      : status === "interrupted" || status === "failed" ? input.turnOutcomeOwners[journey.id]
        : undefined;
    const owner = insideOwner
      ?? (endedOwner && rootThreadId && endedOwner.threadId !== rootThreadId ? endedOwner : undefined);
    const titleOf = (threadId: string) => input.conversationTitleOf(journey.id, threadId);
    const doingIn = (threadId: string) => {
      const entry = liveEntries.find((candidate) => candidate.identity?.kind === "live" && candidate.identity.authority.threadId === threadId);
      return entry ? { doing: describeRunningOperation(entry.runtimeProjection.operations), startedAt: entry.agentRun.startedAt } : {};
    };
    // CR301: what is in motion in the Journey's conversations. The conversation the row's state
    // belongs to carries that state; any other conversation holding an open lease is at work too,
    // including beside the Journey's own work, which CR140 lets the row itself report.
    const inMotion: JourneyActivityConversationLine[] = [];
    if (owner) {
      inMotion.push({
        journeyId: journey.id,
        threadId: owner.threadId,
        title: titleOf(owner.threadId),
        status,
        answerSeen: input.finishedAttention[journey.id]?.acknowledgedAt !== undefined,
        ...(insideOwner ? doingIn(owner.threadId) : {}),
      });
    }
    if (rootThreadId) {
      for (const lease of input.occupancy.entries) {
        const threadId = lease.authority.threadId;
        if (lease.authority.journeyId !== journey.id || lease.terminalState !== "open" || threadId === rootThreadId || threadId === owner?.threadId) continue;
        const leaseStatus = isActivePiInvocationLease(lease) ? "working" : lease.leasePhase === "finalizing" ? "finishing" : undefined;
        if (leaseStatus) inMotion.push({ journeyId: journey.id, threadId, title: titleOf(threadId), status: leaseStatus, ...doingIn(threadId) });
      }
    }
    const conversations = activityConversationsOf({
      journeyId: journey.id,
      inMotion,
      worked: input.workedConversations
        .filter((entry) => entry.journeyId === journey.id)
        .map((entry) => ({ threadId: entry.threadId, title: titleOf(entry.threadId) ?? entry.title, lastWorkedAt: entry.lastWorkedAt })),
      rootThreadId,
      nowMs: input.nowMs,
    });
    return {
      id: journey.id,
      name: journey.name,
      status,
      answerSeen: input.finishedAttention[journey.id]?.acknowledgedAt !== undefined,
      waitingCount: input.waitingCountOf(journey.id),
      pinned: input.pinnedJourneyIds.includes(journey.id),
      lastWorkedAt: input.lastWorkedAtByJourneyId[journey.id],
      startedAt: live?.agentRun.startedAt,
      doing: compacting ? "Compacting the conversation" : live ? describeRunningOperation(live.runtimeProjection.operations) : undefined,
      inside: owner ? { ...owner, title: input.conversationTitleOf(journey.id, owner.threadId) } : undefined,
      context: journey.breadcrumb.length > 1 ? journey.breadcrumb.slice(0, -1).join(" / ") : undefined,
      conversations,
    };
  });
}
