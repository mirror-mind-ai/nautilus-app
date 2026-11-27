# Apple Silicon Test Bundle

A native arm64 build of Nautilus for someone who has an Apple Silicon Mac, to find out whether it works there. It is **not a release**: it is signed ad hoc only, has no updater and carries no voice component. Nautilus still ships one macOS build, x64, which an Apple Silicon Mac runs through Rosetta.

## For the maintainer

Build it on GitHub's arm64 runner, the one place a native build can be made without an Apple Silicon Mac:

```bash
gh workflow run macos-arm64-test-bundle.yml --ref main
gh run list --workflow macos-arm64-test-bundle.yml --limit 1
gh run download <run-id> --name nautilus-eval-arm64-test-bundle --dir <new empty folder>
shasum -a 256 -c <new empty folder>/*.sha256
```

The artifact is a zip of `Nautilus for Mirror Eval.app` and its SHA-256, kept 7 days. Send both to the tester by hand, with this guide. The run's summary names the version, the commit and the checksum; they must match what the tester receives.

The bundle is the **evaluation channel**: the same code as the release, with the updater off and an amber dot on its icon so nobody takes it for the release. It is built from `main` as it stands, not from a tag.

## For the tester

This build uses the same app data and the same Mirror binding as the Nautilus you already have installed. It is the same code, but it reads and writes your real state, so keep that in mind.

1. **Quit Nautilus** (⌘Q) completely. This build refuses to start while the installed app is running, and the two must not run together.
2. Unzip the file and move `Nautilus for Mirror Eval.app` to `~/Applications`. Do not put it in `/Applications` and do not replace the installed app.
3. Open it. macOS will not know the developer, so use **Open Anyway**: try to open it, then System Settings > Privacy & Security, scroll to the message about the app and choose Open Anyway. If macOS says the app is damaged instead, run this once, for this app only, and open it again:

   ```bash
   xattr -dr com.apple.quarantine ~/Applications/"Nautilus for Mirror Eval.app"
   ```

   Do not turn Gatekeeper off.
4. macOS may ask whether the app may use a key stored in your keychain. That is expected: this build has a different signature from the installed one, so macOS asks again.
5. Use it as you normally would, and tell the maintainer whether it opens, how long it takes and what does not work, with a screenshot of anything odd. It helps to say whether the installed Intel build behaved differently.

To remove it, quit it and delete the app. Your data stays where it was.

## What is not in it

- It is **not a release**. It has no Apple signature or notarization, only an ad hoc one, so macOS asks you to confirm opening it.
- There is **no updater**: it never updates itself and never offers an update. A new build is a new file.
- The **voice** component is not available: its manifest has no arm64 entry yet.
- It was built and checked on the runner (identity, version, arm64 executable, arm64 Node, runtime receipt) but nobody opened it before you did.
