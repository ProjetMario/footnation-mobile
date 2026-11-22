import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canGoBack: true,
  focused: true,
  back: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  setState: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useState: (initial: unknown) => [initial, state.setState],
}));
vi.mock("react-native", () => ({
  FlatList: "list",
  Modal: "modal",
  Pressable: "pressable",
  ScrollView: "scroll",
  Text: "text",
  TextInput: "input",
  View: "view",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "gradient" }));
vi.mock("expo-status-bar", () => ({ StatusBar: "status-bar" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: "safe-area-provider",
}));
vi.mock("expo-router", () => ({
  usePathname: () => (state.focused ? "/opportunities" : "/profile/author"),
  router: {
    canGoBack: () => state.canGoBack,
    back: state.back,
    replace: state.replace,
    push: state.push,
  },
}));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "Briefcase",
      "ArrowLeft",
      "ArrowUpRight",
      "SlidersHorizontal",
      "Plus",
      "Building2",
      "MapPin",
      "Megaphone",
      "Search",
      "Send",
      "Sparkles",
      "Target",
      "UserRound",
    ].map((name) => [name, "icon"]),
  ),
);
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { name: "Auteur" } }),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
vi.mock("../src/lib/data", () => ({
  useOpportunities: () => ({
    data: {
      pages: [
        [
          {
            id: "opportunity",
            user_id: "author",
            title: "Devenir professionnel",
            listing_kind: "request",
          },
        ],
      ],
    },
  }),
}));
vi.mock("../src/components/FootballMatchCard", () => ({
  FootballMatchCard: "match-card",
}));
vi.mock("../src/components/ui", () =>
  Object.fromEntries(
    ["Button", "Empty", "ErrorState", "Loading", "Screen"].map((name) => [
      name,
      name.toLowerCase(),
    ]),
  ),
);
vi.mock("../src/components/AuthGate", () => ({ AuthGate: "auth-gate" }));
vi.mock("../src/screens/OpportunityActions", () => ({
  creationTypes: [],
  opportunityProfiles: [],
}));
vi.mock("../src/components/ChoiceField", () => ({ ChoiceField: "choice" }));
vi.mock("../src/lib/networkOptions", () => ({ departmentOptions: [] }));
vi.mock("../src/theme", () => ({
  useTheme: vi.fn(),
  useThemedStyles: vi.fn(),
}));
vi.mock("../src/lib/i18n", () => ({ useTranslation: vi.fn() }));

import Opportunities from "../src/screens/Opportunities";
function nodes(element: any): any[] {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [
    element,
    ...nodes(element.props?.children),
    ...nodes(element.props?.overlay),
  ];
}
function render() {
  const screen = Opportunities() as any;
  return screen.props.children.type();
}
const find = (tree: any, type: string) =>
  nodes(tree).find((node) => node.type === type);
beforeEach(() => {
  vi.clearAllMocks();
  state.canGoBack = true;
  state.focused = true;
});
it("measures the opportunity modal safe areas inside its native full-screen window", () => {
  const modal = find(render(), "modal");
  expect(modal.props.presentationStyle).toBe("fullScreen");
  const provider = find(modal, "safe-area-provider");
  expect(provider).toBeDefined();
  expect(find(provider, "match-card").props.fullscreen).toBe(true);
  expect(find(provider, "status-bar").props.style).toBe("light");
});
it.each([true, false])(
  "returns from the modal with history=%s",
  (hasHistory) => {
    state.canGoBack = hasHistory;
    const modal = find(render(), "modal");
    const back = nodes(modal).find(
      (node) => node.props?.accessibilityLabel === "Retour",
    );
    back.props.onPress();
    expect(hasHistory ? state.back : state.replace).toHaveBeenCalledWith(
      ...(hasHistory ? [] : ["/"]),
    );
    modal.props.onRequestClose();
    expect(hasHistory ? state.back : state.replace).toHaveBeenCalledTimes(2);
  },
);
it("stops displaying the modal status bar when navigating away", () => {
  state.focused = false;
  const modal = find(render(), "modal");
  expect(modal.props.visible).toBe(false);
  expect(find(modal, "status-bar")).toBeUndefined();
});
