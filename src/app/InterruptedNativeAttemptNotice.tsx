import { ProviderFailureLine } from "./ProviderFailureLine";

export function InterruptedNativeAttemptNotice({ providerFailure, onOpenModelProviders }: { providerFailure?: string; onOpenModelProviders?: () => void }) {
  return (
    <section className="dedicated-turn-notice interrupted-native-attempt-notice" role="status" aria-live="polite">
      <strong>Previous attempt was interrupted</strong>
      <p>It ended before producing a response. No retry was started. You can continue by sending a new message.</p>
      {providerFailure ? <ProviderFailureLine failure={providerFailure} onOpenModelProviders={onOpenModelProviders} /> : null}
    </section>
  );
}
