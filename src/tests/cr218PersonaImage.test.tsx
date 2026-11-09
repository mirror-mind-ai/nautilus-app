import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { personaSpeaker } from "../app/conversationPresentation";
import { PersonaForm } from "../app/PersonaScreen";
import { PersonaImagesContext } from "../app/personaImageContext";
import { Speech } from "../app/Speech";
import { MessageSpeakerAvatar } from "../app/UserAvatar";
import appSource from "../app/App.tsx?raw";
import storageSource from "../app/personaImageStorage.ts?raw";
import mainSource from "../../src-tauri/src/main.rs?raw";
import { draftFromPersona, type Persona } from "../domain/personaEditing";
import { imagesAfterChange, sanitizePersonaImages } from "../domain/personaImages";

// CR218: a persona's image is kept by Nautilus, per home, like a Journey's. It is chosen on the
// persona's screen (CR217) and shown where the ◇ stood beside its words.

const IMAGE = "data:image/png;base64,iVBORw0KGgo=";
const OTHER = "data:image/png;base64,AAAA";
const speaker = personaSpeaker({ role: "assistant", content: "Feito." }, "analista-sql", { "analista-sql": "Analista SQL" });

const speech = (images: Record<string, string>) => renderToStaticMarkup(
  <PersonaImagesContext.Provider value={images}>
    <Speech side="agent" speaker={speaker}>Feito.</Speech>
  </PersonaImagesContext.Provider>,
);

describe("CR218: the images the native side answers", () => {
  it("keeps a PNG data URL by persona id, and drops anything else", () => {
    expect(sanitizePersonaImages({ "analista-sql": IMAGE, mentora: OTHER })).toEqual({ "analista-sql": IMAGE, mentora: OTHER });
    expect(sanitizePersonaImages({
      "Bad_Id": IMAGE,
      mentora: "data:image/svg+xml;base64,AAAA",
      outra: "javascript:alert(1)",
      longa: `data:image/png;base64,${"A".repeat(2_800_000)}`,
      numero: 7,
    })).toEqual({});
    for (const refused of [null, [], "x", 3]) expect(sanitizePersonaImages(refused)).toEqual({});
  });

  it("a chosen image replaces the persona's, and a removed one leaves the others", () => {
    const images = { "analista-sql": IMAGE, mentora: OTHER };
    expect(imagesAfterChange(images, "analista-sql", OTHER)).toEqual({ "analista-sql": OTHER, mentora: OTHER });
    expect(imagesAfterChange(images, "analista-sql", undefined)).toEqual({ mentora: OTHER });
  });
});

describe("CR218: the persona speaks behind its image", () => {
  it("shows the persona's image where the ◇ stood", () => {
    const html = speech({ "analista-sql": IMAGE });
    expect(html).toContain('class="message-avatar speech-avatar has-custom-persona-image"');
    expect(html).toContain(`<img src="${IMAGE}" alt=""/>`);
    expect(html).not.toContain(">◇<");
  });

  it("keeps the ◇ without an image, and never shows another persona's", () => {
    expect(speech({})).toContain(">◇<");
    expect(speech({ mentora: IMAGE })).toContain(">◇<");
  });

  it("never puts a persona's image on the agent or the Navigator", () => {
    const agent = renderToStaticMarkup(
      <PersonaImagesContext.Provider value={{ "analista-sql": IMAGE }}>
        <Speech side="agent" speaker={{ label: "Agent", avatar: "π", kind: "agent", personaId: "analista-sql" }}>x</Speech>
      </PersonaImagesContext.Provider>,
    );
    expect(agent).not.toContain("<img");
    for (const speakerKind of ["agent", "user"] as const) {
      expect(renderToStaticMarkup(<MessageSpeakerAvatar speakerKind={speakerKind} fallback="π" personaImage={IMAGE} />)).not.toContain(IMAGE);
    }
  });
});

describe("CR218: the image is chosen on the persona's screen", () => {
  const persona: Persona = {
    id: "analista-sql", name: "Analista SQL", description: null, prompt: "p", routingKeywords: [], updatedAt: "t",
  };
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

  it("offers a choice without an image, and a replacement and a removal with one", () => {
    const without = form();
    expect(without).toContain("Choose image…");
    expect(without).toMatch(/<button[^>]*disabled=""[^>]*>Remove image<\/button>/);
    expect(without).toContain(">◇<");
    const withImage = form({ image: IMAGE });
    expect(withImage).toContain("Replace image…");
    expect(withImage).toMatch(/<button[^>]*type="button"[^>]*>Remove image<\/button>/);
    expect(withImage).not.toMatch(/disabled=""[^>]*>Remove image/);
    expect(withImage).toContain(`<img src="${IMAGE}" alt="The image of Analista SQL"/>`);
  });

  it("says the image stays on this device, and shows an import in flight and its refusal", () => {
    expect(form()).toMatch(/Kept on this device/);
    // CR224: the rule, said before the gesture.
    expect(form()).toContain("Kept on this device, not in Mirror. Saved as soon as you choose it, apart from the Save below.");
    expect(form({ imageBusy: true })).toContain("Importing…");
    expect(form({ imageMessage: "Only PNG, JPEG, and WebP images are supported." })).toContain("Only PNG, JPEG, and WebP images are supported.");
  });
});

describe("CR218: wired from the native side to every bubble", () => {
  it("registers the commands and provides the images", () => {
    for (const command of ["import_persona_image,", "load_persona_images,", "remove_persona_image,"]) {
      expect(mainSource).toContain(command);
    }
    expect(storageSource).toContain('invoke<string | null>("import_persona_image"');
    expect(storageSource).toContain('invoke<unknown>("load_persona_images"');
    expect(storageSource).toContain('invoke("remove_persona_image"');
    expect(appSource).toContain("<PersonaImagesContext.Provider value={personaImages}>");
    expect(appSource).toContain("setPersonaImages((current) => imagesAfterChange(current, personaId, image))");
  });
});
