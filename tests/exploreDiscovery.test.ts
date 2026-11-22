import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  exploreDiscoveryOptions,
  exploreHashtags,
  uniqueExploreRows,
} from "../src/lib/exploreDiscovery";

function deferred() {
  let resolve!: (result: { data: any[]; error: Error | null }) => void;
  const promise = new Promise<{ data: any[]; error: Error | null }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function query(
  result = Promise.resolve({ data: [] as any[], error: null as Error | null }),
) {
  const q: any = { then: result.then.bind(result) };
  for (const method of [
    "select",
    "neq",
    "or",
    "order",
    "limit",
    "not",
    "eq",
    "gt",
    "abortSignal",
  ])
    q[method] = vi.fn(() => q);
  return q;
}
beforeEach(() => client.from.mockReset());

it("renders the clubs result while media is still pending and isolates a stories failure", async () => {
  const delayedPosts = deferred(),
    delayedStories = deferred();
  client.from.mockImplementation((table) =>
    query(
      table === "posts"
        ? delayedPosts.promise
        : table === "stories"
          ? delayedStories.promise
          : Promise.resolve({ data: [{ id: "club" }], error: null }),
    ),
  );
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const options = exploreDiscoveryOptions("viewer", [], true);
  const posts = cache.fetchQuery(options.posts);
  const stories = cache.fetchQuery(options.stories).catch((error) => error);
  const clubs = await cache.fetchQuery(options.clubs);
  expect(clubs).toEqual([{ id: "club" }]);
  expect(cache.getQueryState(options.posts.queryKey)?.status).toBe("pending");
  delayedStories.resolve({ data: [], error: new Error("stories unavailable") });
  expect(await stories).toBeInstanceOf(Error);
  expect(cache.getQueryData(options.clubs.queryKey)).toEqual(clubs);
  delayedPosts.resolve({ data: [], error: null });
  await posts;
  cache.clear();
});

it("waits for verified block visibility, including manual retry, without blocking club suggestions", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const options = exploreDiscoveryOptions("viewer", undefined, true);
  expect(options.players.enabled).toBe(false);
  expect(options.posts.enabled).toBe(false);
  expect(options.stories.enabled).toBe(false);
  expect(options.clubs.enabled).toBe(true);
  await expect(cache.fetchQuery(options.players)).rejects.toThrow("visibilité");
  await expect(cache.fetchQuery(options.posts)).rejects.toThrow("visibilité");
  expect(client.from).not.toHaveBeenCalled();
  cache.clear();
});

it("filters blocked and suspended profiles and forwards cancellation to every request", async () => {
  const queries: any[] = [];
  client.from.mockImplementation(() => {
    const q = query(
      Promise.resolve({
        data: [{ id: "ok" }, { id: "suspended", is_suspended: true }],
        error: null,
      }),
    );
    queries.push(q);
    return q;
  });
  const cache = new QueryClient();
  const options = exploreDiscoveryOptions("viewer", ["blocked"], true);
  expect(
    (await cache.fetchQuery(options.players)).map((row) => row.id),
  ).toEqual(["ok"]);
  await Promise.all([
    cache.fetchQuery(options.posts),
    cache.fetchQuery(options.stories),
  ]);
  expect(queries[0].not).toHaveBeenCalledWith("id", "in", "(blocked)");
  expect(queries[1].not).toHaveBeenCalledWith("user_id", "in", "(blocked)");
  expect(queries[2].not).toHaveBeenCalledWith("user_id", "in", "(blocked)");
  for (const q of queries)
    expect(q.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  cache.clear();
});

it("reuses recent discovery results when returning and isolates accounts and block changes", async () => {
  client.from.mockImplementation(() => query());
  const cache = new QueryClient();
  const first = exploreDiscoveryOptions("alice", [], true);
  const observer = new QueryObserver(cache, first.players);
  const unsubscribe = observer.subscribe(() => {});
  await cache.fetchQuery(first.players);
  unsubscribe();
  await cache.fetchQuery(exploreDiscoveryOptions("alice", [], true).players);
  expect(client.from).toHaveBeenCalledTimes(1);
  await cache.fetchQuery(exploreDiscoveryOptions("bob", [], true).players);
  await cache.fetchQuery(
    exploreDiscoveryOptions("alice", ["hidden"], true).players,
  );
  expect(client.from).toHaveBeenCalledTimes(3);
  cache.clear();
});

it("does not start discovery for a typed query or a signed-out viewer", () => {
  for (const options of [
    exploreDiscoveryOptions("viewer", [], false),
    exploreDiscoveryOptions("", [], true),
  ])
    for (const section of Object.values(options))
      expect(section.enabled).toBe(false);
});

it("can derive hashtags before stories arrive and keeps the prioritized version of duplicates", () => {
  expect(
    exploreHashtags([
      { hashtags: ["#Football", "Foot"] },
      { hashtags: ["Football"] },
    ]),
  ).toEqual(["Football", "Foot"]);
  expect(
    uniqueExploreRows(
      [
        { id: "a", name: "priority" },
        { id: "a", name: "general" },
        { id: "b", name: "second" },
      ],
      2,
    ),
  ).toEqual([
    { id: "a", name: "priority" },
    { id: "b", name: "second" },
  ]);
});
