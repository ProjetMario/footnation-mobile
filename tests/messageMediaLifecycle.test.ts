import { describe, expect, it, vi } from "vitest";
import {
  createMessagePlaybackArbiter,
  prepareVoiceRecording,
} from "../src/lib/messageMediaLifecycle";

function setup() {
  return {
    current: vi.fn(() => true),
    permission: vi.fn(async () => true),
    mode: vi.fn(async (_enabled: boolean) => {}),
    prepare: vi.fn(async () => {}),
    record: vi.fn(),
    stop: vi.fn(async () => {}),
    discard: vi.fn(),
  };
}
describe("voice recording preparation lifecycle", () => {
  it("starts the microphone only after granted permission and successful preparation", async () => {
    const ports = setup();
    await expect(prepareVoiceRecording(ports)).resolves.toBe(true);
    expect(ports.record).toHaveBeenCalledOnce();
    expect(ports.stop).not.toHaveBeenCalled();
    expect(ports.discard).not.toHaveBeenCalled();
  });
  it("does not start or prepare after a cancelled permission request resolves", async () => {
    const ports = setup();
    let resolve!: (allowed: boolean) => void;
    ports.permission.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = prepareVoiceRecording(ports);
    ports.current.mockReturnValue(false);
    resolve(true);
    await expect(pending).resolves.toBe(false);
    expect(ports.mode).not.toHaveBeenCalled();
    expect(ports.prepare).not.toHaveBeenCalled();
    expect(ports.record).not.toHaveBeenCalled();
  });
  it("stops a delayed preparation after blur even if the app returns before it finishes", async () => {
    const ports = setup();
    let revision = 1;
    const attempt = revision;
    let ready!: () => void;
    const entered = new Promise<void>((done) => {
      ports.prepare.mockImplementation(async () => {
        done();
        await new Promise<void>((resolve) => {
          ready = resolve;
        });
      });
    });
    ports.current.mockImplementation(() => attempt === revision);
    const pending = prepareVoiceRecording(ports);
    await entered;
    revision++;
    ready();
    await expect(pending).resolves.toBe(false);
    expect(ports.record).not.toHaveBeenCalled();
    expect(ports.stop).toHaveBeenCalledOnce();
    expect(ports.mode.mock.calls.map(([enabled]) => enabled)).toEqual([
      true,
      false,
    ]);
    expect(ports.discard).toHaveBeenCalledOnce();
  });
  it("cleans a partially prepared recorder on failure even when stop fails", async () => {
    const ports = setup();
    ports.prepare.mockRejectedValue(new Error("Native interruption"));
    ports.stop.mockRejectedValue(new Error("Not prepared"));
    await expect(prepareVoiceRecording(ports)).rejects.toThrow(
      "Native interruption",
    );
    expect(ports.record).not.toHaveBeenCalled();
    expect(ports.stop).toHaveBeenCalledOnce();
    expect(ports.mode).toHaveBeenLastCalledWith(false);
    expect(ports.discard).toHaveBeenCalledOnce();
  });
  it("returns the audio session to playback mode if native record fails", async () => {
    const ports = setup();
    ports.record.mockImplementation(() => {
      throw new Error("Microphone busy");
    });
    await expect(prepareVoiceRecording(ports)).rejects.toThrow(
      "Microphone busy",
    );
    expect(ports.stop).toHaveBeenCalledOnce();
    expect(ports.mode).toHaveBeenLastCalledWith(false);
    expect(ports.discard).toHaveBeenCalledOnce();
  });
  it("keeps permission denial explicit without enabling a recording session", async () => {
    const ports = setup();
    ports.permission.mockResolvedValue(false);
    await expect(prepareVoiceRecording(ports)).rejects.toThrow("microphone");
    expect(ports.mode).not.toHaveBeenCalled();
    expect(ports.record).not.toHaveBeenCalled();
  });
});
describe("message audio playback arbitration", () => {
  it("prevents an older slow signing request from stealing playback after a newer click", async () => {
    const arbiter = createMessagePlaybackArbiter();
    const playing: string[] = [];
    let resolveFirst!: () => void;
    const first = arbiter.take();
    const firstLoad = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    }).then(() => {
      if (arbiter.current(first)) playing.push("first");
    });
    const second = arbiter.take();
    if (arbiter.current(second)) playing.push("second");
    resolveFirst();
    await firstLoad;
    expect(playing).toEqual(["second"]);
  });
  it("pauses existing players and no longer touches an unmounted player", () => {
    const arbiter = createMessagePlaybackArbiter();
    const a = vi.fn(),
      b = vi.fn();
    const remove = arbiter.subscribe(a);
    arbiter.subscribe(b);
    arbiter.take();
    remove();
    arbiter.take();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledTimes(2);
  });
});
