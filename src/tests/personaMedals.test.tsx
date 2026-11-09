import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { builtInPersonaMedal, MEDAL_IDS } from "../app/personaMedals";
import { PersonaForm } from "../app/PersonaScreen";
import { draftFromPersona, type Persona } from "../domain/personaEditing";
import nativeSource from "../../src-tauri/src/main.rs?raw";

const persona: Persona = { id: "engineer", name: "Engineer", description: null, prompt: "p", routingKeywords: [], updatedAt: "t" };

describe("chosen medal defaults", () => {
  it("only serves bundled known ids; unknown personas retain the diamond", () => {
    expect(MEDAL_IDS).toHaveLength(23);
    expect(builtInPersonaMedal("engineer")).toBe("/persona-medals/engineer.png");
    expect(builtInPersonaMedal("../secrets")).toBeUndefined();
    expect(builtInPersonaMedal("new-persona")).toBeUndefined();
    expect(nativeSource).toContain("choose_persona_medal,");
  });
  it("offers the built-in gallery without mistaking a default for a removable custom image", () => {
    const form = (image?: string) => renderToStaticMarkup(<PersonaForm persona={persona} draft={draftFromPersona(persona)} state="idle" onDraft={() => {}} onSave={() => {}} onClose={() => {}} onChooseImage={() => {}} onRemoveImage={() => {}} onChooseMedal={() => {}} image={image} />);
    expect(form()).toContain('/persona-medals/engineer.png');
    expect(form()).toContain('aria-label="Choose Coach medal"');
    expect(form()).toMatch(/>Remove image<\/button>/);
    expect(form()).toMatch(/disabled=""[^>]*>Remove image/);
    expect(form("data:image/png;base64,AAAA")).toContain("Replace image…");
  });
});
