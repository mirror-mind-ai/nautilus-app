import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import screenSource from "../app/PersonaScreen.tsx?raw";
import { PersonaForm } from "../app/PersonaScreen";
import { draftFromPersona, type Persona } from "../domain/personaEditing";

const persona: Persona = { id: "coach", name: "Coach", description: null, prompt: "# Coach", routingKeywords: [], updatedAt: "t" };

function form(overrides: Partial<Parameters<typeof PersonaForm>[0]> = {}) {
  return renderToStaticMarkup(
    <PersonaForm
      persona={persona}
      draft={draftFromPersona(persona)}
      state="idle"
      onDraft={() => {}}
      onSave={() => {}}
      onClose={() => {}}
      onChooseImage={() => {}}
      onRemoveImage={() => {}}
      {...overrides}
    />,
  );
}

describe("CR224: a persona's image says it was saved, where it was chosen", () => {
  it("says Image saved. beside the image buttons, and leaves Save as it was", () => {
    const html = form({ imageSaved: true });
    expect(html).toMatch(/<p class="persona-image-saved" role="status">Image saved\.<\/p>/);
    expect(html.indexOf("Image saved.")).toBeLessThan(html.indexOf("<label>Name"));
    expect(html).toMatch(/<button type="submit" disabled="">Save<\/button>/);
    expect(form()).not.toContain("Image saved.");
  });

  it("says a refusal instead, never both", () => {
    const html = form({ imageSaved: true, imageMessage: "Only PNG, JPEG, and WebP images are supported." });
    expect(html).toContain("Only PNG, JPEG, and WebP images are supported.");
    expect(html).not.toContain("Image saved.");
  });

  it("is said after a choice or a removal, not after a closed dialog, and leaves on the next edit or image action", () => {
    const change = screenSource.slice(screenSource.indexOf("const changeImage"), screenSource.indexOf("const [persona, setPersona]"));
    expect(change).toContain("setImageSaved(false);");
    expect(change).toMatch(/if \(next !== null\) \{\s*onImageChanged\(personaId, next\);\s*setImageSaved\(true\);/);
    expect(screenSource).toMatch(/onDraft=\{\(next\) => \{\s*setImageSaved\(false\);/);
    expect(screenSource).toContain("imageSaved={imageSaved}");
  });
});
