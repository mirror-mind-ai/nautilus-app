import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { personaSpeaker } from "../app/conversationPresentation";
import { PersonaForm } from "../app/PersonaScreen";
import { PersonaOpenerContext } from "../app/personaOpener";
import { Speech } from "../app/Speech";
import appSource from "../app/App.tsx?raw";
import storageSource from "../app/personaStorage.ts?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";
import {
  draftFromPersona,
  namesAfterSave,
  parseRoutingKeywords,
  personaChanges,
  personaDraftProblem,
  sanitizePersona,
  type Persona,
} from "../domain/personaEditing";

// CR217: the persona's name beside an answer opens its screen, which shows the persona whole and
// edits its name, description, prompt and routing keywords through the Core (Core CR205).

const persona: Persona = {
  id: "analista-sql",
  name: "Analista SQL",
  description: "Consultas e modelagem.",
  prompt: "# Analista\n\nResponda com SQL.",
  routingKeywords: ["sql", "consulta"],
  updatedAt: "2026-11-08T12:00:00Z",
};

describe("CR217: the persona as the Core answers it", () => {
  it("keeps a persona the Core answered, and drops anything else", () => {
    expect(sanitizePersona({ ...persona, defaultModel: "m", inheritsFrom: "ego", legacy: 1 })).toEqual(persona);
    expect(sanitizePersona({ id: "mentora", prompt: "p", updatedAt: "t" })).toEqual({
      id: "mentora", name: null, description: null, prompt: "p", routingKeywords: [], updatedAt: "t",
    });
    expect(sanitizePersona({ ...persona, routingKeywords: ["sql", 3, ""] })?.routingKeywords).toEqual(["sql"]);
    expect(sanitizePersona({ ...persona, name: "  " })?.name).toBeNull();
    for (const refused of [null, [], { ...persona, id: "../x" }, { ...persona, prompt: 1 }, { ...persona, updatedAt: undefined }]) {
      expect(sanitizePersona(refused)).toBeUndefined();
    }
  });
});

describe("CR217: an edit sends only what changed", () => {
  it("sends nothing when nothing changed", () => {
    expect(personaChanges(persona, draftFromPersona(persona))).toEqual({});
  });

  it("sends each changed field, trimmed, and removes an emptied name or description", () => {
    const draft = draftFromPersona(persona);
    expect(personaChanges(persona, { ...draft, name: "  Analista de Dados " })).toEqual({ name: "Analista de Dados" });
    expect(personaChanges(persona, { ...draft, name: " " })).toEqual({ name: null });
    expect(personaChanges(persona, { ...draft, description: "" })).toEqual({ description: null });
    expect(personaChanges(persona, { ...draft, prompt: `${persona.prompt}\n` })).toEqual({ prompt: `${persona.prompt}\n` });
    expect(personaChanges(persona, { ...draft, routingKeywords: "sql, consulta, índice" })).toEqual({ routingKeywords: ["sql", "consulta", "índice"] });
    expect(personaChanges(persona, { ...draft, routingKeywords: "" })).toEqual({ routingKeywords: [] });
    expect(personaChanges(persona, { ...draft, routingKeywords: "sql,\nconsulta" })).toEqual({});
  });

  it("reads keywords split by commas or lines", () => {
    expect(parseRoutingKeywords(" sql ,consulta\n\nmodelo de dados, ")).toEqual(["sql", "consulta", "modelo de dados"]);
  });

  it("says what is wrong before asking the Core", () => {
    const draft = draftFromPersona(persona);
    expect(personaDraftProblem(draft)).toBeUndefined();
    expect(personaDraftProblem({ ...draft, prompt: " \n" })).toMatch(/prompt/);
    expect(personaDraftProblem({ ...draft, name: "x".repeat(81) })).toMatch(/name/);
    expect(personaDraftProblem({ ...draft, name: "x".repeat(80) })).toBeUndefined();
    expect(personaDraftProblem({ ...draft, description: "x".repeat(2001) })).toMatch(/description/);
    expect(personaDraftProblem({ ...draft, routingKeywords: "x".repeat(81) })).toMatch(/keyword/);
    expect(personaDraftProblem({ ...draft, routingKeywords: Array.from({ length: 201 }, (_, index) => `k${index}`).join(",") })).toMatch(/keyword/);
  });

  it("a saved name replaces the kept one, and a removed name leaves the readable id", () => {
    const names = { "analista-sql": "Analista SQL", mentora: "Mentora" };
    expect(namesAfterSave(names, { ...persona, name: "Analista de Dados" })).toEqual({ "analista-sql": "Analista de Dados", mentora: "Mentora" });
    expect(namesAfterSave(names, { ...persona, name: null })).toEqual({ mentora: "Mentora" });
  });
});

describe("CR217: the name is a way in", () => {
  const open = () => undefined;
  const speech = (speaker: Parameters<typeof Speech>[0]["speaker"], opener: ((id: string) => void) | null) => renderToStaticMarkup(
    <PersonaOpenerContext.Provider value={opener}>
      <Speech side="agent" speaker={speaker}>Feito.</Speech>
    </PersonaOpenerContext.Provider>,
  );

  it("a persona's name opens its screen", () => {
    const html = speech(personaSpeaker({ role: "assistant", content: "Feito." }, "analista-sql", { "analista-sql": "Analista SQL" }), open);
    expect(html).toMatch(/<button[^>]*class="message-role speech-name speech-name-link"[^>]*>Analista SQL<\/button>/);
    expect(html).toContain('aria-label="Open the persona Analista SQL"');
  });

  it("the agent's π opens nothing, and nothing opens without the screen", () => {
    expect(speech({ label: "Agent", avatar: "π", kind: "agent" }, open)).not.toContain("<button type=\"button\" class=\"message-role");
    const persona = personaSpeaker({ role: "assistant", content: "Feito." }, "analista-sql", {});
    expect(speech(persona, null)).toMatch(/<span class="message-role speech-name">Analista Sql<\/span>/);
  });
});

describe("CR217: the screen shows the persona whole", () => {
  const form = (overrides: Partial<Parameters<typeof PersonaForm>[0]> = {}) => renderToStaticMarkup(
    <PersonaForm
      persona={persona}
      draft={draftFromPersona(persona)}
      state="idle"
      onDraft={() => undefined}
      onSave={() => undefined}
      onClose={() => undefined}
      onChooseImage={() => undefined}
      onRemoveImage={() => undefined}
      {...overrides}
    />,
  );

  it("shows the four fields it edits, and nothing it does not", () => {
    const html = form();
    expect(html).toContain('value="Analista SQL"');
    expect(html).toContain("Consultas e modelagem.");
    expect(html).toContain("# Analista\n\nResponda com SQL.");
    expect(html).toContain("sql, consulta");
    // The id, the default model and the inheritance are not shown: nothing on the screen acts on them.
    expect(html).not.toMatch(/Default model|Inherits from|<dl/);
  });

  it("says where an edited prompt takes effect", () => {
    expect(form()).toMatch(/already spoke keeps the prompt it was given/);
  });

  it("saves only when something changed and nothing is wrong", () => {
    expect(form()).toMatch(/<button type="submit"[^>]*disabled=""/);
    const changed = { ...draftFromPersona(persona), name: "Analista de Dados" };
    expect(form({ draft: changed })).not.toMatch(/<button type="submit"[^>]*disabled=""/);
    const wrong = { ...draftFromPersona(persona), prompt: "" };
    const html = form({ draft: wrong });
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""/);
    expect(html).toMatch(/prompt cannot be empty/);
  });

  it("shows the Core's refusal, and a save in flight", () => {
    expect(form({ state: "error", message: "This persona changed in Mirror after it was opened. Reopen it and try again." }))
      .toContain('role="alert"');
    expect(form({ state: "saving", draft: { ...draftFromPersona(persona), name: "X" } })).toContain("Saving…");
  });
});

describe("CR217: the edit goes through the Core, never the identity table", () => {
  it("is wired from the native commands to the screen", () => {
    expect(mainSource).toContain("persona_admin::read_persona,");
    expect(mainSource).toContain("persona_admin::update_persona,");
    expect(storageSource).toContain('invoke<unknown>("read_persona"');
    expect(storageSource).toContain('invoke<unknown>("update_persona"');
    expect(appSource).toContain("<PersonaOpenerContext.Provider value={openPersona}>");
    expect(appSource).toContain("setPersonaNames((current) => namesAfterSave(current, saved))");
  });
});
