import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  digest: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
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
import { storyPublicationServices } from "../src/lib/storyPublicationServices";
import {
  storyDraft,
  storyUserId,
  otherStoryUserId,
} from "./storyPublicationFixture";

beforeEach(() => {
  vi.resetAllMocks();
  fake.getSession.mockResolvedValue({
    error: null,
    data: {
      session: { user: { id: storyUserId }, access_token: "synthetic-A" },
    },
  });
  fake.digest.mockResolvedValue(new Uint8Array([1, 254]).buffer);
  fake.eq.mockReturnValue({ maybeSingle: fake.single });
  fake.select.mockReturnValue({ eq: fake.eq });
  fake.createClient.mockReturnValue({
    from: () => ({ select: fake.select, insert: fake.insert }),
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
describe("scoped story upload", () => {
  it("pins the JWT instead of following a subsequent session change", async () => {
    await storyPublicationServices(storyUserId, () => {});
    const options = fake.createClient.mock.calls[0][2];
    fake.getSession.mockResolvedValue({
      error: null,
      data: {
        session: {
          user: { id: otherStoryUserId },
          access_token: "synthetic-B",
        },
      },
    });
    expect(await options.accessToken()).toBe("synthetic-A");
    expect(options.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });
  it("refuses the wrong account before any scoped request", async () => {
    await expect(
      storyPublicationServices(otherStoryUserId, () => {}),
    ).rejects.toThrow("session a changé");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("reads the original ID without applying an expiration filter", async () => {
    const row = storyDraft().record;
    fake.single.mockResolvedValue({ error: null, data: row });
    const port = await storyPublicationServices(storyUserId, () => {});
    expect(await port.find(row.id)).toEqual(row);
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", row.id);
    expect(fake.select).toHaveBeenCalledWith(
      "id,user_id,media_url,caption,location,hashtags,filters,expires_at",
    );
  });
  it("records the exact photo checksum and never overwrites the object", async () => {
    fake.upload.mockResolvedValue({ error: null });
    const port = await storyPublicationServices(storyUserId, () => {}),
      draft = storyDraft();
    await port.upload(draft);
    expect(fake.upload).toHaveBeenCalledWith(
      draft.path,
      Uint8Array.from(atob(draft.base64), (c) => c.charCodeAt(0)).buffer,
      {
        contentType: "image/jpeg",
        upsert: false,
        metadata: { storyId: draft.record.id, sha256: "01fe" },
      },
    );
  });
  it("accepts a lost upload response only when object identity, size and checksum match", async () => {
    fake.upload.mockResolvedValue({ error: Error("lost") });
    const port = await storyPublicationServices(storyUserId, () => {}),
      draft = storyDraft();
    fake.info.mockResolvedValue({
      error: null,
      data: { size: 6, metadata: { storyId: draft.record.id, sha256: "01fe" } },
    });
    await expect(port.upload(draft)).resolves.toBeUndefined();
    for (const result of [
      { error: Error("offline"), data: null },
      { error: null, data: { size: 6, metadata: {} } },
      {
        error: null,
        data: { size: 6, metadata: { storyId: "another", sha256: "01fe" } },
      },
      {
        error: null,
        data: {
          size: 6,
          metadata: { storyId: draft.record.id, sha256: "wrong" },
        },
      },
      {
        error: null,
        data: {
          size: 7,
          metadata: { storyId: draft.record.id, sha256: "01fe" },
        },
      },
    ]) {
      fake.info.mockResolvedValue(result);
      await expect(port.upload(draft)).rejects.toThrow("confirmé");
    }
  });
  it("blocks foreign environments, invalid photo data and an account changed during hashing", async () => {
    const draft = storyDraft();
    let same = true;
    const port = await storyPublicationServices(storyUserId, () => {
      if (!same) throw Error("account changed");
    });
    await expect(
      port.upload({
        ...draft,
        record: { ...draft.record, media_url: "https://another.invalid/photo" },
      }),
    ).rejects.toThrow("compte");
    await expect(port.upload({ ...draft, base64: "invalid" })).rejects.toThrow(
      "photo",
    );
    fake.digest.mockImplementation(async () => {
      same = false;
      return new ArrayBuffer(2);
    });
    await expect(port.upload(draft)).rejects.toThrow("account changed");
    expect(fake.upload).not.toHaveBeenCalled();
  });
});
