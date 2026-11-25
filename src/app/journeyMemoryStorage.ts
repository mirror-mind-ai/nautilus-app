import { invoke } from "@tauri-apps/api/core";
import { sanitizeJourneyMemoryRead, type JourneyMemoryRead } from "../domain/journeyMemory";

/** What Mirror kept from one Journey, read from the active home through the host. */
export async function readJourneyMemories(journeyId: string): Promise<JourneyMemoryRead> {
  const read = sanitizeJourneyMemoryRead(await invoke<unknown>("list_journey_memories", { journeyId }));
  if (!read) throw new Error("Mirror answered without this Journey's memories.");
  return read;
}
