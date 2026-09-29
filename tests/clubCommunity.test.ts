import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  query: null as any,
  rows: [] as any[],
  error: null as Error | null,
}));
vi.mock("react-native", () => ({
  Pressable: "button",
  Text: "span",
  View: "div",
}));
vi.mock("lucide-react-native", () => ({ ChevronRight: "span" }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("../src/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("../src/components/ClubExperienceMembers", () => ({
  ClubExperienceMembers: "div",
}));
vi.mock("../src/components/ClubDesign", () => ({
  ClubButton: "button",
  useClubUIStyles: () => ({}),
}));
vi.mock("../src/components/ui", () => ({
  Avatar: "div",
  Empty: "div",
  ErrorState: "div",
  Loading: "div",
  MenuRow: "div",
}));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown) => {
    state.query = options;
    return { isPending: true };
  },
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: () => {
      let offset = 0;
      let end = Infinity;
      const request: any = {
        select: () => request,
        eq: () => request,
        or: () => request,
        order: () => request,
        range: (from: number, to: number) => {
          offset = from;
          end = to;
          return request;
        },
        returns: () => request,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: state.rows.slice(offset, end + 1),
            error: state.error,
          }).then(resolve),
      };
      return request;
    },
  },
}));
import { ClubCommunityPanel } from "../src/components/ClubCommunityPanel";

beforeEach(() => {
  state.rows = [];
  state.error = null;
});
const query = (mode = "followers") => {
  ClubCommunityPanel({ id: "club", name: "Club exemple", mode });
  return state.query;
};

it("continues past a full follower page even when a profile is unavailable", async () => {
  state.rows = Array.from({ length: 31 }, (_, index) => ({
    id: `follow-${index}`,
    profile:
      index === 0
        ? null
        : {
            id: `profile-${index}`,
            full_name: `Membre ${index}`,
            avatar_url: null,
          },
  }));
  const options = query();
  const first = await options.queryFn({ pageParam: 0 });
  expect(first.rows).toHaveLength(29);
  const next = options.getNextPageParam(first, [first]);
  expect(next).toBe(30);
  const second = await options.queryFn({ pageParam: next });
  expect(second.rows.map((row: any) => row.id)).toEqual(["profile-30"]);
  expect(options.getNextPageParam(second, [first, second])).toBeUndefined();
});

it("uses the real name, then username, when full_name is absent", async () => {
  state.rows = [
    { id: "member", full_name: null, first_name: "Lina", last_name: "Martin" },
    { id: "username", full_name: null, username: "football_lina" },
  ];
  const page = await query("members").queryFn({ pageParam: 0 });
  expect(page.rows.map((row: any) => row.title)).toEqual([
    "Lina Martin",
    "football_lina",
  ]);
});

it("keeps a failed community request in the error state instead of reporting no members", async () => {
  state.error = new Error("Connexion indisponible");
  await expect(query().queryFn({ pageParam: 0 })).rejects.toThrow(
    "Connexion indisponible",
  );
});
