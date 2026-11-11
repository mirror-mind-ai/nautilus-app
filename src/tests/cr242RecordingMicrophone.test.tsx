// CR242: while recording, the composer says which microphone is recording. The name is the one the
// recording's own track carries, so a fallback to the system default is named as what it is.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { startVoiceCapture } from "../app/voiceCapture";
import { VoiceSessionStatus } from "../app/VoiceComposerControl";
import appSource from "../app/App.tsx?raw";

function fakeStream(label: string): MediaStream {
  const track = { kind: "audio", label, stop: vi.fn(), readyState: "live" } as unknown as MediaStreamTrack;
  return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  listeners = new Map<string, () => void>();
  constructor(public stream: MediaStream) {}
  addEventListener(type: string, listener: () => void) { this.listeners.set(type, listener); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.listeners.get("stop")?.(); }
}

async function withRecorder(run: () => Promise<void>) {
  const previous = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
  try { await run(); } finally { (globalThis as { MediaRecorder?: unknown }).MediaRecorder = previous; }
}

describe("CR242: the microphone that is recording", () => {
  it("is the name the recording's track carries, including after a fallback", async () => {
    await withRecorder(async () => {
      const chosen = await startVoiceCapture({ mediaDevices: { getUserMedia: async () => fakeStream("Shure MV5") }, inputDeviceId: "mv5" });
      expect(chosen.microphone).toBe("Shure MV5");
      chosen.cancel();
      const getUserMedia = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "OverconstrainedError" }))
        .mockResolvedValueOnce(fakeStream("Microfone (MacBook Pro)"));
      const fallback = await startVoiceCapture({ mediaDevices: { getUserMedia }, inputDeviceId: "mv5" });
      expect(fallback.microphone).toBe("Microfone (MacBook Pro)");
      fallback.cancel();
      const nameless = await startVoiceCapture({ mediaDevices: { getUserMedia: async () => fakeStream("") } });
      expect(nameless.microphone).toBeUndefined();
      nameless.cancel();
    });
  });

  it("is named in the recording status, and left out when unknown", () => {
    const named = renderToStaticMarkup(<VoiceSessionStatus session={{ kind: "recording", draftKey: "j", startedAt: 1 }} elapsedSeconds={5} microphone="Shure MV5" onCancel={() => undefined} />);
    expect(named).toContain("Recording from Shure MV5 · 0:05 · limit 5:00");
    const unnamed = renderToStaticMarkup(<VoiceSessionStatus session={{ kind: "recording", draftKey: "j", startedAt: 1 }} elapsedSeconds={5} onCancel={() => undefined} />);
    expect(unnamed).toContain("Recording · 0:05 · limit 5:00");
    const transcribing = renderToStaticMarkup(<VoiceSessionStatus session={{ kind: "transcribing", draftKey: "j" }} microphone="Shure MV5" onCancel={() => undefined} />);
    expect(transcribing).not.toContain("Shure MV5");
  });

  it("is passed from the capture to the status", () => {
    expect(appSource).toContain("setVoiceMicrophone(capture.microphone)");
    expect(appSource).toContain("microphone={voiceMicrophone}");
  });
});
