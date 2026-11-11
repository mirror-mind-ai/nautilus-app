// CR241: on macOS the WebView hides the microphones until one has been allowed, so the picker
// showed only "System default" and said none was found while a Shure MV5 was plugged in. The
// picker now tells hidden from absent, offers to allow the microphone to list them, and follows
// microphones that are plugged in or out.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { allowMicrophoneListing, readAudioInputs, watchAudioInputs } from "../app/voiceCapture";
import { VoiceInputPickerView } from "../app/VoiceComposerControl";

const hiddenByWebKit = [
  { kind: "audioinput", deviceId: "", label: "" },
  { kind: "audiooutput", deviceId: "", label: "" },
] as MediaDeviceInfo[];
const allowed = [
  { kind: "audioinput", deviceId: "builtin", label: "Microfone (MacBook Pro)" },
  { kind: "audioinput", deviceId: "mv5", label: "Shure MV5" },
] as MediaDeviceInfo[];

function view(listing: Parameters<typeof VoiceInputPickerView>[0]["listing"], extra: Partial<Parameters<typeof VoiceInputPickerView>[0]> = {}) {
  return renderToStaticMarkup(<VoiceInputPickerView listing={listing} inputDeviceId={undefined} disabled={false} allowing={false} onChange={() => undefined} onAllow={() => undefined} {...extra} />);
}

describe("CR241: the microphones the picker can offer", () => {
  it("tells microphones the system hides from no microphone at all", async () => {
    expect(await readAudioInputs({ mediaDevices: { enumerateDevices: async () => hiddenByWebKit } })).toEqual({ devices: [], hidden: true });
    expect(await readAudioInputs({ mediaDevices: { enumerateDevices: async () => [] } })).toEqual({ devices: [], hidden: false });
    expect(await readAudioInputs({ mediaDevices: { enumerateDevices: async () => allowed } })).toEqual({
      devices: [{ deviceId: "builtin", label: "Microfone (MacBook Pro)" }, { deviceId: "mv5", label: "Shure MV5" }],
      hidden: false,
    });
    // Windows before the first allowance: ids, no names.
    const nameless = [{ kind: "audioinput", deviceId: "131b4ad0", label: "" }] as MediaDeviceInfo[];
    expect((await readAudioInputs({ mediaDevices: { enumerateDevices: async () => nameless } })).hidden).toBe(true);
  });

  it("offers to allow the microphone when the list is hidden, instead of saying none was found", () => {
    const hidden = view({ devices: [], hidden: true });
    expect(hidden).toContain("Allow microphone to list them");
    expect(hidden).not.toContain("No microphone was found");
    expect(hidden).toContain("System default");
    const none = view({ devices: [], hidden: false });
    expect(none).toContain("No microphone was found.");
    expect(none).not.toContain("Allow microphone");
  });

  it("names every microphone once allowed, the MV5 among them", () => {
    const listed = view({ devices: [{ deviceId: "builtin", label: "Microfone (MacBook Pro)" }, { deviceId: "mv5", label: "Shure MV5" }], hidden: false }, { inputDeviceId: "mv5" });
    expect(listed).toContain('<option value="mv5" selected="">Shure MV5</option>');
    expect(listed).not.toContain("Allow microphone");
    expect(listed).toContain("If it is unplugged, the system default is used instead.");
  });

  it("says where to allow it when the system refuses", () => {
    const refused = view({ devices: [], hidden: true, error: "voice_permission_denied" });
    expect(refused).toContain("Privacy");
    expect(view({ devices: [], hidden: true }, { allowing: true })).toContain("Allowing…");
  });

  it("allows the microphone without recording: the stream is released at once", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }, { stop }] }) as unknown as MediaStream);
    await allowMicrophoneListing({ mediaDevices: { getUserMedia } });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(stop).toHaveBeenCalledTimes(2);
    const denied = vi.fn().mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    await expect(allowMicrophoneListing({ mediaDevices: { getUserMedia: denied } })).rejects.toThrow("voice_permission_denied");
  });

  it("follows microphones plugged in or out, and stops following when asked", () => {
    const listeners = new Set<() => void>();
    const mediaDevices = {
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
    const changed = vi.fn();
    const stop = watchAudioInputs(changed, { mediaDevices });
    listeners.forEach((listener) => listener());
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.size).toBe(0);
    expect(() => watchAudioInputs(changed, {})()).not.toThrow();
  });
});
