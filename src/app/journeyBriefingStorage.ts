import { invoke } from "@tauri-apps/api/core";
import { sanitizeJourneyBriefing, type JourneyBriefing } from "../domain/journeyBriefing";

const UNREADABLE = "Mirror answered without the briefing.";

/** CR263: one Journey's content whole, read from Mirror each time, never from the registry's cache. */
export async function readJourneyBriefing(journeyId: string): Promise<JourneyBriefing> {
  const answer = sanitizeJourneyBriefing(await invoke<unknown>("read_journey_briefing", { journeyId }));
  if (!answer) throw new Error(UNREADABLE);
  return answer;
}
