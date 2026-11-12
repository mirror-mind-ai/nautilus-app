import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationTranscript } from "../app/ConversationTranscript";
import { initialRuntimeProjectionState } from "../app/runtimeActivityModel";
import { createJourneyConversation, type JourneyConversation } from "../domain/journeyConversation";
import { projectPiBackedConversationSurface } from "../domain/piBackedConversationSurface";

// CR250 let a message carry only files. The Navigator's bubble was drawn only when it had text,
// so such a turn showed the agent's answer and nothing of what was sent; a reload dropped the
// empty Pi entry and with it the files bound to it.
const attachment = {
  schemaVersion: "0.2.0" as const, attachmentId: "attachment-1", journeyId: "journey-a", kind: "file" as const,
  absolutePath: "/Users/a/Downloads/gibran.jpg", displayName: "gibran.jpg", sizeBytes: 12, selectedAt: "2026-11-12T11:00:00Z",
};

function transcript(messages: JourneyConversation["messages"]): string {
  const conversation = createJourneyConversation({ journeyId: "journey-a", initialMessages: [], now: new Date("2026-11-12T11:00:00Z") });
  return renderToStaticMarkup(
    <ConversationTranscript
      messages={messages}
      conversation={conversation}
      importedActivity={{ unlinked: [], byMessageId: new Map() }}
      assistantTurnProximity={new Map()}
      runtimeProjection={initialRuntimeProjectionState}
      person={{ name: "Alisson", initial: "A" }}
      onLocalPathClick={() => undefined}
    />,
  );
}

describe("CR252: a message with only files shows what was sent", () => {
  it("draws the Navigator's bubble with its files when there is no text", () => {
    const html = transcript([{ id: "u1", role: "user", content: "", createdAt: "2026-11-12T11:01:00Z", attachments: [attachment] }]);
    expect(html).toContain('class="speech person-speech"');
    expect(html).toContain("Files attached to this message");
    expect(html).toContain("gibran.jpg");
    expect(html).not.toContain("message-copy-action");
  });

  it("still draws no bubble for a user message with neither text nor files", () => {
    const html = transcript([{ id: "u1", role: "user", content: "", createdAt: "2026-11-12T11:01:00Z" }]);
    expect(html).not.toContain("person-speech");
  });

  it("keeps an empty Pi request after a reload when its bound message carries files", () => {
    const base = createJourneyConversation({ journeyId: "journey-a", initialMessages: [], now: new Date("2026-11-12T11:00:00Z") });
    const projected: JourneyConversation = {
      ...base,
      messages: [
        { id: "desktop-user-1", role: "user", content: "", createdAt: "2026-11-12T11:01:00Z", attachments: [attachment] },
        { id: "desktop-assistant-1", role: "assistant", content: "stale", createdAt: "2026-11-12T11:01:05Z" },
      ],
      reconciliation: {
        ...base.reconciliation,
        turns: [{
          turnId: "turn-1", runId: "run-1", origin: "nautilus", startedAt: "2026-11-12T11:01:00Z",
          harness: { state: "committed", userMessageId: "desktop-user-1", assistantMessageId: "desktop-assistant-1" },
          pi: { state: "committed", userEntryId: "native-user-1", assistantEntryId: "native-assistant-1" },
          mirror: { state: "pending" },
        }],
      },
    };
    const result = projectPiBackedConversationSurface(projected, {
      schemaVersion: "0.1.0",
      entries: [
        { entryId: "native-user-0", role: "user", visibleText: "", timestamp: "2026-11-12T11:00:30Z" },
        { entryId: "native-user-1", role: "user", visibleText: "", timestamp: "2026-11-12T11:01:00Z" },
        { entryId: "native-assistant-1", role: "assistant", visibleText: "Imagem lida.", timestamp: "2026-11-12T11:01:05Z" },
      ],
    });
    expect(result.messages).toEqual([
      { id: "desktop-user-1", role: "user", content: "", createdAt: "2026-11-12T11:01:00Z", attachments: [attachment] },
      { id: "desktop-assistant-1", role: "assistant", content: "Imagem lida.", createdAt: "2026-11-12T11:01:05Z" },
    ]);
  });
});
