import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationTranscript } from "../app/ConversationTranscript";
import { personaDisplayName, personaSpeaker } from "../app/conversationPresentation";
import { initialRuntimeProjectionState } from "../app/runtimeActivityModel";
import { mapPiProcessEventToStreamEvents } from "../agent/piProcessStream";
import { createJourneyConversation } from "../domain/journeyConversation";
import appSource from "../app/App.tsx?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";
import contextSource from "../../src-tauri/src/mirror_context.rs?raw";
import storageSource from "../app/personaNameStorage.ts?raw";
import { sanitizePersonaNames } from "../domain/personaNames";

// CR216: the Core hands the persona's own name beside its id (Core CR204, in mirror-mind 0.41.0).
// The bubble shows that name, live and when the Conversation is read again, where it showed the id
// made readable. A Pi transcript keeps only the id, so the name is kept for the home, by id.
const names = { "analista-sql": "Analista SQL" };

describe("CR216: the persona's own name in its bubble", () => {
  it("reads the name on the line the native side writes", () => {
    // The exact line `persona_event_line` writes with a name (checked in Rust, `cr216_*`).
    const line = '{"journeyId":"mirror-desktop","mode":"mirror","persona":"analista-sql","personaName":"Analista SQL","schemaVersion":"0.1.0","type":"mirror_context"}';
    expect(mapPiProcessEventToStreamEvents({ kind: "stdout", content: `${line}\n` }, { mappingState: {} })).toEqual([
      { type: "persona_context", persona: "analista-sql", personaName: "Analista SQL" },
    ]);
  });

  it("keeps the persona when the name is missing or not a name", () => {
    const line = (personaName: unknown) => `${JSON.stringify({ journeyId: "j", mode: "mirror", persona: "analista-sql", ...(personaName === undefined ? {} : { personaName }), schemaVersion: "0.1.0", type: "mirror_context" })}\n`;
    for (const refused of [undefined, 7, "", "   ", null]) {
      expect(mapPiProcessEventToStreamEvents({ kind: "stdout", content: line(refused) }, { mappingState: {} })).toEqual([
        { type: "persona_context", persona: "analista-sql" },
      ]);
    }
  });

  it("names the speaker by the kept name, and by the readable id without one", () => {
    const answer = { role: "assistant" as const, content: "Feito." };
    expect(personaSpeaker(answer, "analista-sql", names)).toEqual({ label: "Analista SQL", avatar: "◇", kind: "persona", personaId: "analista-sql" });
    expect(personaSpeaker(answer, "analista-sql").label).toBe("Analista Sql");
    expect(personaSpeaker(answer, "mentora", names).label).toBe("Mentora");
    expect(personaSpeaker({ role: "assistant", content: "Feito.\n\n◇ analista-sql" }, undefined, names).label).toBe("Analista SQL");
    expect(personaSpeaker(answer, null, names).label).toBe("Agent");
    expect(personaDisplayName("analista-sql", names)).toBe("Analista SQL");
  });

  it("shows the kept name in the transcript, and says it for the persona that spoke before", () => {
    const conversation = {
      ...createJourneyConversation({ journeyId: "mirror-desktop", initialMessages: [], now: new Date("2026-11-08T10:00:00Z") }),
      responsePersonas: { a1: "analista-sql", a2: "mentora" },
    };
    const message = (id: string, role: "user" | "assistant", content: string) => ({ id, role, content, createdAt: "2026-11-08T10:02:00.000Z" });
    const html = renderToStaticMarkup(
      <ConversationTranscript
        messages={[message("u1", "user", "Um"), message("a1", "assistant", "Primeira"), message("u2", "user", "Dois"), message("a2", "assistant", "Segunda")]}
        conversation={conversation}
        importedActivity={{ unlinked: [], byMessageId: new Map() }}
        assistantTurnProximity={new Map()}
        runtimeProjection={initialRuntimeProjectionState}
        personaNames={names}
        onLocalPathClick={() => undefined}
      />,
    );
    expect(html).toContain("Analista SQL");
    expect(html).toContain("before: Analista SQL");
    expect(html).not.toContain("Analista Sql");
  });

  it("loads the home's kept names and adds the one a live turn brings", () => {
    expect(storageSource).toContain('invoke<Record<string, string>>("load_persona_names")');
    expect(appSource).toMatch(/void loadPersonaNames\(\)\s*\.then\(\(kept\) => \{\s*if \(!cancelled\) setPersonaNames\(\(current\) => \(\{ \.\.\.kept, \.\.\.current \}\)\);/);
    const handler = appSource.slice(appSource.indexOf('if (event.type === "persona_context") {'));
    const body = handler.slice(0, handler.indexOf('if (event.type === "message_delta"'));
    expect(body).toMatch(/if \(event\.persona && event\.personaName\) \{\s*const persona = event\.persona;\s*const personaName = event\.personaName;\s*setPersonaNames\(\(current\) => \(\{ \.\.\.current, \[persona\]: personaName \}\)\);/);
    expect(appSource).toMatch(/<ConversationTranscript[\s\S]{0,200}personaNames=\{personaNames\}/);
  });

  it("keeps from the native answer only ids with a readable name", () => {
    expect(sanitizePersonaNames({ "analista-sql": " Analista SQL ", "../x": "X", mentora: 7, ok: "", "a-b": "linha\nquebrada" })).toEqual({ "analista-sql": "Analista SQL" });
    expect(sanitizePersonaNames({ a: "x".repeat(80), b: "x".repeat(81) })).toEqual({ a: "x".repeat(80) });
    expect(sanitizePersonaNames(null)).toEqual({});
    expect(sanitizePersonaNames(["x"])).toEqual({});
  });

  it("emits the name with the persona and keeps it for the home", () => {
    const start = mainSource.slice(mainSource.indexOf("mirror_context::prepare_turn(&app"));
    const branch = start.slice(0, start.indexOf("Some(guard)"));
    expect(branch).toContain("mirror_context::persona_event_line(&run_authority.journey_id, &persona, context.persona_name.as_deref()),");
    expect(mainSource).toContain("mirror_context::load_persona_names,");
    expect(contextSource).toMatch(/remember_persona_name_in\(&home, persona, context\.persona_name\.as_deref\(\)\)/);
  });
});
