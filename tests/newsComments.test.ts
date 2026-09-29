import { describe, expect, it, vi } from "vitest";
import { publishNewsComment, newsCommentError } from "../src/lib/newsComments";
import { profilePrefill } from "../src/lib/profilePrefill";

function backend(
  options: {
    user?: string | null;
    profile?: boolean;
    profileError?: unknown;
    insertError?: unknown;
  } = {},
) {
  const insert = vi
    .fn()
    .mockResolvedValue({ error: options.insertError || null });
  const read = vi.fn().mockResolvedValue({
    data: options.profile === false ? null : { id: "me" },
    error: options.profileError || null,
  });
  const from = vi.fn((table: string) =>
    table === "profiles"
      ? { select: () => ({ eq: () => ({ maybeSingle: read }) }) }
      : { insert },
  );
  const user = options.user === undefined ? "me" : options.user;
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { user: { id: user } } : null },
        error: null,
      }),
    },
    from,
  };
  return {
    client: client as unknown as Parameters<typeof publishNewsComment>[0],
    insert,
    read,
    from,
  };
}
const comment = {
  newsId: "rss-article",
  userId: "me",
  content: " C’est clair !! ",
};
describe("news comments", () => {
  it("sends ordinary French text for an existing profile with the authenticated author", async () => {
    const b = backend();
    await publishNewsComment(b.client, comment);
    expect(b.insert).toHaveBeenCalledExactlyOnceWith({
      news_id: "rss-article",
      user_id: "me",
      content: "C’est clair !!",
      parent_id: null,
    });
  });
  it("offers profile completion before a doomed insert, then allows the retained draft after completion", async () => {
    const b = backend({ profile: false });
    await expect(publishNewsComment(b.client, comment)).rejects.toMatchObject({
      action: "profile",
    });
    expect(b.insert).not.toHaveBeenCalled();
    b.read.mockResolvedValue({ data: { id: "me" }, error: null });
    await publishNewsComment(b.client, comment);
    expect(b.insert).toHaveBeenCalledOnce();
    expect(comment.content).toBe(" C’est clair !! ");
  });
  it.each([null, "another-account"])(
    "never publishes under a missing or changed session (%s)",
    async (user) => {
      const b = backend({ user });
      await expect(publishNewsComment(b.client, comment)).rejects.toMatchObject(
        { action: "login" },
      );
      expect(b.from).not.toHaveBeenCalled();
    },
  );
  it("does not mistake a profile read failure for an absent profile", async () => {
    const b = backend({ profileError: new Error("network unavailable") });
    await expect(publishNewsComment(b.client, comment)).rejects.toMatchObject({
      action: null,
    });
    expect(b.insert).not.toHaveBeenCalled();
  });
  it("retains the profile recovery action if the profile vanishes during publication", async () => {
    const b = backend({
      insertError: { code: "23503", message: "news_comments_user_id_fkey" },
    });
    await expect(publishNewsComment(b.client, comment)).rejects.toMatchObject({
      action: "profile",
    });
    expect(
      newsCommentError({
        code: "23503",
        message: "news_comments_parent_id_fkey",
      }).action,
    ).toBeNull();
  });
  it("keeps moderation feedback and enforces the database's 1000-character limit before sending", async () => {
    const b = backend();
    for (const content of ["  ", "x".repeat(1001), "connard"])
      await expect(
        publishNewsComment(b.client, { ...comment, content }),
      ).rejects.toThrow();
    expect(b.from).not.toHaveBeenCalled();
    await publishNewsComment(b.client, {
      ...comment,
      content: "x".repeat(1000),
    });
    expect(b.insert).toHaveBeenCalledOnce();
  });
});
describe("signup profile recovery", () => {
  it("prefills existing signup details without inventing identity or copying privileges", () => {
    expect(
      profilePrefill(null, {
        first_name: "Alex",
        last_name: "Martin",
        username: "alex",
        is_admin: true,
        id: "someone-else",
        birthdate: 123,
      }),
    ).toEqual({ first_name: "Alex", last_name: "Martin", username: "alex" });
  });
  it("never replaces saved profile fields with old signup metadata", () => {
    const saved = { first_name: "Updated", username: null };
    expect(profilePrefill(saved, { first_name: "Old", username: "old" })).toBe(
      saved,
    );
  });
});
