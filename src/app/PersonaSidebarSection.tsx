import { useState, type CSSProperties } from "react";
import { filterPersonaList, personaListLabel, type PersonaListEntry } from "../domain/personaList";
import type { PersonaImages } from "../domain/personaImages";
import { personaHue, personaLightColour } from "./personaColour";

export type PersonaListReading =
  | { state: "loading"; personas: readonly PersonaListEntry[] }
  | { state: "ready"; personas: readonly PersonaListEntry[] }
  | { state: "error"; personas: readonly PersonaListEntry[]; message: string };

/**
 * CR221: the personas the Mirror keeps, under the Journeys. The place is CV-015's; what a click
 * does grows there. Today it opens the persona screen CR217 built.
 */
export function PersonaSidebarSection({
  open,
  compact,
  reading,
  images,
  openPersonaId,
  onToggle,
  onOpenPersona,
  onExpand,
  onRetry,
}: {
  open: boolean;
  compact: boolean;
  reading: PersonaListReading;
  images: PersonaImages;
  openPersonaId?: string | null;
  onToggle: () => void;
  onOpenPersona: (personaId: string) => void;
  /** The compact sidebar's ◇: the full sidebar, with this section open. */
  onExpand: () => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const count = reading.state === "ready" ? reading.personas.length : undefined;
  if (compact) {
    return (
      <button
        className="persona-rail-button"
        type="button"
        onClick={onExpand}
        aria-label={count === undefined ? "Show the personas" : `Show the ${count} personas`}
        title="Personas"
      >
        <span aria-hidden="true">◇</span>
        {count === undefined ? null : <small aria-hidden="true">{count}</small>}
      </button>
    );
  }
  const shown = filterPersonaList(reading.personas, query);
  return (
    <section className={`persona-sidebar-section${open ? " is-open" : ""}`} aria-label="Personas">
      <button className="persona-sidebar-heading" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="persona-sidebar-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="persona-sidebar-title">Personas</span>
        {count === undefined ? null : <span className="persona-sidebar-count">{count}</span>}
      </button>
      {open ? (
        <>
          <input
            className="persona-sidebar-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter personas"
            aria-label="Filter personas"
          />
          {reading.state === "loading" ? <p className="persona-sidebar-status" role="status">Reading the personas from Mirror…</p> : null}
          {reading.state === "error" ? (
            <p className="persona-sidebar-status" role="alert">
              {reading.message}{" "}
              <button className="persona-sidebar-retry" type="button" onClick={onRetry}>Try again</button>
            </p>
          ) : null}
          {reading.state === "ready" && reading.personas.length === 0 ? (
            <p className="persona-sidebar-status">Mirror keeps no personas yet.</p>
          ) : null}
          {reading.personas.length > 0 && shown.length === 0 ? (
            <p className="persona-sidebar-status">No persona matches “{query.trim()}”.</p>
          ) : null}
          <div className="persona-sidebar-list">
            {shown.map((persona) => (
              <PersonaRow
                key={persona.id}
                persona={persona}
                image={images[persona.id]}
                isOpen={persona.id === openPersonaId}
                onOpen={() => onOpenPersona(persona.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function PersonaRow({ persona, image, isOpen, onOpen }: { persona: PersonaListEntry; image: string | undefined; isOpen: boolean; onOpen: () => void }) {
  const colour = { "--persona-hue": personaHue(persona.id), "--persona-light": personaLightColour(persona.id) } as CSSProperties;
  const label = personaListLabel(persona);
  return (
    <button
      className={`persona-sidebar-row${isOpen ? " is-open" : ""}`}
      type="button"
      style={colour}
      onClick={onOpen}
      aria-current={isOpen ? "true" : undefined}
      title={persona.description ?? label}
    >
      <span className={`persona-sidebar-avatar${image ? " has-image" : ""}`} aria-hidden="true">
        {image ? <img src={image} alt="" /> : "◇"}
      </span>
      <span className="persona-sidebar-copy">
        <span className="persona-sidebar-name">{label}</span>
        {persona.description ? <small>{persona.description}</small> : null}
      </span>
    </button>
  );
}
