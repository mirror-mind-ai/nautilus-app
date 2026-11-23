import { describeRunningOperation, type JourneyActivityInput } from "../domain/journeyActivity";
import type { FlattenedJourney } from "../domain/journeyRegistry";
import {
  deriveJourneyAgentStatus,
  type JourneyFinishedAttentionState,
  type JourneyTurnOutcome,
} from "./journeyAgentStatus";
import { selectJourneyRuntimeEntries, selectJourneyRuntimeOwnerPhase, type JourneyRuntimeState } from "./journeyRuntimeState";
import { deriveJourneyWorkLocus } from "./journeyWorkLocus";
import type { PiInvocationOccupancyState } from "./piInvocationOccupancy";

/**
 * What the Activity view shows for every Journey, derived exactly as a Journey row of the sidebar
 * derives its status (the same functions, the same inputs), plus what a live run is doing now.
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
  waitingCountOf: (journeyId: string) => number;
  pinnedJourneyIds: readonly string[];
  lastWorkedAtByJourneyId: Readonly<Record<string, string | undefined>>;
}): JourneyActivityInput[] {
  return input.journeys.map((journey) => {
    const runtimePhase = selectJourneyRuntimeOwnerPhase(input.runtimeState, journey.id);
    const work = deriveJourneyWorkLocus({
      occupancy: input.occupancy,
      journeyId: journey.id,
      journeyRootThreadId: input.rootThreadIdOf(journey.id),
      runtimePhase: runtimePhase?.phase,
      runtimeIdentity: runtimePhase?.identity,
    });
    const compacting = input.compactingJourneyId === journey.id;
    const live = selectJourneyRuntimeEntries(input.runtimeState, journey.id)
      .find((entry) => entry.isFinalizingTurn || entry.isStreaming || entry.agentRun.status === "running");
    return {
      id: journey.id,
      name: journey.name,
      status: deriveJourneyAgentStatus({
        runtimePhase: work?.phase,
        finishedAttention: input.finishedAttention[journey.id],
        compacting: compacting,
        turnOutcome: input.turnOutcomes[journey.id],
      }),
      answerSeen: input.finishedAttention[journey.id]?.acknowledgedAt !== undefined,
      waitingCount: input.waitingCountOf(journey.id),
      pinned: input.pinnedJourneyIds.includes(journey.id),
      lastWorkedAt: input.lastWorkedAtByJourneyId[journey.id],
      startedAt: live?.agentRun.startedAt,
      doing: compacting ? "Compacting the conversation" : live ? describeRunningOperation(live.runtimeProjection.operations) : undefined,
      context: journey.breadcrumb.length > 1 ? journey.breadcrumb.slice(0, -1).join(" / ") : undefined,
    };
  });
}
