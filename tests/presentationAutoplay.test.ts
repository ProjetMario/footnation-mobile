import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  player: { loop: false, muted: false, play: vi.fn(), pause: vi.fn() },
  focus: null as null | (() => void | (() => void)),
  appChange: null as null | ((value: string) => void),
  remove: vi.fn(),
  source: "",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: any) => fn,
  useState: () => [true, vi.fn()],
}));
vi.mock("expo-router", () => ({
  Redirect: "Redirect",
  useFocusEffect: (fn: any) => { state.focus = fn; },
}));
vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (value: any) => value, absoluteFill: {} },
  AppState: { currentState: "active", addEventListener: (_event: string, fn: any) => {
    state.appChange = fn;
    return { remove: state.remove };
  } },
}));
vi.mock("expo-video", () => ({
  VideoView: "VideoView",
  useVideoPlayer: (source: string, setup: any) => {
    state.source = source;
    setup(state.player);
    return state.player;
  },
}));
import NativePresentation from "../src/components/PresentationVideo";
import WebPresentation from "../src/components/PresentationVideo.web";
import Start from "../app/(tabs)/index";
import { presentationVideoUrl } from "../src/components/presentationVideoSource";
const props = { title: "Présentation", language: "fr", watchLabel: "Lire" };
beforeEach(() => vi.clearAllMocks());
it("opens home on a fresh root launch", () => {
  expect(Start().props.href).toBe("/home");
});
it("uses playable localized video files", () => {
  expect(presentationVideoUrl("fr-FR")).toMatch(/presentation\.mp4$/);
  expect(presentationVideoUrl("en")).toMatch(/presentation-en\.mp4$/);
});
it("autoplays native video only while focused and foregrounded", () => {
  NativePresentation(props);
  expect(state.source).toMatch(/\.mp4$/);
  expect(state.player.loop).toBe(true);
  expect(state.player.muted).toBe(true);
  const blur = state.focus!();
  expect(state.player.play).toHaveBeenCalledOnce();
  state.appChange!("background");
  expect(state.player.pause).toHaveBeenCalledOnce();
  state.appChange!("active");
  expect(state.player.play).toHaveBeenCalledTimes(2);
  if (typeof blur === "function") blur();
  expect(state.remove).toHaveBeenCalledOnce();
  expect(state.player.pause).toHaveBeenCalledTimes(2);
});
it("requests muted inline autoplay on web and keeps manual playback available", () => {
  const video = WebPresentation(props)!;
  expect(video.type).toBe("video");
  expect(video.props).toMatchObject({ autoPlay: true, muted: true, loop: true, playsInline: true, controls: true });
  const element = { muted: false, play: vi.fn().mockResolvedValue(undefined) };
  video.props.ref(element);
  expect(element.muted).toBe(true);
  expect(element.play).toHaveBeenCalledOnce();
});
