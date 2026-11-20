import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ModelProvidersPanel, disconnectWarning, type ClaudeCodeConnection } from "../app/ModelProvidersPanel";
import { ProviderFailureLine } from "../app/ProviderFailureLine";
import { InterruptedNativeAttemptNotice } from "../app/InterruptedNativeAttemptNotice";
import { claudeSignInLabel, isClaudeSignedOutFailure, type ClaudeSignInState } from "../app/claudeSignIn";
import type { PiProviderStatus } from "../app/piProviders";
import appSource from "../app/App.tsx?raw";
import claudeSignInSource from "../app/claudeSignIn.ts?raw";
import rustSource from "../../src-tauri/src/claude_sign_in.rs?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

// CR262: the Claude sign-in behind Claude through Claude Code expired on 2026-11-20, Settings kept
// saying Connected because it only knew Claude Code was installed, and only a terminal could sign
// in again.

const deepseek: PiProviderStatus = { id: "deepseek", name: "DeepSeek", apiKey: true, oauth: false, stored: true, ready: { type: "api_key" } };
const handlers = () => ({ onSignIn: vi.fn(), onAnswer: vi.fn(), onCancel: vi.fn(), onOpenAgain: vi.fn(), onDisconnect: vi.fn(), onReload: vi.fn() });
const claude = (signIn?: ClaudeSignInState): ClaudeCodeConnection => ({
  installed: true, view: { kind: "idle" }, onConnect: vi.fn(), ...(signIn ? { signIn, onSignIn: vi.fn() } : {}),
});
const claudeRow = (html: string) => {
  const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
  const start = list.indexOf("Claude · through Claude Code");
  return list.slice(start, list.indexOf("</li>", start));
};

describe("CR262: Model providers says whether Claude is signed in", () => {
  it("says Connected only when Claude Code says it is signed in", () => {
    expect(claudeRow(renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek]} state="ready" claude={claude("signed-in")} {...handlers()} />)))
      .toContain("Connected · signed in to Claude");
    expect(claudeSignInLabel("checking")).toBe("Asking Claude Code whether it is signed in…");
  });

  it("says signed out, with Sign in, when it is not", () => {
    const row = claudeRow(renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek]} state="ready" claude={claude("signed-out")} {...handlers()} />));
    expect(row).toContain("Signed out of Claude");
    expect(row).not.toContain("Connected");
    expect(row).toContain(">Sign in</button>");
  });

  it("offers Sign in too when Claude Code could not be asked", () => {
    const row = claudeRow(renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek]} state="ready" claude={claude("unknown")} {...handlers()} />));
    expect(row).toContain("Claude Code did not say whether it is signed in");
    expect(row).toContain(">Sign in</button>");
  });

  it("does not count a signed-out Claude as a connection when the last Pi sign-in is about to go", () => {
    const html = renderToStaticMarkup(<ModelProvidersPanel providers={[deepseek]} state="ready" claude={claude("signed-out")} initialConfirming="deepseek" {...handlers()} />);
    expect(html).toContain("only connected provider");
    expect(disconnectWarning(deepseek, [deepseek], true)).not.toContain("only connected provider");
  });
});

describe("CR262: the app asks and signs in through its own Claude Code", () => {
  it("has the four native commands, registered", () => {
    for (const command of ["inspect_claude_sign_in", "start_claude_login", "answer_claude_login", "cancel_claude_login"]) {
      expect(rustSource).toContain(`pub(crate) async fn ${command}(`);
      expect(mainSource).toContain(`claude_sign_in::${command},`);
      expect(claudeSignInSource).toContain(`"${command}"`);
    }
  });

  it("asks when Model providers opens with Claude Code installed, and again after a Claude sign-in ends", () => {
    expect(appSource).toContain('settingsOpen && settingsTab === "models" && runtimeChannel?.anthropicInstalled === true');
    expect(appSource).toContain("void askClaudeSignIn();");
    const listener = appSource.slice(appSource.indexOf("void listenPiLogin((event) => {"));
    expect(listener.slice(0, listener.indexOf("setPiLogin(undefined);"))).toContain("if (current.provider === CLAUDE_CODE) setClaudeSignInAsks((asks) => asks + 1);");
  });

  it("runs the Claude sign-in in the same panel as Pi's, answering and cancelling through Claude's commands", () => {
    const start = appSource.slice(appSource.indexOf("async function signInToClaude()"));
    const body = start.slice(0, start.indexOf("\n  }\n"));
    expect(body).toContain("await startClaudeLogin()");
    expect(body).toContain('origin: "settings", provider: CLAUDE_CODE, providerName: CLAUDE_CODE_NAME');
    expect(appSource).toContain("piLogin.provider === CLAUDE_CODE ? answerClaudeLogin(session, promptId, value) : answerPiLogin(session, promptId, value)");
    expect(appSource).toContain("if (piLogin) void (piLogin.provider === CLAUDE_CODE ? cancelClaudeLogin(piLogin.session) : cancelPiLogin(piLogin.session));");
    expect(appSource).toContain("onSignIn: () => void signInToClaude()");
  });
});

describe("CR262: a turn that failed because Claude is signed out says so", () => {
  it("recognizes Claude Code's own words, and nothing else", () => {
    expect(isClaudeSignedOutFailure("Not logged in · Please run /login")).toBe(true);
    expect(isClaudeSignedOutFailure("Invalid API key · Please run /login")).toBe(true);
    expect(isClaudeSignedOutFailure("429 rate_limit_error")).toBe(false);
    expect(isClaudeSignedOutFailure(undefined)).toBe(false);
  });

  it("names the missing sign-in and opens Model providers, instead of repeating Claude Code's command", () => {
    const html = renderToStaticMarkup(<ProviderFailureLine failure="Not logged in · Please run /login" onOpenModelProviders={vi.fn()} />);
    expect(html).toContain("Claude is signed out, so this turn could not run.");
    expect(html).toContain(">Sign in to Claude</button>");
    expect(html).not.toContain("/login");
    const other = renderToStaticMarkup(<ProviderFailureLine failure="429 rate_limit_error" onOpenModelProviders={vi.fn()} />);
    expect(other).toContain("The provider reported: 429 rate_limit_error");
  });

  it("is the one line every interrupted-turn notice uses", () => {
    const html = renderToStaticMarkup(<InterruptedNativeAttemptNotice providerFailure="Not logged in · Please run /login" onOpenModelProviders={vi.fn()} />);
    expect(html).toContain("Claude is signed out");
    expect(appSource).not.toContain("The provider reported: {");
    expect(appSource).toContain('setSettingsTab("models");');
  });
});
