import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  readAsset: vi.fn(),
  preview: vi.fn(),
  release: vi.fn(),
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
vi.mock("../src/lib/readAsset", () => ({ readAsset: fake.readAsset }));
vi.mock("../src/lib/postDraftStorage", () => ({
  postMediaPreview: fake.preview,
}));
import { postPublicationServices } from "../src/lib/postPublicationServices";
import { freezePostDraft, newPostDraft } from "../src/lib/postPublication";
const userId = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const draft = freezePostDraft(
  {
    ...newPostDraft(userId, id),
    content: "Foot",
    media: { id, type: "video", mime: "video/mp4" },
  },
  (path) => `https://cdn.example.com/${path}`,
);
beforeEach(() => {
  vi.resetAllMocks();
  fake.getSession.mockResolvedValue({
    error: null,
    data: { session: { user: { id: userId }, access_token: "synthetic-A" } },
  });
  fake.digest.mockResolvedValue(new Uint8Array([1, 254]).buffer);
  fake.readAsset.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  fake.preview.mockResolvedValue({
    uri: "blob:preview",
    release: fake.release,
  });
  fake.createClient.mockReturnValue({
    storage: {
      from: () => ({
        upload: fake.upload,
        info: fake.info,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.com/${path}` },
        }),
      }),
    },
  });
});
describe("post media retry and account isolation", () => {
  it("pins the access token of the original account", async () => {
    await postPublicationServices(userId, () => {});
    const options = fake.createClient.mock.calls[0][2];
    fake.getSession.mockResolvedValue({
      data: { session: { user: { id }, access_token: "synthetic-B" } },
    });
    expect(await options.accessToken()).toBe("synthetic-A");
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
    });
  });
  it("refuses a different active account before constructing a write client", async () => {
    await expect(postPublicationServices(id, () => {})).rejects.toThrow(
      "session a changé",
    );
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("reuses lost uploads only after checking stable post id, bytes and checksum", async () => {
    fake.upload.mockResolvedValue({ error: Error("response lost") });
    fake.info.mockResolvedValue({
      error: null,
      data: { size: 3, metadata: { postId: id, sha256: "01fe" } },
    });
    const services = await postPublicationServices(userId, () => {});
    await services.upload(draft);
    expect(fake.upload).toHaveBeenCalledWith(
      draft.attempt!.path,
      expect.any(ArrayBuffer),
      {
        contentType: "video/mp4",
        upsert: false,
        metadata: { postId: id, sha256: "01fe" },
      },
    );
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it("does not blindly accept conflicting files or inaccessible metadata", async () => {
    fake.upload.mockResolvedValue({ error: Error("409") });
    const services = await postPublicationServices(userId, () => {});
    for (const response of [
      { error: Error("offline"), data: null },
      { error: null, data: { size: 3, metadata: {} } },
      {
        error: null,
        data: { size: 4, metadata: { postId: id, sha256: "01fe" } },
      },
      {
        error: null,
        data: { size: 3, metadata: { postId: userId, sha256: "01fe" } },
      },
      {
        error: null,
        data: { size: 3, metadata: { postId: id, sha256: "changed" } },
      },
    ]) {
      fake.info.mockResolvedValue(response);
      await expect(services.upload(draft)).rejects.toThrow("confirmé");
    }
  });
  it("releases the media preview even if reading the retained file fails", async () => {
    fake.readAsset.mockRejectedValue(Error("missing"));
    const services = await postPublicationServices(userId, () => {});
    await expect(services.upload(draft)).rejects.toThrow("missing");
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.upload).not.toHaveBeenCalled();
  });
});
