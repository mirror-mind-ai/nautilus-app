import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptCacheNotice } from "../app/PromptCacheNotice";
import { loadPromptCacheNotices, savePromptCacheNotices } from "../app/sidebarPresentationStorage";
import { mergeRuntimeContextUsage } from "../app/runtimeActivityModel";
import {
  describePromptCacheReceipt,
  formatCountdown,
  formatPause,
  formatTokens,
  lastModelCallAtOf,
  PROMPT_CACHE_LIFETIME_MS,
  PROMPT_CACHE_NOTICE_MIN_TOKENS,
  promptCacheNoticeFor,
  promptCacheNoticeText,
  promptCacheReceiptOf,
} from "../domain/promptCacheNotice";
import appSource from "../app/App.tsx?raw";
import streamSource from "../agent/piProcessStream.ts?raw";

// Prompt cache notices: when the next message is likely to re-read the whole conversation, and
// what the last one did. An advanced reading, off by default, that never compacts by itself.

const T0 = Date.parse("2026-11-24T13:43:00Z");
const base = { enabled: true, tokens: 919_000, measured: true, lastModelCallAt: new Date(T0).toISOString(), busy: false };

describe("when the notice speaks", () => {
  it("says the cache is warm within five minutes of the last answer, with what remains", () => {
    expect(promptCacheNoticeFor({ ...base, now: T0 + 8_000 })).toEqual({ kind: "warm", tokens: 919_000, remainingMs: PROMPT_CACHE_LIFETIME_MS - 8_000 });
    expect(promptCacheNoticeFor({ ...base, now: T0 + PROMPT_CACHE_LIFETIME_MS - 1 })?.kind).toBe("warm");
  });

  it("says the cache expired after that, and for how long", () => {
    expect(promptCacheNoticeFor({ ...base, now: T0 + PROMPT_CACHE_LIFETIME_MS })).toEqual({ kind: "expired", tokens: 919_000, expiredForMs: 0 });
    expect(promptCacheNoticeFor({ ...base, now: T0 + 98 * 60_000 })).toEqual({ kind: "expired", tokens: 919_000, expiredForMs: 93 * 60_000 });
  });

  it("stays silent when off, while a turn runs, for a short conversation, for an estimate, and with no answer yet", () => {
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, enabled: false })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, busy: true })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, tokens: PROMPT_CACHE_NOTICE_MIN_TOKENS - 1 })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, tokens: null })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, measured: false })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, lastModelCallAt: undefined })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 + 1_000, lastModelCallAt: "yesterday" })).toBeUndefined();
    expect(promptCacheNoticeFor({ ...base, now: T0 - 1_000 })).toBeUndefined();
  });

  it("takes the last answer as the last call", () => {
    expect(lastModelCallAtOf([
      { role: "user", createdAt: "2026-11-24T10:00:00Z" }, { role: "assistant", createdAt: "2026-11-24T10:01:00Z" }, { role: "user", createdAt: "2026-11-24T10:02:00Z" },
    ])).toBe("2026-11-24T10:01:00Z");
    expect(lastModelCallAtOf([{ role: "user", createdAt: "2026-11-24T10:00:00Z" }])).toBeUndefined();
  });

  it("says it in the register of the demo, with the numbers as the footer writes them", () => {
    expect(promptCacheNoticeText({ kind: "warm", tokens: 919_000, remainingMs: 292_000 })).toBe("This conversation is at 919K tokens. After a 5-minute pause, your next message re-processes all of it.");
    expect(promptCacheNoticeText({ kind: "expired", tokens: 919_000, expiredForMs: 93 * 60_000 })).toBe("The model's cache expired 1 h 33 min ago. Your next message re-processes the whole conversation: 919K tokens.");
    expect([formatTokens(919_000), formatTokens(1_200_000), formatTokens(640)]).toEqual(["919K", "1.2M", "640"]);
    expect([formatCountdown(292_000), formatCountdown(0), formatCountdown(59_400)]).toEqual(["4:52", "0:00", "1:00"]);
    expect([formatPause(6 * 60_000), formatPause(93 * 60_000), formatPause(180 * 60_000), formatPause(50 * 3_600_000), formatPause(20_000)]).toEqual(["6 min", "1 h 33 min", "3 h", "2 d", "1 min"]);
  });
});

describe("what the last turn did, from the model's own usage", () => {
  const at = "2026-11-24T13:43:10Z";
  it("reads a re-processing from a write of most of the context, with the pause before the turn", () => {
    const receipt = promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 918_656, cacheRead: 0, cacheWrite: 918_000 }, previousCallAt: "2026-11-24T12:10:10Z" });
    expect(receipt).toEqual({ conversationId: "c", at, tokens: 918_656, cacheRead: 0, cacheWrite: 918_000, pauseMs: 93 * 60_000 });
    expect(describePromptCacheReceipt(receipt!)).toEqual({ kind: "re-processed", text: "The last message re-processed the whole conversation (919K tokens) after a 1 h 33 min pause." });
  });

  it("reads a cache hit from a read of most of the context, and makes no claim between the two", () => {
    const hit = promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 900_500, cacheRead: 899_000, cacheWrite: 1_200 }, previousCallAt: "2026-11-24T13:40:00Z" })!;
    expect(describePromptCacheReceipt(hit)).toEqual({ kind: "read-from-cache", text: "The last message read 899K tokens from the model's cache." });
    const mixed = promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 900_000, cacheRead: 400_000, cacheWrite: 300_000 }, previousCallAt: undefined })!;
    expect(mixed.pauseMs).toBeNull();
    expect(describePromptCacheReceipt(mixed)).toBeUndefined();
  });

  it("reads a partial re-processing, as the field showed it, from a write of most of the context beside a partial read", () => {
    // 2026-11-25, a dev build on Claude after two days: 35% read and 65% written fell in neither case.
    const partial = promptCacheReceiptOf({ conversationId: "c", at: "2026-11-25T18:30:43Z", usage: { tokens: 62_702, cacheRead: 21_731, cacheWrite: 40_961 }, previousCallAt: "2026-11-23T17:55:29Z" })!;
    expect(describePromptCacheReceipt(partial)).toEqual({ kind: "re-processed", text: "The last message re-processed most of the conversation (41K of 63K tokens) after a 2 d pause." });
    const next = promptCacheReceiptOf({ conversationId: "c", at: "2026-11-25T18:31:30Z", usage: { tokens: 63_274, cacheRead: 62_627, cacheWrite: 638 }, previousCallAt: "2026-11-25T18:30:43Z" })!;
    expect(describePromptCacheReceipt(next)?.text).toBe("The last message read 63K tokens from the model's cache.");
    const even = promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 100_000, cacheRead: 40_000, cacheWrite: 40_000 }, previousCallAt: undefined })!;
    expect(describePromptCacheReceipt(even)).toBeUndefined();
  });

  it("says nothing of a short turn, of a reading without the cache accounting, or of a pause under a minute", () => {
    expect(promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 20_000, cacheRead: 0, cacheWrite: 20_000 }, previousCallAt: undefined })).toBeUndefined();
    expect(promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 900_000 }, previousCallAt: undefined })).toBeUndefined();
    const quick = promptCacheReceiptOf({ conversationId: "c", at, usage: { tokens: 900_000, cacheRead: 0, cacheWrite: 900_000 }, previousCallAt: "2026-11-24T13:42:50Z" })!;
    expect(describePromptCacheReceipt(quick)?.text).toBe("The last message re-processed the whole conversation (900K tokens).");
  });

  it("travels from Pi's usage to the runtime's reading", () => {
    expect(streamSource).toContain('...(typeof usage.cacheRead === "number" ? { cacheRead: usage.cacheRead } : {}),');
    expect(streamSource).toContain('...(typeof usage.cacheWrite === "number" ? { cacheWrite: usage.cacheWrite } : {}),');
    expect(mergeRuntimeContextUsage(undefined, { tokens: 10, contextWindow: null, percent: null, cacheRead: 4, cacheWrite: 6 })).toEqual({ tokens: 10, contextWindow: null, percent: null, cacheRead: 4, cacheWrite: 6 });
    expect(mergeRuntimeContextUsage({ tokens: 9, contextWindow: 100, percent: 9, cacheRead: 1, cacheWrite: 8 }, { tokens: 10, contextWindow: null, percent: null })).toEqual({ tokens: 10, contextWindow: 100, percent: null });
  });
});

describe("the notice, drawn", () => {
  const render = (patch: Partial<Parameters<typeof PromptCacheNotice>[0]> = {}) => renderToStaticMarkup(
    <PromptCacheNotice
      enabled
      tokens={919_000}
      measured
      lastModelCallAt={new Date(T0).toISOString()}
      busy={false}
      canCompact
      compacting={false}
      onCompactNow={vi.fn()}
      dismissed={false}
      onDismiss={vi.fn()}
      now={T0 + 8_000}
      {...patch}
    />,
  );

  it("offers to compact while the cache is warm, with the countdown, and says so after it expired", () => {
    const warm = render();
    expect(warm).toContain('class="prompt-cache-notice is-warm"');
    expect(warm).toContain("This conversation is at 919K tokens.");
    expect(warm).toContain("Cache warm · 4:52");
    expect(warm).toMatch(/<button type="button">Compact now<\/button>/);
    expect(warm).toContain(">Not now<");
    const expired = render({ now: T0 + 98 * 60_000 });
    expect(expired).toContain('class="prompt-cache-notice is-expired"');
    expect(expired).toContain("The model&#x27;s cache expired 1 h 33 min ago.");
    expect(expired).toContain("Cache expired");
  });

  it("carries the receipt of the last turn under the notice, and alone once the notice was put aside", () => {
    const receipt = { conversationId: "c", at: "t", tokens: 918_656, cacheRead: 0, cacheWrite: 918_000, pauseMs: 93 * 60_000 };
    expect(render({ receipt })).toContain('<p class="prompt-cache-receipt is-re-processed">The last message re-processed the whole conversation (919K tokens) after a 1 h 33 min pause.</p>');
    const aside = render({ receipt, dismissed: true });
    expect(aside).not.toContain("Compact now");
    expect(aside).toContain("prompt-cache-receipt");
  });

  it("draws nothing when off, while a turn runs, for a short conversation, or when compaction is refused it says why", () => {
    expect(render({ enabled: false })).toBe("");
    expect(render({ busy: true })).toBe("");
    expect(render({ tokens: 12_000 })).toBe("");
    expect(render({ canCompact: false, unavailableReason: "Safe test mode is on." })).toContain('title="Safe test mode is on."');
  });
});

describe("where the choice is kept, and how the app is wired", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is off until asked for, and remembered per runtime channel outside the Journey preferences file", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) } });
    expect(loadPromptCacheNotices("user")).toBe(false);
    savePromptCacheNotices("development", true);
    expect(loadPromptCacheNotices("development")).toBe(true);
    expect(loadPromptCacheNotices("user")).toBe(false);
    expect([...store.keys()]).toEqual(["mirror-desktop:prompt-cache-notices:v1:development"]);
  });

  it("offers the choice in Settings › You, after Appearance, as an advanced reading", () => {
    const you = appSource.slice(appSource.indexOf('id="settings-panel-you"'), appSource.indexOf('{settingsTab === "voice" ? ('));
    expect(you.indexOf('aria-label="Application appearance"')).toBeLessThan(you.indexOf('aria-label="Advanced"'));
    expect(you).toContain("Prompt cache notices");
    expect(you).toContain("checked={promptCacheNotices} onChange={(event) => choosePromptCacheNotices(event.target.checked)}");
    expect(appSource).toContain("setPromptCacheNotices(loadPromptCacheNotices(presentationChannel));");
  });

  it("draws the notice above the composer from the measured reading, the last answer and the turn's first usage", () => {
    const notice = appSource.slice(appSource.indexOf("<PromptCacheNotice"), appSource.indexOf("composer-input-wrap${fileDropActive"));
    expect(notice).toContain('measured={contextMeasuredBySelectedModel && piContextState === "available"}');
    expect(notice).toContain("lastModelCallAt={lastModelCallAtOf(messages)}");
    expect(notice).toContain("busy={selectedRuntimeBusy || compactionInFlight");
    expect(notice).toContain("onCompactNow={() => { void compactSelectedConversationNow(); }}");
    const run = appSource.slice(appSource.indexOf("let promptCacheUsagePending = true;"), appSource.indexOf("setPiContextState(contextStateForLiveUsage(event.usage));"));
    expect(run).toContain("const promptCachePreviousCallAt = lastModelCallAtOf(baseConversation.messages);");
    expect(run).toContain("if (promptCacheUsagePending && !event.usage.estimated) {");
  });
});
