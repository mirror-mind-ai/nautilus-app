/** CR220: what the sidebar says when it shows no Journey, and whether it offers to create one. */
export type JourneyEmptyState = {
  title: string;
  hint: string;
  offersCreation: boolean;
};

export function journeyEmptyState({ hasJourneys, pinnedOnly, search }: { hasJourneys: boolean; pinnedOnly: boolean; search: string }): JourneyEmptyState {
  const query = search.trim();
  // With no Journey at all, every view offers the first one: the Tree tools that hold New Journey
  // show only in the Tree view.
  if (!hasJourneys) return { title: "No Journeys yet", hint: "Create a Journey to begin.", offersCreation: true };
  if (pinnedOnly) {
    return query
      ? { title: `No pinned Journeys found for “${query}”`, hint: "Try another search or clear the Pinned filter.", offersCreation: false }
      : { title: "No pinned Journeys", hint: "Pin a Journey to make it available in this filter.", offersCreation: false };
  }
  if (query) return { title: `No Journeys found for “${query}”`, hint: "Try another search or switch the Journey list order.", offersCreation: false };
  return { title: "No active Journeys", hint: "Show the inactive ones from the Tree tools.", offersCreation: false };
}
