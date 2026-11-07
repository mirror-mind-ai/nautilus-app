import type { SteeringEvidence } from "../domain/journeyConversation";
import type { MessageSpeaker } from "./conversationPresentation";
import { Speech } from "./Speech";

/**
 * CR117: these say what the evidence establishes and no more. `delivered` means the correction
 * reached the model's input, which is what Pi's queue departure proves — not that the model read
 * or followed it, which nothing here can observe.
 */
const labels: Record<SteeringEvidence["status"], string> = {
  pending: "sending",
  accepted: "queued",
  delivered: "reached the agent",
  applied: "applied",
  rejected: "rejected",
  terminally_unconsumed: "not applied",
};

const marks: Partial<Record<SteeringEvidence["status"], string>> = {
  delivered: "✓",
  applied: "✓✓",
  rejected: "✕",
  terminally_unconsumed: "✕",
};

/**
 * CR214: a correction is the Navigator speaking while the agent works, so it is drawn as their own
 * speech, a smaller bubble beside their avatar. What became of it is said quietly beside the name.
 */
export function SteeringMessages({
  evidence,
  speaker,
  userAvatar,
}: {
  evidence: readonly SteeringEvidence[];
  speaker: MessageSpeaker;
  userAvatar?: string;
}) {
  if (!evidence.length) return null;
  return (
    <section className="steering-messages agent-run-corrections" aria-label="Corrections sent during response">
      {evidence.map((item) => (
        <Speech
          key={item.requestId}
          side="person"
          className={`correction-speech steering-message is-${item.status}`}
          speaker={speaker}
          {...(userAvatar ? { userAvatar } : {})}
          meta={(
            <span role="status">
              <span aria-hidden="true">↳</span> correction ·{" "}
              {marks[item.status] ? (
                <span className="steering-mark" aria-hidden="true">{marks[item.status]} </span>
              ) : null}
              {labels[item.status]}
            </span>
          )}
          copyBody={item.text}
        >
          <p className="steering-text">{item.text}</p>
        </Speech>
      ))}
    </section>
  );
}
