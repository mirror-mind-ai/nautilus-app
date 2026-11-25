import { useEffect, useState } from "react";
import {
  describePromptCacheReceipt,
  formatCountdown,
  promptCacheNoticeFor,
  promptCacheNoticeText,
  type PromptCacheReceipt,
} from "../domain/promptCacheNotice";

type PromptCacheNoticeProps = {
  enabled: boolean;
  tokens: number | null;
  measured: boolean;
  lastModelCallAt: string | undefined;
  busy: boolean;
  /** What the last turn did, when the model's usage said clearly. */
  receipt?: PromptCacheReceipt;
  canCompact: boolean;
  compacting: boolean;
  unavailableReason?: string;
  onCompactNow: () => void;
  /** Hides the notice until the next turn ends; the receipt stays. */
  dismissed: boolean;
  onDismiss: () => void;
  /** Test seam; the component keeps its own clock otherwise. */
  now?: number;
};

const CLOCK_TICK_MS = 1_000;

/**
 * Above the composer, when the person has asked for it (Settings › Advanced): what the next
 * message will do with the model's prompt cache, and what the last one did. It offers to compact
 * before a pause and never compacts by itself.
 */
export function PromptCacheNotice({
  enabled, tokens, measured, lastModelCallAt, busy, receipt, canCompact, compacting, unavailableReason, onCompactNow, dismissed, onDismiss, now,
}: PromptCacheNoticeProps) {
  const [tick, setTick] = useState(() => Date.now());
  const watching = enabled && !busy && now === undefined;
  useEffect(() => {
    if (!watching) return undefined;
    setTick(Date.now());
    const handle = setInterval(() => setTick(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(handle);
  }, [watching, lastModelCallAt]);
  if (!enabled || busy) return null;
  const notice = dismissed ? undefined : promptCacheNoticeFor({ enabled, tokens, measured, lastModelCallAt, busy, now: now ?? tick });
  const reading = receipt ? describePromptCacheReceipt(receipt) : undefined;
  if (!notice && !reading) return null;
  return (
    <section className={`prompt-cache-notice${notice ? ` is-${notice.kind}` : ""}`} role="status" aria-label="Prompt cache">
      {notice ? (
        <div className="prompt-cache-notice-line">
          <span className="prompt-cache-notice-text">{promptCacheNoticeText(notice)}</span>
          {notice.kind === "warm" ? (
            <span className="prompt-cache-notice-clock" title="What remains of the model's cache, about five minutes from its last answer.">Cache warm · {formatCountdown(notice.remainingMs)}</span>
          ) : (
            <span className="prompt-cache-notice-clock">Cache expired</span>
          )}
          <span className="prompt-cache-notice-actions">
            <button type="button" onClick={onCompactNow} disabled={!canCompact || compacting} title={!canCompact ? unavailableReason : undefined}>
              {compacting ? "Compacting…" : "Compact now"}
            </button>
            <button type="button" className="secondary-button" onClick={onDismiss}>Not now</button>
          </span>
        </div>
      ) : null}
      {reading ? <p className={`prompt-cache-receipt is-${reading.kind}`}>{reading.text}</p> : null}
    </section>
  );
}
