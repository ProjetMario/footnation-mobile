import { describe, expect, it, vi } from "vitest";
import {
  buildExperienceAttempt,
  editableExperience,
  experienceCapability,
  saveExperienceAttempt,
  sameExperienceHistory,
  stageExperienceAttempt,
  type CareerExperience,
  type ExperienceSnapshot,
} from "../src/lib/experienceSave";
import { createExperienceJournal } from "../src/lib/experienceJournal";
import { onlineManager } from "@tanstack/react-query";
import { createAppQueryClient } from "../src/lib/queryClient";
vi.mock("../src/lib/monitoring", () => ({ reportError: vi.fn() }));
const uid = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  club = "10000000-0000-4000-8000-000000000001";
const eid = "20000000-0000-4000-8000-000000000001",
  attemptId = "30000000-0000-4000-8000-000000000001";
const entry: CareerExperience = {
  club: "Club exact",
  club_id: club,
  ageCategory: "Seniors",
  level: "Régional",
  position: "Gardien",
  startYear: "2020",
  endYear: "",
};
const snapshot: ExperienceSnapshot = {
  id: uid,
  experience_history: null,
  updated_at: null,
};
function build(
  options: Partial<Parameters<typeof buildExperienceAttempt>[0]> = {},
) {
  const ids = [eid, attemptId];
  return buildExperienceAttempt({
    snapshot,
    mode: "synced",
    action: { type: "save", index: null, entry, clubConfirmed: true },
    randomId: () => ids.shift()!,
    ...options,
  });
}
function repository() {
  let current = snapshot;
  return {
    assertIdentity: vi.fn(async () => {}),
    read: vi.fn(async () => current),
    sync: vi.fn(
      async (_expected: unknown, history: unknown[]) =>
        (current = {
          ...snapshot,
          experience_history: history,
          updated_at: "2026-09-11",
        }),
    ),
    update: vi.fn(
      async (history: unknown[], _expectedHistory: unknown) =>
        (current = {
          ...snapshot,
          experience_history: history,
          updated_at: "2026-09-11",
        }),
    ),
    setCurrent: (value: ExperienceSnapshot) => {
      current = value;
    },
  };
}
describe("experience proposals", () => {
  it("captures the whole immutable history and only gives the edited item an identity", () => {
    const legacy = { ...entry, notes: { important: "ancien" } };
    const state = {
      ...snapshot,
      experience_history: [legacy, { opaque: [1, 2] }],
    };
    const next = build({
      snapshot: state,
      action: {
        type: "save",
        index: 0,
        entry: { ...legacy, position: "Milieu" },
        clubConfirmed: true,
      },
    });
    expect(next.history).toEqual([
      { ...legacy, position: "Milieu", native_experience_id: eid },
      { opaque: [1, 2] },
    ]);
    legacy.notes.important = "changé";
    expect((next.expected as typeof state.experience_history)[0]).toMatchObject(
      { notes: { important: "ancien" } },
    );
    expect(state.experience_history[0]).not.toHaveProperty(
      "native_experience_id",
    );
  });
  it("does not infer provenance from an old club ID without explicit reselection", () => {
    const next = build({
      snapshot: { ...snapshot, experience_history: [entry] },
      action: { type: "save", index: 0, entry, clubConfirmed: false },
    });
    expect(next.history[0]).not.toHaveProperty("native_experience_id");
    expect(next.history[0]).toHaveProperty("club_id", club);
  });
  it("retains a stable experience identity when editing and unlinks without renaming", () => {
    const previous = { ...entry, native_experience_id: eid };
    const next = build({
      snapshot: { ...snapshot, experience_history: [previous] },
      action: {
        type: "save",
        index: 0,
        entry: { ...previous, club_id: undefined },
        clubConfirmed: false,
      },
    });
    expect(next.history[0]).toMatchObject({
      native_experience_id: eid,
      club: entry.club,
    });
    expect(next.history[0]).not.toHaveProperty("club_id");
  });
  it("keeps the explicit profile-only workflow when sync is not deployed", () => {
    expect(build({ mode: "profile-only" }).history[0]).not.toHaveProperty(
      "native_experience_id",
    );
    expect(experienceCapability({ code: "PGRST202" }, null)).toBe(false);
    expect(experienceCapability({ code: "42883" }, null)).toBe(false);
    expect(() => experienceCapability(new Error("network"), null)).toThrow(
      "network",
    );
    expect(() => experienceCapability(null, null)).toThrow();
    expect(experienceCapability(null, true)).toBe(true);
  });
  it("requires an explicit year for a selected projected club, but not free text", () => {
    expect(() =>
      build({
        action: {
          type: "save",
          index: null,
          entry: { ...entry, startYear: "" },
          clubConfirmed: true,
        },
      }),
    ).toThrow("année de début");
    expect(
      build({
        action: {
          type: "save",
          index: null,
          entry: { ...entry, club_id: undefined, startYear: "" },
          clubConfirmed: false,
        },
      }).history[0],
    ).toMatchObject({ startYear: "", native_experience_id: eid });
  });
  it.each(["club-name", "../club", "", "0000"])(
    "rejects invalid selected IDs/year %s",
    (bad) => {
      expect(() =>
        build({
          action: {
            type: "save",
            index: null,
            entry: {
              ...entry,
              ...(bad === "0000"
                ? { startYear: bad }
                : { club_id: bad || "?" }),
            },
            clubConfirmed: true,
          },
        }),
      ).toThrow();
    },
  );
  it("removes only the explicitly chosen entry and refuses stale indexes", () => {
    const base = { ...snapshot, experience_history: [entry, { legacy: true }] };
    expect(
      build({ snapshot: base, action: { type: "remove", index: 0 } }).history,
    ).toEqual([{ legacy: true }]);
    expect(() =>
      build({ snapshot: base, action: { type: "remove", index: 2 } }),
    ).toThrow();
  });
  it("preserves numeric legacy dates and recognizes the site's current-year label", () => {
    expect(
      editableExperience({ ...entry, startYear: 2010, endYear: 2020 }),
    ).toMatchObject({ startYear: "2010", endYear: "2020" });
    expect(editableExperience({ ...entry, endYear: "Présent" })).toMatchObject({
      endYear: "",
    });
    expect(
      editableExperience({ ...entry, startYear: { year: 2020 } }),
    ).toBeNull();
  });
  it("ignores JSONB key ordering, but detects changed arrays and values", () => {
    expect(
      sameExperienceHistory(
        [{ a: 1, b: { x: 2, y: 3 } }],
        [{ b: { y: 3, x: 2 }, a: 1 }],
      ),
    ).toBe(true);
    expect(sameExperienceHistory([1, 2], [2, 1])).toBe(false);
    expect(sameExperienceHistory(null, [])).toBe(false);
  });
});
describe("experience atomic save and reconciliation", () => {
  it("sends the complete expected and desired payload to the atomic RPC", async () => {
    const attempt = build(),
      repo = repository();
    await saveExperienceAttempt(attempt, repo);
    expect(repo.sync).toHaveBeenCalledWith(null, attempt.history);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("reconciles a lost response after commit without a second write", async () => {
    const attempt = build(),
      repo = repository();
    const commit = repo.sync.getMockImplementation()!;
    repo.sync.mockImplementationOnce(async (...args) => {
      await commit(...args);
      throw new Error("lost response");
    });
    await expect(saveExperienceAttempt(attempt, repo)).rejects.toThrow(
      "lost response",
    );
    await expect(saveExperienceAttempt(attempt, repo)).resolves.toMatchObject({
      experience_history: attempt.history,
    });
    expect(repo.sync).toHaveBeenCalledTimes(1);
  });
  it("refuses a concurrent different profile without writing", async () => {
    const repo = repository();
    repo.setCurrent({ ...snapshot, experience_history: [{ different: true }] });
    await expect(saveExperienceAttempt(build(), repo)).rejects.toThrow(
      "autre appareil",
    );
    expect(repo.sync).not.toHaveBeenCalled();
  });
  it("compares the full current history for profile-only CAS without requiring timestamps", async () => {
    const repo = repository();
    repo.setCurrent({ ...snapshot, updated_at: "fresh" });
    const attempt = build({ mode: "profile-only" });
    await saveExperienceAttempt(attempt, repo);
    expect(repo.update).toHaveBeenCalledWith(attempt.history, null);
    expect(repo.sync).not.toHaveBeenCalled();
  });
  it.each([1, 2, 3])(
    "rejects identity change at boundary %s before mutation",
    async (boundary) => {
      const repo = repository();
      let count = 0;
      repo.assertIdentity.mockImplementation(async () => {
        if (++count === boundary) throw new Error("account changed");
      });
      await expect(saveExperienceAttempt(build(), repo)).rejects.toThrow(
        "account changed",
      );
      expect(repo.sync).not.toHaveBeenCalled();
    },
  );
  it("does not acknowledge under a changed account after commit", async () => {
    const repo = repository();
    let count = 0;
    repo.assertIdentity.mockImplementation(async () => {
      if (++count === 4) throw new Error("account changed");
    });
    await expect(saveExperienceAttempt(build(), repo)).rejects.toThrow(
      "account changed",
    );
    expect(repo.sync).toHaveBeenCalledTimes(1);
  });
});
describe("durable account-scoped experience attempts", () => {
  function setup() {
    const data = new Map<string, string>();
    const store = {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: async (key: string) => {
        data.delete(key);
      },
    };
    return { data, store, journal: createExperienceJournal(store) };
  }
  it("persists before the real offline mutation guard rejects without sending", async () => {
    const { journal, store } = setup(),
      attempt = build(),
      client = createAppQueryClient(),
      send = vi.fn();
    onlineManager.setOnline(false);
    try {
      const staged = await stageExperienceAttempt(
        attempt,
        journal.save,
        () => {},
      );
      await expect(
        client
          .getMutationCache()
          .build(client, { mutationFn: send })
          .execute(staged),
      ).rejects.toThrow();
      expect(send).not.toHaveBeenCalled();
      expect(await createExperienceJournal(store).read(uid)).toEqual(attempt);
    } finally {
      onlineManager.setOnline(true);
      client.clear();
    }
  });
  it("restores a complete attempt on restart and refuses replacement by another attempt", async () => {
    const { store, journal } = setup(),
      attempt = build();
    await journal.save(attempt);
    expect(await createExperienceJournal(store).read(uid)).toEqual(attempt);
    await expect(
      journal.save({ ...attempt, attemptId: other }),
    ).rejects.toThrow("autre tentative");
    await journal.save(attempt);
    await journal.clear(attempt);
    expect(await journal.read(uid)).toBeNull();
  });
  it("snapshots before awaiting and keeps B when A is deleted", async () => {
    const { store, journal } = setup(),
      attempt = build(),
      b = { ...build(), userId: other };
    const pending = journal.save(attempt);
    attempt.history.push({ late: true });
    await pending;
    expect((await journal.read(uid))?.history).toHaveLength(1);
    await journal.save(b);
    await journal.forgetAccount(uid);
    expect(await journal.read(other)).toEqual(b);
    await expect(journal.save(build())).rejects.toThrow("supprimé");
    await expect(createExperienceJournal(store).save(build())).rejects.toThrow(
      "supprimé",
    );
  });
  it("fences queued writers before deleting the account's only journal", async () => {
    const { journal, data } = setup();
    const writing = journal.save(build());
    const deleting = journal.forgetAccount(uid);
    await expect(writing).rejects.toThrow("supprimé");
    await deleting;
    expect(data.has(`footnation-experience-save.${uid}`)).toBe(false);
    expect(data.get(`footnation-experience-save.${uid}.deleted`)).toBe("1");
  });
  it("does not clear an unrelated newer proposal or accept malformed storage", async () => {
    const { journal, data } = setup(),
      attempt = build();
    await journal.save(attempt);
    await expect(
      journal.clear({ ...attempt, attemptId: other }),
    ).rejects.toThrow();
    data.set(
      `footnation-experience-save.${uid}`,
      JSON.stringify({ ...attempt, userId: other }),
    );
    await expect(journal.read(uid)).rejects.toThrow();
  });
});
