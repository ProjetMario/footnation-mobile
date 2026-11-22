// @vitest-environment jsdom
import React, {
  act,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  players: [] as any[],
  appListeners: new Set<(state: string) => void>(),
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_: string, fn: (state: string) => void) => {
      fixture.appListeners.add(fn);
      return { remove: () => fixture.appListeners.delete(fn) };
    },
  },
  Platform: { OS: "web" },
  StyleSheet: { create: (x: unknown) => x, absoluteFill: {} },
  View: (p: any) => React.createElement("div", null, p.children),
  Text: (p: any) => React.createElement("span", null, p.children),
  Pressable: (p: any) =>
    React.createElement("button", { onClick: p.onPress }, p.children),
  ActivityIndicator: () => null,
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
}));
vi.mock("expo-image", () => ({
  Image: () => React.createElement("img", { "data-poster": "true" }),
}));
vi.mock("../src/theme", () => ({
  useTheme: () => ({ colors: {} }),
  useThemedStyles: () => ({}),
}));
vi.mock("../src/lib/monitoring", () => ({ reportError: vi.fn() }));
vi.mock("lucide-react-native", () => ({
  Play: () => null,
  RotateCcw: () => null,
}));
vi.mock("expo-video", () => ({
  useVideoPlayer: (uri: string, configure: (p: any) => void) =>
    useMemo(() => {
      const listeners = new Map<string, Set<(event: any) => void>>();
      const p: any = {
        uri,
        status: "idle",
        currentTime: 0,
        duration: 20,
        playing: false,
        playbackRate: 1,
        muted: false,
        addListener: (name: string, fn: (e: any) => void) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(fn);
          return { remove: () => listeners.get(name)!.delete(fn) };
        },
        emit: (name: string, event: any) =>
          listeners.get(name)?.forEach((fn) => fn(event)),
        pause: vi.fn(() => {
          p.playing = false;
          p.emit("playingChange", { isPlaying: false });
        }),
      };
      configure(p);
      fixture.players.push(p);
      return p;
    }, [uri]),
  VideoView: forwardRef((p: any, ref) => {
    const el = useRef<HTMLVideoElement>(null);
    useImperativeHandle(ref, () => ({ nativeRef: el }));
    useEffect(() => {
      p.player.firstFrame = p.onFirstFrameRender;
      if (el.current)
        el.current.play = vi.fn(async () => {
          p.player.playing = true;
          p.player.emit("playingChange", { isPlaying: true });
        });
    }, [p.player, p.onFirstFrameRender]);
    return React.createElement("video", { src: p.player.uri, ref: el });
  }),
}));
import { NativeVideo } from "../src/components/Video";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.players.length = 0;
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("stops autoplay retries after playback starts so native controls can keep a deliberate pause", async () => {
  vi.useFakeTimers();
  await draw({ visible: true, active: true, controls: true });
  const player = fixture.players[0];
  const element = host.querySelector("video")!;
  await ready(player);
  await act(() => player.emit("playingChange", { isPlaying: true }));
  const calls = vi.mocked(element.play).mock.calls.length;
  await act(() => {
    player.playing = false;
    player.emit("playingChange", { isPlaying: false });
    vi.advanceTimersByTime(3000);
  });
  expect(element.play).toHaveBeenCalledTimes(calls);
});

it("bounds autoplay retry attempts if the browser never grants playback", async () => {
  vi.useFakeTimers();
  await draw({ visible: true, active: true });
  const element = host.querySelector("video")!;
  vi.mocked(element.play).mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));
  await ready(fixture.players[0]);
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  const calls = vi.mocked(element.play).mock.calls.length;
  expect(calls).toBeGreaterThan(1);
  expect(calls).toBeLessThanOrEqual(11);
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  expect(element.play).toHaveBeenCalledTimes(calls);
});
const draw = async (props: any) => {
  await act(() =>
    root.render(
      React.createElement(NativeVideo, {
        uri: "next.mp4",
        posterUri: "next.jpg",
        ...props,
      }),
    ),
  );
};
const ready = async (player: any) => {
  await act(() => {
    player.status = "readyToPlay";
    player.emit("statusChange", { status: "readyToPlay" });
  });
};

it("preloads silently then promotes the SAME player and element without reloading its source", async () => {
  await draw({ visible: false, preload: true, active: false, muted: false });
  const player = fixture.players[0],
    element = host.querySelector("video")!;
  await ready(player);
  expect(element.preload).toBe("auto");
  expect(player.muted).toBe(true);
  expect(element.play).not.toHaveBeenCalled();
  expect(host.querySelector("[data-poster]")).not.toBeNull();
  await act(() => player.firstFrame());
  expect(host.querySelector("[data-poster]")).toBeNull();
  await draw({ visible: true, preload: false, active: true, muted: false });
  expect(fixture.players).toHaveLength(1);
  expect(host.querySelector("video")).toBe(element);
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  expect(element.play).toHaveBeenCalledOnce();
  expect(player.muted).toBe(false);
  await draw({ visible: false, preload: false, active: false });
  expect(host.querySelector("video")).toBeNull();
  expect(element.getAttribute("src")).toBeNull();
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
});

it("does not play a preload even with a pending seek; background releases both active and preload surfaces", async () => {
  await draw({
    visible: false,
    preload: true,
    active: false,
    seek: { seconds: 3, request: 1, play: true },
  });
  await ready(fixture.players[0]);
  expect(host.querySelector("video")!.play).not.toHaveBeenCalled();
  await act(() => fixture.appListeners.forEach((fn) => fn("background")));
  expect(host.querySelector("video")).toBeNull();
});

it("falls back to the original once when the optimized object is unavailable", async () => {
  await draw({
    uri: "optimized.mp4",
    fallbackUri: "original.mp4",
    visible: true,
    active: true,
  });
  const fail = async () => {
    await act(() => {
      const p = fixture.players.at(-1);
      p.status = "error";
      p.emit("statusChange", { status: "error" });
    });
  };
  await fail();
  expect(fixture.players.map((p) => p.uri)).toEqual([
    "optimized.mp4",
    "original.mp4",
  ]);
  await fail();
  expect(fixture.players).toHaveLength(2);
  expect(host.textContent).toContain("Cette vidéo n’est pas disponible");
});

it("requests playback from metadata on Safari instead of waiting for a canplay event", async () => {
  await draw({ visible: true, active: true, muted: true });
  const element = host.querySelector("video")!,
    player = fixture.players[0];
  Object.defineProperty(element, "readyState", {
    configurable: true,
    value: 1,
  });
  await act(() => element.dispatchEvent(new Event("loadedmetadata")));
  expect(element.play).toHaveBeenCalledOnce();
  // Metadata alone cannot uncover a black video frame.
  expect(host.querySelector("[data-poster]")).not.toBeNull();
  await ready(player);
  await act(() => player.firstFrame());
  expect(host.querySelector("[data-poster]")).toBeNull();
});

it("uncovers a decoded WebKit frame even when Expo missed its first-frame event", async () => {
  const onPlayback = vi.fn();
  await draw({ visible: true, active: true, muted: true, onPlayback });
  const element = host.querySelector("video")!;
  await ready(fixture.players[0]);
  expect(host.querySelector("[data-poster]")).not.toBeNull();
  Object.defineProperty(element, "readyState", { configurable: true, value: 2 });
  await act(() => element.dispatchEvent(new Event("loadeddata")));
  expect(host.querySelector("[data-poster]")).toBeNull();
  expect(host.textContent).not.toContain("Chargement de la vidéo");
  expect(onPlayback).toHaveBeenLastCalledWith(expect.objectContaining({ ready: true }));
});
