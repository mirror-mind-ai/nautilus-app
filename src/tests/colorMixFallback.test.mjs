import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import postcss from "postcss";
import colorMixFallback, { withoutColorMix } from "../../scripts/postcss_color_mix_fallback.mjs";

const run = (css) => postcss([colorMixFallback()]).process(css, { from: undefined }).css;
const squash = (css) => css.replace(/\s+/g, " ").trim();

// CR281: WebKit 15 (macOS 12 until Safari is updated) does not know color-mix(). It drops the whole
// declaration, and a surface whose only `background` was a mix is drawn with none: the update panel
// showed the sidebar through its text. Each declaration with a mix gets one before it that does not.
describe("color-mix fallback", () => {
  it("puts the dominant colour of each mix before the declaration that uses it", () => {
    const out = run(".a { background: color-mix(in srgb, var(--shell-middle) 96%, #000000 4%); }");
    expect(squash(out)).toBe(".a { background: var(--shell-middle); background: color-mix(in srgb, var(--shell-middle) 96%, #000000 4%); }");
  });

  it("reads a tint over nothing as nothing, and an unmarked pair as half and half", () => {
    expect(withoutColorMix("color-mix(in srgb, var(--accent) 18%, transparent)")).toBe("transparent");
    expect(withoutColorMix("color-mix(in srgb, var(--accent) 50%, rgba(255, 255, 255, 0.08))")).toBe("var(--accent)");
    expect(withoutColorMix("color-mix(in srgb, var(--a), var(--b))")).toBe("var(--a)");
    expect(withoutColorMix("color-mix(in srgb, var(--a) 30%, var(--b))")).toBe("var(--b)");
    expect(withoutColorMix("color-mix(in srgb, 70% var(--a), var(--b))")).toBe("var(--a)");
    expect(withoutColorMix("color-mix(in srgb, var(--a) 10%, var(--b) 30%)")).toBe("var(--b)");
  });

  it("replaces every mix in a value, inside gradients and shadows, and nested ones", () => {
    expect(withoutColorMix("linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--light-surface)), rgba(255, 255, 255, 0.05))"))
      .toBe("linear-gradient(135deg, var(--light-surface), rgba(255, 255, 255, 0.05))");
    expect(withoutColorMix("0 0 0 1px color-mix(in srgb, var(--a) 20%, transparent), 0 4px 12px color-mix(in srgb, var(--b) 80%, black)"))
      .toBe("0 0 0 1px transparent, 0 4px 12px var(--b)");
    expect(withoutColorMix("color-mix(in srgb, color-mix(in srgb, var(--a) 90%, white) 60%, var(--b))")).toBe("var(--a)");
  });

  it("leaves alone a declaration that already has a plain one before it", () => {
    const css = ".a { background: var(--surface); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }";
    expect(run(css)).toBe(css);
    expect(run(run(".a { border: 1px solid color-mix(in srgb, var(--x) 30%, transparent); }"))).toBe(run(".a { border: 1px solid color-mix(in srgb, var(--x) 30%, transparent); }"));
  });

  it("does not take a plain declaration of another property, or one after it, for a fallback", () => {
    const css = ".a { color: red; background: color-mix(in srgb, var(--x) 80%, black); background-color: blue; }";
    expect(squash(run(css))).toBe(".a { color: red; background: var(--x); background: color-mix(in srgb, var(--x) 80%, black); background-color: blue; }");
  });

  it("does not touch custom properties or a mix it cannot read", () => {
    const custom = ":root { --p-hover: color-mix(in srgb, var(--a) 20%, transparent); }";
    expect(run(custom)).toBe(custom);
    const odd = ".a { background: color-mix(in srgb, var(--a) 20%); }";
    expect(run(odd)).toBe(odd);
    expect(withoutColorMix("color-mix(in srgb, var(--a) 20%)")).toBeNull();
  });

  it("is registered for the build, which is where macOS 12 meets it", () => {
    expect(readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8")).toContain("colorMixFallback");
  });

  it("covers every declaration of the app's stylesheets that uses a mix", () => {
    const folder = new URL("../styles/", import.meta.url);
    const bare = [];
    for (const name of readdirSync(folder).filter((file) => file.endsWith(".css"))) {
      const root = postcss.parse(run(readFileSync(new URL(name, folder), "utf8")));
      root.walkDecls((decl) => {
        if (decl.prop.startsWith("--") || !decl.value.includes("color-mix(")) return;
        let earlier = decl.prev();
        let plain = false;
        while (earlier) {
          if (earlier.type === "decl" && earlier.prop.toLowerCase() === decl.prop.toLowerCase() && !earlier.value.includes("color-mix(")) plain = true;
          earlier = earlier.prev();
        }
        if (!plain) bare.push(`${name}: ${decl.parent.selector ?? "?"} { ${decl.prop} }`);
      });
    }
    expect(bare).toEqual([]);
  });
});
