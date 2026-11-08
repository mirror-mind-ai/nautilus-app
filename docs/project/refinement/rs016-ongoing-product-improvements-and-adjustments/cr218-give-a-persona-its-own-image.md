[< RS016](index.md)

# CR218: Give a Persona Its Own Image

**Status:** captured
**Driver:** assistant
**Requested:** Navigator, 2026-11-08 ("O avatar deve ser armazenado localmente pelo app e deve ser
semelhante ao modo como armazenamos o avatar de uma journey... O avatar também deve passar a ser
usado no dialogo do chat"); companion to
[CR217](cr217-open-a-persona-from-its-name-and-edit-it.md), toward
[CV-015](../../roadmap/cv-015-personas-beside-journeys/index.md)

## Friction

Every persona speaks behind the same ◇, told apart only by a hashed colour that can collide. A
Journey already has a face of its own: a custom image imported through the native side, normalized
to a 512 px PNG, kept under the app's data folder (`journey_appearance.rs`), chosen through
"Choose custom image…". A persona has nothing of the kind.

## Desired

- **Stored like a Journey's image.** Native commands mirrored from `journey_appearance.rs`:
  import through the file dialog, normalize to a 512 px PNG, keep it under a `persona-appearance`
  directory in the app's data folder by persona id, load it as a data URL, remove it. The same
  bounds: 5 MiB source, PNG/JPEG/WebP, a cap on custom images, no symlinked storage.
- **Chosen like a Journey's image.** The persona screen (CR217) offers the same chooser the
  Journey edit offers.
- **Shown in the dialogue.** A persona with an image speaks behind it in the conversation, live
  and reopened, where the ◇ stands today; `MessageSpeakerAvatar` already takes an image for the
  Navigator's side. Without an image, the ◇ on the persona's colour stays.
- **The image is Nautilus's, not the Core's.** Nothing enters the identity table or leaves the
  machine, exactly as a Journey's appearance works (kept fact from CV-015's review).

## Dependencies

- CR217 for the screen that hosts the chooser. The chat-side rendering has no Core dependency.

## Not in Scope

- Persona images in a sidebar: CV-015.
- Syncing images between machines.
