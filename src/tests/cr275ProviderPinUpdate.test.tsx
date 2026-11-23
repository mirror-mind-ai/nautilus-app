import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ModelProvidersPanel, claudeConnection } from "../app/ModelProvidersPanel";
import { parseRuntimeChannelDiagnostic } from "../app/runtimeChannelStorage";
import type { PiProviderStatus } from "../app/piProviders";
import appSource from "../app/App.tsx?raw";
import storageSource from "../app/runtimeChannelStorage.ts?raw";

// CR275: an update that changes the pin of the app's own Claude provider keeps Claude connected
// while the app brings it up to the pin, and a person's own `pi-claude-bridge` never answers in its
// place without Settings saying so.

const deepseek: PiProviderStatus = { id: "deepseek", name: "DeepSeek", apiKey: true, oauth: false, stored: true, ready: { type: "api_key" } };
const mistral: PiProviderStatus = { id: "mistral", name: "Mistral", apiKey: true, oauth: false, stored: false, ready: null };
const handlers = () => ({ onSignIn: vi.fn(), onAnswer: vi.fn(), onCancel: vi.fn(), onOpenAgain: vi.fn(), onDisconnect: vi.fn(), onReload: vi.fn() });
const validated = {
  channel: "user", productName: "Nautilus for Mirror", bundleIdentifier: "ai.mirrormind.nautilus",
  appDataRoot: "/Users/example/Library/Application Support/ai.mirrormind.nautilus",
  mirrorHome: "/Users/example/.mirror-minds/example", dbPath: "/Users/example/.mirror-minds/example/memory.db",
  status: "validated", piInstalled: true, anthropicInstalled: false,
};

describe("CR275: Claude through an update of its pin", () => {
  it("reads whether Claude is being updated and whether the person's bridge answers, on a validated home only", () => {
    expect(parseRuntimeChannelDiagnostic({ ...validated, anthropicUpdating: true }).anthropicUpdating).toBe(true);
    expect(parseRuntimeChannelDiagnostic({ ...validated, claudeBridgeBorrowed: true }).claudeBridgeBorrowed).toBe(true);
    expect(() => parseRuntimeChannelDiagnostic({ ...validated, anthropicUpdating: "yes" })).toThrow();
    expect(() => parseRuntimeChannelDiagnostic({ ...validated, claudeBridgeBorrowed: 1 })).toThrow();
    const unbound = {
      channel: "user", productName: "Nautilus for Mirror", bundleIdentifier: "ai.mirrormind.nautilus",
      appDataRoot: "/x", status: "unbound", message: "Choose a home.",
    };
    expect(() => parseRuntimeChannelDiagnostic({ ...unbound, anthropicUpdating: true })).toThrow();
    expect(() => parseRuntimeChannelDiagnostic({ ...unbound, claudeBridgeBorrowed: true })).toThrow();
  });

  it("keeps Claude connected while it is updated, and offers Connect again only when the update failed", () => {
    const connect = vi.fn();
    const updating = claudeConnection({ ...validated, anthropicUpdating: true }, { kind: "installing", done: 0, total: 0 }, connect);
    expect(updating).toMatchObject({ installed: true, updating: true });
    const failed = claudeConnection({ ...validated, anthropicUpdating: true }, { kind: "failed", message: "Claude Code could not be downloaded." }, connect);
    expect(failed).toMatchObject({ installed: false, updating: false });
    expect(claudeConnection({ ...validated, anthropicInstalled: true }, { kind: "idle" }, connect)).toMatchObject({ installed: true, updating: false });
    expect(claudeConnection({ ...validated, anthropicInstalled: undefined }, { kind: "idle" }, connect)).toBeUndefined();

    const html = renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek, mistral]} state="ready" claude={updating} {...handlers()} />);
    const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    expect(list).toContain("Claude · through Claude Code");
    expect(list).toContain("Connected · updating for this version of Nautilus");
    expect(list).not.toContain(">Sign in</button>");
    expect(html.slice(html.indexOf("Connect another provider"))).not.toContain("Claude · through Claude Code");
  });

  it("says plainly when turns on Claude run on the person's own bridge", () => {
    const borrowed = claudeConnection({ ...validated, claudeBridgeBorrowed: true }, { kind: "idle" }, vi.fn());
    const html = renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek, mistral]} state="ready" claude={borrowed} {...handlers()} />);
    expect(html).toContain("Until you connect it here, turns on Claude run on your own pi-claude-bridge");
    const own = claudeConnection(validated, { kind: "idle" }, vi.fn());
    expect(renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek, mistral]} state="ready" claude={own} {...handlers()} />))
      .not.toContain("pi-claude-bridge");
  });

  it("brings Claude up to the pin when the app opens on an earlier one, without a click", () => {
    expect(storageSource).toContain('await invoke("update_anthropic_provider")');
    expect(appSource).toMatch(/runtimeChannel\?\.anthropicUpdating === true[\s\S]{0,200}updateClaudeCode\(\)/);
    // Setup counts a Claude being updated as connected, so a person is not sent back to choose a provider.
    expect(appSource).toMatch(/claudeCodeInstalled: runtimeChannel\?\.anthropicInstalled === true \|\| runtimeChannel\?\.anthropicUpdating === true/);
    // Both panels take the same connection, so setup and Settings cannot disagree.
    expect(appSource.match(/claude=\{claudeConnection\(/g)?.length).toBe(2);
  });
});
