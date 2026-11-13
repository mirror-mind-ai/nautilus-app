[< RS016](index.md)

# CR258: Toggle the Journey Sidebar With a Key

**Status:** implemented 2026-11-13 (`8347517c`); awaits a dev check on macOS; not released
**Driver:** Navigator
**Requested:** "Implemente uma CR para fazer funcionar a tecla de atalho Command+B para expandir ou
recolher a sidebar de journeys", 2026-11-13.

## Friction

The Journey sidebar expands and collapses only from its toggle button, with the mouse. A code
editor lets a key do it, and the hand that is already typing expects the same here. There was no
keyboard shortcut in the window at all; this is the first.

## What Changed

- **A key runs the existing toggle.** Command+B on macOS, Ctrl+B elsewhere, runs the same
  presentation toggle the button runs, so the two paths cannot drift. The primary modifier follows
  the platform: Ctrl+B on macOS moves the text cursor, so it is left alone there.
- **The match is a pure predicate.** `matchesSidebarToggleShortcut(event, platform)` accepts the
  primary modifier and the b key with no second modifier; `keyboardPlatformFrom(navigator)` reads
  the platform. Both live beside `toggleJourneySidebar`, where the sidebar concern already is.
- **The listener never re-subscribes.** A window keydown listener reads the latest toggle through a
  ref, the pattern the drag-cancel listener already uses, so sidebar state changes do not churn it.
- **Global on purpose.** The Composer is a plain textarea with no bold, so claiming the key while
  typing takes nothing away, and preventDefault keeps the key from reaching anything underneath.

Specs in `cr258SidebarShortcut.test.ts`: the predicate across platforms and modifiers, and the
App wiring that joins it to the button's toggle.

## Conscious Exclusions

No native menu item carries the accelerator yet, so the shortcut is not discoverable in the menu
bar, and the toggle button's tooltip does not name it. A later change can add both; this one makes
the key work.

## Falsifier

In dev on macOS, Command+B with the sidebar open collapses it and with it collapsed expands it,
whether the focus is on the tree or in the Composer, and it does nothing when a second modifier is
held or another key is pressed.
