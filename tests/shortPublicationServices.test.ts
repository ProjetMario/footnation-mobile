import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  digest: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: fake.createClient }));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: fake.digest,
}));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: vi.fn(),
  supabase: { auth: { getSession: fake.getSession } },
}));
vi.mock("../src/lib/readAsset", () => ({ readAsset: vi.fn() }));
import { shortPublicationServices } from "../src/lib/shortPublicationServices";

const draft = {
  uri: "file:///synthetic.mp4",
  mime: "video/mp4",
  path: "user-short.mp4",
  record: {
    id: "short",
    user_id: "user",
    video_url: "https://example.invalid/short",
    description: "Texte",
  },
};
const content = {
  bytes: new Uint8Array([1, 2, 3]).buffer,
  sha256: "verified-hash",
};
beforeEach(() => {
  vi.resetAllMocks();
  fake.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "user" }, access_token: "synthetic-token-A" },
    },
    error: null,
  });
  fake.digest.mockResolvedValue(new Uint8Array([1, 254]).buffer);
  fake.createClient.mockReturnValue({
    storage: {
      from: () => ({
        upload: fake.upload,
        info: fake.info,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.invalid/${path}` },
        }),
      }),
    },
  });
});

describe("short upload reconciliation", () => {
  it("pins the request token independently from later global account changes", async () => {
    await shortPublicationServices("user", () => {});
    const options = fake.createClient.mock.calls[0][2];
    fake.getSession.mockResolvedValue({
      data: {
        session: { user: { id: "other" }, access_token: "synthetic-token-B" },
      },
      error: null,
    });
    expect(await options.accessToken()).toBe("synthetic-token-A");
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
    });
  });
  it("refuses another account before creating a scoped client", async () => {
    await expect(shortPublicationServices("other", () => {})).rejects.toThrow(
      "session a changé",
    );
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("records the expected identity/checksum and never overwrites", async () => {
    fake.upload.mockResolvedValue({ error: null });
    const port = await shortPublicationServices("user", () => {});
    await port.upload(draft, content);
    expect(fake.upload).toHaveBeenCalledWith(draft.path, content.bytes, {
      contentType: "video/mp4",
      upsert: false,
      metadata: { shortId: "short", sha256: "verified-hash" },
    });
    expect(fake.info).not.toHaveBeenCalled();
  });
  it("accepts a lost response only when the existing object matches the attempt", async () => {
    fake.upload.mockResolvedValue({ error: new Error("response lost") });
    fake.info.mockResolvedValue({
      error: null,
      data: {
        size: 3,
        metadata: { shortId: "short", sha256: "verified-hash" },
      },
    });
    const port = await shortPublicationServices("user", () => {});
    await expect(port.upload(draft, content)).resolves.toBeUndefined();
  });
  it("does not treat duplicate paths or an unavailable lookup as successful uploads", async () => {
    fake.upload.mockResolvedValue({ error: new Error("upload unconfirmed") });
    const port = await shortPublicationServices("user", () => {});
    for (const result of [
      { error: new Error("offline"), data: null },
      { error: null, data: { size: 3, metadata: {} } },
      {
        error: null,
        data: {
          size: 3,
          metadata: { shortId: "other", sha256: "verified-hash" },
        },
      },
      {
        error: null,
        data: {
          size: 3,
          metadata: { shortId: "short", sha256: "other-content" },
        },
      },
      {
        error: null,
        data: {
          size: 999,
          metadata: { shortId: "short", sha256: "verified-hash" },
        },
      },
    ]) {
      fake.info.mockResolvedValue(result);
      await expect(port.upload(draft, content)).rejects.toThrow(
        "upload unconfirmed",
      );
    }
  });
});

describe("short thumbnail reconciliation", () => {
  it("verifies thumbnail identity, size and checksum before reusing a lost upload", async () => {
    const publication = {
      ...draft,
      thumbnail: {
        base64: "/9j/4AAA",
        mime: "image/jpeg",
        path: "thumbnail.jpg",
      },
      record: {
        ...draft.record,
        thumbnail_url: "https://example.invalid/thumbnail.jpg",
      },
    };
    const port = await shortPublicationServices("user", () => {});
    fake.upload.mockResolvedValue({ error: Error("lost") });
    fake.info.mockResolvedValue({
      error: null,
      data: {
        size: 6,
        metadata: { shortId: "short", sha256: "01fe", kind: "thumbnail" },
      },
    });
    await expect(port.uploadThumbnail!(publication)).resolves.toBeUndefined();
    expect(fake.upload).toHaveBeenCalledWith(
      "thumbnail.jpg",
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: false, contentType: "image/jpeg" }),
    );
    fake.info.mockResolvedValue({
      error: null,
      data: {
        size: 6,
        metadata: { shortId: "short", sha256: "other", kind: "thumbnail" },
      },
    });
    await expect(port.uploadThumbnail!(publication)).rejects.toThrow(
      "confirmé",
    );
  });
  it("refuses a foreign thumbnail URL before any upload", async () => {
    const port = await shortPublicationServices("user", () => {});
    await expect(
      port.uploadThumbnail!({
        ...draft,
        thumbnail: {
          base64: "/9j/4AAA",
          mime: "image/jpeg",
          path: "thumb.jpg",
        },
        record: {
          ...draft.record,
          thumbnail_url: "https://other.invalid/changed.jpg",
        },
      }),
    ).rejects.toThrow("publication");
    expect(fake.upload).not.toHaveBeenCalled();
  });
});
