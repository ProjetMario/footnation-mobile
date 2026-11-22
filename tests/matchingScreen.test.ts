import { beforeEach, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  ArrowLeft: "icon",
  ArrowUpRight: "icon",
  Check: "icon",
  MessageCircle: "icon",
  SlidersHorizontal: "icon",
  Sparkles: "icon",
}));

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
  push: vi.fn(),
  hasProfile: true,
  supportsClubs: true,
  pending: false,
  mutation: {} as any,
  insert: vi.fn(),
  writeError: null as Error | null,
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
  ScrollView: "scroll-view",
  Text: "text",
  View: "view",
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "status-bar" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: "safe-area-provider",
  SafeAreaView: "safe-area",
}));
vi.mock("expo-router", () => ({
  usePathname: () => "/matching",
  router: {
    canGoBack: () => state.canGoBack,
    back: state.back,
    replace: state.replace,
    push: state.push,
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useInfiniteQuery: () => ({ isPending: false, data: { pages: [] } }),
  useMutation: (options: any) => {
    state.mutation = options;
    return {
      error: state.error,
      mutate: state.mutate,
      reset: state.reset,
      isPending: state.pending,
    };
  },
}));
vi.mock("../src/hooks/useMatchingEntities", () => ({
  useMatchingEntities: () => ({
    data: {
      pages: [
        {
          entities: state.items,
          hasProfile: state.hasProfile,
          supportsClubs: state.supportsClubs,
        },
      ],
    },
    isPending: false,
  }),
}));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "viewer" } } }),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        in: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async (row: any) => {
          state.insert(table, row);
          return { error: state.writeError };
        },
      };
      return query;
    },
  },
}));
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
  state.hasProfile = true;
  state.supportsClubs = true;
  state.pending = false;
  state.writeError = null;
  vi.clearAllMocks();
});

it("shows a rejected swipe inside the fullscreen card", () => {
  state.error = new Error("Impossible d’enregistrer votre intérêt");
  const card = find(render(), "match-card");
  expect(nodes(card.props.overlay)).toContain(state.error.message);
});

it("can review the final handled card after suggestions are exhausted without sending another swipe", () => {
  state.items = [];
  state.slots[5] = [candidate];
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
  nodes(render())
    .find((node) => node?.type === "modal" && node.props.visible)
    .props.onRequestClose();
  expect(state.replace).toHaveBeenCalledWith("/");
  expect(state.back).not.toHaveBeenCalled();
});

it("opens profile setup from either positive action and returns to matching after saving", () => {
  state.hasProfile = false;
  const card = find(render(), "match-card");
  expect(card.props.canLike).toBe(false);
  expect(card.props.onLikeUnavailable).toBeTypeOf("function");
  card.props.onLikeUnavailable();
  expect(state.push).toHaveBeenCalledWith({
    pathname: "/profile-setup",
    params: { next: "/matching" },
  });
  for (const direction of ["right", "super"]) card.props.onChoose(direction);
  expect(state.mutate).not.toHaveBeenCalled();
});

it("explains an unsupported club action without sending a swipe", () => {
  state.items = [{ ...candidate, entity_type: "club" }];
  state.supportsClubs = false;
  find(render(), "match-card").props.onLikeUnavailable();
  expect(nodes(find(render(), "match-card").props.overlay)).toContain(
    "La mise en relation avec ce club n’est pas encore disponible. Vous pouvez consulter sa fiche.",
  );
  expect(state.push).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
});

it.each(["right", "super"])(
  "persists %s, confirms it, and advances to the next suggestion",
  async (direction) => {
    state.items = [candidate, { ...candidate, id: "next" }];
    const card = find(render(), "match-card");
    expect(card.props.canLike).toBe(true);
    card.props.onChoose(direction);
    expect(state.mutate).toHaveBeenCalledWith({ item: candidate, direction });
    const result = await state.mutation.mutationFn({
      item: candidate,
      direction,
    });
    expect(state.insert).toHaveBeenCalledExactlyOnceWith("swipes", {
      swiper_id: "viewer",
      target_id: "player",
      target_type: "profile",
      direction,
    });
    state.mutation.onSuccess(result, { item: candidate, direction });
    const next = find(render(), "match-card");
    expect(next.props.item.id).toBe("next");
    expect(nodes(next.props.overlay)).toContain(
      "Votre intérêt est enregistré.",
    );
  },
);

it("keeps the same suggestion and exposes the error when saving fails", async () => {
  state.writeError = new Error("Connexion interrompue. Réessayez.");
  render();
  await expect(
    state.mutation.mutationFn({ item: candidate, direction: "right" }),
  ).rejects.toThrow("Connexion interrompue");
  state.error = state.writeError;
  const card = find(render(), "match-card");
  expect(card.props.item).toBe(candidate);
  expect(nodes(card.props.overlay)).toContain(state.writeError.message);
});

it("lets applied filters replace the quick category instead of being silently overridden", () => {
  state.slots[1] = true;
  state.slots[2] = "Clubs";
  find(render(), "button", "Appliquer les filtres").props.onPress();
  expect(state.slots[2]).toBe("Tous");
  expect(state.slots[1]).toBe(false);
});

it("gives the fullscreen deck its own safe-area root and a readable status bar", () => {
  const tree = render();
  const modal = nodes(tree).find(
    (node) => node?.type === "modal" && node.props.visible,
  );
  expect(modal.props.presentationStyle).toBe("fullScreen");
  const provider = find(modal, "safe-area-provider");
  expect(provider).toBeDefined();
  expect(find(provider, "match-card")).toBeDefined();
  expect(find(provider, "status-bar").props.style).toBe("light");
});

it("opens filters from the enlarged header control without submitting a choice", () => {
  const tree = render();
  const filtersButton = nodes(find(tree, "match-card").props.overlay).find(
    (node) => node?.props?.accessibilityLabel === "Filtres",
  );
  const style = filtersButton.props.style({ pressed: false });
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
  expect(style.minWidth).toBeGreaterThanOrEqual(48);
  expect(filtersButton.props.hitSlop).toBe(6);
  filtersButton.props.onPress();
  const filtered = render();
  expect(find(filtered, "button", "Appliquer les filtres")).toBeDefined();
  expect(
    nodes(filtered).some(
      (node) => node?.type === "modal" && node.props.visible,
    ),
  ).toBe(false);
  expect(find(filtered, "status-bar")).toBeUndefined();
  expect(state.mutate).not.toHaveBeenCalled();
});

it("keeps fullscreen categories in one scrollable row on narrow screens", () => {
  const overlay = find(render(), "match-card").props.overlay;
  const categories = find(overlay, "scroll-view");
  expect(categories.props.horizontal).toBe(true);
  expect(
    nodes(categories).filter((node) => node?.type === "pressable"),
  ).toHaveLength(5);
  for (const chip of nodes(categories).filter(
    (node) => node?.type === "pressable",
  )) {
    expect(chip.props.style.minHeight).toBeGreaterThanOrEqual(44);
  }
});
