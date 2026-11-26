// @ts-expect-error Vitest runs in Node; production frontend has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import appSource from "../app/App.tsx?raw";
import { CompactionNotice } from "../app/CompactionNotice";
import type { ProjectedRuntimeOperation } from "../app/runtimeActivityModel";

// The sibling of legacyWebKitSource.test.ts, for the stylesheets. The app draws with the system WebKit,
// and the floor in config/runtime-compatibility.json is macOS 12.0, whose WebKit is 15.0 until Safari is
// updated. An engine drops a rule it cannot parse without a sound, so a stylesheet that leans on a
// construct that arrived later is not refused anywhere: the interface just changes there. CR281 found
// two container queries (WebKit 16.0) and two `:has()` rules (WebKit 15.4) still in that state.
const stylesheets = ["app.css", "presentation.css"].map((name) => ({
  name,
  source: withoutComments(readFileSync(new URL(`../styles/${name}`, import.meta.url), "utf8")),
}));

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// The text between the braces of the block whose opening brace is at `from`.
function braced(css: string, from: number): string {
  let depth = 0;
  for (let index = from; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}" && (depth -= 1) === 0) return css.slice(from + 1, index);
  }
  throw new Error("unbalanced braces");
}

function bodiesOf(css: string, opener: RegExp): string[] {
  return [...css.matchAll(new RegExp(opener.source, "g"))].map((match) => braced(css, (match.index ?? 0) + match[0].length - 1));
}

type Rule = { selector: string; declarations: string };

function rulesIn(body: string): Rule[] {
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, " "),
    declarations: match[2].trim().replace(/\s+/g, " "),
  }));
}

const CONTAINER = /@container [^{]*\{/;
const WITHOUT_CONTAINERS = /@supports not \(container-type: inline-size\) \{/;

describe("CR293: a container query has the answer the narrow form gives where the engine drops it", () => {
  it("finds the container queries the app has, so that the check below is never empty", () => {
    const found = stylesheets.flatMap((sheet) => bodiesOf(sheet.source, CONTAINER).flatMap(rulesIn));
    expect(found.map((rule) => rule.selector)).toEqual(expect.arrayContaining([
      ".journey-tree-tool-label",
      '.app-shell[data-application-layout="compact"]:not(.sidebar-compact) .journey-item.card-node .journey-last-worked',
    ]));
  });

  it("repeats each rule of a container query under @supports not, in the same stylesheet", () => {
    const missing: string[] = [];
    for (const sheet of stylesheets) {
      const fallback = bodiesOf(sheet.source, WITHOUT_CONTAINERS).flatMap(rulesIn);
      for (const rule of bodiesOf(sheet.source, CONTAINER).flatMap(rulesIn)) {
        const repeated = fallback.some((candidate) => candidate.selector === rule.selector && candidate.declarations === rule.declarations);
        if (!repeated) missing.push(`${sheet.name}: ${rule.selector} { ${rule.declarations} }`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the container query itself, so a current engine still shows the words above the threshold", () => {
    const app = stylesheets[0].source;
    expect(app).toMatch(/\.journey-tree-tools-slot \{[^}]*container-type: inline-size/);
    expect(app).toMatch(/@container \(max-width: 232px\) \{\s*\.journey-tree-tool-label \{\s*display: none;/);
  });
});

function operation(status: ProjectedRuntimeOperation["status"], output?: string): ProjectedRuntimeOperation {
  return {
    id: "manual-compaction",
    kind: "compaction",
    name: "Context compaction",
    status,
    arguments: { reason: "manual" },
    ...(output ? { output, isError: status === "failed" } : {}),
  };
}

describe("CR294: what :has() said is said with a class, which every engine reads", () => {
  it("uses no :has() in a stylesheet", () => {
    for (const sheet of stylesheets) {
      const offenders = sheet.source.split("\n").filter((line) => line.includes(":has("));
      expect(offenders, sheet.name).toEqual([]);
    }
  });

  it("widens the Journey menu through a class that the menu carries when it shows a reason", () => {
    expect(appSource).toMatch(/className=\{conversationChapters\.length === 0 \? "journey-menu has-reason" : "journey-menu"\}\s+role="menu"/);
    expect(stylesheets[0].source).toMatch(/\.journey-menu\.has-reason \{\s*min-width: 260px;\s*\}/);
  });

  it("puts a compaction notice's dismissal under its statement through a class the notice carries when it has one", () => {
    expect(stylesheets[0].source).toMatch(/\.compaction-notice\.has-dismiss \{\s*display: grid;\s*gap: 6px;\s*justify-items: end;\s*\}/);

    const dismissible = renderToStaticMarkup(<CompactionNotice operation={operation("failed", "Pi refused to compact")} onDismiss={vi.fn()} />);
    expect(dismissible).toMatch(/class="compaction-notice has-dismiss"/);

    const running = renderToStaticMarkup(<CompactionNotice operation={operation("running")} onDismiss={vi.fn()} />);
    expect(running).toMatch(/class="compaction-notice"/);
    expect(running).not.toContain("has-dismiss");
  });
});
