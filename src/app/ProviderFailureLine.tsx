import { isClaudeSignedOutFailure } from "./claudeSignIn";

/**
 * What the provider said when a turn ended in failure (CR159). CR262: when it is Claude Code saying
 * it has no sign-in, the line names that and opens Model providers, where Claude can be signed in
 * again, instead of repeating a command meant for a terminal.
 */
export function ProviderFailureLine({ failure, onOpenModelProviders }: { failure: string; onOpenModelProviders?: () => void }) {
  if (isClaudeSignedOutFailure(failure)) {
    return (
      <p className="provider-terminal-failure">
        Claude is signed out, so this turn could not run.{" "}
        {onOpenModelProviders ? <button className="secondary-button" type="button" onClick={onOpenModelProviders}>Sign in to Claude</button> : "Sign in again in Settings, Model providers."}
      </p>
    );
  }
  return <p className="provider-terminal-failure">The provider reported: {failure}</p>;
}
