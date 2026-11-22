import { beforeEach, expect, it, vi } from "vitest";
import { favoriteClubSupportersSuggestion } from "../src/lib/favoriteClubSupporters";

const state = vi.hoisted(() => ({ ownerId: "owner", enabled: true }));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: state.ownerId ? { user: { id: state.ownerId } } : null,
  }),
}));
vi.mock("../src/lib/supportersConfig", () => ({
  get SUPPORTERS_ENABLED() {
    return state.enabled;
  },
}));
vi.mock("../src/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("expo-router", () => ({ Link: "link" }));
vi.mock("lucide-react-native", () => ({
  ChevronRight: "chevron",
  UsersRound: "users",
}));
vi.mock("react-native", () => ({
  Pressable: "pressable",
  Text: "text",
  View: "view",
  StyleSheet: { create: (styles: unknown) => styles },
}));
import { FavoriteClubSupportersPrompt } from "../src/components/FavoriteClubSupportersPrompt";

const before = {
  id: "owner",
  city: "Lyon",
  favorite_pro_club: "Ancien club",
  favorite_amateur_club: null,
};

beforeEach(() => {
  state.ownerId = "owner";
  state.enabled = true;
});

it("suggests only changed nonempty favorite clubs confirmed by the save response", () => {
  expect(
    favoriteClubSupportersSuggestion({
      ownerId: "owner",
      before,
      saved: {
        ...before,
        favorite_pro_club: " Paris Saint-Germain ",
        favorite_amateur_club: "AS Lyon",
        city: " Paris ",
      },
      editedKeys: ["favorite_pro_club", "favorite_amateur_club"],
    }),
  ).toEqual({
    ownerId: "owner",
    clubs: ["Paris Saint-Germain", "AS Lyon"],
    city: "Paris",
  });
});

it("does not prompt for unchanged favorites, clearing, or unrelated edits", () => {
  for (const saved of [
    before,
    { ...before, favorite_pro_club: " ancien CLUB " },
    { ...before, favorite_pro_club: null },
    { ...before, favorite_pro_club: " " },
  ])
    expect(
      favoriteClubSupportersSuggestion({
        ownerId: "owner",
        before,
        saved,
        editedKeys: ["favorite_pro_club"],
      }),
    ).toBeNull();
  expect(
    favoriteClubSupportersSuggestion({
      ownerId: "owner",
      before,
      saved: { ...before, favorite_pro_club: "Autre club" },
      editedKeys: ["jersey_number"],
    }),
  ).toBeNull();
});

it("deduplicates favorites and tolerates a profile without a city", () => {
  expect(
    favoriteClubSupportersSuggestion({
      ownerId: "owner",
      before: null,
      saved: {
        id: "owner",
        favorite_pro_club: "Club de Paris",
        favorite_amateur_club: " club de PARIS ",
      },
      editedKeys: ["favorite_pro_club", "favorite_amateur_club"],
    }),
  ).toEqual({ ownerId: "owner", clubs: ["Club de Paris"] });
});

it("rejects saved responses or baselines belonging to another owner", () => {
  for (const [previous, saved] of [
    [before, { ...before, id: "other", favorite_pro_club: "Nouveau club" }],
    [
      { ...before, id: "other" },
      { ...before, favorite_pro_club: "Nouveau club" },
    ],
  ])
    expect(
      favoriteClubSupportersSuggestion({
        ownerId: "owner",
        before: previous,
        saved,
        editedKeys: ["favorite_pro_club"],
      }),
    ).toBeNull();
});

function allElements(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(allElements);
  return [node, ...allElements(node.props?.children)];
}

it("offers an explicit discovery link with encoded club and city search terms", () => {
  const onNavigate = vi.fn();
  const result = FavoriteClubSupportersPrompt({
    suggestion: {
      ownerId: "owner",
      clubs: ["RC Étoile & Mer"],
      city: "Saint-Étienne",
    },
    onNavigate,
  });
  const link = allElements(result).find((node) => node.type === "link");
  expect(link).toBeDefined();
  const url = new URL(link.props.href, "https://example.test");
  expect(url.pathname).toBe("/supporters");
  expect(url.searchParams.get("club")).toBe("RC Étoile & Mer");
  expect(url.searchParams.get("city")).toBe("Saint-Étienne");
  expect(url.searchParams.has("clubId")).toBe(false);
  expect(onNavigate).not.toHaveBeenCalled();
  const button = allElements(link).find((node) => node.type === "pressable");
  button.props.onPress();
  expect(onNavigate).toHaveBeenCalledOnce();
});

it("hides the invitation when disabled, signed out, or the active account changes", () => {
  const suggestion = { ownerId: "owner", clubs: ["AS Lyon"] };
  state.enabled = false;
  expect(FavoriteClubSupportersPrompt({ suggestion })).toBeNull();
  state.enabled = true;
  for (const ownerId of ["", "other"]) {
    state.ownerId = ownerId;
    expect(FavoriteClubSupportersPrompt({ suggestion })).toBeNull();
  }
});
