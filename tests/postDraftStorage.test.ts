import { beforeEach, describe, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({
  files: new Map<string, string | Uint8Array>(),
  directories: new Set<string>(),
  gate: null as Promise<void> | null,
  moving: vi.fn(),
}));
vi.mock("expo-file-system", () => {
  const uri = (...parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/");
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(...parts);
    }
    get exists() {
      return fs.directories.has(this.uri);
    }
    create() {
      fs.directories.add(this.uri);
    }
    list() {
      return [...fs.files.keys()]
        .filter((path) => path.startsWith(`${this.uri}/`))
        .map((path) => new File(path));
    }
    delete() {
      for (const path of fs.files.keys())
        if (path.startsWith(`${this.uri}/`)) fs.files.delete(path);
      fs.directories.delete(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(...parts);
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get parentDirectory() {
      return new Directory(this.uri.slice(0, this.uri.lastIndexOf("/")));
    }
    textSync() {
      return fs.files.get(this.uri) as string;
    }
    write(value: string | Uint8Array) {
      fs.files.set(this.uri, value);
    }
    delete() {
      fs.files.delete(this.uri);
    }
    async move(to: File) {
      fs.moving();
      await fs.gate;
      if (!this.exists || to.exists) throw Error("move failed");
      fs.files.set(to.uri, fs.files.get(this.uri)!);
      this.delete();
      this.uri = to.uri;
    }
  }
  return { Directory, File, Paths: { document: "file:///private/documents" } };
});
import {
  persistPostMedia,
  postDraftJournal,
  postMediaPreview,
  removePostMedia,
} from "../src/lib/postDraftStorage.native";
import { newPostDraft, type PostDraftMedia } from "../src/lib/postPublication";
const userId = "11111111-1111-4111-8111-111111111111",
  otherId = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  fs.files.clear();
  fs.directories.clear();
  fs.gate = null;
  fs.moving.mockClear();
});
describe("native post draft files", () => {
  it("keeps the previous complete revision until Expo57 async move finishes", async () => {
    const first = { ...newPostDraft(userId, id), content: "first" };
    await postDraftJournal.save(first, null);
    let complete!: () => void;
    fs.gate = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const next = { ...first, revision: 1, content: "second" };
    let settled = false;
    const saving = postDraftJournal.save(next, first).then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(fs.moving).toHaveBeenCalledTimes(2));
    expect(settled).toBe(false);
    expect([...fs.files.keys()].some((path) => path.endsWith("/1.json"))).toBe(
      true,
    );
    complete();
    await saving;
    expect(await postDraftJournal.load(userId)).toEqual(next);
    expect(
      [...fs.files.keys()].filter((path) => path.endsWith(".json")),
    ).toHaveLength(1);
  });
  it("retains media outside the picker cache and restores only this account's file", async () => {
    const media: PostDraftMedia = { id, type: "video", mime: "video/mp4" };
    const bytes = new Uint8Array([1, 2, 3]);
    await persistPostMedia(userId, media, bytes.buffer);
    const draft = { ...newPostDraft(userId, id), media, content: "Foot" };
    await postDraftJournal.save(draft, null);
    expect(await postDraftJournal.load(userId)).toEqual(draft);
    const preview = await postMediaPreview(userId, media);
    expect(preview.uri).toContain(`/post-drafts/${userId}/${id}.mp4`);
    expect(fs.files.get(preview.uri)).toEqual(bytes);
    await expect(postMediaPreview(otherId, media)).rejects.toThrow(
      "indisponible",
    );
    await postDraftJournal.remove(draft);
    await removePostMedia(userId, media);
    expect(await postDraftJournal.load(userId)).toBeNull();
    expect(fs.files.has(preview.uri)).toBe(false);
  });
  it("does not acknowledge persistence or lose the old draft when a move fails", async () => {
    const first = { ...newPostDraft(userId, id), content: "first" };
    await postDraftJournal.save(first, null);
    fs.gate = Promise.reject(Error("disk unavailable"));
    // Attach a handler immediately; the move will also consume this rejection.
    void fs.gate.catch(() => {});
    await expect(
      postDraftJournal.save(
        { ...first, revision: 1, content: "second" },
        first,
      ),
    ).rejects.toThrow("disk unavailable");
    fs.gate = null;
    expect(await postDraftJournal.load(userId)).toEqual(first);
    expect([...fs.files.keys()].some((path) => path.endsWith(".tmp"))).toBe(
      false,
    );
  });
});
