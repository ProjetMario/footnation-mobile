import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserVoiceRecording,
  voiceRecordingMime,
} from "../src/lib/browserVoiceRecording";

class Recorder {
  static isTypeSupported(mime: string) {
    return mime === "audio/webm";
  }
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"]) });
    this.onstop?.();
  }
}
function setup() {
  const stop = vi.fn();
  const capture = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
  return { capture, stop };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("browser voice messages", () => {
  it("records an actual supported mime and releases the microphone after stop", async () => {
    const { stop, capture } = setup();
    const recording = new BrowserVoiceRecording(vi.fn());
    expect(capture).not.toHaveBeenCalled();
    expect(await recording.start()).toBe(true);
    const result = await recording.stop();
    expect(result?.mime).toBe("audio/webm");
    expect(await result?.blob.text()).toBe("voice");
    expect(result?.seconds).toBeGreaterThan(0);
    expect(capture).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("stops a permission result that arrives after leaving the conversation", async () => {
    const { capture, stop } = setup();
    let resolve!: (value: unknown) => void;
    capture.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const recording = new BrowserVoiceRecording(vi.fn());
    const pending = recording.start();
    recording.dispose();
    resolve({ getTracks: () => [{ stop }] });
    expect(await pending).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("caps a voice message at two minutes and cancels the timer on dispose", async () => {
    vi.useFakeTimers();
    setup();
    const limit = vi.fn();
    const recording = new BrowserVoiceRecording(limit);
    await recording.start();
    vi.advanceTimersByTime(120000);
    expect(limit).toHaveBeenCalledTimes(1);
    recording.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects unsupported recording without requesting the microphone", async () => {
    const { capture } = setup();
    vi.stubGlobal("MediaRecorder", undefined);
    expect(voiceRecordingMime()).toBeNull();
    await expect(new BrowserVoiceRecording(vi.fn()).start()).rejects.toThrow(
      "compatible",
    );
    expect(capture).not.toHaveBeenCalled();
  });
});
