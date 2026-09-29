import { describe, expect, it, vi } from "vitest";
import {
  createPostPublication,
  freezePostDraft,
  newPostDraft,
  validatePostDraft,
  type PostPublicationRecord,
  type PostPublicationServices,
} from "../src/lib/postPublication";
import {
  createPostDraftJournal,
  type PostDraftAdapter,
} from "../src/lib/postDraftJournal";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
function proposal() {
  return freezePostDraft(
    {
      ...newPostDraft(userId, postId),
      content: "Mon premier entraînement",
      location: "Paris",
      hashtags: "#football",
      media: { id: otherId, type: "video", mime: "video/mp4" },
    },
    (path) => `https://cdn.example.com/${path}`,
  );
}
function services() {
  const rows = new Map<string, PostPublicationRecord>();
  const api: PostPublicationServices = {
    assertCurrentAccount: vi.fn(),
    find: vi.fn(async (id) => rows.get(id) || null),
    upload: vi.fn(async () => {}),
    insert: vi.fn(async (record) => {
      rows.set(record.id, record);
    }),
  };
  return { rows, api };
}
function adapter() {
  const values = new Map<string, string>();
  const store: PostDraftAdapter = {
    read: vi.fn(async (uid) => values.get(uid) || null),
    swap: vi.fn(async (uid, expected, next) => {
      if ((values.get(uid) || null) !== expected) throw Error("changed");
      if (next === null) values.delete(uid);
      else values.set(uid, next);
    }),
    removeAccountMedia: vi.fn(async () => {}),
  };
  return { values, store };
}
describe("durable post publication", () => {
  it("reconciles a lost insertion response without creating a duplicate", async () => {
    const { api, rows } = services();
    api.insert = vi.fn(async (record) => {
      rows.set(record.id, record);
      throw Error("response lost");
    });
    const draft = proposal();
    expect(await createPostPublication(draft).publish(api)).toBe(postId);
    expect(
      await createPostPublication(JSON.parse(JSON.stringify(draft))).publish(
        api,
      ),
    ).toBe(postId);
    expect(api.insert).toHaveBeenCalledOnce();
    expect(api.upload).toHaveBeenCalledOnce();
  });
  it("after an ambiguous insertion and failed read, a restored retry uses exactly the same id and media", async () => {
    const { api, rows } = services();
    let disconnected = false;
    api.insert = vi.fn(async (record) => {
      rows.set(record.id, record);
      disconnected = true;
      throw Error("offline");
    });
    api.find = vi.fn(async (id) => {
      if (disconnected) throw Error("offline");
      return rows.get(id) || null;
    });
    const draft = proposal();
    await expect(createPostPublication(draft).publish(api)).rejects.toThrow(
      "offline",
    );
    disconnected = false;
    expect(
      await createPostPublication(JSON.parse(JSON.stringify(draft))).publish(
        api,
      ),
    ).toBe(postId);
    expect(api.insert).toHaveBeenCalledOnce();
    expect(rows.size).toBe(1);
  });
  it("shares the same in-flight request for two immediate taps", async () => {
    const { api } = services();
    const attempt = createPostPublication(proposal());
    const a = attempt.publish(api),
      b = attempt.publish(api);
    expect(a).toBe(b);
    await a;
    expect(api.insert).toHaveBeenCalledOnce();
  });
  it("does not insert after the account changes during media upload", async () => {
    const { api } = services();
    let current = true;
    api.assertCurrentAccount = () => {
      if (!current) throw Error("account changed");
    };
    api.upload = vi.fn(async () => {
      current = false;
    });
    await expect(
      createPostPublication(proposal()).publish(api),
    ).rejects.toThrow("account changed");
    expect(api.insert).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing id with different content", async () => {
    const { api, rows } = services();
    rows.set(postId, { ...proposal().attempt!.record, content: "Different" });
    await expect(
      createPostPublication(proposal()).publish(api),
    ).rejects.toThrow("autre contenu");
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.insert).not.toHaveBeenCalled();
  });
  it("requires verification even after a successful insert response", async () => {
    const { api } = services();
    api.insert = vi.fn(async () => {});
    await expect(
      createPostPublication(proposal()).publish(api),
    ).rejects.toThrow("confirmée");
  });
  it("rejects changed account/content and invalid media when restoring a frozen attempt", () => {
    expect(() => validatePostDraft(proposal(), otherId)).toThrow();
    expect(() =>
      validatePostDraft(
        { ...proposal(), content: "changed after freeze" },
        userId,
      ),
    ).toThrow();
    expect(() =>
      validatePostDraft(
        {
          ...proposal(),
          media: { id: "../../private", type: "image", mime: "image/jpeg" },
        },
        userId,
      ),
    ).toThrow();
  });
});
describe("post draft journal", () => {
  it("restores editable text and media by account without automatically publishing", async () => {
    const { store } = adapter();
    const draft = { ...proposal(), attempt: null, revision: 0 };
    await createPostDraftJournal(store).save(draft, null);
    expect(await createPostDraftJournal(store).load(userId)).toEqual(draft);
    expect(await createPostDraftJournal(store).load(otherId)).toBeNull();
  });
  it("rejects stale tabs so they cannot overwrite or erase another attempt", async () => {
    const { store } = adapter();
    const first = createPostDraftJournal(store),
      second = createPostDraftJournal(store);
    const draft = { ...newPostDraft(userId, postId), content: "first" };
    await first.save(draft, null);
    const frozen = freezePostDraft(draft, () => "");
    await first.save(frozen, draft);
    await expect(
      second.save({ ...draft, revision: 1, content: "changed" }, draft),
    ).rejects.toThrow("changed");
    await expect(second.remove(draft)).rejects.toThrow("changed");
    expect(await first.load(userId)).toEqual(frozen);
  });
  it("refuses edits to a frozen attempt", async () => {
    const { store } = adapter();
    const journal = createPostDraftJournal(store),
      draft = proposal();
    await journal.save(draft, null);
    await expect(
      journal.save({ ...draft, revision: 2, content: "changed" }, draft),
    ).rejects.toThrow("figée");
  });
  it("cleans deleted accounts and fences delayed queued saves", async () => {
    const { store, values } = adapter();
    const journal = createPostDraftJournal(store);
    const a = proposal(),
      b = { ...newPostDraft(otherId, postId), content: "other account" };
    await journal.save(a, null);
    await journal.save(b, null);
    const deletion = journal.forgetForAccount(userId);
    expect(() => journal.save(a, null)).toThrow("supprimé");
    await deletion;
    expect(values.has(userId)).toBe(false);
    expect(await journal.load(otherId)).toEqual(b);
    expect(store.removeAccountMedia).toHaveBeenCalledWith(userId);
  });
});
