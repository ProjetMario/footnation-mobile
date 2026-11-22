import { describe, expect, it, vi } from "vitest";
import {
  rankSocialPosts,
  scoreSocialPost,
  type FeedContext,
} from "../src/lib/socialFeedRanking";
import {
  readPersonalizedPosts,
  socialFeedMigrationMissing,
} from "../src/lib/personalizedPosts";
import type { Post } from "../src/lib/models";
const now = Date.parse("2026-10-29T10:00:00Z");
const context: FeedContext = {
  viewer: {
    id: "viewer",
    club: "FC Annecy",
    favorite_pro_club: "Olympique Lyonnais",
    department: "74",
    position: "Gardien",
  },
  following: ["friend"],
  connections: [],
  blocked: [],
  hidden: [],
  now,
};
function post(
  id: string,
  author = id,
  hours = 1,
  values: Partial<Post> = {},
): Post {
  return {
    id,
    user_id: author,
    created_at: new Date(now - hours * 3600000).toISOString(),
    content: "Une publication football",
    image_url: null,
    video_url: null,
    hashtags: [],
    location: null,
    author: {
      id: author,
      full_name: author,
      username: author,
      avatar_url: null,
    },
    ...values,
  };
}
describe("balanced social feed", () => {
  it("prefers an equally fresh network post, with an understandable reason", () => {
    const rows = rankSocialPosts(
      [post("unknown"), post("network", "friend")],
      context,
    );
    expect(rows[0].id).toBe("network");
    expect(rows[0].feedRecommendation).toBe("Dans votre réseau");
  });
  it("lets a fresh discovery outrank a stale network post", () =>
    expect(
      rankSocialPosts([post("old", "friend", 300), post("new")], context)[0].id,
    ).toBe("new"));
  it("uses declared football interests, avoiding substring matches", () => {
    expect(
      scoreSocialPost(
        post("club", "other", 1, {
          content: "Match de l’Olympique Lyonnais !",
        }),
        context,
      ).reason,
    ).toBe("Vos intérêts football");
    expect(
      scoreSocialPost(
        post("notclub", "other", 1, { content: "Les Olympique Lyonnaisss" }),
        context,
      ).reason,
    ).toBe("À découvrir");
  });
  it("never rewards media format, long text, or repeated reactions by one user", () => {
    const a = post("text");
    expect(scoreSocialPost(a, context).score).toBe(
      scoreSocialPost(
        {
          ...a,
          image_url: "image.jpg",
          video_url: "video.mp4",
          content: "x".repeat(20000),
        },
        context,
      ).score,
    );
    const reaction = { id: "1", user_id: "viewer", reaction_type: "like" };
    expect(
      scoreSocialPost({ ...a, post_reactions: [reaction] }, context).score,
    ).toBe(
      scoreSocialPost(
        { ...a, post_reactions: Array(100).fill(reaction) },
        context,
      ).score,
    );
    expect(
      scoreSocialPost({ ...a, post_comments: [{ count: 100000 }] }, context)
        .score - scoreSocialPost(a, context).score,
    ).toBeLessThan(8);
  });
  it("reserves discovery slots and diversifies authors when alternatives exist", () => {
    const posts = [
      post("a1", "friend"),
      post("a2", "friend"),
      post("a3", "friend"),
      post("b", "second"),
      post("c", "third"),
      post("d", "fourth"),
    ];
    const ranked = rankSocialPosts(posts, context);
    expect(ranked[0].user_id).toBe("friend");
    expect(ranked[1].user_id).not.toBe("friend");
    expect(ranked[2].user_id).not.toBe("friend");
    expect(new Set(ranked.map((p) => p.id)).size).toBe(posts.length);
  });
  it("carries diversity across candidate windows without dropping sparse content", () => {
    expect(
      rankSocialPosts(
        [post("a", "friend"), post("b", "other")],
        context,
        ["friend"],
        40,
      )[0].user_id,
    ).toBe("other");
    expect(
      rankSocialPosts([post("a", "friend"), post("b", "friend")], context),
    ).toHaveLength(2);
  });
  it("excludes blocked, hidden, inaccessible and duplicated posts before ranking", () => {
    const rows = rankSocialPosts(
      [
        post("blocked", "blocked"),
        post("hidden"),
        post("private", "p", 1, { author: null }),
        post("ok"),
        post("ok"),
      ],
      { ...context, blocked: ["blocked"], hidden: ["hidden"] },
    );
    expect(rows.map((p) => p.id)).toEqual(["ok"]);
  });
  it("is deterministic and does not mutate cached posts", () => {
    const posts = [post("b"), post("a")];
    const before = structuredClone(posts);
    expect(rankSocialPosts(posts, context)).toEqual(
      rankSocialPosts([...posts].reverse(), context),
    );
    expect(posts).toEqual(before);
  });
  it("works for a new member without interests or relationships", () =>
    expect(
      rankSocialPosts([post("old", "a", 30), post("fresh", "b", 1)], {
        ...context,
        viewer: { id: "new" },
        following: [],
      })[0].id,
    ).toBe("fresh"));
});
function mockClient(
  entries: { post_id: string; created_at: string }[],
  posts: Post[],
) {
  const builder = (result: unknown) => {
    const q: any = {
      then: (resolve: any, reject: any) =>
        Promise.resolve(result).then(resolve, reject),
    };
    for (const method of [
      "select",
      "in",
      "eq",
      "or",
      "setHeader",
      "abortSignal",
    ])
      q[method] = vi.fn(() => q);
    return q;
  };
  const rpc = builder({ data: entries, error: null });
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "viewer" }, access_token: "fixture" } },
        error: null,
      })),
    },
    rpc: vi.fn(() => rpc),
    from: vi.fn((name: string) =>
      builder({ data: name === "posts" ? posts : [], error: null }),
    ),
  };
}
describe("feed snapshot pagination", () => {
  it("only permits compatibility for the missing candidate endpoint itself", () => {
    expect(
      socialFeedMigrationMissing({
        code: "PGRST202",
        message:
          "Could not find the function public.get_social_feed_candidates in the schema cache",
      }),
    ).toBe(true);
    expect(
      socialFeedMigrationMissing({
        code: "42883",
        message: "function public.repost_author_visible(uuid) does not exist",
      }),
    ).toBe(false);
    expect(
      socialFeedMigrationMissing({
        code: "42501",
        message: "function public.get_social_feed_candidates denied",
      }),
    ).toBe(false);
    expect(socialFeedMigrationMissing({ code: "PGRST202" })).toBe(false);
  });
  it("advances from raw candidates even when the whole window is hidden", async () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      post(String(i), String(i), i),
    );
    const entries = rows.map((p) => ({
      post_id: p.id,
      created_at: p.created_at,
    }));
    const client = mockClient(entries, rows);
    const result = await readPersonalizedPosts({
      client,
      uid: "viewer",
      profile: null,
      blocked: [],
      hidden: rows.map((p) => p.id),
      signal: new AbortController().signal,
    });
    expect(result.items).toEqual([]);
    expect(result.next).toMatchObject({
      beforeId: "39",
      before: rows[39].created_at,
      displayed: 0,
    });
    expect(client.rpc.mock.calls[0][0]).toBe("get_social_feed_candidates");
  });
  it("keeps the snapshot and carries append-only diversity context", async () => {
    const rows = [post("next")];
    const client = mockClient(
      rows.map((p) => ({ post_id: p.id, created_at: p.created_at })),
      rows,
    );
    const cursor = {
      snapshot: "2026-10-29T10:00:00Z",
      before: "2026-10-29T08:00:00Z",
      beforeId: "last",
      previousAuthors: ["old"],
      displayed: 40,
    };
    const result = await readPersonalizedPosts({
      client,
      uid: "viewer",
      profile: null,
      cursor,
      blocked: [],
      hidden: [],
      signal: new AbortController().signal,
    });
    expect(client.rpc.mock.calls[0][1]).toEqual({
      p_snapshot: cursor.snapshot,
      p_before: cursor.before,
      p_before_id: "last",
    });
    expect(result.next).toBeUndefined();
  });
  it("does not return another account's personalized data after a session switch", async () => {
    const rows = [post("next")];
    const client = mockClient(
      rows.map((p) => ({ post_id: p.id, created_at: p.created_at })),
      rows,
    );
    client.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: "other" }, access_token: "other" } },
      error: null,
    });
    await expect(
      readPersonalizedPosts({
        client,
        uid: "viewer",
        profile: null,
        blocked: [],
        hidden: [],
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("session a changé");
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("propagates authorization failures rather than returning an unrestricted feed", async () => {
    const client = mockClient([], []);
    client.rpc.mockReturnValue({
      setHeader() {
        return this;
      },
      abortSignal: async () => ({ error: { code: "42501" } }),
    } as any);
    await expect(
      readPersonalizedPosts({
        client,
        uid: "viewer",
        profile: null,
        blocked: [],
        hidden: [],
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual({ code: "42501" });
  });
});
