import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { builtInPersonaMedal, MEDAL_IDS } from "../app/personaMedals";
import { PersonaForm } from "../app/PersonaScreen";
import { draftFromPersona, type Persona } from "../domain/personaEditing";
import { PersonaSidebarSection } from "../app/PersonaSidebarSection";
import { Speech } from "../app/Speech";
import { PersonaImagesContext } from "../app/personaImageContext";
import { personaSpeaker } from "../app/conversationPresentation";
import nativeSource from "../../src-tauri/src/main.rs?raw";

const persona: Persona = { id: "engineer", name: "Engineer", description: null, prompt: "p", routingKeywords: [], updatedAt: "t" };

describe("CR235: medals are chosen, never inferred from an id", () => {
  it("only serves bundled known ids; unknown personas retain the diamond", () => {
    expect(MEDAL_IDS).toHaveLength(23);
    expect(builtInPersonaMedal("engineer")).toBe("/persona-medals/engineer.png");
    expect(builtInPersonaMedal("../secrets")).toBeUndefined();
    expect(builtInPersonaMedal("new-persona")).toBeUndefined();
    expect(nativeSource).toContain("choose_persona_medal,");
  });
  it("keeps the gallery but previews only a saved image, including a chosen medal", () => {
    const form = (image?: string) => renderToStaticMarkup(<PersonaForm persona={persona} draft={draftFromPersona(persona)} state="idle" onDraft={() => {}} onSave={() => {}} onClose={() => {}} onChooseImage={() => {}} onRemoveImage={() => {}} onChooseMedal={() => {}} image={image} />);
    expect(form()).not.toContain('alt="The image of Engineer"');
    expect(form()).toContain('aria-hidden="true">◇');
    expect(form()).toContain('/persona-medals/engineer.png');
    expect(form("data:image/png;base64,AAAA")).not.toMatch(/disabled=""[^>]*>Remove image/);
    expect(form("data:image/png;base64,AAAA")).toContain('src="data:image/png;base64,AAAA" alt="The image of Engineer"');
    expect(form()).toContain('aria-label="Choose Coach medal"');
    expect(form()).toMatch(/>Remove image<\/button>/);
    expect(form()).toMatch(/disabled=""[^>]*>Remove image/);
    expect(form("data:image/png;base64,AAAA")).toContain("Replace image…");
  });
  it("shows only saved images in the sidebar and speech, returning to the diamond after removal", () => {
    const sidebar = (images: Record<string, string>) => renderToStaticMarkup(<PersonaSidebarSection
      open compact={false} reading={{ state: "ready", personas: [persona] }} images={images}
      onToggle={() => {}} onOpenPersona={() => {}} onExpand={() => {}} onRetry={() => {}}
      onCreatePersona={() => {}} onDeletePersona={() => {}} />);
    const speaker = personaSpeaker({ role: "assistant", content: "Hello" }, "engineer", { engineer: "Engineer" });
    const speech = (images: Record<string, string>) => renderToStaticMarkup(<PersonaImagesContext.Provider value={images}>
      <Speech side="agent" speaker={speaker}>Hello</Speech></PersonaImagesContext.Provider>);
    for (const render of [sidebar, speech]) {
      expect(render({})).not.toContain('/persona-medals/');
      expect(render({ engineer: "data:image/png;base64,AAAA" })).toContain('src="data:image/png;base64,AAAA"');
      expect(render({})).toContain('◇');
    }
  });
});
