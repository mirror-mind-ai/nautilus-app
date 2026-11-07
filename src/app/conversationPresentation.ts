import type { ConversationMessage } from "../agent/piTaskPacket";
import type { Person } from "../domain/personName";

export type MessageSpeaker = {
  label: string;
  avatar: string;
  kind: "user" | "agent" | "persona";
  /** CR213: the persona's id, which its colour is taken from. */
  personaId?: string;
};

const AGENT_SPEAKER: MessageSpeaker = { label: "Agent", avatar: "π", kind: "agent" };

const personaSignaturePattern = /^(?:\s|[│|╭╮╰╯─━═┌┐└┘╔╗╚╝╠╣╦╩╬])*[◇✦]\s*(?:Persona:\s*)?([^\n]+?)\s*(?:\n|$)/i;
const embeddedCertifiedPersonaPattern = /✦\s*Persona:\s*([a-z0-9-]+)\s*/i;
// CR188: the 0.3 Core asks the model to `sign ◇ <persona>`, and the model signs on the last line.
const trailingPersonaSignaturePattern = /\n[ \t]*[◇✦][ \t]*(?:Persona:[ \t]*)?([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\s*$/i;

export function inferMessageSpeaker(
  message: Pick<ConversationMessage, "role" | "content">,
  person: Person = { name: "You", initial: "Y" },
): MessageSpeaker {
  // CR190: the person's own name and initial, where "You" and a hard-coded "N" used to be.
  if (message.role === "user") {
    return { label: person.name, avatar: person.initial, kind: "user" };
  }

  const persona = message.content.match(personaSignaturePattern)?.[1]?.trim()
    ?? message.content.match(embeddedCertifiedPersonaPattern)?.[1]?.trim()
    ?? message.content.match(trailingPersonaSignaturePattern)?.[1]?.trim();
  return persona ? speakerForPersona(persona) : AGENT_SPEAKER;
}

/**
 * CR188: the persona the Mirror delivered names the speaker; the text's own signature is the fallback.
 * CR213: `null` is the Core saying the turn has no persona, and then the agent speaks, whatever the
 * model may have signed; `undefined` is a turn the Core said nothing about.
 */
export function personaSpeaker(
  message: Pick<ConversationMessage, "role" | "content">,
  deliveredPersona: string | null | undefined,
): MessageSpeaker {
  if (message.role === "assistant" && deliveredPersona === null) return AGENT_SPEAKER;
  if (message.role === "assistant" && deliveredPersona) return speakerForPersona(deliveredPersona);
  return inferMessageSpeaker(message);
}

/**
 * CR213: the persona's name. The Core keeps a name for some personas but hands its host only the id
 * (Core CR203), so until then the id is made readable: "product-designer" reads "Product Designer".
 */
export function personaDisplayName(persona: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(persona)) return persona;
  return persona.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

// Until personas have images of their own, the ◇ stands in, on the persona's colour.
function speakerForPersona(persona: string): MessageSpeaker {
  return { label: personaDisplayName(persona), avatar: "◇", kind: "persona", personaId: persona };
}

export function stripMessageSpeakerSignature(content: string): string {
  return withoutStandaloneSignatureLines(content
    .replace(personaSignaturePattern, "")
    .replace(embeddedCertifiedPersonaPattern, "")
    .replace(trailingPersonaSignaturePattern, ""))
    .trimStart()
    .trimEnd();
}

// CR211: two text blocks written in a row reach the surface as one comment, and when the second
// opens with the signature it sits between them. A line that is only `◇ <persona-id>` is a
// signature wherever it is, except inside a code block, which shows what was written.
const standaloneSignatureLine = /^[ \t]*◇[ \t]*[a-z0-9]+(?:-[a-z0-9]+)*[ \t]*$/;

function withoutStandaloneSignatureLines(content: string): string {
  if (!content.includes("◇")) return content;
  let inCode = false;
  const kept: string[] = [];
  for (const line of content.split("\n")) {
    if (/^[ \t]*(?:```|~~~)/.test(line)) inCode = !inCode;
    if (!inCode && standaloneSignatureLine.test(line)) {
      // The blank line that separated it from the next paragraph goes with it.
      if (kept.at(-1) === "") kept.pop();
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

export function withCertifiedPersona(content: string, persona: string): string {
  const marker = `✦ Persona: ${persona}`;
  const withoutExistingMarker = content
    .replace(new RegExp(`(?:^|\\n)?[◇✦]\\s*(?:Persona:\\s*)?${escapeRegExp(persona)}\\s*`, "i"), "")
    .trimStart();
  return withoutExistingMarker ? `${marker}\n\n${withoutExistingMarker}` : `${marker}\n\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
