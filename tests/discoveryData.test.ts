import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  uid: "viewer",
  tables: {} as Record<string, Record<string, unknown>[]>,
  failures: {} as Record<string, Error>,
}));
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useState: (value: unknown) => [value, () => {}],
}));
vi.mock("react-native", () => ({ AppState: { currentState: "active" } }));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => options,
  useInfiniteQuery: (options: unknown) => options,
  useQueryClient: () => ({}),
}));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: state.uid } } }),
}));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: () => {},
  supabase: { from: (table: string) => memoryQuery(table) },
}));
import { useOpportunities, usePosts } from "../src/lib/data";
import {
  useProfileOverview,
  useClubOverview,
} from "../src/lib/profileOverview";

// Evaluate filters before ranges, as PostgREST does. Fixtures expose the
// regression where a screen filters only an already-paginated result.
function memoryQuery(table: string) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  let start = 0,
    end = Infinity,
    countRequested = false;
  const q = {
    select: (_columns: string, options?: { count?: string }) => {
      countRequested = !!options?.count;
      return q;
    },
    eq: (key: string, value: unknown) => {
      filters.push((row) => row[key] === value);
      return q;
    },
    neq: (key: string, value: unknown) => {
      filters.push((row) => row[key] !== value);
      return q;
    },
    not: (key: string, operator: string, value: unknown) => {
      if (operator === "is") filters.push((row) => row[key] != null);
      else if (operator === "in") {
        const values = String(value).replace(/[()]/g, "").split(",");
        filters.push((row) => !values.includes(String(row[key])));
      }
      return q;
    },
    or: () => q,
    order: () => q,
    abortSignal: () => q,
    range: (from: number, to: number) => {
      start = from;
      end = to;
      return q;
    },
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      const rows = (state.tables[table] || []).filter((row) =>
        filters.every((filter) => filter(row)),
      );
      return Promise.resolve({
        data: rows.slice(start, end + 1),
        count: countRequested ? rows.length : null,
        error: state.failures[table] || null,
      }).then(resolve, reject);
    },
  };
  return q;
}
type Query = {
  enabled?: boolean;
  queryKey: unknown[];
  queryFn: (context: {
    pageParam: number;
    signal?: AbortSignal;
  }) => Promise<any>;
};
const run = (hook: unknown, pageParam = 0) =>
  (hook as Query).queryFn({ pageParam });
beforeEach(() => {
  state.uid = "viewer";
  state.tables = {};
  state.failures = {};
});

it("finds an old request behind twenty recent offers on the first Requests page", async () => {
  state.tables.opportunities = [
    ...Array.from({ length: 20 }, (_, id) => ({
      id,
      is_active: true,
      listing_kind: "offer",
    })),
    { id: "old-request", is_active: true, listing_kind: "request" },
  ];
  expect(await run(useOpportunities("", "", "", "", "demandes"))).toEqual([
    { id: "old-request", is_active: true, listing_kind: "request" },
  ]);
  expect(await run(useOpportunities("", "", "", "", "offres"))).toHaveLength(
    20,
  );
});
it("loads an older video even when the twenty newest posts contain no video", async () => {
  state.tables.posts = [
    ...Array.from({ length: 20 }, (_, id) => ({
      id,
      user_id: "author",
      video_url: null,
    })),
    { id: "video", user_id: "author", video_url: "video.mp4" },
  ];
  expect(await run(usePosts("all", "author", "video"))).toEqual([
    { id: "video", user_id: "author", video_url: "video.mp4" },
  ]);
});
it("counts all publications and the viewed profile's followers independently of the viewer", async () => {
  state.tables.posts = Array.from({ length: 45 }, (_, id) => ({
    id,
    user_id: "author",
  }));
  state.tables.profile_followers = [
    { followed_id: "author", follower_id: "a" },
    { followed_id: "author", follower_id: "b" },
    { followed_id: "c", follower_id: "author" },
    { followed_id: "viewer", follower_id: "d" },
  ];
  const query = useProfileOverview("author");
  expect(await run(query.counts)).toEqual({
    posts: 45,
    followers: 2,
    following: 1,
  });
  expect((query.views as unknown as Query).enabled).toBe(false);
});
it("does not invent zero counters when the backend rejects a read", async () => {
  state.failures.posts = new Error("read failed");
  await expect(run(useProfileOverview("author").counts)).rejects.toThrow(
    "read failed",
  );
});
it("counts published club news and active players, excluding drafts and inactive players", async () => {
  state.tables.club_news = [
    { club_id: "club", is_published: true },
    { club_id: "club", is_published: false },
  ];
  state.tables.club_players = [
    { club_id: "club", is_active: true },
    { club_id: "club", is_active: false },
  ];
  state.tables.club_followers = [{ club_id: "club" }];
  expect(await run(useClubOverview("club"))).toEqual({
    news: 1,
    followers: 1,
    players: 1,
  });
});
it("isolates cached filter results and account changes", () => {
  const all = useOpportunities("", "", "", "", "") as unknown as Query;
  const requests = useOpportunities(
    "",
    "",
    "",
    "",
    "demandes",
  ) as unknown as Query;
  expect(all.queryKey).not.toEqual(requests.queryKey);
  state.uid = "other-viewer";
  expect(
    (useOpportunities("", "", "", "", "") as unknown as Query).queryKey,
  ).not.toEqual(all.queryKey);
});
