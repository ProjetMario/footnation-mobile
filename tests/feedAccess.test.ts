import { beforeEach, expect, it, vi } from "vitest";
const visibility = vi.hoisted(() => ({ blockedSocialAuthors: vi.fn() }));
vi.mock("../src/lib/socialVisibility", () => visibility);
import { readFeedAccess } from "../src/lib/feedAccess";

beforeEach(() => {
  visibility.blockedSocialAuthors.mockReset();
});

it("starts feed discovery while visibility is pending, but releases no result before both finish", async () => {
  let resolveBlocks!: (ids: string[]) => void;
  visibility.blockedSocialAuthors.mockReturnValue(
    new Promise<string[]>((resolve) => {
      resolveBlocks = resolve;
    }),
  );
  const started = vi.fn();
  const feed = {
    then: (resolve: (data: string[]) => unknown) => {
      started();
      return Promise.resolve(["post"]).then(resolve);
    },
  };
  const signal = new AbortController().signal;
  let settled = false;
  const result = readFeedAccess("viewer", feed, signal).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  expect(started).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  expect(visibility.blockedSocialAuthors).toHaveBeenCalledWith(
    "viewer",
    signal,
  );
  resolveBlocks(["blocked-author"]);
  expect(await result).toEqual({ blocked: ["blocked-author"], feed: ["post"] });
});

it("fails closed when visibility cannot be checked", async () => {
  visibility.blockedSocialAuthors.mockRejectedValue(
    new Error("visibility unavailable"),
  );
  await expect(
    readFeedAccess("viewer", Promise.resolve(["post"])),
  ).rejects.toThrow("visibility unavailable");
});

it("preserves feed failures and missing-backend responses for the existing caller policy", async () => {
  visibility.blockedSocialAuthors.mockResolvedValue([]);
  await expect(
    readFeedAccess("viewer", Promise.reject(new Error("network failure"))),
  ).rejects.toThrow("network failure");
  const missing = { data: null, error: { code: "PGRST202" } };
  expect((await readFeedAccess("viewer", Promise.resolve(missing))).feed).toBe(
    missing,
  );
});
