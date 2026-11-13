import type { CompactionQueue } from "../domain/compactionQueue";

/**
 * CR259: what was written while the compaction ran, shown where it will leave from. A queue that
 * leaves on its own says when; a held one says why and offers both ways out.
 */
export function WaitingMessages({
  queue,
  canSend,
  onRemove,
  onSendNow,
  onReturnToComposer,
}: {
  queue?: CompactionQueue;
  canSend: boolean;
  onRemove: (index: number) => void;
  onSendNow: () => void;
  onReturnToComposer: () => void;
}) {
  if (!queue?.items.length) return null;
  const count = `${queue.items.length} ${queue.items.length === 1 ? "message" : "messages"} waiting.`;
  const status = queue.state === "waiting"
    ? "They go to the agent as one message when the compaction ends."
    : queue.state === "held"
      ? queue.heldReason ?? ""
      : "Sending to the agent.";
  return (
    <section className={`dedicated-turn-notice waiting-messages is-${queue.state}`} aria-label="Messages waiting for the compaction">
      <p className="waiting-messages-status" role="status">
        <strong>{count}</strong> {status}
      </p>
      <ol className="waiting-messages-list">
        {queue.items.map((item, index) => (
          <li key={`${index}-${item.slice(0, 24)}`} className="waiting-message">
            <p className="waiting-message-text">{item}</p>
            {queue.state === "sending" ? null : (
              <button
                type="button"
                className="icon-button waiting-message-remove"
                aria-label={`Remove waiting message ${index + 1}`}
                title="Remove"
                onClick={() => onRemove(index)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ol>
      {queue.state === "held" ? (
        <div className="waiting-messages-actions">
          <button type="button" disabled={!canSend} onClick={onSendNow}>Send now</button>
          <button type="button" onClick={onReturnToComposer}>Back to the composer</button>
        </div>
      ) : null}
    </section>
  );
}
