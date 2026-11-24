# Windows Release

This is how a tagged release reaches Windows: the installer a person downloads, and the update an installed application finds. It runs after the macOS route (`npm run release:deploy`) has published the tag, as a second route with its own confirmation.

It is a second route, and not a stage of the first, for two reasons. The installer is built on a Windows runner, which can only happen once the tag exists. And a Windows failure must neither block a macOS release nor leave one half published.

## What is published

Under the same base URL the macOS artifacts use (`https://updates.mirrormind.sh/nautilus`):

| Path | What it is |
|------|------------|
| `artifacts/Nautilus for Mirror_X.Y.Z_x64-setup.exe` and `.sig` | The installer and its updater signature. On Windows the installer itself is what an update downloads. |
| `windows/<installed version>/latest.json`, `windows-x86_64/<installed version>/latest.json` | The manifest an installed application polls, one per retained version. `{{target}}` is `windows` in the application as built; the architecture-qualified path is published as it is for macOS. |
| `downloads/windows/nautilus-latest-setup.exe` | The stable address for someone who does not have the application yet. |
| `downloads/windows/latest.json` | Version, SHA-256 and size of that download. |

The installer is also added to the GitHub release of the tag.

## The updater key stays on the publisher's machine

The Windows release workflow (`.github/workflows/windows-release.yml`) builds the user channel exactly as it is installed, with the application's updater endpoint and public key, but **without the updater signature** (`npm run tauri:build:user:unsigned`). Its token is read-only and it has no secrets.

The signature is made afterwards, by `tauri signer sign`, with the key at `~/.mirror-desktop-updater/alpha/updater.key` (or `MIRROR_DESKTOP_UPDATER_SIGNING_KEY`), on the machine that already holds it. A minisign signature is over the file's bytes, so it does not matter where the file was built.

## The route

1. Publish the release as usual: `npm run release:deploy -- publish --yes`. Pushing the tag starts the Windows release workflow, which runs the Windows suites, builds the installer, installs, launches and uninstalls it, and keeps it for 30 days with a descriptor (`windows-release.json`: version, tag, revision, size, SHA-256).
2. When the workflow has finished: `npm run release:windows -- prepare`. It
   - finds the workflow run of the tag's revision, and stops if it is still running or did not succeed;
   - downloads the installer and refuses it unless the descriptor names this version, this revision, the user channel's identifier and exactly the downloaded bytes;
   - signs it, then checks the signature the way the application will: over these bytes, by the key whose public half is in `src-tauri/tauri.nautilus-update.conf.json`. A signature from any other key stops here, naming both keys;
   - stages everything under `.tmp/windows-release/vX.Y.Z/stage` and prints the single confirmation: the run, the installer's digest, the key, the manifest paths and the actions.
3. After confirming: `npm run release:windows -- publish --yes`. It adds the installer to the GitHub release, uploads the installer and the stable download, then the manifests (last, so no application is told of an installer that is not there yet), and verifies, blocking:
   - every polled manifest serves this version, the confirmed signature and the installer's address;
   - the update artifact and the stable download serve the confirmed bytes.

   It then writes `docs/update/vX.Y.Z-windows-publication-<date>.md`, commits and pushes it.

`npm run release:windows` alone prints the plan and executes nothing. `reset` discards the prepared state. Each stage is recorded, so a route interrupted halfway resumes where it stopped.

If the workflow failed, fix it on `main` and release the fix in the next version; to rebuild the same tag, run the workflow by hand on it (`gh workflow run windows-release.yml --ref vX.Y.Z`).

## Who is offered the update

Every Windows installation of the user channel of a retained version, including those installed before this route existed: they already poll `windows/<version>/latest.json` and carry the public key. Development and evaluation builds do not update.

## Not covered here

- **Code signing.** The installer is not signed with a Windows certificate, so a browser download shows the unknown-publisher warning. The updater signature is a different thing: it is what lets an installed application trust an update.
- **A download bootstrap** that fetches and checks the installer without that warning.
- **ARM64.** One architecture, x64.
- **A process still running the bundled Node.** The installer replaces `mirror-host
ode
ode.exe`. If something is still running that file when the update's installer reaches it, the installer stops at an Abort / Retry / Ignore dialog, and Retry continues once the process is gone. In the rehearsal the application's own host process had ended by then; nothing in the installer enforces it.
