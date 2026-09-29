import { describe, expect, it } from "vitest";
import {
  initialVideoCursor,
  mergeVideoPage,
  videoFeedKey,
} from "../src/lib/videoFeed";

const video = (id: string, day: number) => ({
  id,
  created_at: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
});
describe("all user videos in Shorts", () => {
  it("merges both sources chronologically and preserves the original identity", () => {
    const result = mergeVideoPage(
      [video("post", 25)],
      [video("short", 26)],
      initialVideoCursor,
    );
    expect(result.items.map(videoFeedKey)).toEqual([
      "short:short",
      "post:post",
    ]);
    expect(result.next).toBeUndefined();
  });
  it("does not skip older shorts when a whole page consists of newer posts", () => {
    const posts = Array.from({ length: 15 }, (_, i) => video(`p${i}`, 27 - i));
    const shorts = [video("s1", 10), video("s2", 9)];
    const first = mergeVideoPage(
      posts.slice(0, 13),
      shorts,
      initialVideoCursor,
    );
    expect(first.next).toEqual({ offset: 12, posts: 12, shorts: 0 });
    const second = mergeVideoPage(
      posts.slice(first.next!.posts),
      shorts.slice(first.next!.shorts),
      first.next!,
    );
    expect([...first.items, ...second.items].map(videoFeedKey)).toEqual([
      ...posts.map((p) => `post:${p.id}`),
      "short:s1",
      "short:s2",
    ]);
    expect(second.next).toBeUndefined();
  });
  it("advances only the consumed cursor from each source across mixed pages", () => {
    const posts = [video("p1", 27), video("p2", 24), video("p3", 22)];
    const shorts = [video("s1", 26), video("s2", 25), video("s3", 23)];
    const first = mergeVideoPage(posts, shorts, initialVideoCursor, 3);
    expect(first.next).toEqual({ offset: 3, posts: 1, shorts: 2 });
    const second = mergeVideoPage(
      posts.slice(1),
      shorts.slice(2),
      first.next!,
      3,
    );
    expect(second.items.map(videoFeedKey)).toEqual([
      "post:p2",
      "short:s3",
      "post:p3",
    ]);
    expect(second.next).toBeUndefined();
  });
  it("keeps distinct originals with the same UUID in different source tables", () => {
    const rows = mergeVideoPage(
      [video("same", 26)],
      [video("same", 26)],
      initialVideoCursor,
    );
    expect(rows.items.map(videoFeedKey)).toEqual(["post:same", "short:same"]);
  });
  it("compares instants including timezone offsets", () => {
    const page = mergeVideoPage(
      [{ id: "p", created_at: "2026-09-26T12:00:00+02:00" }],
      [{ id: "s", created_at: "2026-09-26T11:00:00Z" }],
      initialVideoCursor,
    );
    expect(page.items.map(videoFeedKey)).toEqual(["short:s", "post:p"]);
  });
  it("finishes cleanly when both sources are exhausted", () => {
    expect(mergeVideoPage([], [], initialVideoCursor)).toEqual({
      items: [],
      next: undefined,
    });
  });
});
