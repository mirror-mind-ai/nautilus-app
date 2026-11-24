import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLAUDE_CODE, ModelProvidersPanel, claudeSignOutWarning, type ClaudeCodeConnection } from "../app/ModelProvidersPanel";
import type { ClaudeSignInState } from "../app/claudeSignIn";
import type { PiProviderStatus } from "../app/piProviders";
import appSource from "../app/App.tsx?raw";
import claudeSignInSource from "../app/claudeSignIn.ts?raw";
import rustSource from "../../src-tauri/src/claude_sign_in.rs?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

// CR282: Model providers offered Disconnect for OpenAI and nothing for Claude, so the only way out of
// a Claude sign-in was a terminal. Claude's sign-in is one per computer, shared with Claude Code
// outside Nautilus, which the confirmation says in plain words.

const openai: PiProviderStatus = { id: "openai", name: "OpenAI", apiKey: false, oauth: true, stored: true, ready: { type: "oauth" } };
const handlers = () => ({ onSignIn: vi.fn(), onAnswer: vi.fn(), onCancel: vi.fn(), onOpenAgain: vi.fn(), onDisconnect: vi.fn(), onReload: vi.fn() });
const claude = (signIn: ClaudeSignInState | undefined, extra: Partial<ClaudeCodeConnection> = {}): ClaudeCodeConnection => ({
  installed: true, view: { kind: "idle" }, onConnect: vi.fn(), ...(signIn ? { signIn, onSignIn: vi.fn(), onSignOut: vi.fn() } : {}), ...extra,
});
const claudeRow = (html: string) => {
  const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
  const start = list.indexOf("Claude · through Claude Code");
  return list.slice(start, list.indexOf("</li>", start));
};
const render = (connection: ClaudeCodeConnection | undefined, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<ModelProvidersPanel providers={[openai]} state="ready" claude={connection} {...handlers()} {...props} />);

describe("CR282: Sign out of Claude from Model providers", () => {
  it("offers Sign out on the Claude line while Claude is signed in", () => {
    const row = claudeRow(render(claude("signed-in")));
    expect(row).toContain("Connected · signed in to Claude");
    expect(row).toContain(">Sign out</button>");
    expect(row).not.toContain(">Sign in</button>");
  });

  it("offers it only then: not signed out, not asking, not unknown, not updating, not where nothing can be done", () => {
    for (const state of ["signed-out", "checking", "unknown"] as const) {
      expect(claudeRow(render(claude(state)))).not.toContain("Sign out");
    }
    expect(claudeRow(render(claude("signed-in", { updating: true })))).not.toContain("Sign out");
    expect(claudeRow(render(claude("signed-in", { onSignOut: undefined })))).not.toContain("Sign out");
    expect(claudeRow(render(claude(undefined)))).not.toContain("Sign out");
  });

  it("asks first, in plain words, and says that the sign-in is shared with Claude Code outside Nautilus", () => {
    const row = claudeRow(render(claude("signed-in"), { initialConfirming: CLAUDE_CODE }));
    expect(row).toContain(claudeSignOutWarning());
    expect(claudeSignOutWarning()).toContain("Sign out of Claude?");
    expect(claudeSignOutWarning()).toContain("Claude Code in a terminal");
    expect(row).toContain(">Sign out</button>");
    expect(row).toContain(">Keep</button>");
  });

  it("does not ask when nobody started it, and does not offer a Disconnect for Claude", () => {
    expect(claudeRow(render(claude("signed-in")))).not.toContain("Sign out of Claude?");
    expect(claudeRow(render(claude("signed-in")))).not.toContain("Disconnect");
  });

  it("says it is signing out, and holds the other buttons, while it runs", () => {
    const html = render(claude("signed-in"), { busy: CLAUDE_CODE });
    expect(claudeRow(html)).toContain("Signing out…");
    expect(claudeRow(html)).toMatch(/<button[^>]*disabled[^>]*>Signing out…<\/button>/);
  });
});

describe("CR282: the app signs Claude Code out through its own command", () => {
  it("has the native command, registered, called by the front end and running `auth logout`", () => {
    expect(rustSource).toContain("pub(crate) async fn sign_out_of_claude(");
    expect(rustSource).toContain('&["auth", "logout"]');
    expect(mainSource).toContain("claude_sign_in::sign_out_of_claude,");
    expect(claudeSignInSource).toContain('"sign_out_of_claude"');
  });

  it("wires the button, shows the result, and asks Claude Code again", () => {
    expect(appSource).toContain("async function signOutOfClaude()");
    expect(appSource).toContain("onSignOut: () => void signOutOfClaude()");
    const body = appSource.slice(appSource.indexOf("async function signOutOfClaude()"));
    const end = body.slice(0, body.indexOf("\n  }\n"));
    expect(end).toContain("setPiDisconnecting(CLAUDE_CODE)");
    expect(end).toContain("setPiDisconnecting(undefined)");
    expect(end).toContain("setClaudeSignInAsks");
  });
});
