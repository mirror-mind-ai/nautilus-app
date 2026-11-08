[< RS016](index.md)

# CR218: Give a Persona Its Own Image

**Status:** built, awaiting the Navigator's validation
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

## Delivered on `main` (`ce22f759`)

Built 2026-11-08 on the Navigator's word ("construa a CR218 e a CR205"), beside RS028's CR205.

- **Kept per home.** `journey_appearance.rs` gains `import_persona_image`, `load_persona_images` and
  `remove_persona_image`, on the Journey image's own rules: a PNG, JPEG or WebP of at most 5 MiB,
  normalized to a 512 px PNG, written atomically under `persona-appearance/<id>.png` in the home's
  state folder, never through a link (folder, file or source), at most 64 per device. A persona's
  ids belong to its home, so its images do too, as a Journey's do.
- **Loaded at once.** Every bubble needs its persona's image, so the app loads every image kept
  for the home at launch, beside CR216's names. A file that is not one Nautilus wrote (not an id,
  not a 512 px PNG, a link, a folder) is skipped, and the rest still load.
- **Chosen on the persona's screen.** "Choose image…", "Replace image…", "Remove image", with the
  persona's ◇ on its colour as the preview without one. Applied at once and kept on this device,
  as a Journey's appearance is; it does not wait for Save.
- **Shown in the dialogue.** A persona with an image speaks behind it, ringed in its colour, where
  the ◇ stood; without one the ◇ stays. The agent and the Navigator never take a persona's image.
- **Nothing reaches Mirror.** No Core call, no identity row.
- **One rule, not three.** The PNG data URL rule the Journey and user avatar storage each copied
  moved to `src/domain/imageDataUrl.ts`; the persona images use it too.

Found while building: the command census (`native_command_serialization.rs`) did not read
`mirror_context.rs` or `persona_admin.rs`, so CR216's `load_persona_names` and CR217's
`read_persona` ran off the main thread without the serialisation guard every such command takes
first. Both files are listed and both commands take the guard: 109 commands became 115 with CR218's
three.

## Validation

- Spec first: `src/tests/cr218PersonaImage.test.tsx` (9), red on the missing modules; four Rust
  tests (`cr218_*`), red on `todo!()`.
- 21 mutations: 10 in the front and 10 in Rust caught, plus one Rust survivor that is equivalent
  (`stored_png`'s regular-file check repeats the directory listing's, which already drops links and
  folders; its case, a link to a valid image outside the folder, was added). A first front survivor
  (the avatar's own speaker-kind check) gained its case.
- `tsc` clean; vitest 333 files, 2,841 passed, 1 skipped; cargo 517 passed; the real-host tests pass.
- Changed spec: `journeyVisualMark.test.tsx` looked for the name `PNG_DATA_URL` in the Journey
  image storage; it now looks for `validatePngDataUrl`, the same check from its new place.

## Acceptance

In `npm run tauri:dev`, on a rehearsal home:

1. On a persona's screen, "Choose image…" takes a photo; the preview and every bubble of that
   persona show it at once.
2. After a relaunch, the persona's bubbles still show it.
3. "Remove image" brings back the ◇ in the persona's colour.
4. A GIF or an SVG is refused with a sentence; the previous image stays.

