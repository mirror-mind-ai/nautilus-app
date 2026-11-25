import { useState } from "react";
import {
  describeJourneyMemoryCounts,
  formatMemoryDate,
  groupJourneyMemories,
  memoryExcerpt,
  type JourneyMemory,
  type MemoryConversationTarget,
} from "../domain/journeyMemory";

export type JourneyMemoryPanelStatus = "loading" | "ready" | "failed";

type JourneyMemoryPanelProps = {
  journeyName: string;
  status: JourneyMemoryPanelStatus;
  memories: readonly JourneyMemory[];
  truncated?: boolean;
  error?: string;
  /** Where a memory's conversation can be opened, when the app knows the conversation. */
  conversationTargetOf: (memory: JourneyMemory) => MemoryConversationTarget | undefined;
  onOpenConversation: (memory: JourneyMemory, target: MemoryConversationTarget) => void;
  onReload: () => void;
  onClose: () => void;
  /** Explicit only in tests; production follows the reader's own locale. */
  locale?: string;
};

/**
 * What Mirror kept from this Journey, by kind, newest first. Mirror already extracts these from
 * the Journey's Conversations and hands them to the agent; this is the first place the person sees
 * them. It reads and leads to the conversation of origin; it changes nothing (a memory that no
 * longer holds is a matter for Mirror, not for this panel).
 */
export function JourneyMemoryPanel({
  journeyName, status, memories, truncated = false, error, conversationTargetOf, onOpenConversation, onReload, onClose, locale,
}: JourneyMemoryPanelProps) {
  const groups = groupJourneyMemories(memories);
  return (
    <aside className="journey-memory-panel" aria-label={`Memory of ${journeyName}`}>
      <button type="button" className="conversation-panel-close" onClick={onClose} aria-label="Close Journey memory" title="Close">×</button>
      <header className="journey-memory-head">
        <strong>Journey memory</strong>
        <span>{status === "ready" ? describeJourneyMemoryCounts(memories) : status === "loading" ? "Reading what Mirror kept…" : "Could not be read"}</span>
      </header>
      {status === "failed" ? (
        <div className="journey-memory-notice" role="alert">
          <p>{error ?? "Mirror did not answer."}</p>
          <button type="button" className="secondary-button" onClick={onReload}>Try again</button>
        </div>
      ) : null}
      {status === "ready" && groups.length === 0 ? (
        <p className="journey-memory-empty">Mirror has kept nothing from this Journey yet. It learns from Conversations after they rest.</p>
      ) : null}
      <div className="journey-memory-body">
        {groups.map((group) => (
          <section key={group.kind} className={`journey-memory-group is-${group.kind}`} aria-label={`${group.label}, ${group.memories.length}`}>
            <h3><span>{group.label}</span><small>{group.hint}</small></h3>
            {group.memories.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                showKind={group.kind === "other"}
                target={conversationTargetOf(memory)}
                onOpenConversation={onOpenConversation}
                locale={locale}
              />
            ))}
          </section>
        ))}
      </div>
      <footer className="journey-memory-foot">
        {truncated ? "The newest are shown; the counts above include the rest. " : ""}
        Read from the Mirror home. These are the memories Mirror hands to the agent when a turn in this Journey calls for them.
      </footer>
    </aside>
  );
}

function MemoryRow({ memory, showKind, target, onOpenConversation, locale }: {
  memory: JourneyMemory;
  showKind: boolean;
  target: MemoryConversationTarget | undefined;
  onOpenConversation: (memory: JourneyMemory, target: MemoryConversationTarget) => void;
  locale?: string;
}) {
  const [whole, setWhole] = useState(false);
  const excerpt = memoryExcerpt(memory.content);
  return (
    <article className="journey-memory-item" data-memory-id={memory.id}>
      <h4>{memory.title}</h4>
      <p className="journey-memory-content">{whole ? memory.content : excerpt.text}</p>
      <div className="journey-memory-meta">
        <span>{formatMemoryDate(memory.createdAt, locale)}</span>
        {showKind ? <span className="journey-memory-tag">{memory.memoryType}</span> : null}
        {memory.persona ? <span className="journey-memory-tag">{memory.persona}</span> : null}
        {excerpt.cut ? (
          <button type="button" className="journey-memory-link" onClick={() => setWhole((current) => !current)}>{whole ? "Less" : "Whole text"}</button>
        ) : null}
        {target ? (
          <button type="button" className="journey-memory-link" onClick={() => onOpenConversation(memory, target)}>Open the conversation</button>
        ) : null}
      </div>
    </article>
  );
}
