[< RS016](index.md)

# CR234: Choose a Bundled Persona Medal

**Status:** merged 2026-11-11, awaiting the Navigator's validation; published in v0.4.0-alpha.12 (2026-11-11)
**Driver:** Rodrigo (`rodrigoimmaginario`), external contribution
**Source:** [PR #4](https://github.com/mirror-mind-ai/nautilus-app/pull/4), merged as `67a70a46` on the Navigator's explicit authorization.

## Change

Adds 23 bundled PNG medals and an accessible gallery in the persona screen. `choose_persona_medal` accepts an allowlisted medal name and writes compiled image bytes to the selected home's persona image store. Chosen images appear in the sidebar, speech and persona preview. Working animation is unchanged.

The original proposal also inferred a default medal from a matching persona id. The Navigator rejected that behavior and authorized CR235 to retain explicit choices only. The rationale and exact modification were documented publicly before merge in [the PR comment](https://github.com/mirror-mind-ai/nautilus-app/pull/4#issuecomment-6799126883). That earlier comment includes private persona examples; canonical repository records intentionally do not repeat them.

## Evaluation and Limits

Evaluated together with #7: TypeScript clean, vitest 2,943 passed and 3 skipped, build passed, cargo 525 passed and 11 ignored. Two preflight skips reflect the unmaterialized worktree runtime. Source after merge exactly matched the evaluated source. The only merge conflict was the additive command census: 119 plus one command from each PR equals 121; its five tests passed after resolution. There is no CI. Local evidence is macOS only; choosing and removing medals still need field validation.

PNGs exist both in public assets and compiled native bytes (about 2.2 MB each). Deduplication is deferred. The unnumbered Canvas candidate is replaced by this canonical record. No unrelated Appearance decision is asserted here.

## Falsifier

Choose any medal for any persona, including an id absent from the bundled names. The saved image appears consistently after reopening. Another persona's image is untouched. Removing the image returns to the diamond after CR235. Unknown medal names cannot write arbitrary files.
