import { describe, expect, it } from "vitest";
import { parseJourneyAppearanceById, sanitizeJourneyAppearanceById } from "../domain/journeyAppearance";
import type { JourneyRegistry } from "../domain/journeyRegistry";
import appSource from "../app/App.tsx?raw";
import nativeSource from "../../src-tauri/src/journey_appearance.rs?raw";

// CR302: a Journey may have a custom image however many other Journeys have one. The old caps (32
// custom images, 256 entries) were written in four places, and the parser's copy discarded the whole
// preferences file, so the rule is tested at each of them.

const many = (count: number, appearance: unknown) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`journey-${index}`, appearance]));

describe("CR302: no count of Journey images or appearance choices", () => {
  it("reads a saved appearance map with more than 32 custom images and more than 256 entries", () => {
    expect(Object.keys(parseJourneyAppearanceById(many(40, { kind: "custom" })) ?? {})).toHaveLength(40);
    expect(Object.keys(parseJourneyAppearanceById(many(300, { kind: "system", icon: "book" })) ?? {})).toHaveLength(300);
    const mixed = { ...many(100, { kind: "custom" }), ...Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`icon-${index}`, { kind: "system", icon: "leaf" }])) };
    expect(Object.keys(parseJourneyAppearanceById(mixed) ?? {})).toHaveLength(300);
  });

  it("still checks every entry, however many there are", () => {
    expect(parseJourneyAppearanceById({ ...many(300, { kind: "custom" }), "../escape": { kind: "custom" } })).toBeUndefined();
    expect(parseJourneyAppearanceById({ ...many(300, { kind: "custom" }), bad: { kind: "custom", path: "/tmp/a.png" } })).toBeUndefined();
    expect(parseJourneyAppearanceById({ ...many(300, { kind: "custom" }), bad: { kind: "system", icon: "arbitrary" } })).toBeUndefined();
  });

  it("keeps the map bounded by the Journeys that exist", () => {
    const registry: JourneyRegistry = {
      schemaVersion: "0.2.0", source: "mirror", sourceVersion: "a".repeat(64), syncedAt: "now",
      roots: [{ id: "journey-1", name: "One" }],
    };
    expect(Object.keys(sanitizeJourneyAppearanceById(many(300, { kind: "custom" }) as never, registry))).toEqual(["journey-1"]);
  });

  it("refuses nothing in the renderer on a count", () => {
    expect(appSource).not.toContain("At most 32 Journeys");
    expect(appSource).not.toContain("At most 256 Journey appearance");
    expect(appSource).not.toMatch(/customCount >= \d+/);
    expect(appSource).not.toMatch(/Object\.keys\(journeyAppearanceById\)\.length >= \d+/);
  });

  it("refuses nothing in the native import on a count, and keeps the protections of the file", () => {
    const journeyImport = nativeSource.slice(nativeSource.indexOf("fn import_at("), nativeSource.indexOf("pub fn import_journey_custom_image"));
    expect(journeyImport).not.toContain("MAX_CUSTOM_IMAGES");
    expect(journeyImport).not.toContain("At most");
    expect(nativeSource).not.toContain("MAX_CUSTOM_IMAGES");
    expect(nativeSource).toContain("MAX_SOURCE_BYTES: u64 = 5 * 1024 * 1024");
    expect(nativeSource).toContain("MAX_NORMALIZED_BYTES: usize = 2 * 1024 * 1024");
  });
});
