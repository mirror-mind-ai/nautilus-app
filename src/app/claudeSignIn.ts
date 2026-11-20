import { invoke } from "@tauri-apps/api/core";

/**
 * CR262: whether the app's own Claude Code is signed in to Claude, and signing it in again. Claude
 * Code keeps the sign-in (in `~/.claude` and the system keychain), the same one the person's own
 * Claude Code reads; nothing here reads it back. A sign-in's events arrive as Pi's do, on
 * `pi-login-event`, and are shown in the same panel.
 */
export type ClaudeSignIn = { signedIn: boolean; method?: string };

/** What Model providers knows about the Claude sign-in. */
export type ClaudeSignInState = "checking" | "signed-in" | "signed-out" | "unknown";

export function claudeSignInLabel(state: ClaudeSignInState): string {
  switch (state) {
    case "signed-in":
      return "Connected · signed in to Claude";
    case "signed-out":
      return "Signed out of Claude";
    case "checking":
      return "Asking Claude Code whether it is signed in…";
    case "unknown":
      return "Claude Code did not say whether it is signed in";
  }
}

/** The words Claude Code ends a turn with when it has no sign-in to use. */
export function isClaudeSignedOutFailure(failure: string | undefined): boolean {
  return failure !== undefined && /please run \/login/i.test(failure);
}

export async function inspectClaudeSignIn(): Promise<ClaudeSignIn> {
  return invoke<ClaudeSignIn>("inspect_claude_sign_in");
}

export async function startClaudeLogin(): Promise<number> {
  return invoke<number>("start_claude_login");
}

export async function answerClaudeLogin(session: number, promptId: string, value: string): Promise<void> {
  await invoke("answer_claude_login", { session, promptId, value });
}

export async function cancelClaudeLogin(session: number): Promise<void> {
  await invoke("cancel_claude_login", { session });
}
