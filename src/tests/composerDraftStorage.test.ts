import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("Composer draft storage boundary", () => {
  beforeEach(() => invoke.mockReset());

  it("loads absent and versioned channel-local drafts", async () => {
    const { loadComposerDrafts } = await import("../app/composerDraftStorage");
    invoke.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: "1.0.0",
      drafts: { "journey-a": "restored" },
      savedAt: "2026-08-30T15:00:00.000Z",
    }));
    await expect(loadComposerDrafts()).resolves.toEqual({ drafts: {}, queued: {} });
    await expect(loadComposerDrafts()).resolves.toEqual({ drafts: { "journey-a": "restored" }, queued: {} });
  });

  it("saves through the dedicated native command", async () => {
    const { saveComposerDrafts } = await import("../app/composerDraftStorage");
    invoke.mockResolvedValue(undefined);
    await saveComposerDrafts({ drafts: { "journey-a": "draft" }, queued: {} });
    expect(invoke).toHaveBeenCalledWith("save_composer_drafts", {
      payload: expect.stringContaining('"journey-a": "draft"'),
    });
  });

  it("CR259: loads and saves the messages waiting for a compaction", async () => {
    const { loadComposerDrafts, saveComposerDrafts } = await import("../app/composerDraftStorage");
    invoke.mockResolvedValueOnce(JSON.stringify({
      schemaVersion: "1.1.0",
      drafts: {},
      queued: { "journey-a": ["a", "b"] },
      savedAt: "2026-11-13T12:00:00.000Z",
    }));
    await expect(loadComposerDrafts()).resolves.toEqual({ drafts: {}, queued: { "journey-a": ["a", "b"] } });
    invoke.mockResolvedValue(undefined);
    await saveComposerDrafts({ drafts: {}, queued: { "journey-a": ["a"] } });
    const payload = JSON.parse(invoke.mock.calls.at(-1)![1].payload);
    expect(payload.schemaVersion).toBe("1.1.0");
    expect(payload.queued).toEqual({ "journey-a": ["a"] });
  });

  it("fails closed on malformed persisted content", async () => {
    const { loadComposerDrafts } = await import("../app/composerDraftStorage");
    invoke.mockResolvedValueOnce("{bad-json");
    await expect(loadComposerDrafts()).rejects.toThrow("malformed JSON");
  });
});
