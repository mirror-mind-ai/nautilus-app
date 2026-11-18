// @ts-expect-error Vitest runs in Node; production frontend has no Node dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The native build writes and locks files under src-tauri/target while it compiles. When Vite
// watches them, the dev server stops on Windows with EBUSY and `npm run tauri:dev` never opens
// the window. Nothing under src-tauri is served by Vite on any platform.
describe("the dev server", () => {
  it("does not watch the native build's folder", () => {
    const config = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    expect(config).toMatch(/watch:\s*\{\s*ignored:\s*\[\s*"\*\*\/src-tauri\/\*\*"\s*\]\s*\}/);
  });
});
