import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PRO_VIDEO_BYTES, validateProVideo } from "../src/lib/proVideo";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  client: vi.fn(),
  info: vi.fn(),
  upload: vi.fn(),
  read: vi.fn(),
  owner: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.session, getUser: mocks.user } },
}));
vi.mock("../src/lib/readAsset", () => ({ readAsset: mocks.read }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("expo-crypto", async () => {
  const { createHash, randomUUID } = await import("node:crypto");
  return {
    randomUUID,
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digest: async (_algorithm: string, bytes: ArrayBuffer) =>
      new Uint8Array(
        createHash("sha256").update(new Uint8Array(bytes)).digest(),
      ).buffer,
  };
});
import { createProVideoUploader } from "../src/lib/proVideoUpload";
const uid = "11111111-1111-4111-8111-111111111111",
  pageId = "22222222-2222-4222-8222-222222222222";
const asset = {
  uri: "file:///video.mp4",
  type: "video" as const,
  mimeType: "video/mp4",
  fileSize: 1000,
  width: 100,
  height: 100,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: uid }, access_token: "synthetic-token-A" } },
    error: null,
  });
  mocks.user.mockResolvedValue({ data: { user: { id: uid } }, error: null });
  mocks.owner.mockResolvedValue({ data: { id: pageId }, error: null });
  mocks.read.mockResolvedValue(new ArrayBuffer(1000));
  mocks.info.mockResolvedValue({ data: null, error: { status: 404 } });
  mocks.upload.mockResolvedValue({ error: null });
  const query = { select: () => query, eq: () => query, single: mocks.owner };
  mocks.client.mockReturnValue({
    from: () => query,
    storage: {
      from: () => ({
        info: mocks.info,
        upload: mocks.upload,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/${path}` },
        }),
      }),
    },
  });
});
describe("Pro Page video uploads", () => {
  it("checks measured bytes even when the picker omitted its size", () => {
    expect(
      validateProVideo({ ...asset, fileSize: undefined }, 1000).extension,
    ).toBe("mp4");
    expect(() =>
      validateProVideo(
        { ...asset, fileSize: undefined },
        MAX_PRO_VIDEO_BYTES + 1,
      ),
    ).toThrow();
    expect(() =>
      validateProVideo({ ...asset, mimeType: "text/html" }),
    ).toThrow();
    expect(() => validateProVideo({ ...asset, type: "image" })).toThrow();
  });
  it("uses the verified account token for owner check and upload", async () => {
    const url = await createProVideoUploader()(asset, uid, pageId);
    expect(mocks.user).toHaveBeenCalledWith("synthetic-token-A");
    expect(mocks.client.mock.calls[0][2].global.headers.Authorization).toBe(
      "Bearer synthetic-token-A",
    );
    expect(url).toContain(`${uid}/content/${pageId}/`);
    expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
  });
  it("retains a path across an uncertain upload instead of creating another object", async () => {
    const upload = createProVideoUploader();
    mocks.upload.mockResolvedValueOnce({ error: new Error("network") });
    await expect(upload(asset, uid, pageId)).rejects.toThrow("network");
    const path = mocks.upload.mock.calls[0][0];
    await upload(asset, uid, pageId);
    expect(mocks.upload.mock.calls[1][0]).toBe(path);
  });
  it("reconciles an accepted upload whose response was lost", async () => {
    mocks.info
      .mockResolvedValueOnce({ data: null, error: { status: 404 } })
      .mockResolvedValueOnce({
        data: {
          size: 1000,
          contentType: "video/mp4",
          metadata: {
            sha256: createHash("sha256")
              .update(new Uint8Array(1000))
              .digest("hex"),
          },
        },
        error: null,
      });
    mocks.upload.mockResolvedValueOnce({ error: new Error("lost response") });
    await expect(
      createProVideoUploader()(asset, uid, pageId),
    ).resolves.toContain(pageId);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it("does not upload for another current account or a former page owner", async () => {
    mocks.session.mockResolvedValueOnce({
      data: { session: { user: { id: "other" }, access_token: "synthetic-B" } },
    });
    await expect(
      createProVideoUploader()(asset, uid, pageId),
    ).rejects.toThrow();
    mocks.owner.mockResolvedValueOnce({ error: new Error("owner changed") });
    await expect(
      createProVideoUploader()(asset, uid, pageId),
    ).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("refuses reusing one asset attempt for another page", async () => {
    const upload = createProVideoUploader();
    await upload(asset, uid, pageId);
    await expect(
      upload(asset, uid, "33333333-3333-4333-8333-333333333333"),
    ).rejects.toThrow();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it("does not upload when existence cannot be checked", async () => {
    mocks.info.mockResolvedValue({ data: null, error: { status: 503 } });
    await expect(createProVideoUploader()(asset, uid, pageId)).rejects.toThrow(
      "vérifier",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("refuses a different remote object of the same size", async () => {
    mocks.info.mockResolvedValue({
      data: {
        size: 1000,
        contentType: "video/mp4",
        metadata: { sha256: "other" },
      },
      error: null,
    });
    await expect(createProVideoUploader()(asset, uid, pageId)).rejects.toThrow(
      "distant",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("freezes the bytes as well as the path for a retry", async () => {
    const upload = createProVideoUploader();
    await upload(asset, uid, pageId);
    mocks.read.mockResolvedValueOnce(new Uint8Array(1000).fill(1).buffer);
    await expect(upload(asset, uid, pageId)).rejects.toThrow("changé");
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it("stops if the account changes while storage is being checked", async () => {
    mocks.info.mockImplementationOnce(async () => {
      mocks.session.mockResolvedValue({
        data: { session: { user: { id: "other" } } },
      });
      return { data: null, error: { status: 404 } };
    });
    await expect(createProVideoUploader()(asset, uid, pageId)).rejects.toThrow(
      "session",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
