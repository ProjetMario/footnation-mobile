import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  newCreationProject,
  sourceClip,
  type CreationSource,
} from "../src/lib/creationProject";
const fake = vi.hoisted(() => ({
  attempt: null as any,
  row: null as any,
  save: vi.fn(),
  saveAttempt: vi.fn(),
  read: vi.fn(),
  find: vi.fn(),
  insert: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  shortUpload: vi.fn(),
  persist: vi.fn(),
  checksum: vi.fn(),
  api: vi.fn(),
}));
vi.mock("../src/lib/creationStorage", () => ({
  loadCreationAttempt: async () => fake.attempt,
  saveCreationProject: fake.save,
  saveCreationAttempt: fake.saveAttempt,
  readCreationMedia: fake.read,
  persistCreationMedia: fake.persist,
}));
vi.mock("../src/lib/creationApi", () => ({
  creationChecksum: fake.checksum,
  createCreationApi: fake.api,
  readCreationRemote: vi.fn(),
  frozenCreationClient: async () => ({
    client: {
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://cdn.example.test/${path}` },
          }),
          upload: fake.upload,
          info: fake.info,
        }),
      },
    },
  }),
}));
vi.mock("../src/lib/postPublicationServices", () => ({
  postPublicationServices: async (_id: string, guard: () => void) => ({
    assertCurrentAccount: guard,
    find: fake.find,
    insert: fake.insert,
  }),
}));
vi.mock("../src/lib/storyPublicationServices", () => ({
  storyPublicationServices: vi.fn(),
}));
vi.mock("../src/lib/shortPublicationServices", () => ({
  shortPublicationServices: async (_id: string, guard: () => void) => ({
    assertCurrentAccount: guard,
    find: fake.find,
    insert: fake.insert,
    upload: fake.shortUpload,
  }),
}));
import {
  publishCreationProject,
  assertCreationRender,
  creationPublicationErrorMessage,
  creationPublicationNeedsProfile,
} from "../src/lib/creationPublication";
const owner = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  mediaId = "33333333-3333-4333-8333-333333333333";
const source: CreationSource = {
  id: mediaId,
  type: "video",
  name: "test.mp4",
  mime: "video/mp4",
  size: 3,
  width: 100,
  height: 100,
  duration: 3,
};
const project = () => ({
  ...newCreationProject(owner, id, "post"),
  sources: [source],
  clips: [sourceClip(source, "clip")],
});
beforeEach(() => {
  vi.resetAllMocks();
  fake.attempt = null;
  fake.row = null;
  fake.read.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  fake.checksum.mockResolvedValue("a".repeat(64));
  fake.saveAttempt.mockImplementation(async (attempt) => {
    fake.attempt = JSON.parse(JSON.stringify(attempt));
  });
  fake.find.mockImplementation(async () => fake.row);
  fake.insert.mockImplementation(async (row) => {
    fake.row = row;
  });
  fake.upload.mockResolvedValue({ error: null });
});
describe("durable creation publication", () => {
  it("requires durable attempt storage before any public write", async () => {
    fake.saveAttempt.mockRejectedValueOnce(Error("disk full"));
    await expect(publishCreationProject(project(), () => {})).rejects.toThrow(
      "disk full",
    );
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.insert).not.toHaveBeenCalled();
  });
  it("reconciles an ambiguous insert with the same UUID and does not duplicate on retry", async () => {
    const value = project();
    fake.insert.mockImplementationOnce(async (row) => {
      fake.row = row;
      throw Error("response lost");
    });
    expect(await publishCreationProject(value, () => {})).toEqual({
      id,
      mode: "post",
    });
    expect(fake.attempt.completed).toBe(true);
    expect(await publishCreationProject(value, () => {})).toEqual({
      id,
      mode: "post",
    });
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.row.id).toBe(id);
  });
  it("keeps an unfinished attempt immutable and blocks a changed account", async () => {
    const value = project();
    fake.find.mockRejectedValueOnce(Error("offline"));
    await expect(publishCreationProject(value, () => {})).rejects.toThrow(
      "offline",
    );
    await expect(
      publishCreationProject({ ...value, caption: "changed" }, () => {}),
    ).rejects.toThrow("même version");
    expect(() =>
      publishCreationProject(value, () => {
        throw Error("account changed");
      }),
    ).toThrow("account changed");
    expect(fake.insert).not.toHaveBeenCalled();
  });
  it("retries a rejected author reference with the retained UUID and confirms the existing upload", async () => {
    const value = project();
    const failure = {
      code: "23503",
      message:
        'insert or update on table "posts" violates foreign key constraint "posts_user_id_fkey"',
    };
    fake.insert.mockRejectedValueOnce(failure);
    await expect(publishCreationProject(value, () => {})).rejects.toBe(failure);
    expect(fake.attempt.completed).toBe(false);
    expect(fake.row).toBeNull();

    fake.upload.mockResolvedValueOnce({ error: { statusCode: "409" } });
    fake.info.mockResolvedValueOnce({
      error: null,
      data: { size: 3, metadata: { postId: id, sha256: "a".repeat(64) } },
    });
    expect(await publishCreationProject(value, () => {})).toEqual({
      id,
      mode: "post",
    });
    expect(fake.attempt.completed).toBe(true);
    expect(fake.insert.mock.calls[0][0]).toEqual(fake.insert.mock.calls[1][0]);
    expect(fake.info).toHaveBeenCalledWith(`videos/${id}.mp4`);
    expect(fake.upload.mock.calls[0][0]).toBe(fake.upload.mock.calls[1][0]);
    expect(fake.row.id).toBe(id);
    await publishCreationProject(value, () => {});
    expect(fake.insert).toHaveBeenCalledTimes(2);
  });
  it("refuses stale and preview renders before downloading media", async () => {
    const value = project();
    expect(() =>
      assertCreationRender(value, {
        id,
        projectId: id,
        revision: value.revision - 1,
        kind: "render",
        status: "succeeded",
        progress: 1,
        stage: "done",
        result: { path: "private" },
      }),
    ).toThrow("cette version");
    await expect(
      publishCreationProject(
        {
          ...value,
          texts: [
            {
              id: "text",
              text: "Goal",
              start: 0,
              end: 2,
              x: 0.5,
              y: 0.5,
              size: 20,
              color: "#ffffff",
            },
          ],
        },
        () => {},
      ),
    ).rejects.toThrow("Finalisez");
    expect(fake.api).not.toHaveBeenCalled();
    expect(fake.upload).not.toHaveBeenCalled();
  });
  it("writes baked short media with no extra soundtrack or trim", async () => {
    const value = {
      ...project(),
      mode: "short" as const,
      aspect: "9:16" as const,
    };
    await publishCreationProject(value, () => {});
    expect(fake.row).toMatchObject({
      id,
      start_time: 0,
      duration: 3,
      music_url: null,
    });
    expect(fake.shortUpload).toHaveBeenCalledOnce();
  });
  it("refuses altered bytes on a retained attempt", async () => {
    const value = project();
    fake.find.mockRejectedValueOnce(Error("offline"));
    await expect(publishCreationProject(value, () => {})).rejects.toThrow(
      "offline",
    );
    fake.checksum.mockResolvedValueOnce("b".repeat(64));
    await expect(publishCreationProject(value, () => {})).rejects.toThrow(
      "média conservé a changé",
    );
    expect(fake.insert).not.toHaveBeenCalled();
  });
});

describe("creation publication error messages", () => {
  it("explains a plain-object author-reference failure without displaying SQL", () => {
    const result = creationPublicationErrorMessage({
      code: "23503",
      message:
        'insert or update on table "posts" violates foreign key constraint "posts_user_id_fkey"',
      details: "Private database details",
    });
    expect(result).toContain("Complétez votre profil");
    expect(result).toContain("brouillon sont conservés");
    expect(result).not.toMatch(/posts|foreign key|Private database/i);
  });
  it("only routes missing author references to explicit profile completion", () => {
    for (const table of ["posts", "shorts", "stories"])
      expect(
        creationPublicationNeedsProfile({
          code: "23503",
          message: `${table}_user_id_fkey`,
        }),
      ).toBe(true);
    for (const error of [
      null,
      new Error("offline"),
      { code: "23503", message: "posts_club_id_fkey" },
      { code: "42501", message: "posts_user_id_fkey" },
    ])
      expect(creationPublicationNeedsProfile(error)).toBe(false);
  });
  it("keeps session and network failures actionable", () => {
    expect(creationPublicationErrorMessage({ code: "PGRST301" })).toContain(
      "Reconnectez-vous",
    );
    expect(
      creationPublicationErrorMessage(new TypeError("Network request failed")),
    ).toContain("Vérifiez votre connexion");
  });
  it("preserves local validation and sanitizes unknown backend failures", () => {
    expect(
      creationPublicationErrorMessage(new Error("Ajoutez une photo.")),
    ).toBe("Ajoutez une photo.");
    expect(
      creationPublicationErrorMessage({
        code: "42501",
        message: "private SQL",
      }),
    ).not.toContain("private SQL");
    expect(
      creationPublicationErrorMessage({ message: "private SQL" }),
    ).not.toContain("private SQL");
  });
});
