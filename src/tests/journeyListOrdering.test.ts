import { describe, expect, it } from "vitest";
import {
  movePinnedJourney,
  pinnedDropPosition,
  pinnedDropSentence,
  pinnedMoveAvailability,
  placePinnedJourney,
  recentSidebarDividers,
  togglePinnedJourneyFirst,
} from "../domain/journeyListOrdering";
import { shouldBeginJourneyDrag } from "../domain/journeyPointerDrag";
import appSource from "../app/App.tsx?raw";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const pinned = ["a", "b", "c", "d"];

describe("Pinned order is the Navigator's", () => {
  it("puts a newly pinned Journey first, where the hand that pinned it will look", () => {
    expect(togglePinnedJourneyFirst(pinned, "e")).toEqual(["e", "a", "b", "c", "d"]);
  });

  it("unpins without disturbing the order of the others", () => {
    expect(togglePinnedJourneyFirst(pinned, "b")).toEqual(["a", "c", "d"]);
  });

  it("moves one place up, one place down, or to the top", () => {
    expect(movePinnedJourney(pinned, "c", "up")).toEqual(["a", "c", "b", "d"]);
    expect(movePinnedJourney(pinned, "b", "down")).toEqual(["a", "c", "b", "d"]);
    expect(movePinnedJourney(pinned, "d", "top")).toEqual(["d", "a", "b", "c"]);
  });

  it("leaves the order alone at an edge or for a Journey that is not pinned", () => {
    expect(movePinnedJourney(pinned, "a", "up")).toBe(pinned);
    expect(movePinnedJourney(pinned, "a", "top")).toBe(pinned);
    expect(movePinnedJourney(pinned, "d", "down")).toBe(pinned);
    expect(movePinnedJourney(pinned, "x", "top")).toBe(pinned);
  });

  it("says which moves the menu can offer", () => {
    expect(pinnedMoveAvailability(pinned, "a")).toEqual({ up: false, down: true, top: false });
    expect(pinnedMoveAvailability(pinned, "c")).toEqual({ up: true, down: true, top: true });
    expect(pinnedMoveAvailability(pinned, "d")).toEqual({ up: true, down: false, top: true });
    expect(pinnedMoveAvailability(["only"], "only")).toEqual({ up: false, down: false, top: false });
    expect(pinnedMoveAvailability(pinned, "x")).toBeUndefined();
  });
});

describe("Dragging inside Pinned", () => {
  it("places the dragged Journey before or after the row it was dropped on", () => {
    expect(placePinnedJourney(pinned, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(placePinnedJourney(pinned, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
    expect(placePinnedJourney(pinned, "a", "d", "after")).toEqual(["b", "c", "d", "a"]);
  });

  it("changes nothing when dropped on itself, next to where it already is, or on an unpinned row", () => {
    expect(placePinnedJourney(pinned, "b", "b", "before")).toBe(pinned);
    expect(placePinnedJourney(pinned, "b", "c", "before")).toBe(pinned);
    expect(placePinnedJourney(pinned, "b", "a", "after")).toBe(pinned);
    expect(placePinnedJourney(pinned, "b", "x", "after")).toBe(pinned);
  });

  it("aims at the upper or lower half of the row", () => {
    expect(pinnedDropPosition(5, 40)).toBe("before");
    expect(pinnedDropPosition(19, 40)).toBe("before");
    expect(pinnedDropPosition(20, 40)).toBe("after");
    expect(pinnedDropPosition(0, 0)).toBe("before");
  });

  it("says where the Journey will land, or that releasing there does nothing", () => {
    expect(pinnedDropSentence(pinned, "d", { journeyId: "b", name: "Bravo", position: "before" })).toBe("Place it before Bravo");
    expect(pinnedDropSentence(pinned, "a", { journeyId: "c", name: "Charlie", position: "after" })).toBe("Place it after Charlie");
    expect(pinnedDropSentence(pinned, "b", { journeyId: "c", name: "Charlie", position: "before" })).toBe("It is already there.");
    expect(pinnedDropSentence(pinned, "b", undefined)).toBe("Release here to cancel. Esc also cancels.");
  });

  it("begins a drag in Pinned even though Pinned is not the tree", () => {
    const press = { button: 0, treeView: false, dragAllowed: false, onControl: false, moveInFlight: false };
    expect(shouldBeginJourneyDrag({ ...press, pinnedView: true })).toBe(true);
    expect(shouldBeginJourneyDrag({ ...press, pinnedView: true, button: 2 })).toBe(false);
    expect(shouldBeginJourneyDrag({ ...press, pinnedView: true, onControl: true })).toBe(false);
    expect(shouldBeginJourneyDrag(press)).toBe(false);
  });
});

describe("The sidebar uses these decisions", () => {
  it("pins first, and moves within Pinned from the card's menu", () => {
    expect(appSource).toContain("togglePinnedJourneyFirst(preferences.pinnedJourneyIds, journeyId)");
    expect(appSource).toContain("movePinnedJourney(preferences.pinnedJourneyIds, journeyId, move)");
    expect(appSource).toContain("onMovePinned={movePinnedJourneyInOrder}");
  });

  it("drags within Pinned only when the list is unfiltered, and writes only the local pin order", () => {
    expect(appSource).toContain('const pinnedView = pinnedOnly && !journeySearch.trim();');
    expect(appSource).toContain('mode: pinnedView ? "pinned" : "tree"');
    const pinnedDrop = appSource.slice(
      appSource.indexOf('if (drag.mode === "pinned") {\n      const point'),
      appSource.indexOf("const aimed = dropping"),
    );
    expect(pinnedDrop).toContain("placePinnedJourney(preferences.pinnedJourneyIds, drag.journeyId, row.journeyId, position)");
    expect(pinnedDrop).not.toContain("executeJourneyMutation");
  });

  it("draws Recent's dividers only in unfiltered Recent", () => {
    expect(appSource).toContain("recentSidebarDividers(sidebarJourneys, journeyPreferences.recentJourneyIds)");
    expect(appSource).toContain('!pinnedOnly && journeyListOrder === "recent" && !journeySearch.trim()');
    expect(appSource).toContain('className="journey-list-divider" role="separator"');
  });
});

describe("Recent says which rows are recent and which are only pinned", () => {
  const row = (id: string, pinnedRow = false) => ({ id, pinned: pinnedRow });

  it("names the pinned group that follows the recent ones", () => {
    const rows = [row("r1"), row("r2", true), row("p1", true), row("p2", true)];
    expect(recentSidebarDividers(rows, ["r1", "r2"])).toEqual({ p1: "Pinned but not used recently" });
  });

  it("names a selected Journey that is neither recent nor pinned", () => {
    const rows = [row("r1"), row("p1", true), row("s")];
    expect(recentSidebarDividers(rows, ["r1"])).toEqual({ p1: "Pinned but not used recently", s: "Selected" });
  });

  it("draws nothing above the first group, so a list of one kind has no divider", () => {
    expect(recentSidebarDividers([row("r1"), row("r2")], ["r1", "r2"])).toEqual({});
    expect(recentSidebarDividers([row("p1", true), row("p2", true)], [])).toEqual({});
    expect(recentSidebarDividers([row("p1", true), row("s")], [])).toEqual({ s: "Selected" });
  });
});

describe("CR229: the divider says what the group is", () => {
  it("names the pinned group by the use it lacks, not by the pin alone", () => {
    const rows = [{ id: "r1", pinned: false }, { id: "p1", pinned: true }];
    expect(recentSidebarDividers(rows, ["r1"]).p1).toBe("Pinned but not used recently");
    expect(recentSidebarDividers(rows, ["r1"]).p1).not.toBe("Pinned");
  });

  it("keeps a stretch of rule when the longer words wrap at the narrowest sidebar", () => {
    const css: string = cssSource;
    const rule = css.slice(css.indexOf(".journey-list-divider::after {"), css.indexOf("}", css.indexOf(".journey-list-divider::after {")));
    expect(rule).toMatch(/min-width:\s*16px;/);
  });
});
