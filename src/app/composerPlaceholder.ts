export type ComposerPlaceholderInput = {
  isAgentResponding: boolean;
  /** CR259: a message written now waits for the compaction instead of being refused. */
  compacting?: boolean;
};

export function composerPlaceholder({ isAgentResponding, compacting }: ComposerPlaceholderInput): string {
  if (compacting) return "Write your next message. It waits for the compaction and is sent when it ends.";
  return isAgentResponding
    ? "Prepare your next message. You can send it when the current response is complete."
    : "What would you like to do next?";
}
