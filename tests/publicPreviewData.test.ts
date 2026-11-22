import {
  readPublicPreviewPosts,
  readPublicPreviewPost,
} from "../src/lib/publicPostPreview";
import { expect, it, vi } from "vitest";
import {
  readPublicPreviewProfile,
  publicPreviewProfileFields,
} from "../src/lib/publicPreviewData";
import { authenticatedInteraction } from "../src/lib/authenticatedInteraction";

function backend(result: { data: unknown; error: unknown }) {
  const calls: [string, unknown[]][] = [];
  const query: any = {};
  for (const method of ["select", "eq", "or", "order", "range", "not", "neq"])
    query[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return query;
    };
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (error: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  query.maybeSingle = () => {
    calls.push(["maybeSingle", []]);
    return Promise.resolve(result);
  };
  const client = { from: vi.fn(() => query) };
  return { client: client as any, calls };
}

function previewBackend(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error });
  return { client: { functions: { invoke } } as any, invoke };
}
it("uses the public GET endpoint and preserves its opaque cursor and public author", async () => {
  const api = previewBackend({
    posts: [{ id: "post", profiles: { id: "author" } }],
    hasMore: true,
    nextCursor: "opaque|next",
  });
  const result = await readPublicPreviewPosts(api.client, {
    authorId: "author",
    media: "video",
    limit: 10,
    before: "opaque|previous",
  });
  expect(result).toMatchObject({
    items: [{ id: "post", author: { id: "author" } }],
    next: "opaque|next",
  });
  const [path, options] = api.invoke.mock.calls[0];
  const query = new URL("https://fixture.invalid/" + path);
  expect(query.pathname).toBe("/public-post-preview");
  expect(Object.fromEntries(query.searchParams)).toEqual({
    authorId: "author",
    type: "video",
    limit: "10",
    before: "opaque|previous",
  });
  expect(options).toEqual({ method: "GET" });
});
it("does not invent another page or fall back to privileged reads on failure", async () => {
  expect(
    await readPublicPreviewPosts(
      previewBackend({ posts: [], hasMore: false, nextCursor: null }).client,
    ),
  ).toEqual({ items: [], next: undefined });
  await expect(
    readPublicPreviewPosts(previewBackend(null, new Error("denied")).client),
  ).rejects.toThrow("denied");
  await expect(
    readPublicPreviewPosts(
      previewBackend({ posts: [], hasMore: true, nextCursor: null }).client,
    ),
  ).rejects.toThrow("aperçu");
});
it("limits public feed size and treats only a hidden/missing detail as unavailable", async () => {
  const api = previewBackend({ posts: [], hasMore: false, nextCursor: null });
  await readPublicPreviewPosts(api.client, { limit: 1000 });
  expect(api.invoke.mock.calls[0][0]).toContain("limit=20");
  const detail = previewBackend({
    post: { id: "post", profiles: { id: "author" } },
  });
  expect(await readPublicPreviewPost(detail.client, "post")).toMatchObject({
    id: "post",
    author: { id: "author" },
  });
  expect(detail.invoke).toHaveBeenCalledWith("public-post-preview?id=post", {
    method: "GET",
  });
  expect(
    await readPublicPreviewPost(
      previewBackend(null, { context: { status: 404 } }).client,
      "post",
    ),
  ).toBeNull();
  await expect(
    readPublicPreviewPost(
      previewBackend(null, new Error("offline")).client,
      "post",
    ),
  ).rejects.toThrow("offline");
});

it("requests only profile presentation fields and respects invisible/suspended profiles", async () => {
  for (const field of [
    "email",
    "phone",
    "birthdate",
    "is_admin",
    "referral_code",
    "business_email",
    "club_email",
  ])
    expect(publicPreviewProfileFields.split(",")).not.toContain(field);
  const visible = backend({
    data: { id: "profile", full_name: "Public name" },
    error: null,
  });
  expect(await readPublicPreviewProfile(visible.client, "profile")).toEqual({
    id: "profile",
    full_name: "Public name",
  });
  expect(visible.calls).toContainEqual([
    "select",
    [publicPreviewProfileFields],
  ]);
  expect(
    await readPublicPreviewProfile(
      backend({ data: null, error: null }).client,
      "hidden",
    ),
  ).toBeNull();
  expect(
    await readPublicPreviewProfile(
      backend({
        data: { id: "profile", is_suspended: true, suspended_until: null },
        error: null,
      }).client,
      "profile",
    ),
  ).toBeNull();
});

it("filters private and active suspensions in SQL before retrieving a profile", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
  try {
    const api = backend({ data: null, error: null });
    await readPublicPreviewProfile(api.client, "profile");
    const predicates = api.calls.filter(([name]) => name === "or");
    expect(predicates).toEqual([
      ["or", ["is_private.is.null,is_private.eq.false"]],
      [
        "or",
        [
          "is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.2026-10-12T15:00:00.000Z",
        ],
      ],
    ]);
    expect(api.calls.at(-1)).toEqual(["maybeSingle", []]);
  } finally {
    vi.useRealTimers();
  }
});

it("hides explicitly private profiles even when legacy anonymous RLS returns them", async () => {
  expect(
    await readPublicPreviewProfile(
      backend({ data: { id: "private", is_private: true }, error: null })
        .client,
      "private",
    ),
  ).toBeNull();
  expect(
    await readPublicPreviewProfile(
      backend({
        data: {
          id: "expired",
          is_suspended: true,
          suspended_until: "2020-01-01T00:00:00Z",
        },
        error: null,
      }).client,
      "expired",
    ),
  ).toMatchObject({ id: "expired" });
});

it("redirects guest interactions to safe login without invoking any mutation", () => {
  const mutation = vi.fn(),
    login = vi.fn();
  authenticatedInteraction(undefined, "/posts/example", mutation, login);
  expect(mutation).not.toHaveBeenCalled();
  expect(login).toHaveBeenCalledWith("/posts/example");
  authenticatedInteraction(
    undefined,
    "https://outside.example",
    mutation,
    login,
  );
  expect(login).toHaveBeenLastCalledWith(null);
  authenticatedInteraction("member", "/posts/example", mutation, login);
  expect(mutation).toHaveBeenCalledTimes(1);
});
