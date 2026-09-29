import { beforeEach, describe, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  moveGate: null as Promise<void> | null,
  moving: vi.fn(),
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "44444444-4444-4444-8444-444444444444",
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
      return fs.files.get(this.uri)!;
    }
    write(value: string) {
      fs.files.set(this.uri, value);
    }
    delete() {
      fs.files.delete(this.uri);
    }
    async move(to: File) {
      fs.moving();
      await fs.moveGate;
      if (to.exists) throw Error("exists");
      if (!this.exists) throw Error("temp disappeared");
      fs.files.set(to.uri, this.textSync());
      this.delete();
      this.uri = to.uri;
    }
  }
  return { Directory, File, Paths: { document: "file:///private/documents" } };
});
import { storyPublicationJournal } from "../src/lib/storyPublicationStorage.native";
import {
  storyDraft,
  storyUserId,
  otherStoryUserId,
} from "./storyPublicationFixture";
const root = "file:///private/documents/story-drafts";
beforeEach(() => {
  fs.files.clear();
  fs.directories.clear();
  fs.moveGate = null;
  fs.moving.mockClear();
});
describe("native durable story file", () => {
  it("waits for Expo57's async move before acknowledging persistence or deleting its temporary file", async () => {
    let move!: () => void;
    fs.moveGate = new Promise<void>((resolve) => {
      move = resolve;
    });
    let settled = false;
    const saving = storyPublicationJournal.save(storyDraft()).then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(fs.moving).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    expect([...fs.files.keys()]).toHaveLength(1);
    expect([...fs.files.keys()][0]).toMatch(/\.tmp$/);
    move();
    await saving;
    expect([...fs.files.keys()]).toEqual([
      `${root}/story-publication.${storyUserId}.json`,
    ]);
    expect(await storyPublicationJournal.load(storyUserId)).toEqual(
      storyDraft(),
    );
  });
  it("removes only this account's interrupted temporary files when restoring", async () => {
    fs.directories.add(root);
    fs.files.set(
      `${root}/story-publication.${storyUserId}.interrupted.tmp`,
      "private photo A",
    );
    const other = `${root}/story-publication.${otherStoryUserId}.interrupted.tmp`;
    fs.files.set(other, "private photo B");
    expect(await storyPublicationJournal.load(storyUserId)).toBeNull();
    expect([...fs.files.keys()]).toEqual([other]);
  });
});
