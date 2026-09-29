import { describe, expect, it, vi } from "vitest";
import {
  createStoryPublication,
  storyPhoto,
  validateStoryPublication,
  MAX_STORY_BYTES,
  type StoryPublicationJournal,
  type StoryPublicationServices,
  type StoryPublicationRecord,
} from "../src/lib/storyPublication";
import {
  createStoryPublicationJournal,
  type StoryDraftStore,
} from "../src/lib/storyPublicationJournal";
import {
  storyDraft,
  storyUserId,
  otherStoryUserId,
} from "./storyPublicationFixture";
const journal = (): StoryPublicationJournal => ({
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
});
const services = (
  override: Partial<StoryPublicationServices> = {},
): StoryPublicationServices => ({
  assertCurrentAccount: vi.fn(),
  now: () => storyDraft().createdAt,
  find: vi.fn().mockResolvedValue(null),
  upload: vi.fn().mockResolvedValue(undefined),
  insert: vi.fn().mockResolvedValue(undefined),
  ...override,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function memory() {
  const data = new Map<string, string>();
  const store: StoryDraftStore = {
    read: vi.fn(async (key) => data.get(key) ?? null),
    create: vi.fn(async (key, value) => {
      if (data.has(key)) throw Error("exists");
      data.set(key, value);
    }),
    remove: vi.fn(async (key, value) => {
      if (data.get(key) !== value) throw Error("changed");
      data.delete(key);
    }),
  };
  return { data, store, journal: createStoryPublicationJournal(store) };
}

describe("durable story publication", () => {
  it("waits for durable save before any request and shares the double-tap promise", async () => {
    const write = deferred<void>(),
      local = journal(),
      port = services();
    local.save = vi.fn(() => write.promise);
    const attempt = createStoryPublication(storyDraft(), local);
    const a = attempt.publish(port),
      b = attempt.publish(port);
    expect(a).toBe(b);
    expect(port.find).not.toHaveBeenCalled();
    write.resolve();
    await a;
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(port.insert).toHaveBeenCalledTimes(1);
    expect(local.remove).toHaveBeenCalledTimes(1);
  });
  it("blocks every network request if durable storage is unavailable", async () => {
    const local = journal(),
      port = services();
    local.save = vi.fn().mockRejectedValue(Error("full"));
    await expect(
      createStoryPublication(storyDraft(), local).publish(port),
    ).rejects.toThrow("full");
    expect(port.find).not.toHaveBeenCalled();
    expect(port.upload).not.toHaveBeenCalled();
    expect(port.insert).not.toHaveBeenCalled();
  });
  it("preserves all submitted content, filters, photo and original expiry", async () => {
    const input = storyDraft(),
      expected = storyDraft(),
      port = services(),
      local = journal();
    const attempt = createStoryPublication(input, local);
    input.record.filters.brightness = 0;
    input.record.caption = "changed";
    input.record.hashtags.push("changed");
    input.base64 = "broken";
    input.path = "other";
    input.record.expires_at = "2099-01-01";
    await attempt.publish(port);
    expect(local.save).toHaveBeenCalledWith(expected);
    expect(port.insert).toHaveBeenCalledWith(expected.record);
  });
  it("reconciles a lost insert response without removing its published photo", async () => {
    const row = storyDraft().record,
      local = journal();
    const port = services({
      find: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row),
      insert: vi.fn().mockRejectedValue(Error("response lost")),
    });
    await expect(
      createStoryPublication(storyDraft(), local).publish(port),
    ).resolves.toBe(row.id);
    expect(port.find).toHaveBeenNthCalledWith(2, row.id);
    expect(port.insert).toHaveBeenCalledTimes(1);
    expect(local.remove).toHaveBeenCalledTimes(1);
  });
  it("restores after app restart without sending automatically and resolves the original record", async () => {
    const local = memory(),
      port = services({
        insert: vi.fn().mockRejectedValue(Error("lost")),
        find: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(Error("offline")),
      });
    await expect(
      createStoryPublication(storyDraft(), local.journal).publish(port),
    ).rejects.toThrow("offline");
    const restored = createStoryPublicationJournal(local.store);
    const pending = await restored.load(storyUserId);
    expect(pending).toEqual(storyDraft());
    expect(port.insert).toHaveBeenCalledTimes(1);
    const retry = services({
      find: vi.fn().mockResolvedValue(storyDraft().record),
    });
    await createStoryPublication(pending!, restored).publish(retry);
    expect(retry.upload).not.toHaveBeenCalled();
    expect(retry.insert).not.toHaveBeenCalled();
    expect(await restored.load(storyUserId)).toBeNull();
  });
  it("reuses an uploaded photo after an absent insert and keeps the original expiry", async () => {
    const local = memory(),
      port = services({
        insert: vi
          .fn()
          .mockRejectedValueOnce(Error("offline"))
          .mockResolvedValueOnce(undefined),
      });
    const attempt = createStoryPublication(storyDraft(), local.journal);
    await expect(attempt.publish(port)).rejects.toThrow("offline");
    await attempt.publish(port);
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(port.insert).toHaveBeenNthCalledWith(2, storyDraft().record);
  });
  it("recognizes an already published expired row before checking expiry", async () => {
    const row = {
      ...storyDraft().record,
      expires_at: storyDraft().record.expires_at.replace(".000Z", "+00:00"),
    };
    const port = services({
      now: () => Date.parse(row.expires_at) + 1,
      find: vi.fn().mockResolvedValue(row),
    });
    await createStoryPublication(storyDraft(), journal()).publish(port);
    expect(port.insert).not.toHaveBeenCalled();
    expect(port.upload).not.toHaveBeenCalled();
  });
  it("refuses an absent expired attempt without renewing or uploading it", async () => {
    const local = memory(),
      port = services({
        now: () => Date.parse(storyDraft().record.expires_at),
      });
    await expect(
      createStoryPublication(storyDraft(), local.journal).publish(port),
    ).rejects.toThrow("expiré");
    expect(port.find).toHaveBeenCalledOnce();
    expect(port.upload).not.toHaveBeenCalled();
    expect(port.insert).not.toHaveBeenCalled();
    expect(await local.journal.load(storyUserId)).toEqual(storyDraft());
  });
  it("refuses to insert if the original expiry passes during photo upload", async () => {
    let now = storyDraft().createdAt;
    const port = services({
      now: () => now,
      upload: vi.fn(async () => {
        now = Date.parse(storyDraft().record.expires_at);
      }),
    });
    await expect(
      createStoryPublication(storyDraft(), journal()).publish(port),
    ).rejects.toThrow("expiré");
    expect(port.insert).not.toHaveBeenCalled();
  });
  it("retains the journal and stops insertion after the account changes during upload", async () => {
    let same = true;
    const local = memory();
    const port = services({
      assertCurrentAccount: () => {
        if (!same) throw Error("account changed");
      },
      upload: vi.fn(async () => {
        same = false;
      }),
    });
    await expect(
      createStoryPublication(storyDraft(), local.journal).publish(port),
    ).rejects.toThrow("account changed");
    expect(port.insert).not.toHaveBeenCalled();
    expect(await local.journal.load(storyUserId)).not.toBeNull();
  });
  it("rejects a conflicting existing story and leaves both local and remote content alone", async () => {
    const local = memory(),
      port = services({
        find: vi
          .fn()
          .mockResolvedValue({ ...storyDraft().record, caption: "other" }),
      });
    await expect(
      createStoryPublication(storyDraft(), local.journal).publish(port),
    ).rejects.toThrow("autre contenu");
    expect(port.upload).not.toHaveBeenCalled();
    expect(port.insert).not.toHaveBeenCalled();
    expect(await local.journal.load(storyUserId)).not.toBeNull();
  });
  it("keeps the journal if an upload cannot be confirmed", async () => {
    const local = memory(),
      port = services({
        upload: vi.fn().mockRejectedValue(Error("unknown upload")),
      });
    await expect(
      createStoryPublication(storyDraft(), local.journal).publish(port),
    ).rejects.toThrow("unknown upload");
    expect(port.insert).not.toHaveBeenCalled();
    expect(await local.journal.load(storyUserId)).not.toBeNull();
  });
  it("reconciles again if local cleanup failed after successful insertion", async () => {
    const local = journal(),
      port = services({
        find: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(storyDraft().record),
      });
    local.remove = vi
      .fn()
      .mockRejectedValueOnce(Error("locked"))
      .mockResolvedValueOnce(undefined);
    const attempt = createStoryPublication(storyDraft(), local);
    await expect(attempt.publish(port)).rejects.toThrow("locked");
    await attempt.publish(port);
    expect(port.insert).toHaveBeenCalledOnce();
  });
  it("serializes discard and publish and never silently starts publication after discard", async () => {
    const lookup = deferred<StoryPublicationRecord | null>(),
      port = services({ find: vi.fn(() => lookup.promise) }),
      local = journal();
    const attempt = createStoryPublication(storyDraft(), local);
    const first = attempt.discard(port);
    expect(attempt.discard(port)).toBe(first);
    await expect(attempt.publish(port)).rejects.toThrow("vérification");
    lookup.resolve(null);
    await expect(first).resolves.toEqual({ published: false });
    expect(port.insert).not.toHaveBeenCalled();
  });
  it("refuses discard during publication and keeps an unverified discard for retry", async () => {
    const lookup = deferred<StoryPublicationRecord | null>(),
      port = services({ find: vi.fn(() => lookup.promise) }),
      local = journal();
    const attempt = createStoryPublication(storyDraft(), local);
    const sending = attempt.publish(port);
    await expect(attempt.discard(port)).rejects.toThrow("encore en cours");
    lookup.resolve(storyDraft().record);
    await sending;
    const failed = services({
      find: vi.fn().mockRejectedValue(Error("offline")),
    });
    local.remove = vi.fn();
    await expect(attempt.discard(failed)).rejects.toThrow("offline");
    expect(local.remove).not.toHaveBeenCalled();
  });
  it("allows local discard if the published story was later edited elsewhere", async () => {
    const local = journal(),
      port = services({
        find: vi.fn().mockResolvedValue({
          ...storyDraft().record,
          caption: "Edited on the website",
        }),
      });
    await expect(
      createStoryPublication(storyDraft(), local).discard(port),
    ).resolves.toEqual({ published: true });
    expect(local.remove).toHaveBeenCalledOnce();
    expect(port.insert).not.toHaveBeenCalled();
    expect(port.upload).not.toHaveBeenCalled();
  });
  it("reports that a discarded attempt was already published without deleting it", async () => {
    const port = services({
      find: vi.fn().mockResolvedValue(storyDraft().record),
    });
    await expect(
      createStoryPublication(storyDraft(), journal()).discard(port),
    ).resolves.toEqual({ published: true });
    expect(port.insert).not.toHaveBeenCalled();
    expect(port.upload).not.toHaveBeenCalled();
  });
});

describe("story journal isolation and photo validation", () => {
  it("allows only one attempt per account and leaves another account untouched on cleanup", async () => {
    const local = memory(),
      a = storyDraft(),
      b = storyDraft();
    b.record.user_id = otherStoryUserId;
    b.path = b.path.replace(storyUserId, otherStoryUserId);
    await local.journal.save(a);
    await local.journal.save(b);
    const changed = storyDraft();
    changed.record.caption = "another attempt";
    await expect(local.journal.save(changed)).rejects.toThrow("autre story");
    await expect(local.journal.remove(changed)).rejects.toThrow(
      "autre tentative",
    );
    await local.journal.forgetForAccount(storyUserId);
    expect(await local.journal.load(storyUserId)).toBeNull();
    expect(await local.journal.load(otherStoryUserId)).toEqual(b);
  });
  it("handles two tabs saving the same attempt atomically", async () => {
    const local = memory(),
      other = createStoryPublicationJournal(local.store);
    await Promise.all([
      local.journal.save(storyDraft()),
      other.save(storyDraft()),
    ]);
    expect(await local.journal.load(storyUserId)).toEqual(storyDraft());
  });
  it("never removes a newer attempt inserted between lookup and atomic deletion", async () => {
    const local = memory();
    await local.journal.save(storyDraft());
    const original = local.store.remove;
    local.store.remove = async (key, expected) => {
      local.data.set(key, "newer-value");
      await original(key, expected);
    };
    await expect(local.journal.remove(storyDraft())).rejects.toThrow("changed");
    expect([...local.data.values()]).toEqual(["newer-value"]);
  });
  it("takes a snapshot before a queued save and refuses account-crossed restore", async () => {
    const local = memory(),
      input = storyDraft();
    const saving = local.journal.save(input);
    input.record.caption = "changed while queued";
    await saving;
    expect((await local.journal.load(storyUserId))?.record.caption).toBe(
      "Un match",
    );
    expect(() =>
      validateStoryPublication(storyDraft(), otherStoryUserId),
    ).toThrow("compte");
  });
  it("retains corrupt journals until an explicit account-local discard", async () => {
    const local = memory();
    local.data.set(
      `story-publication.${storyUserId}`,
      "invalid private payload",
    );
    await expect(local.journal.load(storyUserId)).rejects.toThrow("récupérer");
    expect(local.data.size).toBe(1);
    await local.journal.forgetForAccount(storyUserId);
    expect(local.data.size).toBe(0);
  });
  it("fences pending and future writes after verified deletion, while another account can still save", async () => {
    const local = memory(),
      lookup = deferred<string | null>();
    local.store.read = vi
      .fn()
      .mockImplementationOnce(() => lookup.promise)
      .mockImplementation(async (key: string) => local.data.get(key) ?? null);
    const saving = local.journal.save(storyDraft());
    // Let the queued save enter its asynchronous read before deletion arrives.
    await vi.waitFor(() => expect(local.store.read).toHaveBeenCalledOnce());
    const deleting = local.journal.forgetForAccount(storyUserId);
    const rejected = expect(saving).rejects.toThrow("supprimé");
    lookup.resolve(null);
    await rejected;
    await deleting;
    expect(local.store.create).not.toHaveBeenCalled();
    expect(() => local.journal.save(storyDraft())).toThrow("supprimé");
    const other = storyDraft();
    other.record.user_id = otherStoryUserId;
    other.path = other.path.replace(storyUserId, otherStoryUserId);
    await local.journal.save(other);
    expect(await local.journal.load(otherStoryUserId)).toEqual(other);
  });
  it("allows an explicitly discarded unreadable journal to be replaced without marking the account deleted", async () => {
    const local = memory();
    local.data.set(`story-publication.${storyUserId}`, "corrupt");
    await local.journal.discardUnreadableForAccount(storyUserId);
    await local.journal.save(storyDraft());
    expect(await local.journal.load(storyUserId)).toEqual(storyDraft());
  });
  it("identifies photo bytes, including a JPEG returned for a HEIC picker asset", () => {
    expect(storyPhoto(storyDraft().base64)).toEqual({
      mime: "image/jpeg",
      ext: "jpg",
    });
    expect(storyPhoto(btoa("\x89PNG\r\n\x1a\n"))).toEqual({
      mime: "image/png",
      ext: "png",
    });
    expect(storyPhoto(btoa("RIFF0000WEBP"))).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
    expect(storyPhoto(btoa("0000ftypheic"))).toEqual({
      mime: "image/heic",
      ext: "heic",
    });
  });
  it("rejects malformed, oversized or unrecognized image bytes before journal persistence", () => {
    for (const photo of [
      null,
      "",
      "/9j/4AA",
      "/9j=4AAA",
      "====",
      "_9j/4AAA",
      btoa("not a photograph"),
      "A".repeat(Math.ceil(MAX_STORY_BYTES / 3) * 4 + 4),
    ])
      expect(() => storyPhoto(photo)).toThrow("photo");
    for (const changed of [
      { mime: "video/mp4" },
      { path: "other.jpg" },
      { createdAt: -1 },
    ])
      expect(() =>
        validateStoryPublication({ ...storyDraft(), ...changed }, storyUserId),
      ).toThrow("invalide");
    const extended = storyDraft();
    extended.record.expires_at = new Date(
      Date.parse(extended.record.expires_at) + 1,
    ).toISOString();
    expect(() => validateStoryPublication(extended, storyUserId)).toThrow(
      "invalide",
    );
  });
});
