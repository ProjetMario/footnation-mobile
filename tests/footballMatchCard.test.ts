import { beforeEach, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  ArrowUpRight: "icon",
  Heart: "icon",
  MapPin: "icon",
  RotateCcw: "icon",
  Star: "icon",
  X: "icon",
}));

const state = vi.hoisted(() => ({
  gesture: {} as any,
  width: 402,
  height: 874,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (fn: () => unknown) => fn(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  Animated: {
    Value: class {
      interpolate() {
        return 0;
      }
      setValue() {}
    },
    View: "animated-view",
    Text: "text",
    spring: () => ({ start: () => {} }),
  },
  Image: "image",
  Pressable: "pressable",
  Text: "text",
  View: "view",
  ScrollView: "scroll-view",
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
  PanResponder: {
    create: (value: unknown) => {
      state.gesture = value;
      return {
        panHandlers: {
          onMoveShouldSetResponder: state.gesture.onMoveShouldSetPanResponder,
        },
      };
    },
  },
  useWindowDimensions: () => ({ width: state.width, height: state.height }),
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "gradient" }));
vi.mock("../src/lib/brandAssets", () => ({ brandIcon: "fixture-icon" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "safe-area",
}));
import { FootballMatchCard } from "../src/components/FootballMatchCard";

const onChoose = vi.fn(),
  onLikeUnavailable = vi.fn();
const item: any = {
  id: "player",
  name: "Joueur",
  entity_type: "profile",
  avatar_url: "https://example.com/avatar.jpg",
  location: {},
};
const render = (props: Record<string, unknown> = {}) =>
  FootballMatchCard({
    item,
    busy: false,
    canLike: true,
    showScore: true,
    onChoose,
    onLikeUnavailable,
    onOpen: vi.fn(),
    ...props,
  });
function nodes(value: any): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
const button = (tree: any, label: string) =>
  nodes(tree).find((node) => node.props?.accessibilityLabel === label);

beforeEach(() => vi.clearAllMocks());

it.each([
  ["Intéressé", "right"],
  ["Coup de cœur", "super"],
])("sends the correct choice from %s", (label, direction) => {
  const action = button(render(), label);
  expect(action.props.disabled).toBe(false);
  action.props.onPress();
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(direction);
});

it.each(["Intéressé", "Coup de cœur"])(
  "keeps %s actionable when the profile needs completing",
  (label) => {
    const action = button(render({ canLike: false }), label);
    expect(action.props.disabled).toBe(false);
    action.props.onPress();
    expect(onLikeUnavailable).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  },
);

it("handles a right swipe with the same profile-completion action", () => {
  render({ canLike: false });
  state.gesture.onPanResponderRelease(null, { dx: 110 });
  expect(onLikeUnavailable).toHaveBeenCalledOnce();
  expect(onChoose).not.toHaveBeenCalled();
});

it("blocks taps and gestures while the choice is being saved", () => {
  const tree = render({ busy: true });
  for (const label of ["Intéressé", "Coup de cœur", "Passer"]) {
    const action = button(tree, label);
    expect(action.props.disabled).toBe(true);
    action.props.onPress();
  }
  state.gesture.onPanResponderRelease(null, { dx: 110 });
  expect(onChoose).not.toHaveBeenCalled();
  expect(onLikeUnavailable).not.toHaveBeenCalled();
});

it.each([
  [402, 874],
  [320, 568],
  [874, 402],
])(
  "fits the modal at %i × %i without imposing the full window height on its contents",
  (width, height) => {
    state.width = width;
    state.height = height;
    const tree = render({ fullscreen: true, overlay: "Filtres" });
    const card = nodes(tree).find((node) => node.type === "animated-view");
    const style = Object.assign({}, ...card.props.style.filter(Boolean));
    expect(style.height).toBeUndefined();
    expect(style.flex).toBe(1);
    expect(style.minHeight).toBe(0);
    expect(nodes(card).some((node) => node.type === "scroll-view")).toBe(true);
    expect(button(card, "Intéressé")).toBeUndefined();
    expect(button(tree, "Intéressé")).toBeDefined();
  },
);

it("keeps the navigation outside the swipe surface and protects top/bottom controls with native safe areas", () => {
  const tree = render({ fullscreen: true, overlay: "Filtres" });
  const areas = nodes(tree).filter((node) => node.type === "safe-area");
  const header = areas.find((node) => node.props.edges.includes("top"));
  const footer = areas.find((node) => node.props.edges.includes("bottom"));
  expect(header.props.children).toBe("Filtres");
  expect(button(footer, "Intéressé")).toBeDefined();
  const card = nodes(tree).find((node) => node.type === "animated-view");
  expect(nodes(card)).not.toContain(header);
  expect(nodes(card)).not.toContain(footer);
});
