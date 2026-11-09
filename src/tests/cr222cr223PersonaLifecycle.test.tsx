// @ts-expect-error Vitest runs in Node; production code has no Node dependency.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import appSource from "../app/App.tsx?raw";
import { PersonaDeletionList } from "../app/PersonaDeletionDialog";
import { NewPersonaForm, PersonaForm } from "../app/PersonaScreen";
import { PersonaRowMenu, PersonaSidebarSection } from "../app/PersonaSidebarSection";
import storageSource from "../app/personaStorage.ts?raw";
import { draftFromPersona, type Persona } from "../domain/personaEditing";
import {
  newPersonaDraft,
  newPersonaDraftWithId,
  newPersonaDraftWithName,
  PERSONA_DELETION_CHANGED,
  personaCreation,
  personaCreationProblem,
  personaDeletionRefusal,
  personaDeletionSummary,
  personaIdFromName,
  personaListAfterCreate,
  personaListAfterDelete,
  sanitizePersonaDeletionPreview,
  type PersonaDeletionPreview,
} from "../domain/personaLifecycle";
import type { PersonaListEntry } from "../domain/personaList";

const rustSource: string = readFileSync(new URL("../../src-tauri/src/persona_admin.rs", import.meta.url), "utf8");
const hostSource: string = readFileSync(new URL("../../mirror-host/host.mjs", import.meta.url), "utf8");
const pin = JSON.parse(readFileSync(new URL("../../mirror-host/pin.json", import.meta.url), "utf8"));

const coach: PersonaListEntry = { id: "coach", name: "Coach", description: "Goals" };
const writer: PersonaListEntry = { id: "writer", name: "Writer", description: null };

const preview = (overrides: Partial<PersonaDeletionPreview> = {}): PersonaDeletionPreview => ({
  persona: "gardener",
  heirs: [],
  kept: { conversations: 3, memories: 1, runtime_sessions: 0 },
  deleted: { descriptors: 1, identity_integrations: 0, extension_bindings: 2 },
  cleared: { journey_defaults: ["allotment"], sticky_default: true },
  digest: "a".repeat(64),
  image: true,
  ...overrides,
});

describe("CR222: the Core that creates and deletes a persona", () => {
  it("embeds mirror-mind 0.44.0, the release of Core CR207", () => {
    expect(pin.core.version).toBe("0.44.0");
    expect(pin.core.release).toBe("v0.44.0");
    expect(pin.core.tarball).toBe("vendor/mirror-host/mirror-mind-0.44.0.tgz");
  });

  it("lets the host call createPersona, previewPersonaDeletion and deletePersona", () => {
    expect(hostSource).toContain("createPersona: (d, p) => d.createPersona(p.dbPath, p.request)");
    expect(hostSource).toContain("previewPersonaDeletion: (d, p) => d.previewPersonaDeletion(p.dbPath, p.request)");
    expect(hostSource).toContain("deletePersona: (d, p) => d.deletePersona(p.dbPath, p.request)");
  });
});

describe("CR222: a new persona's id and fields", () => {
  it("proposes the id from the name as a slug the Core accepts", () => {
    expect(personaIdFromName("Médica Clínica")).toBe("medica-clinica");
    expect(personaIdFromName("  C++ Coach!  ")).toBe("c-coach");
    expect(personaIdFromName("   ")).toBe("");
    const long = personaIdFromName(`${"a".repeat(79)} b`);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("-")).toBe(false);
  });

  it("follows the name until the id is typed, then keeps the typed id", () => {
    let draft = newPersonaDraftWithName(newPersonaDraft(), "Jardineira");
    expect(draft.id).toBe("jardineira");
    draft = newPersonaDraftWithId(draft, "horta");
    draft = newPersonaDraftWithName(draft, "Jardineira da Horta");
    expect(draft.id).toBe("horta");
    expect(draft.name).toBe("Jardineira da Horta");
  });

  it("says what is missing before the Core is asked", () => {
    const ready = { ...newPersonaDraftWithName(newPersonaDraft(), "Gardener"), prompt: "# Gardener" };
    expect(personaCreationProblem(ready)).toBeUndefined();
    expect(personaCreationProblem({ ...ready, name: "  " })).toBe("A new persona needs a name.");
    expect(personaCreationProblem(newPersonaDraftWithId(ready, ""))).toBe("A new persona needs an id.");
    expect(personaCreationProblem(newPersonaDraftWithId(ready, "Gar den"))).toBe(
      "The id takes lowercase letters, digits and single hyphens, at most 80 characters.",
    );
    expect(personaCreationProblem({ ...ready, prompt: " " })).toBe("The prompt cannot be empty.");
  });

  it("sends only the fields given, keywords split as an edit splits them", () => {
    const draft = { ...newPersonaDraftWithName(newPersonaDraft(), " Gardener "), prompt: "# Gardener\n" };
    expect(personaCreation(draft)).toEqual({ persona: "gardener", name: "Gardener", prompt: "# Gardener\n" });
    expect(personaCreation({ ...draft, description: " Soil. ", routingKeywords: "soil, pruning\nseasons" })).toEqual({
      persona: "gardener",
      name: "Gardener",
      prompt: "# Gardener\n",
      description: "Soil.",
      routingKeywords: ["soil", "pruning", "seasons"],
    });
  });

  it("lists a created persona at once, in its place", () => {
    const list = personaListAfterCreate([coach, writer], { id: "gardener", name: "Gardener", description: null });
    expect(list.map((entry) => entry.id)).toEqual(["coach", "gardener", "writer"]);
    expect(personaListAfterCreate(list, { id: "coach", name: "Treinadora", description: null }).map((entry) => entry.name)).toEqual([
      "Gardener",
      "Treinadora",
      "Writer",
    ]);
  });
});

describe("CR222: the screen for a new persona", () => {
  const render = (props: Partial<Parameters<typeof NewPersonaForm>[0]> = {}) =>
    renderToStaticMarkup(
      <NewPersonaForm
        draft={newPersonaDraft()}
        state="idle"
        onDraft={() => {}}
        onCreate={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );

  it("is titled New persona, with the id beside the fields an edit has", () => {
    const html = render();
    expect(html).toContain("<h2>New persona</h2>");
    for (const label of ["Name", "Id", "Description", "Prompt", "Routing keywords"]) expect(html).toContain(`${label}<`);
    expect(html).toContain("Cannot be changed once the persona is created.");
    expect(html).toContain("An image can be chosen once the persona is created.");
  });

  it("creates only a complete persona, and Cancel creates nothing", () => {
    expect(render()).toMatch(/<button type="submit" disabled="">Create persona<\/button>/);
    const ready = { ...newPersonaDraftWithName(newPersonaDraft(), "Gardener"), prompt: "# Gardener" };
    expect(render({ draft: ready })).toMatch(/<button type="submit">Create persona<\/button>/);
    expect(render({ draft: ready })).toContain(">Cancel</button>");
    expect(render({ draft: ready, state: "saving" })).toContain("Creating…");
  });

  it("shows the Core's refusal as written", () => {
    const html = render({ state: "error", message: "Mirror already keeps a persona with this id. Choose another." });
    expect(html).toContain('role="alert">Mirror already keeps a persona with this id. Choose another.</p>');
  });
});

describe("CR222 and CR223: the Personas section", () => {
  const reading = { state: "ready" as const, personas: [coach, writer] };
  const section = (open: boolean, compact = false) =>
    renderToStaticMarkup(
      <PersonaSidebarSection
        open={open}
        compact={compact}
        reading={reading}
        images={{}}
        onToggle={() => {}}
        onOpenPersona={() => {}}
        onExpand={() => {}}
        onRetry={() => {}}
        onCreatePersona={() => {}}
        onDeletePersona={() => {}}
      />,
    );

  it("offers ＋ New persona only while the section is open", () => {
    expect(section(true)).toContain('aria-label="New persona"');
    expect(section(false)).not.toContain('aria-label="New persona"');
    expect(section(false, true)).not.toContain('aria-label="New persona"');
  });

  it("gives each row a ⋯ beside it, not inside it", () => {
    const html = section(true);
    expect(html).toContain('aria-label="More for Coach"');
    expect(html).not.toMatch(/<button[^>]*persona-sidebar-row[^>]*>(?:(?!<\/button>).)*<button/s);
  });

  it("the row's ⋯ opens and deletes", () => {
    const html = renderToStaticMarkup(<PersonaRowMenu label="Coach" onOpen={() => {}} onDelete={() => {}} onDismiss={() => {}} />);
    expect(html).toContain('role="menu"');
    expect(html).toContain('aria-label="Coach"');
    expect(html).toMatch(/role="menuitem"[^>]*>Open<\/button>/);
    expect(html).toMatch(/role="menuitem"[^>]*>Delete persona…<\/button>/);
  });
});

describe("CR223: the persona screen's door to deletion", () => {
  const persona: Persona = { id: "coach", name: "Coach", description: null, prompt: "# Coach", routingKeywords: [], updatedAt: "t" };
  const form = (onDelete?: () => void) =>
    renderToStaticMarkup(
      <PersonaForm
        persona={persona}
        draft={draftFromPersona(persona)}
        state="idle"
        onDraft={() => {}}
        onSave={() => {}}
        onClose={() => {}}
        onChooseImage={() => {}}
        onRemoveImage={() => {}}
        {...(onDelete ? { onDelete } : {})}
      />,
    );

  it("ends in Delete persona…", () => {
    expect(form(() => {})).toMatch(/<button type="button" class="persona-screen-delete">Delete persona…<\/button>/);
    expect(form()).not.toContain("Delete persona…");
  });
});

describe("CR223: what a deletion takes", () => {
  it("reads only a preview the Core and Nautilus answered", () => {
    expect(sanitizePersonaDeletionPreview(preview())).toEqual(preview());
    expect(sanitizePersonaDeletionPreview({ ...preview(), digest: "" })).toBeUndefined();
    expect(sanitizePersonaDeletionPreview({ ...preview(), heirs: [7] })).toBeUndefined();
    expect(sanitizePersonaDeletionPreview({ ...preview(), kept: { conversations: -1, memories: 0, runtime_sessions: 0 } })).toBeUndefined();
    expect(sanitizePersonaDeletionPreview({ ...preview(), cleared: { journey_defaults: [], sticky_default: "yes" } })).toBeUndefined();
    expect(sanitizePersonaDeletionPreview({ ...preview(), image: undefined })).toBeUndefined();
    expect(sanitizePersonaDeletionPreview(null)).toBeUndefined();
  });

  it("says what goes, what is cleared and what stays, by name", () => {
    expect(personaDeletionSummary(preview(), (id) => (id === "allotment" ? "Allotment" : id))).toEqual({
      goes: [
        "Its definition: name, description, prompt and routing keywords",
        "Its generated descriptor",
        "2 extension bindings",
        "Its image on this device",
      ],
      cleared: ["The default persona of Allotment", "Mirror's remembered default persona"],
      kept: ["3 Conversations", "1 memory"],
    });
    const bare = preview({
      kept: { conversations: 0, memories: 0, runtime_sessions: 1 },
      deleted: { descriptors: 0, identity_integrations: 1, extension_bindings: 1 },
      cleared: { journey_defaults: [], sticky_default: false },
      image: false,
    });
    expect(personaDeletionSummary(bare, (id) => id)).toEqual({
      goes: ["Its definition: name, description, prompt and routing keywords", "1 identity integration", "1 extension binding"],
      cleared: [],
      kept: ["1 runtime session"],
    });
  });

  it("refuses a persona others inherit from, naming them", () => {
    expect(personaDeletionRefusal(preview(), (id) => id)).toBeUndefined();
    expect(personaDeletionRefusal(preview({ heirs: ["coach", "writer"] }), (id) => (id === "coach" ? "Coach" : id))).toBe(
      "2 personas inherit from this one: Coach, writer. Mirror deletes a persona only when none does.",
    );
  });

  it("lists it in the theme's ink, with the refusal in place of the list", () => {
    const html = renderToStaticMarkup(<PersonaDeletionList preview={preview()} nameOfJourney={(id) => id} nameOfPersona={(id) => id} />);
    expect(html).toContain('class="journey-deletion-list"');
    expect(html).toContain("Will be deleted:");
    expect(html).toContain("Will be cleared:");
    expect(html).toContain("Will be kept, as history, with the persona&#x27;s id:");
    expect(html).toContain("A bubble this persona signed keeps its name and colour.");
    const quiet = renderToStaticMarkup(
      <PersonaDeletionList
        preview={preview({ cleared: { journey_defaults: [], sticky_default: false }, kept: { conversations: 0, memories: 0, runtime_sessions: 0 } })}
        nameOfJourney={(id) => id}
        nameOfPersona={(id) => id}
      />,
    );
    expect(quiet).not.toContain("Will be cleared:");
    expect(quiet).toContain("No Conversation or memory was recorded with this persona.");
    const refused = renderToStaticMarkup(
      <PersonaDeletionList preview={preview({ heirs: ["coach"] })} nameOfJourney={(id) => id} nameOfPersona={(id) => id} />,
    );
    expect(refused).toContain('role="alert">1 persona inherits from this one: coach.');
    expect(refused).not.toContain("Will be deleted:");
    expect(renderToStaticMarkup(<PersonaDeletionList nameOfJourney={(id) => id} nameOfPersona={(id) => id} />)).toContain(
      "Asking Mirror what this persona holds…",
    );
  });

  it("takes a deleted persona out of the list", () => {
    expect(personaListAfterDelete([coach, writer], "coach")).toEqual([writer]);
    expect(personaListAfterDelete([coach], "nobody")).toEqual([coach]);
  });

  it("previews again when the persona changed since the list was shown", () => {
    expect(PERSONA_DELETION_CHANGED).toBe("What this persona holds changed since the list was shown. Review the new list and confirm again.");
    expect(rustSource).toContain(`"${PERSONA_DELETION_CHANGED}"`);
  });
});

describe("CR222 and CR223: native commands", () => {
  it("are three commands, each through the host", () => {
    expect(storageSource).toContain('invoke<unknown>("create_persona", { request })');
    expect(storageSource).toContain('invoke<unknown>("preview_persona_deletion", { persona })');
    expect(storageSource).toContain('invoke<unknown>("delete_persona", { persona, expectedDigest })');
    for (const command of ["create_persona", "preview_persona_deletion", "delete_persona"]) {
      expect(rustSource).toMatch(new RegExp(`pub\\(crate\\) fn ${command}\\(`));
    }
  });
});

describe("CR222 and CR223: the app", () => {
  it("opens the new persona's screen from ＋, and its edit screen once created", () => {
    expect(appSource).toContain("onCreatePersona={() => setCreatingPersona(true)}");
    expect(appSource).toContain("<NewPersonaScreen");
    expect(appSource).toMatch(/onCreated=\{\(created\) => \{[^}]*setCreatingPersona\(false\);[^}]*setOpenPersonaId\(created\.id\);/s);
    expect(appSource).toContain("personaListAfterCreate(current.personas, created)");
  });

  it("opens one confirmation from both doors", () => {
    expect(appSource).toContain("onDeletePersona={setPersonaDeletionTarget}");
    expect(appSource).toMatch(/onDelete=\{\(\) => \{\s*setOpenPersonaId\(null\);\s*setPersonaDeletionTarget\(openPersonaId\);/);
    expect(appSource).toContain("<PersonaDeletionDialog");
  });

  it("takes a deleted persona out of the list, its image and its screen at once, and keeps its name for old bubbles", () => {
    const deleted = appSource.slice(appSource.indexOf("onDeleted={(personaId, problem) => {"));
    const body = deleted.slice(0, deleted.indexOf("}}"));
    expect(body).toContain("personaListAfterDelete(current.personas, personaId)");
    expect(body).toContain("imagesAfterChange(current, personaId, undefined)");
    expect(body).toContain("setPersonaDeletionTarget(null)");
    expect(body).not.toContain("setPersonaNames");
  });
});
