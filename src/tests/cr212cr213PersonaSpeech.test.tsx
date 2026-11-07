// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentTurn } from "../app/AgentTurn";
import { ConversationTranscript } from "../app/ConversationTranscript";
import { personaDisplayName, personaSpeaker } from "../app/conversationPresentation";
import type { AgentTurnPresentation } from "../app/conversationTurnPresentation";
import { contrastRatio, personaHue, personaLightColour } from "../app/personaColour";
import { initialRuntimeProjectionState } from "../app/runtimeActivityModel";
import { mapPiProcessEventToStreamEvents } from "../agent/piProcessStream";
import { createJourneyConversation } from "../domain/journeyConversation";
import { projectPiBackedConversationSurface } from "../domain/piBackedConversationSurface";
import appSource from "../app/App.tsx?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";

const cssSource = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const surface = {
  id: "surface-1",
  kind: "ariad_surface",
  timestamp: "2026-11-07T00:00:00.000Z",
  title: "Ariad surface: PLAN",
  source: { system: "mirror" as const, table: "messages", id: "assistant-1" },
  content: "<<<ARIAD:PLAN>>>\ncanonical\n<<<END:PLAN>>>",
};

const worked: AgentTurnPresentation = {
  agentActions: {
    ...initialRuntimeProjectionState,
    status: "completed",
    operations: [{ id: "read-1", name: "read", status: "completed", output: "what the read returned" }],
    activityOrder: [{ type: "operation", id: "read-1" }],
  },
  systemSurfaces: [surface],
  remainingActivity: [],
  agentComment: "A resposta da persona.",
};

const productDesigner = { label: "Product Designer", avatar: "◇", kind: "persona" as const, personaId: "product-designer" };

function turn(
  proximity: "active" | "latest_completed" | "historical",
  extra: Partial<Parameters<typeof AgentTurn>[0]> = {},
) {
  return renderToStaticMarkup(
    <AgentTurn
      message={{ id: "assistant-1", role: "assistant", content: "ignored", createdAt: "2026-11-07T14:02:00.000Z" }}
      speaker={productDesigner}
      presentation={worked}
      proximity={proximity}
      responseModel={{ label: "Opus 5.5", changed: false }}
      {...extra}
    />,
  );
}

// CR212: after a turn ends its actions are noise between the Navigator and the words. They fold into
// one line, and on a finished turn that line sits under the speech.
describe("CR212: a finished turn folds what it did into one line under its words", () => {
  for (const proximity of ["latest_completed", "historical"] as const) {
    it(`folds the actions of a ${proximity} turn into the turn's line, under the speech`, () => {
      const html = turn(proximity);
      expect(html).toContain('class="agent-turn-line historical-turn-disclosure"');
      expect(html.replace(/<[^>]+>/g, "")).toContain("1 action · 1 surface · Opus 5.5");
      expect(html.indexOf("A resposta da persona.")).toBeLessThan(html.indexOf("agent-turn-line"));
      expect(html).not.toContain("what the read returned");
      expect(html).not.toContain("Show turn details");
    });
  }

  it("never folds away how a turn that failed or was cancelled ended", () => {
    for (const [status, word] of [["failed", "Failed"], ["cancelled", "Cancelled"]] as const) {
      const html = turn("latest_completed", {
        presentation: {
          ...worked,
          systemSurfaces: [],
          agentActions: { ...initialRuntimeProjectionState, status, terminalMessage: `${word} by runtime` },
        },
      });
      expect(html).toMatch(/<details class="agent-turn-line historical-turn-disclosure" open="">/);
      expect(html.replace(/<[^>]+>/g, "")).toContain(`${word} · Opus 5.5`);
      expect(html).toContain('<div class="runtime-terminal-status"');
    }
    expect(turn("latest_completed")).not.toMatch(/historical-turn-disclosure" open/);
  });

  it("keeps a running turn's actions open, above the speech, under a live line", () => {
    const html = turn("active");
    expect(html).toContain("Working · 1 action");
    expect(html.indexOf('aria-label="Agent Actions"')).toBeLessThan(html.indexOf("agent-speech"));
    expect(html).not.toContain("historical-turn-disclosure");
  });

  it("anchors the reader on the speech, which is what moves when the actions fold above it (CR125)", () => {
    const html = turn("latest_completed");
    expect(html).not.toMatch(/<article[^>]*data-conversation-message-id/);
    expect(html).toMatch(/class="speech agent-speech[^"]*"[^>]*data-conversation-message-id="assistant-1"/);
  });
});

// CR213: the persona speaks beside its words, as in a forum; the Navigator speaks the same way,
// mirrored; each bubble copies itself, on hover.
describe("CR213: the persona speaks beside its words", () => {
  it("puts the persona's avatar and name beside the bubble, coloured from its id", () => {
    const html = turn("latest_completed");
    expect(html).toContain("Product Designer");
    expect(html).toMatch(/class="message-avatar speech-avatar"[^>]*>◇</);
    expect(html).toContain(`--persona-hue:${personaHue("product-designer")}`);
    expect(html).not.toContain("message-speaker-row");
  });

  it("says, quietly, which persona spoke before when it changed", () => {
    expect(turn("latest_completed", { previousSpeakerLabel: "Prompt Engineer" })).toContain("before: Prompt Engineer");
    expect(turn("latest_completed", { previousSpeakerLabel: "Product Designer" })).not.toContain("before:");
  });

  it("tells the transcript's runs who spoke before them", () => {
    const conversation = {
      ...createJourneyConversation({ journeyId: "mirror-desktop", initialMessages: [], now: new Date("2026-11-07T14:00:00Z") }),
      responsePersonas: { a1: "pensadora", a2: "pensadora", a3: "ai-engineer" },
    };
    const message = (id: string, role: "user" | "assistant", content: string) => ({ id, role, content, createdAt: "2026-11-07T14:02:00.000Z" });
    const html = renderToStaticMarkup(
      <ConversationTranscript
        messages={[
          message("u1", "user", "Um"), message("a1", "assistant", "Primeira"),
          message("u2", "user", "Dois"), message("a2", "assistant", "Segunda"),
          message("u3", "user", "Três"), message("a3", "assistant", "Terceira"),
        ]}
        conversation={conversation}
        importedActivity={{ unlinked: [], byMessageId: new Map() }}
        assistantTurnProximity={new Map()}
        runtimeProjection={initialRuntimeProjectionState}
        onLocalPathClick={() => undefined}
      />,
    );
    expect(html.match(/before: /g)).toHaveLength(1);
    expect(html.indexOf("before: Pensadora")).toBeGreaterThan(html.indexOf("Segunda"));
    expect(html.indexOf("before: Pensadora")).toBeLessThan(html.indexOf("Terceira"));
  });

  it("puts the copy action inside the agent's bubble", () => {
    const html = turn("latest_completed");
    const bubble = html.slice(html.indexOf('class="speech-bubble"'));
    expect(bubble.indexOf("message-copy-action")).toBeGreaterThan(-1);
    expect(bubble.indexOf("message-copy-action")).toBeLessThan(bubble.indexOf("A resposta da persona."));
  });

  it("gives the Navigator's message the same speech, mirrored, with its copy action in the bubble", () => {
    const conversation = createJourneyConversation({ journeyId: "mirror-desktop", initialMessages: [], now: new Date("2026-11-07T14:00:00Z") });
    const html = renderToStaticMarkup(
      <ConversationTranscript
        messages={[{ id: "u1", role: "user", content: "Aplique.", createdAt: "2026-11-07T14:02:00.000Z" }]}
        conversation={conversation}
        importedActivity={{ unlinked: [], byMessageId: new Map() }}
        assistantTurnProximity={new Map()}
        runtimeProjection={initialRuntimeProjectionState}
        person={{ name: "Alisson", initial: "A" }}
        onLocalPathClick={() => undefined}
      />,
    );
    expect(html).toContain('class="speech person-speech"');
    expect(html).toContain("Alisson");
    const bubble = html.slice(html.indexOf('class="speech-bubble"'));
    expect(bubble.indexOf("message-copy-action")).toBeGreaterThan(-1);
    expect(bubble.indexOf("message-copy-action")).toBeLessThan(bubble.indexOf("Aplique."));
  });

  it("shows each bubble's copy action only on hover or keyboard focus", () => {
    expect(cssSource).toMatch(/\.speech-bubble \.message-copy-action \{[^}]*opacity: 0;/);
    expect(cssSource).toMatch(/\.speech-bubble:hover \.message-copy-action,\s*\.speech-bubble:focus-within \.message-copy-action \{[^}]*opacity: 1;/);
  });

  it("names a persona by its id made readable while the Core gives no name", () => {
    expect(personaDisplayName("product-designer")).toBe("Product Designer");
    expect(personaDisplayName("mentora")).toBe("Mentora");
  });

  it("darkens the colour on light themes until the name reads at 4.5:1 on every light surface", () => {
    const ids = ["ai-engineer", "escritora", "pensadora", "product-designer", "prompt-engineer", "tesoureira", "tech-nerd", "medica"];
    for (const id of ids) {
      const colour = personaLightColour(id);
      for (const surfaceColour of ["#ffffff", "#f6f7f9", "#f4f1ea", "#fffdf7"]) {
        expect(contrastRatio(colour, surfaceColour), `${id} on ${surfaceColour}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(personaHue("pensadora")).toBe(personaHue("pensadora"));
  });

  it("no longer paints the persona's name the dark theme's lilac on every theme", () => {
    expect(cssSource).not.toContain(".message.speaker-persona .message-role {\n  color: #d7c5ff;");
  });
});

// CR213: a turn the Core gives no persona is spoken by the agent, never by a name read from the
// model's own signature.
describe("CR213: no persona from the Core means the agent speaks", () => {
  const signed = { role: "assistant" as const, content: "Feito.\n\n◇ product-designer" };

  it("shows π when the Core said none, and still reads the signature when the Core said nothing", () => {
    expect(personaSpeaker(signed, null)).toMatchObject({ kind: "agent", label: "Agent", avatar: "π" });
    expect(personaSpeaker(signed, undefined)).toMatchObject({ kind: "persona", label: "Product Designer", personaId: "product-designer" });
  });

  it("records none for every answer of a run whose delivered context named no persona", () => {
    const base = createJourneyConversation({ journeyId: "mirror-desktop", initialMessages: [], now: new Date("2026-11-07T14:00:00Z") });
    const surface = projectPiBackedConversationSurface(base, {
      schemaVersion: "0.1.0",
      entries: [
        { entryId: "u1", role: "user", visibleText: "Oi", timestamp: "2026-11-07T14:00:00Z", mirrorPersonaNone: true },
        { entryId: "a1", role: "assistant", visibleText: "Olá", timestamp: "2026-11-07T14:00:05Z" },
        { entryId: "u2", role: "user", visibleText: "Sem Mirror", timestamp: "2026-11-07T14:01:00Z" },
        { entryId: "a2", role: "assistant", visibleText: "Resposta", timestamp: "2026-11-07T14:01:05Z" },
      ],
    });
    const [, first, , second] = surface.messages;
    expect(surface.responsePersonas?.[first.id]).toBeNull();
    expect(surface.responsePersonas?.[second.id]).toBeUndefined();
  });

  it("reads the native side's no-persona line as a persona event with none", () => {
    const line = '{"journeyId":"mirror-desktop","mode":"mirror","persona":null,"schemaVersion":"0.1.0","type":"mirror_context"}';
    expect(mapPiProcessEventToStreamEvents({ kind: "stdout", content: `${line}\n` }, { mappingState: {} })).toEqual([
      { type: "persona_context", persona: null },
    ]);
  });

  it("records none on the live surface without certifying a persona in the text", () => {
    const handler = appSource.slice(appSource.indexOf('if (event.type === "persona_context") {'));
    const body = handler.slice(0, handler.indexOf('if (event.type === "message_delta"'));
    expect(body).toMatch(/event\.persona === null\s*\?\s*message\.content/);
  });

  it("emits the no-persona line when the delivered context named none", () => {
    const start = mainSource.slice(mainSource.indexOf("mirror_context::prepare_turn(&app"));
    const branch = start.slice(0, start.indexOf("Some(guard)"));
    expect(branch).toMatch(/else if context\.no_persona \{\s*emit\(\s*&app,\s*&authority,\s*PiProcessEventKind::Stdout,\s*mirror_context::no_persona_event_line\(&run_authority\.journey_id\),/);
  });
});

// The grids inside a bubble had no declared column, so an implicit `auto` track grew to the widest
// line of a code block in a progress note, and the note's paragraphs ran past the bubble with it.
describe("CR213: what the persona says stays inside its bubble", () => {
  it("bounds every grid between the bubble and a comment to the bubble's width", () => {
    for (const selector of [".speech-bubble", ".agent-turn-region", ".agent-comment-trail"]) {
      const rule = cssSource.match(new RegExp(`\\n${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, selector).toContain("grid-template-columns: minmax(0, 1fr)");
    }
    expect(cssSource).toMatch(/\n\.agent-comment-note \{[^}]*min-width: 0/);
  });
});
