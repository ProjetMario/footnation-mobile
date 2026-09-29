import { expect, it } from "vitest";
import {
  profileSnapshotRequest,
  saveProfileSnapshot,
} from "../src/lib/profileSave";
it("recovers a confirmed profile/photo write without another mutation", async () => {
  const row = {
    id: "me",
    bio: "New",
    avatar_url: "https://example.com/avatar",
    skills: ["A"],
  };
  const fail = async () => {
    throw new Error("Unexpected mutation");
  };
  expect(
    await saveProfileSnapshot(
      { read: async () => row, insert: fail, update: fail },
      row,
      { id: "me", bio: "Old" },
    ),
  ).toEqual(row);
});
it("never overwrites a concurrently created or changed profile", async () => {
  const repository = {
    read: async () => ({ id: "me", bio: "Other" }),
    insert: async () => {
      throw new Error("Unexpected insert");
    },
    update: async () => null,
  };
  await expect(
    saveProfileSnapshot(repository, { id: "me", bio: "Mine" }, null),
  ).rejects.toThrow("existe déjà");
  await expect(
    saveProfileSnapshot(
      repository,
      { id: "me", bio: "Mine" },
      { id: "me", bio: "Old" },
    ),
  ).rejects.toThrow("a changé");
});
it("passes the original snapshot and keeps arrays and long text in the request body", async () => {
  const baseline = { id: "me", skills: ["a,b", 'quote"', "back\\slash"] };
  const payload = { id: "me", skills: ["Updated"] };
  expect(
    await saveProfileSnapshot(
      {
        read: async () => baseline,
        insert: async () => payload,
        update: async (row, original) => {
          expect(original).toBe(baseline);
          return row;
        },
      },
      payload,
      baseline,
    ),
  ).toEqual(payload);
  const request = profileSnapshotRequest(
    { id: "me", skills: ["New"], bio: "é".repeat(3000) },
    baseline,
  );
  expect(request.p_expected).toEqual({ skills: baseline.skills, bio: null });
  expect(request.p_values).toEqual({ skills: ["New"], bio: "é".repeat(3000) });
  expect(request.p_values).not.toHaveProperty("id");
});
