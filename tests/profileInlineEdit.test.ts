import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  editableProfileField,
  inlineProfilePayload,
  saveInlineProfile,
} from "../src/lib/profileInlineEdit";
import type { Profile } from "../src/lib/models";
const profile = {
  id: "me",
  first_name: "Alex",
  last_name: "Test",
  full_name: "Alex Test",
  city: "Paris",
  is_admin: false,
} as Profile;
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "me" } } });
  client.rpc.mockResolvedValue({
    data: { ...profile, city: "Lyon" },
    error: null,
  });
});
it("changes only the selected field with its original value for conflict detection", async () => {
  await saveInlineProfile(profile, editableProfileField(profile, "Ville")!, {
    city: "Lyon",
    is_admin: "true",
  });
  expect(client.rpc).toHaveBeenCalledWith("update_native_profile_snapshot", {
    p_values: { city: "Lyon" },
    p_expected: { city: "Paris" },
  });
});
it("keeps the display name aligned with first and last names", () => {
  expect(
    inlineProfilePayload(profile, editableProfileField(profile, "Nom")!, {
      first_name: "Jean",
      last_name: "Dupont",
    }),
  ).toEqual({
    first_name: "Jean",
    last_name: "Dupont",
    full_name: "Jean Dupont",
  });
});
it("rejects an arbitrary field and never edits age or birthdate", () => {
  expect(editableProfileField(profile, "Âge")).toBeNull();
  expect(editableProfileField(profile, "Date de naissance")).toBeNull();
  expect(() =>
    inlineProfilePayload(
      profile,
      { label: "Ville", keys: ["is_admin"] },
      { is_admin: "true" },
    ),
  ).toThrow();
});
it("does not write when the signed-in account changes", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "other" } } });
  await expect(
    saveInlineProfile(profile, editableProfileField(profile, "Ville")!, {
      city: "Lyon",
    }),
  ).rejects.toThrow("session");
  expect(client.rpc).not.toHaveBeenCalled();
  expect(client.from).not.toHaveBeenCalled();
});
it("reports a concurrent change without overwriting it", async () => {
  client.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  await expect(
    saveInlineProfile(profile, editableProfileField(profile, "Ville")!, {
      city: "Lyon",
    }),
  ).rejects.toThrow("entre-temps");
});
it("deduplicates array values and rejects invalid measures", () => {
  expect(
    inlineProfilePayload(
      profile,
      editableProfileField(profile, "Compétences")!,
      { skills: "Relance, Relance, Vitesse" },
    ),
  ).toEqual({ skills: ["Relance", "Vitesse"] });
  expect(() =>
    inlineProfilePayload(profile, editableProfileField(profile, "Taille")!, {
      height: "abc",
    }),
  ).toThrow();
});
it("compares the original array when editing secondary roles", async () => {
  const q = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  for (const method of [q.update, q.eq, q.is, q.select])
    method.mockReturnValue(q);
  client.from.mockReturnValue(q);
  const p = { ...profile, secondary_roles: ["Entraîneur"] };
  await saveInlineProfile(p, editableProfileField(p, "Rôles secondaires")!, {
    secondary_roles: "Arbitre",
  });
  expect(q.update).toHaveBeenCalledWith({ secondary_roles: ["Arbitre"] });
  expect(q.eq).toHaveBeenCalledWith("id", "me");
  expect(q.eq).toHaveBeenCalledWith("secondary_roles", '{"Entraîneur"}');
});
it("saves the department chosen with a city using conflict detection for both fields", async () => {
  const p = { ...profile, department: "75 - Paris" };
  await saveInlineProfile(p, editableProfileField(p, "Ville")!, {
    city: "Voglans",
    department: "73 - Savoie",
  });
  expect(client.rpc).toHaveBeenCalledWith("update_native_profile_snapshot", {
    p_values: { city: "Voglans", department: "73 - Savoie" },
    p_expected: { city: "Paris", department: "75 - Paris" },
  });
});
it("ignores unrelated draft fields and rejects an invalid derived department", () => {
  expect(() =>
    inlineProfilePayload(profile, editableProfileField(profile, "Ville")!, {
      city: "Lyon",
      department: "is_admin",
    }),
  ).toThrow("département");
  expect(
    inlineProfilePayload(profile, editableProfileField(profile, "Genre")!, {
      gender: "Masculin",
      department: "73 - Savoie",
    }),
  ).toEqual({ gender: "Masculin" });
});
