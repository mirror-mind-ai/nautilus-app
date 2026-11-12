import { describe, expect, it } from "vitest";
import { inferMessageSpeaker, stripMessageSpeakerSignature } from "../app/conversationPresentation";

// CR253: a reply with no Mirror context imitated the signature of earlier turns on its last line,
// after the text. The signature is the runtime's to name; on the text it is noise.
describe("CR253: a signature written on the answer's own line", () => {
  const content = "É uma imagem do código de barras **ISBN 978-65-02-40807-0**, identificador de um livro. ◇ escritora";

  it("is taken off the text", () => {
    expect(stripMessageSpeakerSignature(content)).toBe("É uma imagem do código de barras **ISBN 978-65-02-40807-0**, identificador de um livro.");
  });

  it("names no persona, since the runtime did not", () => {
    expect(inferMessageSpeaker({ role: "assistant", content }).kind).toBe("agent");
  });

  it("leaves a diamond the sentence itself uses alone", () => {
    for (const text of ["O losango ◇ marca a persona no fim.", "Usei o ◇ como marcador no fim ◇ ai-engineer"]) {
      expect(stripMessageSpeakerSignature(text)).toBe(text);
    }
  });

  it("is taken off after a question or a bold close too", () => {
    expect(stripMessageSpeakerSignature("Qual livro? ◇ escritora")).toBe("Qual livro?");
    expect(stripMessageSpeakerSignature("É o **ISBN** ◇ escritora")).toBe("É o **ISBN** ◇ escritora");
    expect(stripMessageSpeakerSignature("É o **ISBN**. ◇ escritora")).toBe("É o **ISBN**.");
  });
});
