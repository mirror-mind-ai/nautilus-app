import { createContext } from "react";

/**
 * CR217: opens a persona's screen by its id. A persona's name beside an answer is a way in only
 * where the app provides this; elsewhere it stays a label.
 */
export const PersonaOpenerContext = createContext<((personaId: string) => void) | null>(null);
