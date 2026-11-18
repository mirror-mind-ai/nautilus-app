import { describe, expect, it } from "vitest";
import { dropMessageLifetimeMs, type JourneyDropMessage } from "../domain/journeyPointerDrag";
import appSource from "../app/App.tsx?raw";

describe("CR261: the sentence after a Journey drop goes away", () => {
  it("lets a confirmed move be read and then leave", () => {
    const lifetime = dropMessageLifetimeMs("move");
    expect(lifetime).toBeGreaterThanOrEqual(3000);
    expect(lifetime).toBeLessThanOrEqual(10000);
  });

  it("keeps a refusal longer than a confirmed move, because it asks for another try", () => {
    expect(dropMessageLifetimeMs("refused")!).toBeGreaterThan(dropMessageLifetimeMs("move")!);
  });

  it("never expires the wait, which ends only when Mirror answers", () => {
    expect(dropMessageLifetimeMs("moving")).toBeUndefined();
  });

  it("clears the message from the app when its lifetime ends, and not before it is replaced", () => {
    expect(appSource).toContain("dropMessageLifetimeMs(journeyDropMessage.kind)");
    expect(appSource).toContain("setJourneyDropMessage((current) => (current === journeyDropMessage ? undefined : current))");
  });

  it("types the message the app clears", () => {
    const message: JourneyDropMessage = { kind: "move", text: "Moved A into B." };
    expect(message.kind).toBe("move");
  });
});
