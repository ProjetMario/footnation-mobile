import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachCallMedia,
  browserCallDependencies,
} from "../src/lib/browserCalls";
import type { CallBackend } from "../src/lib/calls";

afterEach(() => vi.unstubAllGlobals());
describe("browser call adapter", () => {
  it("does not capture until requested and preserves the relay-only constraint", async () => {
    const stream = {} as MediaStream;
    const capture = vi.fn().mockResolvedValue(stream);
    const construct = vi.fn();
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
    vi.stubGlobal(
      "RTCPeerConnection",
      class {
        constructor(config: RTCConfiguration) {
          construct(config);
        }
      },
    );
    const deps = browserCallDependencies({} as CallBackend);
    expect(capture).not.toHaveBeenCalled();
    expect(await deps.getUserMedia({ audio: true, video: false })).toBe(stream);
    expect(capture).toHaveBeenCalledWith({ audio: true, video: false });
    deps.createPeerConnection({
      iceServers: [{ urls: "turn:relay.test:3478" }],
      iceTransportPolicy: "all",
    });
    expect(construct).toHaveBeenCalledWith({
      iceServers: [{ urls: "turn:relay.test:3478" }],
      iceTransportPolicy: "relay",
    });
  });
  it("reports unsupported browsers without capturing", async () => {
    const capture = vi.fn();
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
    await expect(
      browserCallDependencies({} as CallBackend).getUserMedia({ audio: true }),
    ).rejects.toThrow("HTTPS");
    expect(capture).not.toHaveBeenCalled();
  });
  it("offers user-activated audio when autoplay is refused and detaches on cleanup", async () => {
    const blocked = vi.fn();
    const element = {
      srcObject: null,
      muted: true,
      play: vi.fn().mockRejectedValue(new Error("autoplay")),
      pause: vi.fn(),
    };
    const stream = { getTracks: vi.fn() };
    const detach = attachCallMedia(
      element as unknown as HTMLVideoElement,
      stream as unknown as MediaStream,
      false,
      blocked,
    );
    await Promise.resolve();
    expect(element.srcObject).toBe(stream);
    expect(element.muted).toBe(false);
    expect(blocked).toHaveBeenCalledWith(true);
    detach();
    expect(element.srcObject).toBeNull();
    expect(element.pause).toHaveBeenCalled();
    expect(stream.getTracks).not.toHaveBeenCalled();
  });
  it("ignores a late playback promise after a stream view is detached", async () => {
    let resolve!: () => void;
    const element = {
      srcObject: null,
      muted: false,
      play: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
      pause: vi.fn(),
    };
    const blocked = vi.fn();
    const detach = attachCallMedia(
      element as unknown as HTMLVideoElement,
      {} as MediaStream,
      true,
      blocked,
    );
    detach();
    resolve();
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
  });
});
