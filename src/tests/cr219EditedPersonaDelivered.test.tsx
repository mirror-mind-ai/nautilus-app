import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { PersonaForm } from "../app/PersonaScreen";
import { draftFromPersona, type Persona } from "../domain/personaEditing";

// CR219: the embedded Core delivers a persona again when its prompt changed (Core CR206,
// mirror-mind 0.43.0), so the persona screen no longer warns that an edit waits for compaction.

const pin = JSON.parse(readFileSync(new URL("../../mirror-host/pin.json", import.meta.url), "utf8"));

const persona: Persona = {
  id: "mentora", name: "Mentora", description: null, prompt: "p", routingKeywords: [], updatedAt: "t",
};

describe("CR219: an edited prompt reaches the open Conversation", () => {
  it("embeds a Core that carries Core CR206", () => {
    const [major, minor] = String(pin.core.version).split(".").map(Number);
    expect(major > 0 || minor >= 43, pin.core.version).toBe(true);
  });

  it("tells the Navigator the edit reaches every Conversation the next time the persona speaks, with no compaction caveat", () => {
    const html = renderToStaticMarkup(
      <PersonaForm
        persona={persona}
        draft={draftFromPersona(persona)}
        state="idle"
        onDraft={() => undefined}
        onSave={() => undefined}
        onClose={() => undefined}
        onChooseImage={() => undefined}
        onRemoveImage={() => undefined}
      />,
    );
    expect(html).toContain("A changed prompt reaches each Conversation the next time this persona speaks there, open ones included.");
    expect(html).not.toMatch(/compact/i);
  });
});
