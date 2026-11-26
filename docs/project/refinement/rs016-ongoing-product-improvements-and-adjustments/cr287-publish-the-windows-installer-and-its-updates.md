[< RS016](index.md)

# CR287: Publish the Windows Installer and Its Updates

**Status:** in_progress 2026-11-25 (`16410969`); published 2026-11-26 for alpha.26, awaiting the update test
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution; evaluated and merged by the assistant
**Requested:** contribution [PR #29](https://github.com/mirror-mind-ai/nautilus-app/pull/29); merged as it stands on the Navigator's word, 2026-11-25 ("pode começar pela correção e depois siga suas recomendações para o merge dos 3 prs"), after the evaluation, alone in its round.
Merge commit `16410969`.

## Friction

A release reached macOS only. An installed Windows application polls
`https://updates.mirrormind.sh/nautilus/windows/<version>/latest.json`, receives 404 and never updates
(checked on 2026-11-25 for alpha.24 and alpha.25), and every Windows installer so far was built by hand.

## What Changed

A second release route for Windows, run after the macOS one and confirmed on its own; `release_deploy.mjs`
is not changed, so a Windows failure neither blocks a macOS release nor leaves one half published. No
Rust and no application code.

- **`windows-release.yml`**, on every `v*` tag (or by hand): checks that the tag names the version in the
  tree, runs the suites, builds the user channel's NSIS installer with the application's updater
  endpoint and public key but without the updater signature (`npm run tauri:build:user:unsigned`, the
  user build plus `tauri.user-unsigned.conf.json`), installs, launches and uninstalls it, and keeps it
  for 30 days with a descriptor binding its bytes to the version and revision. Read-only token, no
  secrets, actions pinned by commit. The updater key never enters CI.
- **`npm run release:windows -- prepare`**, on the publisher's machine: refuses without the tag, without
  a successful workflow run for the tag's revision, or with an installer the descriptor does not match;
  signs with `~/.mirror-desktop-updater/alpha/updater.key`, checks the signature against the public key
  in `tauri.nautilus-update.conf.json` the way the updater will, and stages. Nothing is published.
- **`publish --yes`**: adds the installer and `SHA256SUMS` to the GitHub release, uploads the installer,
  its signature and the stable download through the same SSH path as macOS, then the manifests
  (`windows/` and `windows-x86_64/`, for every retained version), verifies every polled URL and the
  served bytes, and commits and pushes `docs/update/vX-windows-publication-<date>.md`.
- **`get.ps1`** at the repository root, the Mirror installer's one-line form: reads `SHA256SUMS`,
  refuses anything but one line naming `nautilus-latest-setup.exe`, downloads, checks the hash, and
  opens the installer; on a mismatch it deletes the file and runs nothing.
- `scripts/release_line.mjs` gains `windowsDownloadAlias`; `scripts/mirror_desktop_channel.mjs` gains
  `build-user-unsigned`; `docs/release/windows-release.md` is the guide; the README gains the install
  line; `src/tests/windowsRelease.test.mjs` (28 tests, three of them, on `get.ps1`, run only on Windows).

## Noted at Review

- **What turning it on does.** The first Windows manifest published offers the update to every Windows
  installation of this line at once. That is the purpose, and it is also why the first publication is
  the real test of this CR.
- **The workflow runs on every tag.** The next macOS release's tag starts it and produces an installer;
  nothing reaches the host until `release:windows` is run and confirmed.
- **`get.ps1` takes away SmartScreen's warning on purpose.** The installer is not code-signed; a file
  PowerShell downloads carries no mark of the web, and the script also clears it. The hash comes from
  the same host as the installer, so it protects against a damaged or substituted download in transit,
  not against a compromised host; the updater's minisign signature does protect updates. The Mirror
  installer made the same choice; code signing on Windows remains a decision for later, as on macOS.
- `tauri.nautilus-update.conf.json` (endpoint and public key) is unchanged, and the macOS stable alias
  `nautilus-latest.dmg` and `darwin` paths are untouched.

## Falsifier

On the first release after this merge: `windows-release.yml` succeeds on the tag; `prepare` accepts its
installer and the signature verifies; after `publish --yes` the Windows manifests of every retained
version serve the new version, the stable download's bytes match `SHA256SUMS`, and a Windows
installation of the previous alpha is offered the update, installs it, and keeps its Mirror home and
data. If any step fails, or the macOS publication is affected in any way, this CR reopens.

## Evaluation

Read in full. Tested alone on `2ac03746` (vitest 383 files, 3216 passed, 4 skipped; `tsc` clean), then
merged onto `d08ac21b` after PR #31 and PR #30: vitest 388 files, 3252 passed, 4 skipped (the three `get.ps1`
tests, which run only on Windows, and one skipped on `main` already); `tsc` clean. The merged `main` has the same tree as the tested one.
The PR's Windows and macOS CI were green on `3144b4f2`. The author ran the workflow on a tag in the author's fork
(every step passed) and, on two clean Windows 11 VMs (an en-US profile and an accented pt-BR one),
installed, used and uninstalled the installer it built, and completed three updates through the route's
own staging, served by a local host with a throwaway key. Not exercised: a publication to
`updates.mirrormind.sh` with the real key, which only a release can do.

## Validation Route

1. On the next release, after `release:deploy publish`: `gh run list --workflow windows-release.yml`
   shows the tag's run succeeded.
2. `npm run release:windows -- plan`, then `prepare`; read the confirmation.
3. `publish --yes` only on the Navigator's word for that release; then check each surface on its own:
   the GitHub release assets, `windows/<previous>/latest.json`, the stable download against
   `SHA256SUMS`.
4. On a Windows machine with the previous alpha installed: the update is offered and installs.

## First Windows Publication

On the Navigator's word ("publique o Windows da alpha.26", 2026-11-26) the route ran on the tag
`v0.4.0-alpha.26` (`c3be8def`): `windows-release.yml` run `45712173991` had succeeded, `prepare` accepted
the installer (sha256 `757964662a18f2a100de7206f85cc2683d27c1261f5dc92e4a5249e6b31bc4a2`, the one the
Navigator had installed in a Windows 11 virtual machine) and verified the signature against the application's
public key, and `publish --yes` verified 52 URLs (evidence `docs/update/v0.4.0-alpha.26-windows-publication-2026-11-26.md`,
commit `b1e30dca`). Checked again on its own: the stable download's bytes match `SHA256SUMS` and the GitHub
asset; the Windows manifests of alpha.1, alpha.12, alpha.25 and alpha.26 serve version 0.4.0-alpha.26 with a
signature; the macOS download and `darwin` manifest are unchanged.

Before this publication the Navigator installed the installer in the virtual machine and used it: the first
window, the assistant, the provider and a first turn worked, and the update check answered that it could not
fetch a valid release, which is what an endpoint with no Windows manifest returns.

Not exercised, and the reason this CR stays open: no installed Windows app has yet been offered an update
and installed it. The guide asks for that test before a first publication; there was no earlier published
Windows version to update from, so it moves to the next alpha, where the virtual machine's alpha.26 is
offered the new version. A failed update, or any effect on the macOS publication, reopens this CR. Steps 21
to 27 of the virtual machine roteiro (the accented profile, `get.ps1` against a local server, uninstall and
reinstall) were not reported before the publication.
