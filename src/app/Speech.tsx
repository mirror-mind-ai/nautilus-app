import { useContext, type CSSProperties, type ReactNode } from "react";
import type { MessageSpeaker } from "./conversationPresentation";
import { MessageCopyAction } from "./MessageCopyAction";
import { personaHue, personaLightColour } from "./personaColour";
import { PersonaOpenerContext } from "./personaOpener";
import { MessageSpeakerAvatar } from "./UserAvatar";

/**
 * CR213: whoever speaks, speaks beside their words, as in a forum. The agent's speech sits on the
 * left, the Navigator's mirrored on the right, so the transcript reads as a conversation. Each
 * bubble copies its own words.
 */
export function Speech({
  side,
  speaker,
  userAvatar,
  meta,
  copyBody,
  anchorMessageId,
  registerElement,
  highlighted = false,
  className,
  children,
}: {
  side: "agent" | "person";
  speaker: MessageSpeaker;
  userAvatar?: string;
  /** Said quietly beside the name: the time, or the persona that spoke before. */
  meta?: ReactNode;
  copyBody?: string;
  /** CR125: the reader is anchored on the speech, which is what moves when a turn folds above it. */
  anchorMessageId?: string;
  registerElement?: (element: HTMLElement | null) => void;
  highlighted?: boolean;
  /** CR214: a variant of a side's speech, such as a correction sent while the agent works. */
  className?: string;
  children: ReactNode;
}) {
  const openPersona = useContext(PersonaOpenerContext);
  const personaId = speaker.kind === "persona" ? speaker.personaId : undefined;
  const style = speaker.personaId
    ? ({
      "--persona-hue": personaHue(speaker.personaId),
      "--persona-light": personaLightColour(speaker.personaId),
    } as CSSProperties)
    : undefined;
  return (
    <div
      className={`speech ${side}-speech${className ? ` ${className}` : ""}${highlighted ? " conversation-message-search-current" : ""}`}
      {...(anchorMessageId ? { "data-conversation-message-id": anchorMessageId } : {})}
      ref={registerElement}
      style={style}
    >
      <MessageSpeakerAvatar
        speakerKind={speaker.kind}
        fallback={speaker.avatar}
        className="speech-avatar"
        {...(userAvatar ? { userAvatar } : {})}
      />
      <div className="speech-body">
        <div className="speech-head">
          {openPersona && personaId ? (
            // CR217: a persona's name is a way into its screen; the agent's π opens nothing.
            <button
              type="button"
              className="message-role speech-name speech-name-link"
              aria-label={`Open the persona ${speaker.label}`}
              onClick={() => openPersona(personaId)}
            >
              {speaker.label}
            </button>
          ) : (
            <span className="message-role speech-name">{speaker.label}</span>
          )}
          {meta ? <span className="speech-meta">{meta}</span> : null}
        </div>
        <div className="speech-bubble">
          {copyBody ? <MessageCopyAction body={copyBody} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
