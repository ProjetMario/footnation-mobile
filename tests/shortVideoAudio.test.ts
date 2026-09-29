import { beforeEach, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState(initial: any) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots))
      hooks.slots[index] = typeof initial === "function" ? initial() : initial;
    return [
      hooks.slots[index],
      (value: any) => {
        hooks.slots[index] =
          typeof value === "function" ? value(hooks.slots[index]) : value;
      },
    ];
  },
  useRef(initial: any) {
    const index = hooks.cursor++;
    return (hooks.slots[index] ||= { current: initial });
  },
  useEffect(fn: () => void, dependencies: unknown[]) {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as unknown[] | undefined;
    hooks.slots[index] = dependencies;
    if (
      !previous ||
      dependencies.some((value, i) => !Object.is(previous[i], value))
    )
      hooks.effects.push(fn);
  },
  useCallback: (fn: any) => fn,
  useMemo: (fn: any) => fn(),
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: vi.fn() }),
  },
  Platform: { OS: "web" },
  View: "View",
  Pressable: "Pressable",
  Text: "Text",
  ScrollView: "ScrollView",
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (fn: any) => {
    fn();
  },
}));
vi.mock("expo-audio", () => ({
  useAudioPlayer: vi.fn(),
  useAudioPlayerStatus: vi.fn(),
}));
vi.mock("lucide-react-native", () => ({
  Play: "Play",
  Pause: "Pause",
  Volume2: "Volume2",
  VolumeX: "VolumeX",
  RotateCcw: "RotateCcw",
  RotateCw: "RotateCw",
  Music: "Music",
  AudioLines: "AudioLines",
}));
vi.mock("../src/components/Video", () => ({ NativeVideo: "NativeVideo" }));
vi.mock("../src/components/CallProvider", () => ({
  useCalls: () => ({ busy: false }),
}));
vi.mock("../src/components/ui", () => ({
  useUIStyles: () => ({}),
  Chip: "Chip",
}));
vi.mock("../src/theme", () => ({ useTheme: () => ({ colors: {} }) }));
import { ShortVideo } from "../src/components/ShortVideo";

function nodes(element: any): any[] {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}
function render(extra = {}) {
  const props = {
    uri: "fixture.mp4",
    musicUri: "fixture.mp3",
    controls: false,
    autoplay: true,
    ...extra,
  };
  hooks.cursor = 0;
  ShortVideo(props);
  hooks.effects.splice(0).forEach((effect) => effect());
  hooks.cursor = 0;
  return nodes(ShortVideo(props));
}
beforeEach(() => {
  hooks.slots = [];
  hooks.cursor = 0;
  hooks.effects = [];
});
it("mounts the soundtrack for the Reels layout even without the editing toolbar", () => {
  const tree = render();
  expect(
    tree.find((node) => node.type.name === "ShortSoundtrack"),
  ).toBeDefined();
  expect(tree.find((node) => node.type === "NativeVideo").props.volume).toBe(0);
});
it("lets the Reels sound button unmute the video and the selected music together", () => {
  const tree = render({ muted: false });
  expect(
    tree.find((node) => node.type.name === "ShortSoundtrack").props.muted,
  ).toBe(false);
  expect(tree.find((node) => node.type === "NativeVideo").props.muted).toBe(
    false,
  );
});
it("uses original audio when there is no music or the soundtrack fails", () => {
  let tree = render();
  tree
    .find((node) => node.type.name === "ShortSoundtrack")
    .props.onUnavailable();
  tree = render();
  expect(
    tree.find((node) => node.type.name === "ShortSoundtrack"),
  ).toBeUndefined();
  expect(tree.find((node) => node.type === "NativeVideo").props.volume).toBe(1);
});
it("removes the soundtrack when the short leaves the visible feed", () => {
  render();
  const tree = render({ visible: false });
  expect(
    tree.find((node) => node.type.name === "ShortSoundtrack"),
  ).toBeUndefined();
  expect(tree.find((node) => node.type === "NativeVideo").props.visible).toBe(
    false,
  );
});
it("does not apply a seek from the previous file when replacing the preview video", () => {
  let tree = render();
  tree
    .find((node) => node.type === "NativeVideo")
    .props.onPlayback({
      seconds: 18,
      duration: 60,
      playing: true,
      ready: true,
      rate: 1,
    });
  tree = render();
  tree
    .find(
      (node) => node.props?.accessibilityLabel === "Mettre le short en pause",
    )
    .props.onPress();
  tree = render();
  expect(
    tree.find((node) => node.type === "NativeVideo").props.seek,
  ).toBeDefined();
  tree = render({ uri: "another-fixture.mp4" });
  expect(
    tree.find((node) => node.type === "NativeVideo").props.seek,
  ).toBeUndefined();
  expect(tree.find((node) => node.type === "NativeVideo").props.active).toBe(
    true,
  );
});
it("lets the loading/error player receive Retry clicks instead of covering it with the pause overlay", () => {
  let tree = render();
  const overlay = () =>
    tree.find(
      (node) => node.props?.accessibilityLabel === "Mettre le short en pause",
    );
  expect(overlay().props.pointerEvents).toBe("none");
  tree
    .find((node) => node.type === "NativeVideo")
    .props.onPlayback({
      seconds: 0,
      duration: 60,
      playing: true,
      ready: true,
      rate: 1,
    });
  tree = render();
  expect(overlay().props.pointerEvents).toBe("auto");
  tree
    .find((node) => node.type === "NativeVideo")
    .props.onPlayback({
      seconds: 0,
      duration: 60,
      playing: false,
      ready: false,
      rate: 1,
    });
  tree = render();
  expect(overlay().props.pointerEvents).toBe("none");
  expect(overlay().props.disabled).toBe(true);
});
it("preserves pause and resume while keeping the playback position", () => {
  let tree = render();
  tree
    .find((node) => node.type === "NativeVideo")
    .props.onPlayback({
      seconds: 18,
      duration: 60,
      playing: true,
      ready: true,
      rate: 1,
    });
  tree = render();
  tree
    .find(
      (node) => node.props?.accessibilityLabel === "Mettre le short en pause",
    )
    .props.onPress();
  tree = render();
  expect(tree.find((node) => node.type === "NativeVideo").props.active).toBe(
    false,
  );
  expect(
    tree.find((node) => node.type === "NativeVideo").props.seek.seconds,
  ).toBe(18);
  tree
    .find((node) => node.props?.accessibilityLabel === "Reprendre le short")
    .props.onPress();
  tree = render();
  expect(tree.find((node) => node.type === "NativeVideo").props.active).toBe(
    true,
  );
  expect(
    tree.find((node) => node.type === "NativeVideo").props.seek.seconds,
  ).toBe(18);
});
