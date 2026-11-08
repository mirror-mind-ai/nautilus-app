import { createContext } from "react";
import type { PersonaImages } from "../domain/personaImages";

/** CR218: the images of the home's personas, for every bubble a persona speaks in. */
export const PersonaImagesContext = createContext<PersonaImages>({});
