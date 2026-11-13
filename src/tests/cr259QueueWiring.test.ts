import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JourneyItemCopy } from "../app/JourneyItemCopy";
import appSource from "../app/App.tsx?raw";
import { composerPlaceholder } from "../app/composerPlaceholder";

const generatePacket = appSource.slice(
  appSource.indexOf("async function generatePacket("),
  appSource.indexOf("async function startSelectedJourney()"),
);
const compaction = appSource.slice(
  appSource.indexOf("async function compactSelectedConversationNow()"),
  appSource.indexOf("async function loadCompleteSegmentHistory()"),
);

describe("CR259: the App queues messages behind a compaction", () => {
  it("invites writing during a compaction", () => {
    expect(composerPlaceholder({ isAgentResponding: false, compacting: true }))
      .toBe("Write your next message. It waits for the compaction and is sent when it ends.");
    expect(appSource).toContain("compacting: compactionInFlight");
  });

  it("keeps the queue with the drafts and restores it held", () => {
    expect(appSource).toContain("createComposerDraftPersistence<ComposerStore>({");
    expect(appSource).toContain("queued: queuedItemsForStorage(");
    expect(appSource).toContain("queuesRestoredAfterRestart(loadedComposerDrafts.queued)");
  });

  it("Enter and Send queue while a compaction runs, and a held queue goes with the next message", () => {
    expect(appSource).toContain("} else if (queueTakesDraft || selectedQueue?.state === \"held\") {");
    expect(appSource).toContain("onClick={submitComposerMessage}");
    expect(appSource).toContain("\"Send when the compaction ends\"");
    expect(appSource).toContain("<WaitingMessages");
  });

  it("releases a waiting queue on its own once the conversation on screen can send", () => {
    expect(appSource).toMatch(/queueReadyToRelease\(selectedQueue, \{ canSend: queueCanLeave, compacting: compactionInFlight \}\)/);
    expect(appSource).toContain("void generatePacket(\"live\", { key, content: queueContent(queue) });");
  });

  it("a queued turn leaves what is being typed and returns to the queue, not the draft", () => {
    expect(generatePacket).toContain("const content = (queued?.content ?? draftRef.current).trim();");
    expect(generatePacket).toContain("} else if (!queued && selectedJourneyRef.current === ownerJourneyId) {");
    expect(generatePacket).toContain("updateCompactionQueues((current) => removeQueue(current, queued.key));");
    expect(generatePacket.match(/returnUnsentContent\(/g)?.length).toBe(3);
    expect(generatePacket).not.toContain("persistOwnerComposerDraft(content);");
    expect(generatePacket).toContain("else persistOwnerComposerDraft(composerText, flush);");
    expect(generatePacket.match(/if \(!queued\) setUnsentDraftNotices/g)?.length).toBe(3);
    expect(generatePacket.match(/holdQueuedTurn\(message\);/g)?.length).toBe(5);
  });

  it("a failed compaction holds the queue, and a refused one lets it go", () => {
    expect(compaction).toContain("if (!nothingToDo) {");
    expect(compaction).toContain("holdJourneyQueues(current, authority.journeyId,");
  });

  it("the sidebar counts a Journey's waiting messages beside its name", () => {
    expect(appSource).toContain("const waitingCount = waitingMessageCount(compactionQueues, journey.id);");
    expect(appSource).toContain("waitingCount={waitingCount}");
    const html = renderToStaticMarkup(createElement(JourneyItemCopy, {
      layout: "tree", journeyName: "Journey", description: "", waitingCount: 2,
    }));
    expect(html).toContain('<span class="journey-waiting-count" aria-label="2 messages waiting to be sent" title="2 messages waiting to be sent">2</span>');
    expect(renderToStaticMarkup(createElement(JourneyItemCopy, { layout: "tree", journeyName: "J", description: "" })))
      .not.toContain("journey-waiting-count");
  });
});
