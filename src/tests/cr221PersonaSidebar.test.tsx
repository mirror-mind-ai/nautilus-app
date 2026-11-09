// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import { PersonaSidebarSection } from "../app/PersonaSidebarSection";
import { contrastRatio } from "../app/personaColour";
import {
  filterPersonaList,
  personaListAfterSave,
  sanitizePersonaList,
  type PersonaListEntry,
} from "../domain/personaList";
import {
  createPersistedJourneyPreferences,
  defaultJourneyPreferenceState,
  parsePersistedJourneyPreferences,
} from "../domain/journeyPreferencePersistence";

const cssSource: string = readFileSync(new URL("../styles/app.css", import.meta.url), "utf8");

const coach: PersonaListEntry = { id: "coach", name: "Coach", description: "Goals and habits" };
const medica: PersonaListEntry = { id: "medica", name: "Médica", description: "Sintomas e tratamentos" };
const mentora: PersonaListEntry = { id: "mentora", name: "Mentora", description: null };
const marketeira: PersonaListEntry = { id: "marketeira", name: "Marketeira", description: "Copy de conversão para o blog" };
const unnamed: PersonaListEntry = { id: "zeta", name: null, description: null };

describe("CR221: the personas the Core lists", () => {
  it("keeps only well-formed entries, once each, sorted by the name a person reads", () => {
    const list = sanitizePersonaList([
      { id: "mentora", name: "Mentora", description: null },
      { id: "medica", name: " Médica ", description: "Sintomas e tratamentos" },
      { id: "marketeira", name: "Marketeira", description: "Copy de conversão para o blog" },
      { id: "zeta", name: "", description: "  " },
      { id: "coach", name: "Coach", description: "Goals and habits" },
      { id: "coach", name: "Twice", description: null },
      { id: "../private", name: "Escape", description: null },
      { id: "Coach", name: "Upper", description: null },
      { id: "x", name: 7, description: null },
      "coach",
      null,
    ]);
    // Accents do not move a name: Médica sits between Marketeira and Mentora. A persona with no
    // name is read, and sorted, by its id.
    expect(list).toEqual([coach, marketeira, medica, mentora, unnamed]);
  });

  it("orders two personas that differ only in case by their ids", () => {
    const list = sanitizePersonaList([
      { id: "b-ana", name: "ana", description: null },
      { id: "a-ana", name: "Ana", description: null },
    ]);
    expect(list.map((entry) => entry.id)).toEqual(["a-ana", "b-ana"]);
  });

  it("reads anything else as an empty list", () => {
    for (const answer of [undefined, null, {}, "coach", 3]) expect(sanitizePersonaList(answer)).toEqual([]);
  });

  it("filters by name, id and description, ignoring case and accents", () => {
    const list = [coach, marketeira, medica, mentora, unnamed];
    expect(filterPersonaList(list, "")).toEqual(list);
    expect(filterPersonaList(list, "   ")).toEqual(list);
    expect(filterPersonaList(list, "MEDICA")).toEqual([medica]);
    expect(filterPersonaList(list, "conversao")).toEqual([marketeira]);
    expect(filterPersonaList(list, "zet")).toEqual([unnamed]);
    expect(filterPersonaList(list, "ment")).toEqual([medica, mentora]);
    expect(filterPersonaList(list, "nobody")).toEqual([]);
  });

  it("renames a saved persona's row at once and keeps the order", () => {
    const list = [coach, marketeira, medica, mentora];
    expect(personaListAfterSave(list, { id: "coach", name: "Treinadora", description: null })).toEqual([
      marketeira,
      medica,
      mentora,
      { id: "coach", name: "Treinadora", description: null },
    ]);
    expect(personaListAfterSave(list, { id: "unknown", name: "New", description: null })).toBe(list);
  });
});

function section(overrides: Partial<Parameters<typeof PersonaSidebarSection>[0]> = {}) {
  return renderToStaticMarkup(
    <PersonaSidebarSection
      open={false}
      compact={false}
      reading={{ state: "ready", personas: [coach, medica, unnamed] }}
      images={{}}
      onToggle={() => undefined}
      onOpenPersona={() => undefined}
      onExpand={() => undefined}
      onRetry={() => undefined}
      {...overrides}
    />,
  );
}

describe("CR221: the Personas section", () => {
  it("is one line when closed: its name, its count, and nothing that creates", () => {
    const html = section();
    expect(html).toContain("Personas");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">3<");
    expect(html).not.toContain("persona-sidebar-row");
    expect(html).not.toContain("Filter personas");
    expect(html).not.toContain("＋");
    expect(html).not.toContain("New persona");
  });

  it("lists every persona when open, with its image or its colour, its name and its description", () => {
    const html = section({ open: true, images: { medica: "data:image/png;base64,AAAA" }, openPersonaId: "coach" });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('placeholder="Filter personas"');
    expect(html.match(/class="persona-sidebar-row/g)).toHaveLength(3);
    expect(html).toContain("<small>Goals and habits</small>");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain("--persona-hue");
    expect(html).toContain(">zeta<");
    // The row of the persona whose screen is open stays marked.
    expect(html).toMatch(/class="persona-sidebar-row is-open"[^>]*aria-current="true"[^>]*>(?:(?!<\/button>).)*Coach/);
    // CR222 brings the ＋; until then nothing in the section creates.
    expect(html).not.toContain("New persona");
  });

  it("says why it is empty, and lets a failed reading be tried again", () => {
    expect(section({ open: true, reading: { state: "loading", personas: [] } })).toContain("Reading the personas from Mirror");
    const failed = section({ open: true, reading: { state: "error", personas: [], message: "Mirror is busy." } });
    expect(failed).toContain("Mirror is busy.");
    expect(failed).toContain("Try again");
    expect(section({ open: true, reading: { state: "ready", personas: [] } })).toContain("Mirror keeps no personas yet");
  });

  it("is one ◇ with the count in the compact sidebar, which expands the sidebar on the section", () => {
    const html = section({ compact: true });
    expect(html).toContain('aria-label="Show the 3 personas"');
    expect(html).toContain("◇");
    expect(html).not.toContain("persona-sidebar-row");
  });

  it("sits under the Journeys and reads its list from the Core through the host", () => {
    expect(appSource.indexOf("<PersonaSidebarSection")).toBeGreaterThan(appSource.indexOf('className={`journey-list'));
    expect(appSource).toContain("loadPersonaList()");
    // A saved persona renames its row at once.
    expect(appSource).toContain("personaListAfterSave(");
  });
});

describe("CR221: the section's open state is a remembered preference", () => {
  it("is closed by default, kept when saved, and a bad value costs nothing else", () => {
    expect(defaultJourneyPreferenceState.personasSectionOpen).toBe(false);
    const saved = createPersistedJourneyPreferences({ ...defaultJourneyPreferenceState, personasSectionOpen: true, pinnedJourneyIds: ["a"] });
    expect(parsePersistedJourneyPreferences(JSON.parse(JSON.stringify(saved)))?.preferences.personasSectionOpen).toBe(true);
    const bad = { ...saved, preferences: { ...saved.preferences, personasSectionOpen: "yes" } };
    const parsed = parsePersistedJourneyPreferences(bad);
    expect(parsed?.preferences.personasSectionOpen).toBe(false);
    expect(parsed?.preferences.pinnedJourneyIds).toEqual(["a"]);
  });
});

function themeToken(theme: string, token: string): string {
  const block = cssSource.slice(cssSource.indexOf(`.app-shell[data-application-theme="${theme}"] {`));
  const value = block.slice(0, block.indexOf("}")).match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${theme} has no ${token}`);
  return value;
}

function opaque(colour: string): string {
  if (colour.startsWith("#")) return colour;
  const [r, g, b] = colour.match(/\d+(?:\.\d+)?/g)!.map(Number);
  return `#${[r, g, b].map((channel) => Math.round(channel!).toString(16).padStart(2, "0")).join("")}`;
}

function mix(left: string, right: string, leftShare: number): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const [a, b] = [channels(left), channels(right)];
  return `#${a.map((value, index) => Math.round(value * leftShare + b[index]! * (1 - leftShare)).toString(16).padStart(2, "0")).join("")}`;
}

describe("CR221: every text in the section reads at 4.5:1 in the light themes", () => {
  it("holds for the description line, the quietest ink, on the sidebar and on a hovered row", () => {
    const rule = cssSource.slice(cssSource.indexOf("/* CR221: the light themes. */"));
    const share = Number(rule.match(/--persona-sidebar-quiet:\s*color-mix\(in srgb, var\(--light-text\) (\d+)%, var\(--light-muted\)\)/)?.[1]);
    expect(share).toBeGreaterThan(0);
    for (const theme of ["daylight", "mist", "parchment"]) {
      const quiet = mix(themeToken(theme, "--light-text"), themeToken(theme, "--light-muted"), share / 100);
      for (const surface of [opaque(themeToken(theme, "--sidebar-surface")), themeToken(theme, "--light-raised"), themeToken(theme, "--light-surface")]) {
        expect(contrastRatio(quiet, surface), `${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
