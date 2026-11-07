// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentTurn } from "../app/AgentTurn";
import { SteeringMessages } from "../app/SteeringMessages";
import type { AgentTurnPresentation } from "../app/conversationTurnPresentation";
import { initialRuntimeProjectionState } from "../app/runtimeActivityModel";
import type { SteeringEvidence } from "../domain/journeyConversation";

const cssSource = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const alisson = { label: "Alisson", avatar: "A", kind: "user" as const };
const productDesigner = { label: "Product Designer", avatar: "◇", kind: "persona" as const, personaId: "product-designer" };

function correction(status: SteeringEvidence["status"], text = "Use o tema parchment também."): SteeringEvidence {
  return {
    schemaVersion: "0.1.0",
    requestId: `steer-${status}`,
    sequence: 1,
    journeyId: "mirror-desktop",
    generation: 1,
    runId: "run-1",
    turnId: "turn-1",
    assistantMessageId: "assistant-1",
    text,
    status,
    createdAt: "2026-11-07T14:10:05.000Z",
    updatedAt: "2026-11-07T14:10:06.000Z",
  };
}

const worked: AgentTurnPresentation = {
  agentActions: {
    ...initialRuntimeProjectionState,
    status: "completed",
    operations: [{ id: "read-1", name: "read", status: "completed", output: "rendered" }],
    activityOrder: [{ type: "operation", id: "read-1" }],
  },
  systemSurfaces: [],
  remainingActivity: [],
  agentComment: "Pronto: escuro, daylight e parchment.",
};

function turn(proximity: "active" | "latest_completed", status: SteeringEvidence["status"] = "applied") {
  return renderToStaticMarkup(
    <AgentTurn
      message={{ id: "assistant-1", role: "assistant", content: "ignored", createdAt: "2026-11-07T14:10:00.000Z" }}
      speaker={productDesigner}
      presentation={worked}
      proximity={proximity}
      corrections={[correction(status)]}
      person={alisson}
    />,
  );
}

// CR214: a correction is the Navigator speaking, so it speaks as they do, in a bubble of theirs.
describe("CR214: a correction sent mid-turn is the Navigator's own speech", () => {
  it("draws each correction as a speech of the Navigator, with their name and their words", () => {
    const html = renderToStaticMarkup(<SteeringMessages evidence={[correction("delivered")]} speaker={alisson} />);
    expect(html).toContain("speech person-speech correction-speech");
    expect(html).toContain(">Alisson<");
    expect(html).toContain("Use o tema parchment também.");
    expect(html).not.toContain("Correction during response");
  });

  it("says what the evidence establishes beside the name, and no more (CR117)", () => {
    const said = (status: SteeringEvidence["status"]) =>
      renderToStaticMarkup(<SteeringMessages evidence={[correction(status)]} speaker={alisson} />).replace(/<[^>]+>/g, "");
    expect(said("pending")).toContain("correction · sending");
    expect(said("accepted")).toContain("correction · queued");
    expect(said("delivered")).toContain("correction · ✓ reached the agent");
    expect(said("applied")).toContain("correction · ✓✓ applied");
    expect(said("rejected")).toContain("correction · ✕ rejected");
    expect(said("terminally_unconsumed")).toContain("correction · ✕ not applied");
    expect(said("terminally_unconsumed")).not.toContain("✓");
  });

  it("lets the Navigator copy a correction like any other bubble", () => {
    const html = renderToStaticMarkup(<SteeringMessages evidence={[correction("delivered")]} speaker={alisson} />);
    expect(html).toContain("message-copy-action");
  });

  it("puts the correction before the speech it shaped on a finished turn, and the turn's line last", () => {
    const html = turn("latest_completed");
    const correctionAt = html.indexOf("Use o tema parchment também.");
    const speechAt = html.indexOf("Pronto: escuro, daylight e parchment.");
    expect(correctionAt).toBeGreaterThan(-1);
    expect(correctionAt).toBeLessThan(speechAt);
    expect(speechAt).toBeLessThan(html.indexOf("agent-turn-line"));
  });

  it("puts the correction between the open actions and the speech while the turn runs", () => {
    const html = turn("active");
    const actionsAt = html.indexOf("agent-turn-line is-live");
    const correctionAt = html.indexOf("Use o tema parchment também.");
    expect(actionsAt).toBeGreaterThan(-1);
    expect(actionsAt).toBeLessThan(correctionAt);
    expect(correctionAt).toBeLessThan(html.indexOf("Pronto: escuro, daylight e parchment."));
  });

  it("marks a correction the agent never took apart from one it did", () => {
    expect(turn("latest_completed", "terminally_unconsumed")).toContain("is-terminally_unconsumed");
    expect(turn("latest_completed", "applied")).toContain("is-applied");
  });

  it("styles the correction as a smaller, dashed bubble of the Navigator's, without the old box", () => {
    expect(cssSource).toContain(".correction-speech .speech-bubble");
    expect(cssSource).toMatch(/\.correction-speech \.speech-bubble \{[^}]*border-style: dashed/);
    expect(cssSource).not.toContain(".steering-message header");
  });

  it("keeps the persona's colour off the Navigator's correction inside the persona's turn", () => {
    // The turn's article carries the speaker's class; the colour belongs to the agent's speech alone.
    expect(cssSource).not.toMatch(/\.message\.speaker-(persona|agent) \.(message-avatar|speech-name)/);
    expect(cssSource).toContain(".correction-speech .message-avatar:not(.has-custom-user-avatar)");
  });
});
