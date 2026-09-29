import { beforeEach, describe, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({
  files: new Map<string, number>(),
  copies: [] as Array<{ uri: string; finish: () => void }>,
  badSize: false,
}));
vi.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .reduce(
          (path, part, index) =>
            index
              ? `${path.replace(/\/$/, "")}/${part.replace(/^\/+/, "")}`
              : part,
          "",
        );
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {
      for (const uri of fs.files.keys())
        if (uri.startsWith(this.uri + "/")) fs.files.delete(uri);
    }
  }
  class File extends Directory {
    get exists() {
      return fs.files.has(this.uri);
    }
    get size() {
      return fs.files.get(this.uri) ?? 0;
    }
    delete() {
      fs.files.delete(this.uri);
    }
    copy(target: File) {
      return new Promise<void>((resolve) =>
        fs.copies.push({
          uri: target.uri,
          finish: () => {
            fs.files.set(target.uri, fs.badSize ? 1 : this.size);
            resolve();
          },
        }),
      );
    }
  }
  return {
    Directory,
    File,
    Paths: {
      document: { uri: "file:///private" },
      cache: { uri: "file:///cache" },
    },
  };
});
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
import {
  forgetMessageAttachmentFiles,
  retainMessageFile,
} from "../src/lib/messageAttachmentStorage";
import type { LocalMessageFile } from "../src/lib/messageAttachment";
const file: LocalMessageFile = {
  uri: "file:///cache/test.pdf",
  mime: "application/pdf",
  name: "CV.pdf",
  size: 4,
  kind: "file",
  duration: null,
};
beforeEach(() => {
  fs.files.clear();
  fs.copies = [];
  fs.badSize = false;
  fs.files.set(file.uri, 4);
});
describe("Expo 57 private file copy lifecycle", () => {
  it("waits for the asynchronous copy before returning a usable private file", async () => {
    let settled = false;
    const promise = retainMessageFile(
      "11111111-1111-4111-8111-111111111111",
      file,
    ).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(fs.files.size).toBe(1);
    fs.copies[0].finish();
    const result = await promise;
    expect(result.size).toBe(4);
    expect(result.uri).not.toBe(file.uri);
    expect(fs.files.get(file.uri)).toBe(4);
  });
  it("removes only its late copy when the account is deleted during copying", async () => {
    const uid = "22222222-2222-4222-8222-222222222222";
    const other =
      "file:///private/message-drafts/33333333-3333-4333-8333-333333333333/existing.pdf";
    fs.files.set(other, 8);
    const promise = retainMessageFile(uid, file);
    const failure = expect(promise).rejects.toThrow("supprimé");
    await forgetMessageAttachmentFiles(uid);
    fs.copies[0].finish();
    await failure;
    expect(fs.files.has(fs.copies[0].uri)).toBe(false);
    expect(fs.files.get(other)).toBe(8);
    expect(fs.files.get(file.uri)).toBe(4);
  });
  it("rejects and cleans an incomplete copy while preserving the source", async () => {
    fs.badSize = true;
    const promise = retainMessageFile(
      "44444444-4444-4444-8444-444444444444",
      file,
    );
    const failure = expect(promise).rejects.toThrow("incomplète");
    fs.copies[0].finish();
    await failure;
    expect(fs.files.has(fs.copies[0].uri)).toBe(false);
    expect(fs.files.get(file.uri)).toBe(4);
  });
});
