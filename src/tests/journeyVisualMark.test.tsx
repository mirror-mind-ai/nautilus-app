import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JourneyVisualMark } from "../app/JourneyVisualMark";
import storageSource from "../app/journeyAppearanceStorage.ts?raw";
import nativeSource from "../../src-tauri/src/journey_appearance.rs?raw";
import tauriMainSource from "../../src-tauri/src/main.rs?raw";
// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";

const appStyles = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8") as string;


describe("Journey visual mark", () => {
  it("renders curated system appearance without duplicating agent status", () => {
    const html = renderToStaticMarkup(
      <JourneyVisualMark
        journeyId="journey-one"
        appearance={{ kind: "system", icon: "book" }}
        fallbackGlyph="•"
      />,
    );
    expect(html).toContain("▤");
    expect(html).not.toContain("data-runtime-phase");
    expect(html).not.toContain("journey-visual-activity");
  });

  it("leaves the surface behind a custom image to the stylesheet, not to an inline colour", () => {
    // CR269: an inline `#101719` painted every transparent icon black, in the light themes too.
    const html = renderToStaticMarkup(
      <JourneyVisualMark journeyId="journey-one" appearance={{ kind: "custom" }} fallbackGlyph="•" />,
    );
    expect(html).toContain("journey-visual-mark custom");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("#101719");
  });

  it("shows transparent custom pixels over a neutral surface that follows the theme family", () => {
    const rule = (selector: string) => {
      const start = appStyles.indexOf(selector);
      expect(start, `${selector} is in the stylesheet`).toBeGreaterThan(-1);
      return appStyles.slice(start, appStyles.indexOf("}", start));
    };
    const dark = rule(".journey-visual-mark.custom {");
    expect(dark).toContain("background-color: #101719");
    expect(dark).toContain("border-color: rgba(255, 255, 255, 0.16)");
    const light = rule(".journey-visual-mark.custom {\n  background-color: var(--light-surface)");
    expect(light).toContain("border-color: var(--light-border)");
    // The three light themes share the one rule, so none of them keeps the dark surface.
    const before = appStyles.slice(0, appStyles.indexOf(".journey-visual-mark.custom {\n  background-color: var(--light-surface)"));
    const selectorList = before.slice(before.lastIndexOf(":is("));
    for (const theme of ["daylight", "mist", "parchment"]) {
      expect(selectorList).toContain(`[data-application-theme="${theme}"]`);
    }
  });

  it("keeps external paths out of the frontend overlay boundary", () => {
    expect(storageSource).toContain('invoke<string | null>("import_journey_custom_image", { journeyId })');
    // CR218: the PNG data URL rule moved to `domain/imageDataUrl.ts`, shared with the persona images.
    expect(storageSource).toContain("validatePngDataUrl");
    expect(storageSource).not.toContain("sourcePath");
  });

  it("normalizes only approved formats into app-controlled square PNG files", () => {
    expect(nativeSource).toContain("MAX_SOURCE_BYTES: u64 = 5 * 1024 * 1024");
    expect(nativeSource).toContain("ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP");
    expect(nativeSource).toContain("resize_to_fill(IMAGE_SIZE, IMAGE_SIZE");
    expect(nativeSource).toContain('const IMAGE_SIZE: u32 = 512');
    expect(nativeSource).toContain('const APPEARANCE_DIRECTORY: &str = "journey-appearance"');
    expect(nativeSource).toContain("MAX_CUSTOM_IMAGES: usize = 32");
    expect(tauriMainSource).toContain("import_journey_custom_image");
    expect(tauriMainSource).toContain("load_journey_custom_image");
    expect(tauriMainSource).toContain("remove_journey_custom_image");
  });
});
