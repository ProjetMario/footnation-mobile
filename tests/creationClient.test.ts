import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  newCreationProject,
  sourceClip,
  type CreationProject,
  type CreationSource,
} from "../src/lib/creationProject";
import {
  checkCreationDraft,
  checkCreationSave,
  creationKey,
  creationMediaMime,
} from "../src/lib/creationStorageShared";

const fake = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  sign: vi.fn(),
  read: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: fake.createClient }));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: async (_: string, bytes: ArrayBuffer) =>
    createHash("sha256").update(new Uint8Array(bytes)).digest().buffer,
}));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: () => {},
  supabase: { auth: { getSession: fake.getSession } },
}));
vi.mock("../src/lib/creationStorage", () => ({
  readCreationMedia: fake.read,
  persistCreationMedia: fake.persist,
  creationMediaPreview: vi.fn(),
}));
import { createCreationApi, readCreationRemote } from "../src/lib/creationApi";

const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
const source: CreationSource = {
  id: other,
  type: "image",
  name: "photo.jpg",
  mime: "image/jpeg",
  size: 3,
  width: 100,
  height: 100,
  duration: 0,
};
const project = (): CreationProject => ({
  ...newCreationProject(owner, id, "post"),
  sources: [source],
  clips: [sourceClip(source, "clip")],
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fake.getSession.mockResolvedValue({
    data: { session: { user: { id: owner }, access_token: "account-A-token" } },
    error: null,
  });
  fake.createClient.mockReturnValue({
    storage: {
      from: () => ({
        upload: fake.upload,
        info: fake.info,
        createSignedUrl: fake.sign,
      }),
    },
  });
  fake.read.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  vi.stubEnv("EXPO_PUBLIC_MEDIA_STUDIO_URL", "https://studio.example.test");
});
describe("creation private projects", () => {
  it("uses encoded photo bytes when the picker returns a misleading HEIC mime", () => {
    expect(
      creationMediaMime(
        new Uint8Array([255, 216, 255, 0]).buffer,
        "image",
        "image/heic",
      ),
    ).toBe("image/jpeg");
    expect(
      creationMediaMime(
        new TextEncoder().encode("RIFF0000WEBP").buffer,
        "image",
        "image/png",
      ),
    ).toBe("image/webp");
    expect(
      creationMediaMime(new Uint8Array([1]).buffer, "video", "video/quicktime"),
    ).toBe("video/quicktime");
  });
  it("isolates account keys and refuses foreign source object paths", () => {
    expect(creationKey(owner, id)).not.toBe(creationKey(other, id));
    expect(() => checkCreationDraft(project(), other)).toThrow("compte");
    expect(() =>
      checkCreationDraft({
        ...project(),
        sources: [{ ...source, path: `${other}/${id}/${source.id}.jpg` }],
      }),
    ).toThrow("privé");
  });
  it("strips picker blob URLs from a saved source and refuses traversal", () => {
    const value = {
      ...project(),
      sources: [{ ...source, uri: "blob:temporary" }],
    };
    expect(checkCreationDraft(value).sources[0]).not.toHaveProperty("uri");
    expect(() => creationKey(owner, "../other")).toThrow();
  });
  it("prevents stale saves and content changes during a frozen attempt", () => {
    const value = project(),
      attempt = {
        version: 1 as const,
        project: value,
        media: source,
        sha256: "a".repeat(64),
        createdAt: 1,
        completed: false,
      };
    expect(() =>
      checkCreationSave({ ...value, revision: 2 }, value, null, 0),
    ).toThrow("changé");
    expect(() =>
      checkCreationSave(
        { ...value, caption: "same revision, different tab" },
        value,
        null,
      ),
    ).toThrow("changé");
    expect(() =>
      checkCreationSave({ ...value, caption: "changed" }, value, attempt),
    ).toThrow("vérification");
    expect(() => checkCreationSave(value, value, attempt)).not.toThrow();
  });
  it("pins authenticated requests to their owner even if another account signs in", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ music: [], transcription: true })),
      );
    vi.stubGlobal("fetch", fetcher);
    const api = await createCreationApi(owner, () => {});
    fake.getSession.mockResolvedValue({
      data: {
        session: { user: { id: other }, access_token: "account-B-token" },
      },
    });
    await api.capabilities();
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer account-A-token",
    );
    expect(await fake.createClient.mock.calls[0][2].accessToken()).toBe(
      "account-A-token",
    );
  });
  it("rejects a different account before making a client", async () => {
    await expect(createCreationApi(other, () => {})).rejects.toThrow(
      "session a changé",
    );
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("does not accept a conflicting uploaded object just because it already exists", async () => {
    fake.info.mockResolvedValue({
      error: null,
      data: { size: 3, metadata: { sha256: "different" } },
    });
    fake.upload.mockResolvedValue({ error: Error("409") });
    const api = await createCreationApi(owner, () => {});
    await expect(api.sync(project())).rejects.toThrow("confirmé");
    expect(fake.upload.mock.calls[0][2].upsert).toBe(false);
  });
  it("never signs another owner's output path or trusts arbitrary job URLs", async () => {
    const api = await createCreationApi(owner, () => {});
    const job = {
      id,
      projectId: id,
      revision: 1,
      kind: "render" as const,
      status: "succeeded" as const,
      progress: 1,
      stage: "done",
      result: {
        path: `${other}/${id}/out.mp4`,
        url: "https://evil.example.test",
      },
    };
    await expect(api.outputPreview(job)).rejects.toThrow("compte");
    expect(fake.sign).not.toHaveBeenCalled();
  });
  it("bounds streamed downloads without trusting content length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array(4))),
    );
    await expect(
      readCreationRemote("https://signed.example.test", 3),
    ).rejects.toThrow("taille");
  });
});
