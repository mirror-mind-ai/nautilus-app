import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";

// CR292: the invocation mode is a route (another prompt, Pi's RPC mode off), not a label, so it lives in
// Settings > Advanced with the other options a person turns on only when they want to, and it is saved as
// it changes. It was the third field of Models > Global defaults, saved with the model by one button.

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`missing ${end}`);
  return source.slice(from, to);
}

describe("CR292: where the invocation mode is chosen", () => {
  const models = between(appSource, 'aria-label="Global agent defaults"', "<ModelIntentsPanel");
  const advanced = between(appSource, 'id="settings-panel-advanced"', '{settingsTab === "diagnostics" ? (');

  it("no longer sits among the model and the thinking level", () => {
    expect(models).toContain("Pi model");
    expect(models).toContain("Thinking level");
    expect(models).not.toContain("Invocation mode");
    expect(models).not.toContain("setProviderInvocationMode");
  });

  it("is offered in Advanced, with the same two labels, and still refused while the session runs in safe test mode", () => {
    expect(advanced).toContain("Invocation mode");
    expect(advanced).toContain('<option value="mirror">Mirror runtime Pi</option>');
    expect(advanced).toContain('<option value="raw">Raw local Pi</option>');
    expect(advanced).toContain("value={providerInvocationMode}");
    expect(advanced).toContain("onChange={(event) => void chooseInvocationMode(event.target.value as AgentInvocationMode)}");
    expect(advanced).toContain('disabled={providerSafeTestMode || agentSettingsState === "saving"}');
  });

  it("keeps the option that was already there", () => {
    expect(advanced).toContain("Prompt cache notices");
  });

  it("says when and how it applies, and what the raw route is while it is chosen", () => {
    expect(advanced).toMatch(/Saved as soon as you choose[^<]*next message/);
    const raw = between(advanced, '{providerInvocationMode === "raw" ? (', ") : null}");
    expect(raw).toContain("task packet");
    expect(raw).toContain("JSON mission draft");
    expect(raw).toContain("RPC mode");
  });

  it("shows a save that failed, where the person chose", () => {
    expect(advanced).toContain('agentSettingsState === "error" && agentSettingsMessage');
    expect(advanced).toContain('role="alert"');
  });
});

describe("CR292: how the mode is saved", () => {
  const choose = between(appSource, "async function chooseInvocationMode", "async function saveGlobalAgentProfile");
  const saveGlobal = between(appSource, "async function saveGlobalAgentProfile", "async function saveSelectedJourneyAgentOverride");
  const restore = between(appSource, "async function restoreDefaultAgentSettings", "function applyProviderConfiguration");

  it("writes the mode alone, as it changes, and shows the choice at once", () => {
    expect(choose).toContain("setProviderInvocationMode(next);");
    expect(choose).toContain("persistAgentSettings((current) => setInvocationMode(current, next)");
    expect(choose).not.toContain("globalModelDraft");
    expect(choose).not.toContain("globalThinkingDraft");
  });

  it("puts the select back on the stored mode when the save fails", () => {
    expect(choose).toContain("if (!saved) setProviderInvocationMode(agentSettings.globalProfile.invocationMode);");
  });

  it("is not written again by Save global defaults, which keeps the stored mode", () => {
    expect(saveGlobal).toContain("invocationMode: current.globalProfile.invocationMode");
    expect(saveGlobal).not.toContain("providerInvocationMode");
  });

  it("is still returned to Mirror runtime Pi by Restore Nautilus defaults", () => {
    expect(restore).toContain("persistAgentSettings(() => defaults");
    expect(restore).toContain("setProviderInvocationMode(defaults.globalProfile.invocationMode);");
  });
});
