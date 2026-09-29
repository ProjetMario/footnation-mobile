import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  slots: {} as Record<number, any>,
  cursor: 0,
  items: [] as any[],
  error: null as Error | null,
  back: vi.fn(),
  replace: vi.fn(),
  mutate: vi.fn(),
  reset: vi.fn(),
  canGoBack: false,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: () => {},
  useReducer: (_reducer: unknown, initial: unknown) => [initial, vi.fn()],
  useState: (initial: unknown) => {
    const slot = state.cursor++;
    if (!(slot in state.slots)) state.slots[slot] = initial;
    return [
      state.slots[slot],
      (value: any) => {
        state.slots[slot] =
          typeof value === "function" ? value(state.slots[slot]) : value;
      },
    ];
  },
}));
vi.mock("react-native", () => ({
  Modal: "modal",
  Pressable: "pressable",
  Text: "text",
  View: "view",
}));
vi.mock("expo-router", () => ({
  usePathname: () => "/matching",
  router: {
    canGoBack: () => state.canGoBack,
    back: state.back,
    replace: state.replace,
    push: vi.fn(),
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useInfiniteQuery: () => ({ isPending: false, data: { pages: [] } }),
  useMutation: () => ({
    error: state.error,
    mutate: state.mutate,
    reset: state.reset,
    isPending: false,
  }),
}));
vi.mock("../src/hooks/useMatchingEntities", () => ({
  useMatchingEntities: () => ({
    data: {
      pages: [{ entities: state.items, hasProfile: true, supportsClubs: true }],
    },
    isPending: false,
  }),
}));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "viewer" } } }),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
vi.mock("../src/lib/matchingSchema", () => ({
  supportsClubMatching: async () => true,
}));
vi.mock("../src/components/FootballMatchCard", () => ({
  FootballMatchCard: "match-card",
}));
vi.mock("../src/components/ChoiceField", () => ({ ChoiceField: "choice" }));
vi.mock("../src/components/AuthGate", () => ({ AuthGate: "auth-gate" }));
vi.mock("../src/components/ui", () => ({
  Avatar: "avatar",
  Button: "button",
  Chip: "chip",
  Empty: "empty",
  ErrorState: "error",
  Loading: "loading",
  Screen: "screen",
  useUIStyles: () => ({}),
}));
import Matching from "../src/screens/Matching";

const candidate = {
  id: "player",
  entity_type: "profile",
  name: "Joueur exemple",
};
const render = () => {
  state.cursor = 0;
  const screen = Matching() as any;
  return screen.props.children.props.children.type();
};
function nodes(element: any): any[] {
  if (!element) return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (typeof element !== "object") return [element];
  return [
    element,
    ...nodes(element.props?.children),
    ...nodes(element.props?.overlay),
  ];
}
const find = (tree: any, type: string, title?: string) =>
  nodes(tree).find(
    (node) => node?.type === type && (!title || node.props.title === title),
  );

beforeEach(() => {
  state.slots = {};
  state.items = [candidate];
  state.error = null;
  state.canGoBack = false;
  vi.clearAllMocks();
});

it("shows a rejected swipe inside the fullscreen card", () => {
  state.error = new Error("Impossible d’enregistrer votre intérêt");
  const card = find(render(), "match-card");
  expect(nodes(card.props.overlay)).toContain(state.error.message);
});

it("can review the final handled card after suggestions are exhausted without sending another swipe", () => {
  state.items = [];
  state.slots[3] = [candidate];
  const review = find(render(), "button", "Revoir la dernière fiche");
  expect(review).toBeDefined();
  review.props.onPress();
  const card = find(render(), "match-card");
  expect(card.props.item.id).toBe("player");
  expect(card.props.busy).toBe(true);
  card.props.onChoose("right");
  expect(state.mutate).not.toHaveBeenCalled();
});

it("returns to home from a directly opened matching page", () => {
  find(render(), "modal").props.onRequestClose();
  expect(state.replace).toHaveBeenCalledWith("/");
  expect(state.back).not.toHaveBeenCalled();
});

it("lets applied filters replace the quick category instead of being silently overridden", () => {
  state.slots[1] = true;
  state.slots[2] = "Clubs";
  find(render(), "button", "Appliquer les filtres").props.onPress();
  expect(state.slots[2]).toBe("Tous");
  expect(state.slots[1]).toBe(false);
});
