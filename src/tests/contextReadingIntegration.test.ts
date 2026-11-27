import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";

describe("context reading integration", () => {
  // CR079: the window is known from the live catalog long before anything measures the
  // Conversation, so it must reach the footer independently of the token count.
  it("hands the footer the window and the approximation separately from the usage", () => {
    expect(appSource).toContain("contextWindow={displayContextWindow}");
    expect(appSource).toContain("contextApproximate={!contextMeasuredBySelectedModel}");
    // The cached-reading shortcut runs before inspection, so it must not relabel an estimate
    // as a measurement while it waits.
    expect(appSource).toContain('setPiContextState(cachedUsageIsEstimated ? "estimated" : "available")');
  });

  // Nothing rescheduled a read after the bounded retry gave up, which is why the reading
  // could stay absent indefinitely unless a turn happened to run.
  it("reschedules a bounded re-read while the reading has not settled", () => {
    expect(appSource).toContain("contextReadingNeedsRefresh(piContextState)");
    expect(appSource).toContain("CONTEXT_REFRESH_DELAYS_MS[contextRefreshAttempt]");
    expect(appSource).toContain("setContextRefreshEpoch((epoch) => epoch + 1)");
    // The attempt budget has to reset per Conversation, or a second Journey inherits an
    // exhausted one and never re-reads at all.
    expect(appSource).toContain("setContextRefreshAttempt(0)");
  });

  // CR288: the budget reset only with the Conversation, so three turns spent it (1.5 s, 5 s,
  // 15 s) and a reading that lagged the fourth turn stayed approximate, hiding the cache notice.
  it("gives every turn its own re-read budget", () => {
    const reset = appSource.slice(
      appSource.indexOf("setContextRefreshAttempt(0);"),
      appSource.indexOf("]);", appSource.indexOf("setContextRefreshAttempt(0);")),
    );
    expect(reset).toContain("conversation.id");
    expect(reset).toContain("isStreaming");
  });

  // The stale snapshot must never outrank the live catalog: it lists none of the models in
  // daily use, so a match there would be an accident rather than an authority.
  it("lets the live catalog lead and the static snapshot only follow", () => {
    const derivation = appSource.slice(
      appSource.indexOf("const configuredContextWindow"),
      appSource.indexOf("const displayContextWindow"),
    );
    expect(derivation).toContain("piModelCatalog.find(");
    expect(derivation.indexOf("piModelCatalog.find(")).toBeLessThan(derivation.indexOf("configuredModelContextWindow("));
    expect(derivation).toContain("?? configuredModelContextWindow(");
  });

  it("scopes the cached reading to the Conversation, not to the measuring model", () => {
    expect(appSource).toContain("hasConversationContextStats(");
    // The identity gate itself must not consult the model; only the marker below may.
    const identity = appSource.slice(
      appSource.indexOf("const contextIdentityMatches"),
      appSource.indexOf("const contextMeasuredBySelectedModel"),
    );
    expect(identity).not.toContain("providerModel ===");
    expect(appSource).toContain("const contextMeasuredBySelectedModel");
  });

  // The measurement was previously thrown away whenever another model had produced it,
  // which is exactly the evidence needed to keep a number on screen after an Intent switch.
  it("stores an inspected snapshot even when another model produced it", () => {
    const effect = appSource.slice(
      appSource.indexOf("void readContextStatsWithBoundedRetry"),
      appSource.indexOf("useEffect(() => {", appSource.indexOf("void readContextStatsWithBoundedRetry")),
    );
    expect(effect).not.toContain('if (nextState !== "available" || !snapshot)');
    expect(effect).toContain("if (!snapshot)");
  });

  // Without this the footer and the prompt cache notice kept announcing the size the
  // conversation had before a compaction that ended while the Navigator was in another Journey.
  it("drops a stored measurement when the branch Pi holds ends in a compaction", () => {
    const effect = appSource.slice(
      appSource.indexOf("void readContextStatsWithBoundedRetry"),
      appSource.indexOf("useEffect(() => {", appSource.indexOf("void readContextStatsWithBoundedRetry")),
    );
    expect(effect).toContain("cachedReadingPredatesCompaction(");
    const overtaken = effect.slice(
      effect.indexOf("cachedReadingPredatesCompaction("),
      effect.indexOf("if (!hasMatchingCache) setPiContextState(nextState)"),
    );
    expect(overtaken).toContain('setPiContextState("unknown_after_compaction")');
    expect(overtaken).toContain("authoritativeContextStats: undefined");
  });
});
