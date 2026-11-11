import { useEffect, useState, type CSSProperties } from "react";
import { filterPersonaList, personaListLabel, type PersonaListEntry } from "../domain/personaList";
import type { PersonaImages } from "../domain/personaImages";
import { personaHue, personaLightColour } from "./personaColour";

export type PersonaListReading =
  | { state: "loading"; personas: readonly PersonaListEntry[] }
  | { state: "ready"; personas: readonly PersonaListEntry[] }
  | { state: "error"; personas: readonly PersonaListEntry[]; message: string };

/**
 * CR221: the personas the Mirror keeps, under the Journeys. The place is CV-015's; what a click
 * does grows there. Today it opens the persona screen CR217 built. CR222 adds the section's ＋;
 * CR223, the row's ⋯ with Delete.
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
  onCreatePersona,
  onDeletePersona,
  notice,
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
  onCreatePersona: () => void;
  onDeletePersona: (personaId: string) => void;
  /** CR223: what Nautilus could not remove of its own after a deletion. */
  notice?: string;
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // CR223: a press anywhere but the open menu's row closes it. WebKit does not focus a pressed
  // button, so a blur would not tell.
  useEffect(() => {
    if (menuFor === null) return undefined;
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Element && event.target.closest(".persona-sidebar-item.has-menu"))) setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);
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
      <div className="persona-sidebar-header">
        <button className="persona-sidebar-heading" type="button" onClick={onToggle} aria-expanded={open}>
          <span className="persona-sidebar-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
          <span className="persona-sidebar-title">Personas</span>
          {count === undefined ? null : <span className="persona-sidebar-count">{count}</span>}
        </button>
        {open ? (
          <button className="persona-sidebar-create" type="button" onClick={onCreatePersona} aria-label="New persona" title="New persona">＋</button>
        ) : null}
      </div>
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
          {notice ? <p className="persona-sidebar-status" role="status">{notice}</p> : null}
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
                menuOpen={menuFor === persona.id}
                onOpen={() => onOpenPersona(persona.id)}
                onMenu={() => setMenuFor((current) => (current === persona.id ? null : persona.id))}
                onDelete={() => {
                  setMenuFor(null);
                  onDeletePersona(persona.id);
                }}
                onDismissMenu={() => setMenuFor(null)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** CR223: the row's ⋯, a menu of what can be done to the persona. */
export function PersonaRowMenu({ label, onOpen, onDelete, onDismiss }: { label: string; onOpen: () => void; onDelete: () => void; onDismiss: () => void }) {
  return (
    <div
      className="journey-item-context-menu persona-sidebar-menu"
      role="menu"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
    >
      <button type="button" role="menuitem" onClick={onOpen}>Open</button>
      <button type="button" role="menuitem" className="danger-menu-item" onClick={onDelete}>Delete persona…</button>
    </div>
  );
}

function PersonaRow({
  persona,
  image,
  isOpen,
  menuOpen,
  onOpen,
  onMenu,
  onDelete,
  onDismissMenu,
}: {
  persona: PersonaListEntry;
  image: string | undefined;
  isOpen: boolean;
  menuOpen: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onDelete: () => void;
  onDismissMenu: () => void;
}) {
  const colour = { "--persona-hue": personaHue(persona.id), "--persona-light": personaLightColour(persona.id) } as CSSProperties;
  const label = personaListLabel(persona);
  return (
    <div className={`persona-sidebar-item${menuOpen ? " has-menu" : ""}`}>
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
      <button
        className="persona-sidebar-more"
        type="button"
        onClick={onMenu}
        aria-label={`More for ${label}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="More"
      >⋯</button>
      {menuOpen ? (
        <PersonaRowMenu
          label={label}
          onOpen={() => {
            onDismissMenu();
            onOpen();
          }}
          onDelete={onDelete}
          onDismiss={onDismissMenu}
        />
      ) : null}
    </div>
  );
}
