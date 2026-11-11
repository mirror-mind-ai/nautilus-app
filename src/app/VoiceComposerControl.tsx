import { useEffect, useState } from "react";
import { allowMicrophoneListing, readAudioInputs, watchAudioInputs, type AudioInputListing } from "./voiceCapture";
import {
  describeInstallProgress,
  describeVoiceModel,
  formatComponentSize,
  voiceControlIntent,
  voiceControlLabel,
  voiceLanguages,
  type VoiceComponentCatalog,
  type VoiceComponentStatus,
  type VoiceLanguage,
  type VoiceControlIntent,
  type VoiceInstallProgress,
  type VoiceSession,
} from "../domain/voiceTranscription";

type VoiceComposerControlProps = {
  status: VoiceComponentStatus | undefined;
  session: VoiceSession;
  installing: boolean;
  composerBusy: boolean;
  onIntent: (intent: VoiceControlIntent) => void;
};

/**
 * One microphone entry point for two separate consents: installing the local
 * component and recording. It never starts a recording after installation.
 */
export function VoiceComposerControl({ status, session, installing, composerBusy, onIntent }: VoiceComposerControlProps) {
  const intent = voiceControlIntent(status, session, { installing, composerBusy });
  const label = voiceControlLabel(intent, session, installing);
  const recording = session.kind === "recording";
  const busy = session.kind === "transcribing" || session.kind === "requesting_permission" || installing;
  return (
    <button
      className={`icon-button voice-composer-button${recording ? " is-recording" : ""}${busy ? " is-busy" : ""}`}
      type="button"
      onClick={() => onIntent(intent)}
      disabled={intent === "blocked"}
      aria-label={label}
      aria-pressed={recording}
      title={label}
      data-voice-intent={intent}
    >
      {recording ? <StopIcon /> : <MicrophoneIcon />}
    </button>
  );
}

/** Conventional microphone: capsule, cradle arc, stand and base. */
function MicrophoneIcon() {
  return (
    <svg className="voice-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="voice-icon" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

type VoiceSessionStatusProps = {
  session: VoiceSession;
  elapsedSeconds?: number;
  /** CR242: the microphone recording, named while recording only. */
  microphone?: string;
  onCancel: () => void;
};

export function VoiceSessionStatus({ session, elapsedSeconds, microphone, onCancel }: VoiceSessionStatusProps) {
  if (session.kind === "idle") return null;
  const text = session.kind === "recording"
    ? `Recording${microphone ? ` from ${microphone}` : ""}${elapsedSeconds !== undefined ? ` · ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}` : ""} · limit 5:00`
    : session.kind === "transcribing"
      ? "Transcribing locally…"
      : "Waiting for microphone permission…";
  return (
    <div className={`voice-session-status is-${session.kind}`} role="status" aria-live="polite">
      <span className="runtime-live-dot" aria-hidden="true" />
      <span>{text}</span>
      <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

type VoiceModelPickerProps = {
  catalog: VoiceComponentCatalog | undefined;
  loading: boolean;
  modelId: string | undefined;
  disabled: boolean;
  onChange: (modelId: string) => void;
};

/**
 * Accuracy and speed trade off sharply by model and the right answer depends on
 * the machine, so the choice belongs to the Navigator rather than to a default
 * baked in from one benchmark.
 */
export function VoiceModelPicker({ catalog, loading, modelId, disabled, onChange }: VoiceModelPickerProps) {
  if (!catalog) {
    return loading ? <p className="provider-note" role="status">Reading the available speech models…</p> : null;
  }
  const selected = modelId ?? catalog.defaultModel;
  return (
    <label className="voice-model-picker">
      <span>Speech model</span>
      <select value={selected} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {catalog.models.map((model) => (
          <option key={model.id} value={model.id}>
            {describeVoiceModel(model.id).label} · {formatComponentSize(model.sizeBytes)}
            {model.id === catalog.defaultModel ? " · recommended" : ""}
          </option>
        ))}
      </select>
      <small>{describeVoiceModel(selected).detail}</small>
    </label>
  );
}

type VoiceInstallDialogProps = {
  status: VoiceComponentStatus;
  installing: boolean;
  progress?: VoiceInstallProgress;
  error?: string;
  catalog?: VoiceComponentCatalog;
  catalogLoading: boolean;
  modelId?: string;
  onModelChange: (modelId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function VoiceInstallDialog({ status, installing, progress, error, catalog, catalogLoading, modelId, onModelChange, onConfirm, onClose }: VoiceInstallDialogProps) {
  const ready = status.state === "ready";
  return (
    <div className="settings-backdrop" role="presentation" onClick={() => !installing && onClose()}>
      <section
        className="settings-window voice-install-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Install local voice transcription"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <div>
            <p className="eyebrow">Voice prompt composition</p>
            <h2>{ready ? "Local transcription is ready" : "Install local transcription?"}</h2>
            <p className="settings-intro">
              {ready
                ? "Click the microphone again to start a recording. Nothing was recorded during installation."
                : "Nautilus downloads a small speech-to-text engine and model, verifies their checksums and keeps them in this app's data folder."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={installing}>×</button>
        </header>
        {!ready ? (
          <div className="restart-assurances">
            <p>Audio is transcribed on this computer. Recordings are never uploaded and are deleted after each transcription.</p>
            <p>The download is roughly 100 MB and can be removed at any time in Settings → Voice.</p>
            <p>Installing does not turn on the microphone. Recording starts only when you click the microphone afterwards.</p>
          </div>
        ) : null}
        {!ready ? (
          <VoiceModelPicker catalog={catalog} loading={catalogLoading} modelId={modelId} disabled={installing} onChange={onModelChange} />
        ) : null}
        {installing ? <p className="provider-note" role="status">{describeInstallProgress(progress)}</p> : null}
        {error ? <p className="settings-error" role="alert">{error}</p> : null}
        <div className="provider-actions">
          {ready ? (
            <button type="button" onClick={onClose}>Done</button>
          ) : (
            <>
              <button type="button" onClick={onConfirm} disabled={installing}>{installing ? "Installing…" : "Install"}</button>
              <button className="secondary-button" type="button" onClick={onClose} disabled={installing}>Not now</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

type VoiceLanguagePickerProps = {
  language: VoiceLanguage;
  disabled: boolean;
  onChange: (language: VoiceLanguage) => void;
};

/**
 * Naming the language skips the engine's detection pass, which is a large share
 * of the wait on a short prompt. Detection remains the default because a wrong
 * hint transcribes the wrong language outright.
 */
export function VoiceLanguagePicker({ language, disabled, onChange }: VoiceLanguagePickerProps) {
  return (
    <label className="voice-model-picker">
      <span>Spoken language</span>
      <select value={language} disabled={disabled} onChange={(event) => onChange(event.target.value as VoiceLanguage)}>
        {voiceLanguages.map((entry) => (
          <option key={entry.id} value={entry.id}>{entry.label}</option>
        ))}
      </select>
      <small>
        {language === "auto"
          ? "The engine detects the language on every recording, which adds noticeably to the wait."
          : "Skips language detection, so transcription finishes sooner. Speaking another language will transcribe incorrectly."}
      </small>
    </label>
  );
}

type VoiceInputPickerProps = {
  inputDeviceId: string | undefined;
  disabled: boolean;
  onChange: (inputDeviceId: string | undefined) => void;
};

/**
 * Which microphone records. The system default is the first choice and the one most people keep;
 * the list is what the browser enumerates. Until a microphone has been allowed the system hides the
 * list (CR241: on macOS a plugged-in Shure MV5 was invisible and the picker said none was found),
 * so the picker offers to allow it without recording. It follows microphones plugged in or out. A
 * chosen device that is gone falls back to the default at recording time (`startVoiceCapture`), so
 * a stale choice never records nothing.
 */
export function VoiceInputPicker({ inputDeviceId, disabled, onChange }: VoiceInputPickerProps) {
  const [listing, setListing] = useState<AudioInputListing>({ devices: [], hidden: false });
  const [refresh, setRefresh] = useState(0);
  const [allowing, setAllowing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void readAudioInputs()
      .then((found) => { if (!cancelled) setListing((current) => ({ ...found, error: found.hidden ? current.error : undefined })); })
      .catch(() => { if (!cancelled) setListing({ devices: [], hidden: false }); });
    return () => { cancelled = true; };
  }, [refresh]);
  useEffect(() => watchAudioInputs(() => setRefresh((n) => n + 1)), []);
  const allow = () => {
    setAllowing(true);
    void allowMicrophoneListing()
      .then(() => setListing((current) => ({ ...current, error: undefined })))
      .catch((error: unknown) => setListing((current) => ({ ...current, error: error instanceof Error ? error.message : "voice_capture_unsupported" })))
      .finally(() => { setAllowing(false); setRefresh((n) => n + 1); });
  };
  return <VoiceInputPickerView listing={listing} inputDeviceId={inputDeviceId} disabled={disabled} allowing={allowing} onChange={onChange} onAllow={allow} onFocus={() => setRefresh((n) => n + 1)} />;
}

type VoiceInputPickerViewProps = {
  listing: AudioInputListing;
  inputDeviceId: string | undefined;
  disabled: boolean;
  allowing: boolean;
  onChange: (inputDeviceId: string | undefined) => void;
  onAllow: () => void;
  onFocus?: () => void;
};

export function VoiceInputPickerView({ listing, inputDeviceId, disabled, allowing, onChange, onAllow, onFocus }: VoiceInputPickerViewProps) {
  const { devices, hidden, error } = listing;
  const chosenKnown = inputDeviceId === undefined || devices.some((device) => device.deviceId === inputDeviceId);
  const offerAllow = hidden && devices.length === 0;
  return (
    <div className="voice-model-picker">
      <span id="voice-input-picker-label">Microphone</span>
      <select aria-labelledby="voice-input-picker-label" value={inputDeviceId ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || undefined)} onFocus={onFocus}>
        <option value="">System default</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
        ))}
        {!chosenKnown ? <option value={inputDeviceId}>Chosen microphone (not connected now)</option> : null}
      </select>
      {offerAllow ? (
        <button type="button" className="secondary-button voice-input-allow" onClick={onAllow} disabled={disabled || allowing}>
          {allowing ? "Allowing…" : "Allow microphone to list them"}
        </button>
      ) : null}
      <small>
        {devices.length > 0
          ? "Recording uses this microphone. If it is unplugged, the system default is used instead."
          : error === "voice_permission_denied"
            ? "The microphone is not allowed. Allow Nautilus in the system's Privacy settings for the microphone, then try again."
            : offerAllow
              ? "The system names the microphones only after Nautilus may use one. Nothing is recorded."
              : "No microphone was found."}
      </small>
    </div>
  );
}

type VoiceSettingsPanelProps = {
  status: VoiceComponentStatus | undefined;
  installing: boolean;
  removing: boolean;
  progress?: VoiceInstallProgress;
  error?: string;
  sessionActive: boolean;
  catalog?: VoiceComponentCatalog;
  catalogLoading: boolean;
  modelId?: string;
  language: VoiceLanguage;
  onModelChange: (modelId: string) => void;
  onLanguageChange: (language: VoiceLanguage) => void;
  /** The microphone picker; absent (as in older callers and tests) means the system default, unpicked. */
  inputDeviceId?: string;
  onInputDeviceChange?: (inputDeviceId: string | undefined) => void;
  onInstall: () => void;
  onRemove: () => void;
};

export function VoiceSettingsPanel({ status, installing, removing, progress, error, sessionActive, catalog, catalogLoading, modelId, language, inputDeviceId, onModelChange, onLanguageChange, onInputDeviceChange, onInstall, onRemove }: VoiceSettingsPanelProps) {
  const busy = installing || removing || sessionActive;
  const installed = status?.modelId;
  const selected = modelId ?? catalog?.defaultModel;
  const switching = status?.state === "ready" && selected !== undefined && selected !== installed;
  return (
    <section className="settings-section provider-card" aria-label="Local voice transcription">
      <h3>Local voice transcription</h3>
      <p className="settings-intro">Optional speech-to-text component managed by Nautilus. Audio never leaves this computer.</p>
      <dl>
        <div className="voice-status-row"><dt>Status</dt><dd><span className={`voice-status-badge is-${status?.state ?? "checking"}`}>{voiceStateLabel(status)}</span></dd></div>
        {status?.state === "ready" ? (
          <>
            <div><dt>Engine</dt><dd>whisper.cpp {status.componentVersion}</dd></div>
            <div><dt>Model</dt><dd>{describeVoiceModel(status.modelId ?? "").label} ({status.modelId})</dd></div>
            <div><dt>Size</dt><dd>{formatComponentSize(status.sizeBytes)}</dd></div>
            {status.installedAt ? <div><dt>Installed</dt><dd>{status.installedAt}</dd></div> : null}
          </>
        ) : null}
      </dl>
      {status?.message ? <p className="provider-note">{status.message}</p> : null}
      {installing ? <p className="provider-note" role="status">{describeInstallProgress(progress)}</p> : null}
      {error ? <p className="provider-error" role="alert">{error}</p> : null}
      {status?.state === "ready" || status?.state === "not_installed" ? (
        <VoiceModelPicker catalog={catalog} loading={catalogLoading} modelId={selected} disabled={busy} onChange={onModelChange} />
      ) : null}
      {status?.state === "ready" ? (
        <VoiceLanguagePicker language={language} disabled={sessionActive} onChange={onLanguageChange} />
      ) : null}
      {status?.state === "ready" && onInputDeviceChange ? (
        <VoiceInputPicker inputDeviceId={inputDeviceId} disabled={sessionActive} onChange={onInputDeviceChange} />
      ) : null}
      {switching ? (
        <p className="provider-note">Switching models downloads the new one and replaces the installed model. The engine is kept.</p>
      ) : null}
      <div className="provider-actions">
        {status?.state === "not_installed" || status?.state === "damaged" ? (
          <button type="button" onClick={onInstall} disabled={busy || status.state === "damaged"}>{installing ? "Installing…" : "Install local transcription"}</button>
        ) : null}
        {switching ? (
          <button type="button" onClick={onInstall} disabled={busy}>{installing ? "Installing…" : "Switch model"}</button>
        ) : null}
        {status?.state === "ready" || status?.state === "damaged" ? (
          <button type="button" className="secondary-button" onClick={onRemove} disabled={busy}>{removing ? "Removing…" : "Remove local transcription"}</button>
        ) : null}
      </div>
    </section>
  );
}

function voiceStateLabel(status: VoiceComponentStatus | undefined): string {
  switch (status?.state) {
    case "ready": return "Installed and verified";
    case "not_installed": return "Not installed";
    case "damaged": return "Incomplete — remove and install again";
    case "unsupported": return "Not available on this platform";
    default: return "Checking…";
  }
}
