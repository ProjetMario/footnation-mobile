import { expect, it, vi } from "vitest";
import {
  readPublicPreviewShort,
  readPublicPreviewVideos,
  publicShortSelection,
  type PublicVideoCursor,
} from "../src/lib/publicPreviewVideos";
import { initialVideoCursor } from "../src/lib/videoFeed";
import { resolveVideoSource } from "../src/lib/videoSource";

const video = (id: string, day: number, kind = "short") => ({
  id,
  user_id: "author",
  created_at: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
  video_url: "https://fixture.invalid/video.mp4",
  thumbnail_url: null,
  description: id,
  user: { id: "author" },
  origin: kind,
});
function backend(postPages: any[] = [], shortPages: any[][] = []) {
  const calls: [string, unknown[]][] = [];
  const invoke = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: postPages.shift(), error: null }),
    );
  const from = vi.fn().mockImplementation(() => {
    const data = shortPages.shift() || [];
    const q: any = {};
    for (const name of ["select", "or", "not", "neq", "eq", "order", "range"])
      q[name] = (...args: unknown[]) => {
        calls.push([name, args]);
        return q;
      };
    q.then = (resolve: any, reject: any) =>
      Promise.resolve({ data, error: null }).then(resolve, reject);
    q.maybeSingle = () =>
      Promise.resolve({ data: data[0] ?? null, error: null });
    return q;
  });
  return {
    client: { from, functions: { invoke } } as any,
    invoke,
    from,
    calls,
  };
}
function postPage(ids: [string, number][], next: string | null) {
  return {
    posts: ids.map(([id, day]) => ({
      ...video(id, day, "post"),
      profiles: { id: "author" },
      content: id,
      image_url: null,
    })),
    hasMore: !!next,
    nextCursor: next,
  };
}
it("merges both public video sources without skipping buffered rows or rebuilding the server cursor", async () => {
  const api = backend(
    [
      postPage(
        [
          ["p6", 6],
          ["p4", 4],
        ],
        "opaque-p4",
      ),
      postPage([["p2", 2]], null),
    ],
    [[video("s5", 5), video("s3", 3)], [video("s1", 1)]],
  );
  let cursor: PublicVideoCursor | undefined = initialVideoCursor;
  const ids: string[] = [];
  for (let i = 0; cursor && i < 10; i++) {
    const result = await readPublicPreviewVideos(
      api.client,
      cursor,
      undefined,
      2,
    );
    ids.push(...result.items.map((item) => item.id));
    cursor = result.next;
  }
  expect(cursor).toBeUndefined();
  expect(ids).toEqual(["p6", "s5", "p4", "s3", "p2", "s1"]);
  expect(api.invoke).toHaveBeenCalledTimes(2);
  expect(api.invoke.mock.calls[1][0]).toContain("before=opaque-p4");
  expect(api.from.mock.calls.every(([table]) => table === "shorts")).toBe(true);
  expect(api.calls).toContainEqual(["range", [2, 3]]);
});
it("enforces readable public authors with an inner RLS join before pagination", async () => {
  const api = backend([postPage([], null)], [[video("short", 1)]]);
  await readPublicPreviewVideos(api.client, initialVideoCursor, "author");
  expect(publicShortSelection).toContain("profiles!shorts_user_id_fkey!inner");
  expect(api.calls).toContainEqual(["not", ["user.is_private", "is", true]]);
  expect(api.calls).toContainEqual(["eq", ["user_id", "author"]]);
  expect(
    api.calls.some(
      ([name, args]) =>
        name === "or" &&
        String(args[0]).includes("suspended_until.lte.") &&
        JSON.stringify(args[1]) === JSON.stringify({ referencedTable: "user" }),
    ),
  ).toBe(true);
});
it("fails closed for a missing, private, suspended or RLS-hidden author in details", async () => {
  for (const user of [
    null,
    { id: "a", is_private: true },
    { id: "a", is_suspended: true, suspended_until: null },
    { id: "a", is_suspended: true, suspended_until: "2099-01-01T00:00:00Z" },
  ]) {
    const api = backend([], [[{ ...video("short", 1), user }]]);
    expect(await readPublicPreviewShort(api.client, "short")).toBeNull();
  }
  expect(
    await readPublicPreviewShort(
      backend([], [[video("public", 1)]]).client,
      "public",
    ),
  ).toMatchObject({ id: "public" });
});

it("preserves optimized sources from post previews and short rows without replacing originals", async () => {
  const optimization = {
    optimized_video_url: "https://fixture.invalid/mobile.mp4",
    optimized_video_source_url: "https://fixture.invalid/video.mp4",
    optimized_thumbnail_url: "https://fixture.invalid/poster.jpg",
  };
  const page = postPage([["post", 2]], null);
  Object.assign(page.posts[0], optimization);
  const api = backend([page], [[{ ...video("short", 1), ...optimization }]]);
  const result = await readPublicPreviewVideos(api.client, initialVideoCursor);
  expect(result.items).toHaveLength(2);
  for (const item of result.items) {
    expect(item).toMatchObject({ video_url: optimization.optimized_video_source_url, ...optimization });
    expect(resolveVideoSource(item, item.thumbnail_url)).toEqual({
      uri: optimization.optimized_video_url,
      fallbackUri: optimization.optimized_video_source_url,
      posterUri: optimization.optimized_thumbnail_url,
    });
  }
  for (const field of Object.keys(optimization)) expect(publicShortSelection).toContain(field);
});
