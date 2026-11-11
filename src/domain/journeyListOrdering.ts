/**
 * The order of the sidebar cards the Navigator controls, as pure data.
 *
 * Pinned is the Navigator's own order: a new pin goes first, and a pinned Journey is moved by the
 * card's menu or by dragging inside Pinned. The order is a local preference, never a Mirror
 * mutation. Recent stays automatic (the last message sent), but says where its recent rows end and
 * the pinned or selected rows that are only kept visible begin.
 */
export type PinnedMove = "up" | "down" | "top";
export type PinnedDropPosition = "before" | "after";
export type PinnedDropTarget = { journeyId: string; position: PinnedDropPosition };
/** The words are the divider's own: "recent" in Recent is the last message sent, not the pin. */
export type RecentSidebarDivider = "Pinned but not used recently" | "Selected";

export function togglePinnedJourneyFirst(pinnedJourneyIds: readonly string[], journeyId: string): string[] {
  return pinnedJourneyIds.includes(journeyId)
    ? pinnedJourneyIds.filter((id) => id !== journeyId)
    : [journeyId, ...pinnedJourneyIds];
}

export function pinnedMoveAvailability(
  pinnedJourneyIds: readonly string[],
  journeyId: string,
): Record<PinnedMove, boolean> | undefined {
  const index = pinnedJourneyIds.indexOf(journeyId);
  if (index < 0) return undefined;
  return { up: index > 0, down: index < pinnedJourneyIds.length - 1, top: index > 0 };
}

/** The same array when nothing moves, so a no-op does not rewrite the preferences. */
export function movePinnedJourney<T extends readonly string[]>(pinnedJourneyIds: T, journeyId: string, move: PinnedMove): T | string[] {
  const index = pinnedJourneyIds.indexOf(journeyId);
  const target = index < 0 ? index : move === "top" ? 0 : move === "up" ? index - 1 : index + 1;
  if (index < 0 || target === index || target < 0 || target >= pinnedJourneyIds.length) return pinnedJourneyIds;
  const reordered = pinnedJourneyIds.filter((id) => id !== journeyId);
  reordered.splice(target, 0, journeyId);
  return reordered;
}

/** The same array when the drop would leave the Journey where it is. */
export function placePinnedJourney<T extends readonly string[]>(
  pinnedJourneyIds: T,
  draggedJourneyId: string,
  targetJourneyId: string,
  position: PinnedDropPosition,
): T | string[] {
  if (draggedJourneyId === targetJourneyId) return pinnedJourneyIds;
  if (!pinnedJourneyIds.includes(draggedJourneyId) || !pinnedJourneyIds.includes(targetJourneyId)) return pinnedJourneyIds;
  const reordered = pinnedJourneyIds.filter((id) => id !== draggedJourneyId);
  const targetIndex = reordered.indexOf(targetJourneyId);
  reordered.splice(position === "before" ? targetIndex : targetIndex + 1, 0, draggedJourneyId);
  return reordered.every((id, index) => id === pinnedJourneyIds[index]) ? pinnedJourneyIds : reordered;
}

/** The upper half of a card places the Journey before it; the lower half, after it. */
export function pinnedDropPosition(offsetY: number, height: number): PinnedDropPosition {
  return height > 0 && offsetY >= height / 2 ? "after" : "before";
}

export function pinnedDropSentence(
  pinnedJourneyIds: readonly string[],
  draggedJourneyId: string,
  aimed: (PinnedDropTarget & { name: string }) | undefined,
): string {
  if (!aimed) return "Release here to cancel. Esc also cancels.";
  const placed = placePinnedJourney(pinnedJourneyIds, draggedJourneyId, aimed.journeyId, aimed.position);
  if (placed === pinnedJourneyIds) return "It is already there.";
  return `Place it ${aimed.position} ${aimed.name}`;
}

/**
 * The divider to draw above a row of Recent, by row id. Recent lists the recent Journeys first,
 * then the pinned ones that are not recent, then the selected one when it is neither. A divider is
 * drawn where one group gives way to the next, never above the first group.
 */
export function recentSidebarDividers(
  rows: readonly { id: string; pinned: boolean }[],
  recentJourneyIds: readonly string[],
): Record<string, RecentSidebarDivider> {
  const recent = new Set(recentJourneyIds);
  const dividers: Record<string, RecentSidebarDivider> = {};
  let previous: "recent" | RecentSidebarDivider | undefined;
  for (const row of rows) {
    const group: "recent" | RecentSidebarDivider = recent.has(row.id) ? "recent" : row.pinned ? "Pinned but not used recently" : "Selected";
    if (previous !== undefined && group !== previous && group !== "recent") dividers[row.id] = group;
    previous = group;
  }
  return dividers;
}
