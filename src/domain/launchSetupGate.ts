/**
 * Which setup steps show at launch (slice 3c). A person who finished setup on this device before (a
 * model is kept) is not held while the app reads what it already knew; the reads still bring a step
 * back when they find it unfinished.
 */

/** What decides whether setup shows the provider step (slice 3c-1, CR175). */
export type ProviderSetupReading = {
  /** The person opened the step themselves. */
  stepOpen: boolean;
  /** A sign-in started from the step is in progress. */
  signingInFromSetup: boolean;
  /** Pi has answered which providers are signed in, at least once since launch. */
  providersRead: boolean;
  anyProviderReady: boolean;
  /** Claude through the app's own Claude Code counts as a connected provider (CR175). */
  claudeCodeInstalled: boolean;
  /** Setup was finished on this device before: a model is kept. */
  setupFinishedBefore: boolean;
};

/**
 * Whether setup shows the provider step. Until Pi answers, only a person who never finished setup
 * waits for it; a person who did works meanwhile, and Pi's answer still brings the step back when
 * nothing is signed in.
 */
export function providerSetupNeeded(reading: ProviderSetupReading): boolean {
  if (reading.stepOpen || reading.signingInFromSetup) return true;
  if (!reading.providersRead) return !reading.setupFinishedBefore;
  return !(reading.anyProviderReady || reading.claudeCodeInstalled);
}

/** What decides whether setup shows the OpenRouter key step (slice 3c-2). */
export type OpenRouterSetupReading = {
  /** The person went on without a key in this session. */
  skipped: boolean;
  /** The kept key's status has been read since launch. */
  keyRead: boolean;
  configured: boolean;
  declined: boolean;
  /** Setup was finished on this device before: a model is kept. */
  setupFinishedBefore: boolean;
};

/**
 * Whether setup shows the OpenRouter key step. While the key's status is read, a person who never
 * finished setup sees the step checking, as before; a person who did is not shown it for that moment.
 */
export function openRouterSetupNeeded(reading: OpenRouterSetupReading): boolean {
  if (reading.skipped) return false;
  if (!reading.keyRead) return !reading.setupFinishedBefore;
  return !(reading.configured || reading.declined);
}
