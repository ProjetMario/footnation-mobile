import { describe, expect, it, vi } from "vitest";
import {
  createShortPublication,
  shortVideoExtension,
  type ShortPublicationDraft,
  type ShortPublicationRecord,
  type ShortPublicationServices,
} from "../src/lib/shortPublication";

function draft(): ShortPublicationDraft {
  return {
    uri: "file:///synthetic.mp4",
    mime: "video/mp4",
    path: "user-short.mp4",
    record: {
      id: "short",
      user_id: "user",
      video_url: "https://example.invalid/user-short.mp4",
      description: "Une action",
    },
  };
}
function services(
  overrides: Partial<ShortPublicationServices> = {},
): ShortPublicationServices {
  return {
    assertCurrentAccount: vi.fn(),
    find: vi.fn().mockResolvedValue(null),
    read: vi.fn().mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      sha256: "hash",
    }),
    upload: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("short publication retries", () => {
  it("shares one synchronous lock for simultaneous submissions", async () => {
    const lookup = deferred<ShortPublicationRecord | null>();
    const port = services({ find: vi.fn(() => lookup.promise) });
    const attempt = createShortPublication(draft());
    const first = attempt.publish(port);
    const second = attempt.publish(port);
    expect(first).toBe(second);
    lookup.resolve(null);
    await Promise.all([first, second]);
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(port.insert).toHaveBeenCalledTimes(1);
  });

  it("freezes a copy of the submitted description and media identity", async () => {
    const input = draft();
    const attempt = createShortPublication(input);
    Object.assign(input.record, {
      description: "Texte modifié après publication",
    });
    Object.assign(input, { path: "other.mp4", uri: "file:///other.mp4" });
    const port = services();
    await attempt.publish(port);
    expect(port.read).toHaveBeenCalledWith("file:///synthetic.mp4");
    expect(port.upload).toHaveBeenCalledWith(
      expect.objectContaining({ path: "user-short.mp4" }),
      expect.anything(),
    );
    expect(port.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Une action" }),
    );
  });

  it("recognizes an insertion committed despite a lost response", async () => {
    const value = draft();
    const port = services({
      find: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(value.record),
      insert: vi.fn().mockRejectedValue(new Error("response lost")),
    });
    await expect(createShortPublication(value).publish(port)).resolves.toBe(
      "short",
    );
    expect(port.insert).toHaveBeenCalledTimes(1);
  });

  it("reads the same row before retrying when both responses were lost", async () => {
    const value = draft();
    const port = services({
      find: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(value.record),
      insert: vi.fn().mockRejectedValue(new Error("response lost")),
    });
    const attempt = createShortPublication(value);
    await expect(attempt.publish(port)).rejects.toThrow("offline");
    await expect(attempt.publish(port)).resolves.toBe("short");
    expect(port.insert).toHaveBeenCalledTimes(1);
    expect(port.upload).toHaveBeenCalledTimes(1);
  });

  it("retries an uncommitted row with the same ID without another upload", async () => {
    const port = services({
      insert: vi
        .fn()
        .mockRejectedValueOnce(new Error("not committed"))
        .mockResolvedValueOnce(undefined),
    });
    const attempt = createShortPublication(draft());
    await expect(attempt.publish(port)).rejects.toThrow("not committed");
    await expect(attempt.publish(port)).resolves.toBe("short");
    expect(port.insert).toHaveBeenNthCalledWith(1, attempt.draft.record);
    expect(port.insert).toHaveBeenNthCalledWith(2, attempt.draft.record);
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(port.read).toHaveBeenCalledTimes(1);
  });

  it("keeps exact bytes and path when the upload response cannot be verified", async () => {
    const port = services({
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error("upload unknown"))
        .mockResolvedValueOnce(undefined),
    });
    const attempt = createShortPublication(draft());
    await expect(attempt.publish(port)).rejects.toThrow("upload unknown");
    expect(port.insert).not.toHaveBeenCalled();
    await expect(attempt.publish(port)).resolves.toBe("short");
    const upload = vi.mocked(port.upload);
    expect(upload.mock.calls[0][0]).toBe(upload.mock.calls[1][0]);
    expect(upload.mock.calls[0][1]).toBe(upload.mock.calls[1][1]);
    expect(port.read).toHaveBeenCalledTimes(1);
  });

  it("never overwrites an existing row with a different owner or payload", async () => {
    for (const replacement of [
      { user_id: "other" },
      { description: "other" },
      { video_url: "other" },
    ]) {
      const value = draft();
      const port = services({
        find: vi.fn().mockResolvedValue({ ...value.record, ...replacement }),
      });
      await expect(createShortPublication(value).publish(port)).rejects.toThrow(
        "autre contenu",
      );
      expect(port.upload).not.toHaveBeenCalled();
      expect(port.insert).not.toHaveBeenCalled();
    }
  });

  it("stops before any write if the initial verification is unavailable", async () => {
    const port = services({
      find: vi.fn().mockRejectedValue(new Error("lookup unavailable")),
    });
    await expect(createShortPublication(draft()).publish(port)).rejects.toThrow(
      "lookup unavailable",
    );
    expect(port.upload).not.toHaveBeenCalled();
    expect(port.insert).not.toHaveBeenCalled();
  });

  it("stops before insertion if the account changes during upload", async () => {
    let sameAccount = true;
    const port = services({
      assertCurrentAccount: () => {
        if (!sameAccount) throw new Error("account changed");
      },
      upload: vi.fn(async () => {
        sameAccount = false;
      }),
    });
    await expect(createShortPublication(draft()).publish(port)).rejects.toThrow(
      "account changed",
    );
    expect(port.insert).not.toHaveBeenCalled();
  });

  it("does not repeat a known successful publication", async () => {
    const attempt = createShortPublication(draft());
    const port = services();
    await attempt.publish(port);
    await attempt.publish(port);
    expect(port.insert).toHaveBeenCalledTimes(1);
    expect(port.find).toHaveBeenCalledTimes(1);
  });

  it("accepts only supported video formats", () => {
    expect(shortVideoExtension("video/mp4")).toBe("mp4");
    expect(shortVideoExtension("video/quicktime")).toBe("mov");
    expect(shortVideoExtension("video/webm")).toBe("webm");
    expect(() => shortVideoExtension("image/jpeg")).toThrow("MP4, MOV ou WebM");
  });
});

describe("advanced short publication snapshot", () => {
  function enriched(): ShortPublicationDraft {
    return {
      ...draft(),
      thumbnail: {
        base64: "/9j/4AAA",
        mime: "image/jpeg",
        path: "user-short-thumbnail.jpg",
      },
      record: {
        ...draft().record,
        thumbnail_url: "https://example.invalid/user-short-thumbnail.jpg",
        music: "Track",
        artist: "Catalogue",
        music_url: "https://example.invalid/music.mp3",
        start_time: 30,
        duration: 10,
        goal_timestamps: [31, 35],
      },
    };
  }
  it("freezes thumbnail, music, excerpt and goal positions before the first await", async () => {
    const input = enriched(),
      expected = enriched(),
      attempt = createShortPublication(input),
      port = services({
        uploadThumbnail: vi.fn().mockResolvedValue(undefined),
      });
    Object.assign(input.record, {
      music: "changed",
      duration: 1,
      thumbnail_url: "other",
    });
    (input.record.goal_timestamps as number[]).push(39);
    Object.assign(input.thumbnail!, { path: "changed", base64: "corrupt" });
    await attempt.publish(port);
    expect(port.insert).toHaveBeenCalledWith(expected.record);
    expect(port.uploadThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnail: expected.thumbnail }),
    );
  });
  it("does not insert while thumbnail upload is unconfirmed and reuses the already uploaded video", async () => {
    const attempt = createShortPublication(enriched()),
      port = services({
        uploadThumbnail: vi
          .fn()
          .mockRejectedValueOnce(Error("thumbnail uncertain"))
          .mockResolvedValueOnce(undefined),
      });
    await expect(attempt.publish(port)).rejects.toThrow("thumbnail uncertain");
    expect(port.insert).not.toHaveBeenCalled();
    await attempt.publish(port);
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(port.uploadThumbnail).toHaveBeenCalledTimes(2);
    expect(port.insert).toHaveBeenCalledTimes(1);
  });
  it("reconciles a lost insert with all optional fields and does not upload the thumbnail twice", async () => {
    const attempt = createShortPublication(enriched()),
      port = services({
        uploadThumbnail: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockRejectedValue(Error("lost")),
        find: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(enriched().record),
      });
    await attempt.publish(port);
    await attempt.publish(port);
    expect(port.insert).toHaveBeenCalledTimes(1);
    expect(port.uploadThumbnail).toHaveBeenCalledTimes(1);
  });
  it("refuses a conflicting music, clip or goal field on an existing record", async () => {
    for (const change of [
      { music_url: "other" },
      { duration: 11 },
      { goal_timestamps: [31] },
      { thumbnail_url: "other" },
    ]) {
      const port = services({
        find: vi.fn().mockResolvedValue({ ...enriched().record, ...change }),
      });
      await expect(
        createShortPublication(enriched()).publish(port),
      ).rejects.toThrow("autre contenu");
      expect(port.upload).not.toHaveBeenCalled();
      expect(port.insert).not.toHaveBeenCalled();
    }
  });
  it("keeps legacy Shorts compatible when optional fields are absent or null", async () => {
    const port = services({
      find: vi.fn().mockResolvedValue({
        ...draft().record,
        music: null,
        music_url: null,
        thumbnail_url: null,
        start_time: null,
        duration: null,
        goal_timestamps: [],
      }),
    });
    await createShortPublication(draft()).publish(port);
    expect(port.upload).not.toHaveBeenCalled();
  });
});
