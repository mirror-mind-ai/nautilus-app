import { describe, expect, it } from "vitest";
import {
  BRIEFING_PLACE,
  canGoBackInField,
  canGoForwardInField,
  currentFieldPlace,
  fieldHistoryBack,
  fieldHistoryForward,
  startFieldHistory,
  visitFieldPlace,
  type FieldPlace,
} from "../domain/fieldHistory";

const node = (relativePath: string): FieldPlace => ({ kind: "node", relativePath });

describe("CR260 iteration 2: the Agentic Field's navigation history", () => {
  it("starts on the briefing with nowhere to go", () => {
    const history = startFieldHistory();
    expect(currentFieldPlace(history)).toEqual(BRIEFING_PLACE);
    expect(canGoBackInField(history)).toBe(false);
    expect(canGoForwardInField(history)).toBe(false);
  });

  it("walks back and forward through the visited places", () => {
    let history = startFieldHistory();
    history = visitFieldPlace(history, node("docs"));
    history = visitFieldPlace(history, node("docs/plan.md"));

    history = fieldHistoryBack(history);
    expect(currentFieldPlace(history)).toEqual(node("docs"));
    history = fieldHistoryBack(history);
    expect(currentFieldPlace(history)).toEqual(BRIEFING_PLACE);
    expect(canGoBackInField(history)).toBe(false);

    history = fieldHistoryForward(history);
    history = fieldHistoryForward(history);
    expect(currentFieldPlace(history)).toEqual(node("docs/plan.md"));
    expect(canGoForwardInField(history)).toBe(false);
  });

  it("drops the forward places when a new place is visited after going back", () => {
    let history = visitFieldPlace(visitFieldPlace(startFieldHistory(), node("a")), node("b"));
    history = visitFieldPlace(fieldHistoryBack(history), node("c"));
    expect(currentFieldPlace(history)).toEqual(node("c"));
    expect(canGoForwardInField(history)).toBe(false);
    expect(currentFieldPlace(fieldHistoryBack(history))).toEqual(node("a"));
  });

  it("does not record the current place twice, and keeps the same history object", () => {
    const history = visitFieldPlace(startFieldHistory(), node("a"));
    expect(visitFieldPlace(history, node("a"))).toBe(history);
    const briefing = startFieldHistory();
    expect(visitFieldPlace(briefing, BRIEFING_PLACE)).toBe(briefing);
  });

  it("returns the same history when there is nowhere to go", () => {
    const history = startFieldHistory();
    expect(fieldHistoryBack(history)).toBe(history);
    expect(fieldHistoryForward(history)).toBe(history);
  });

  it("forgets the oldest places beyond a bound", () => {
    let history = startFieldHistory();
    for (let index = 0; index < 120; index += 1) history = visitFieldPlace(history, node(`f${index}`));
    expect(history.places.length).toBeLessThanOrEqual(100);
    expect(currentFieldPlace(history)).toEqual(node("f119"));
    expect(canGoForwardInField(history)).toBe(false);
  });
});
