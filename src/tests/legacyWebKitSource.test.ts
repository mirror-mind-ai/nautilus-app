// @ts-expect-error Vitest runs in Node; production frontend has no Node dependency.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The app draws its window with the system WebKit, not with Safari. On macOS 12 and early 13 that
// is a Safari 15 era engine, and a regular expression it cannot parse is thrown when the module
// loads: React never mounts and the window stays black, with nothing in any log. CR253 put a
// lookbehind in conversationPresentation.ts, out of reach of the check that only read
// LinkifiedText.tsx, and alpha.20 opened black on a Monterey Mac. Lookbehind needs WebKit 16.4.
const sourceRoot = new URL("../", import.meta.url);

function frontendSources(directory: URL): string[] {
  return readdirSync(directory).flatMap((name: string) => {
    const path = new URL(name, directory);
    if (statSync(path).isDirectory()) return name === "tests" ? [] : frontendSources(new URL(`${name}/`, directory));
    return /\.tsx?$/.test(name) ? [path.pathname] : [];
  });
}

describe("the frontend source stays parseable by the WebKit macOS 12 ships", () => {
  const files = frontendSources(sourceRoot);

  it("reads the whole frontend, not one file", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((file) => file.endsWith("/app/conversationPresentation.ts"))).toBe(true);
  });

  it("uses no regular expression lookbehind", () => {
    const offenders = files.filter((file) => /\(\?<[=!]/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  // The declared floor is macOS 12.0 (config/runtime-compatibility.json), whose WebKit is 15.0 until
  // Safari is updated. These arrived later and throw where they run, not when the module loads.
  it("calls no built-in the WebKit of macOS 12.0 lacks", () => {
    const newer: Array<[string, RegExp]> = [
      ["Array/String.prototype.at (15.4)", /\.at\(/],
      ["Object.hasOwn (15.4)", /Object\.hasOwn\(/],
      ["structuredClone (15.4)", /\bstructuredClone\(/],
      ["findLast / findLastIndex (15.4)", /\.findLast(Index)?\(/],
      ["change-array-by-copy (16)", /\.(toSorted|toReversed|toSpliced)\(/],
      ["Promise.withResolvers (17.4)", /Promise\.withResolvers\(/],
      ["Object.groupBy / Map.groupBy (17.4)", /\b(Object|Map)\.groupBy\(/],
      ["AbortSignal.timeout / any (16 / 17.4)", /AbortSignal\.(timeout|any)\(/],
    ];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return newer.filter(([, pattern]) => pattern.test(source)).map(([name]) => `${file.replace(/.*\/src\//, "src/")}: ${name}`);
    });
    expect(offenders).toEqual([]);
  });

  it("builds the bundle for that WebKit, not for Vite's default", () => {
    const config = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    expect(config).toMatch(/target:\s*"safari15"/);
  });
});
