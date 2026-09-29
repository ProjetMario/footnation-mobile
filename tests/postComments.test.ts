import { describe, expect, it, vi } from "vitest";
import {
  PostCommentError,
  publishPostComment,
  changeOwnPostComment,
} from "../src/lib/postComments";
import { commentTextRejected } from "../src/lib/commentModeration";

function backend({
  user = "me",
  profile = true,
  profileError = null as unknown,
  insertError = null as unknown,
  authError = null as unknown,
} = {}) {
  const write = vi.fn().mockResolvedValue({ error: insertError });
  const read = vi.fn().mockResolvedValue({
    error: profileError,
    data: profile ? { id: user } : null,
  });
  const insert = vi.fn(() => ({ setHeader: write }));
  const from = vi.fn((table) =>
    table === "profiles"
      ? {
          select: () => ({
            eq: () => ({ maybeSingle: () => ({ setHeader: read }) }),
          }),
        }
      : { insert },
  );
  const getUser = vi.fn().mockResolvedValue({
    data: { user: authError ? null : { id: user } },
    error: authError,
  });
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: user }, access_token: "fixture-token" },
        },
      }),
      getUser,
    },
    from,
  };
  return {
    client: client as unknown as Parameters<typeof publishPostComment>[0],
    insert,
    from,
    read,
    write,
    getUser,
  };
}
const input = { postId: "post", userId: "me", content: " ❤️ " };
describe("post comment publication", () => {
  it("sends emoji comments after verifying the real account and profile", async () => {
    const b = backend();
    await publishPostComment(b.client, input);
    expect(b.getUser).toHaveBeenCalledWith("fixture-token");
    expect(b.insert).toHaveBeenCalledExactlyOnceWith({
      post_id: "post",
      user_id: "me",
      content: "❤️",
    });
    expect(b.write).toHaveBeenCalledWith(
      "Authorization",
      "Bearer fixture-token",
    );
  });
  it("offers profile completion instead of a foreign-key failure", async () => {
    const b = backend({ profile: false });
    await expect(publishPostComment(b.client, input)).rejects.toMatchObject({
      recovery: "profile",
    });
    expect(b.insert).not.toHaveBeenCalled();
  });
  it("requires login for a stale or deleted account without recreating it", async () => {
    const b = backend({ authError: { status: 403, code: "user_not_found" } });
    await expect(publishPostComment(b.client, input)).rejects.toMatchObject({
      recovery: "login",
    });
    expect(b.from).not.toHaveBeenCalled();
  });
  it("rejects a draft belonging to another account", async () => {
    const b = backend({ user: "other" });
    await expect(publishPostComment(b.client, input)).rejects.toMatchObject({
      recovery: "login",
    });
    expect(b.from).not.toHaveBeenCalled();
  });
  it("does not confuse network failure with a missing profile", async () => {
    const b = backend({ profileError: { message: "offline" } });
    await expect(publishPostComment(b.client, input)).rejects.toMatchObject({
      recovery: "retry",
    });
    expect(b.insert).not.toHaveBeenCalled();
  });
  it("handles a profile removed between verification and insertion", async () => {
    const b = backend({
      insertError: { code: "23503", message: "post_comments_user_id_fkey" },
    });
    await expect(publishPostComment(b.client, input)).rejects.toMatchObject({
      recovery: "profile",
    });
  });
  it("surfaces server moderation explicitly", async () => {
    const b = backend({
      insertError: {
        code: "22023",
        message: "server",
        hint: "COMMENT_MODERATION",
      },
    });
    await expect(publishPostComment(b.client, input)).rejects.toThrow(
      "insultes",
    );
  });
  it("blocks insults before any network request", async () => {
    const b = backend();
    await expect(
      publishPostComment(b.client, { ...input, content: "sale connard" }),
    ).rejects.toBeInstanceOf(PostCommentError);
    expect(b.getUser).not.toHaveBeenCalled();
    expect(b.from).not.toHaveBeenCalled();
  });
});
describe("comment moderation", () => {
  it.each([
    "idiot",
    "imbécile",
    "connard",
    "PUTAIN",
    "merde",
    "enculé",
    "fdp",
    "c0nn@rd",
    "c.o.n.n.a.r.d",
    "sal0pe",
    "fuck",
    "shit",
    "ta gueule",
    "je vais te tuer",
  ])("rejects %s", (content) => {
    expect(commentTextRejected(content)).toBe(true);
  });
  it.each([
    "❤️",
    "Bien joué !",
    "Quel beau match de football",
    "Un bon conseil",
    "La compétition commence",
    "Il passe dans le couloir",
    "Le gardien fait la queue",
    "Bravo les filles",
  ])("allows %s", (content) => {
    expect(commentTextRejected(content)).toBe(false);
  });
});

// Exercise the write filters and response checks independently of the UI.
describe("own comment changes", () => {
  function editingBackend(error: unknown = null) {
    const result = vi
      .fn()
      .mockResolvedValue({ data: error ? null : { id: "comment" }, error });
    const builder: any = { setHeader: result };
    builder.eq = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.single = vi.fn(() => builder);
    const update = vi.fn(() => builder);
    const remove = vi.fn(() => builder);
    const b = backend();
    b.client.from = vi.fn(() => ({ update, delete: remove })) as any;
    return { ...b, builder, update, remove };
  }
  const own = {
    postId: "post",
    userId: "me",
    comment: { id: "comment", user_id: "me", content: "Original" },
  };
  it("updates only the text and scopes the mutation to the author, post and original value", async () => {
    const b = editingBackend();
    await changeOwnPostComment(b.client, {
      ...own,
      action: { type: "edit", content: " Bravo ! " },
    });
    expect(b.update).toHaveBeenCalledExactlyOnceWith({ content: "Bravo !" });
    expect(b.builder.eq.mock.calls).toEqual([
      ["id", "comment"],
      ["post_id", "post"],
      ["user_id", "me"],
      ["content", "Original"],
    ]);
    expect(b.remove).not.toHaveBeenCalled();
  });
  it("deletes one's comment with the same ownership checks", async () => {
    const b = editingBackend();
    await changeOwnPostComment(b.client, {
      ...own,
      action: { type: "delete" },
    });
    expect(b.remove).toHaveBeenCalledOnce();
    expect(b.update).not.toHaveBeenCalled();
  });
  it("refuses someone else's comment before contacting the backend", async () => {
    const b = editingBackend();
    await expect(
      changeOwnPostComment(b.client, {
        ...own,
        userId: "someone",
        action: { type: "delete" },
      }),
    ).rejects.toThrow("Seul l’auteur");
    expect(b.getUser).not.toHaveBeenCalled();
  });
  it("moderates edits before any write", async () => {
    const b = editingBackend();
    await expect(
      changeOwnPostComment(b.client, {
        ...own,
        action: { type: "edit", content: "c0nn@rd" },
      }),
    ).rejects.toThrow("insultes");
    expect(b.update).not.toHaveBeenCalled();
  });
  it("does not claim success for denied, deleted or concurrently modified comments", async () => {
    const b = editingBackend({ code: "PGRST116", message: "no matching row" });
    await expect(
      changeOwnPostComment(b.client, {
        ...own,
        action: { type: "edit", content: "Bravo" },
      }),
    ).rejects.toThrow("n’a pas pu être confirmée");
  });
});
