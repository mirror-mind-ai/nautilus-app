import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import {
  openRouterSetupNeeded,
  providerSetupNeeded,
  type OpenRouterSetupReading,
  type ProviderSetupReading,
} from "../domain/launchSetupGate";

// Every launch asks Pi which providers are signed in. On a machine whose antivirus reads Pi's files
// cold, that took 20–37 s, and setup held the person at "Checking your model providers…" even though
// they had finished setup the day before. A person who has finished setup now works while Pi
// answers; Pi's answer still brings the provider step back when nothing is signed in. The OpenRouter
// step, which that wait used to hide while the key was read, follows the same rule.

const returning: ProviderSetupReading = {
  stepOpen: false,
  signingInFromSetup: false,
  providersRead: false,
  anyProviderReady: false,
  claudeCodeInstalled: false,
  setupFinishedBefore: true,
};
const firstRun: ProviderSetupReading = { ...returning, setupFinishedBefore: false };

function between(start: string, end: string): string {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`missing ${from < 0 ? start : end}`);
  return appSource.slice(from, to);
}

describe("the provider step at launch", () => {
  it("waits for Pi's answer when setup was never finished", () => {
    expect(providerSetupNeeded(firstRun)).toBe(true);
  });

  it("does not wait for Pi's answer when setup was finished before", () => {
    expect(providerSetupNeeded(returning)).toBe(false);
  });

  it("comes back when Pi answers that nothing is signed in, finished setup or not", () => {
    expect(providerSetupNeeded({ ...returning, providersRead: true })).toBe(true);
    expect(providerSetupNeeded({ ...firstRun, providersRead: true })).toBe(true);
  });

  it("stays away when Pi answers with a provider ready, or the app's own Claude Code is installed", () => {
    for (const reading of [returning, firstRun]) {
      expect(providerSetupNeeded({ ...reading, providersRead: true, anyProviderReady: true })).toBe(false);
      expect(providerSetupNeeded({ ...reading, providersRead: true, claudeCodeInstalled: true })).toBe(false);
    }
  });

  it("shows while the person has opened it or is signing in from it", () => {
    const answered = { ...returning, providersRead: true, anyProviderReady: true };
    expect(providerSetupNeeded({ ...answered, stepOpen: true })).toBe(true);
    expect(providerSetupNeeded({ ...answered, signingInFromSetup: true })).toBe(true);
  });

  it("is what App decides with, and finished setup means a model was kept", () => {
    const provider = between("const runtimeSetupNeedsProvider", "const runtimeSetupNeedsOpenRouter");
    expect(provider).toContain("providerSetupNeeded({");
    expect(provider).toContain("providersRead: piProvidersLoadedOnce");
    expect(provider).toContain("setupFinishedBefore: agentProfileConfigured === true");
    expect(provider).not.toContain("!piProvidersLoadedOnce ||");
  });
});

describe("the OpenRouter step at launch", () => {
  const read: OpenRouterSetupReading = { skipped: false, keyRead: true, configured: false, declined: false, setupFinishedBefore: true };

  it("shows until a key is kept or declined, finished setup or not", () => {
    expect(openRouterSetupNeeded(read)).toBe(true);
    expect(openRouterSetupNeeded({ ...read, setupFinishedBefore: false })).toBe(true);
    expect(openRouterSetupNeeded({ ...read, configured: true })).toBe(false);
    expect(openRouterSetupNeeded({ ...read, declined: true })).toBe(false);
    expect(openRouterSetupNeeded({ ...read, skipped: true })).toBe(false);
  });

  it("does not show while the key is still being read, when setup was finished before", () => {
    expect(openRouterSetupNeeded({ ...read, keyRead: false })).toBe(false);
  });

  it("shows while the key is read when setup was never finished, as it always did", () => {
    expect(openRouterSetupNeeded({ ...read, keyRead: false, setupFinishedBefore: false })).toBe(true);
  });

  it("is what App decides with", () => {
    const openRouter = between("const runtimeSetupNeedsOpenRouter", "async function signInToProvider");
    expect(openRouter).toContain("!runtimeSetupNeedsProvider");
    expect(openRouter).toContain("openRouterSetupNeeded({");
    expect(openRouter).toContain("keyRead: openRouterKey !== undefined");
    expect(openRouter).toContain("setupFinishedBefore: agentProfileConfigured === true");
  });
});
