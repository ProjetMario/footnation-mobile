import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  profileRolesDraft,
  profileRolesPayload,
  saveProfileRoles,
} from "../src/lib/profileRoles";
import { saveProfileSnapshot } from "../src/lib/profileSave";
const original = {
  id: "me",
  primary_role: "Joueur amateur",
  secondary_roles: ["Arbitre"],
};
const target = {
  ...original,
  ...profileRolesPayload("Joueur amateur, Entraîneur, Éducateur"),
};
const q = {
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "me" } },
    error: null,
  });
  client.from.mockReturnValue(q);
  for (const method of [q.update, q.eq, q.is, q.select])
    method.mockReturnValue(q);
  q.maybeSingle.mockResolvedValue({ data: target, error: null });
});
it("loads primary and secondary roles, deduplicates and round-trips a multi-role profile", () => {
  expect(profileRolesDraft(original)).toBe("Joueur amateur, Arbitre");
  expect(profileRolesPayload(profileRolesDraft(original))).toEqual({
    primary_role: original.primary_role,
    secondary_roles: original.secondary_roles,
  });
  expect(profileRolesPayload(" Arbitre, Arbitre, Éducateur ")).toEqual({
    primary_role: "Arbitre",
    secondary_roles: ["Éducateur"],
  });
  expect(profileRolesDraft(null)).toBe("");
  expect(profileRolesPayload("")).toEqual({
    primary_role: null,
    secondary_roles: [],
  });
});
it("updates both columns together with identity and original role guards", async () => {
  expect(
    await saveProfileRoles(original, original, profileRolesDraft(target)),
  ).toEqual(target);
  expect(q.update).toHaveBeenCalledWith({
    primary_role: "Joueur amateur",
    secondary_roles: ["Entraîneur", "Éducateur"],
  });
  expect(q.eq).toHaveBeenCalledWith("id", "me");
  expect(q.eq).toHaveBeenCalledWith("primary_role", "Joueur amateur");
  expect(q.eq).toHaveBeenCalledWith("secondary_roles", '{"Arbitre"}');
});
it("supports legacy profiles with null roles", async () => {
  const blank = { id: "me", primary_role: null, secondary_roles: null };
  await saveProfileRoles(blank, blank, "Arbitre");
  expect(q.is).toHaveBeenCalledWith("primary_role", null);
  expect(q.is).toHaveBeenCalledWith("secondary_roles", null);
});
it("does not write after an account switch", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "other" } } });
  await expect(
    saveProfileRoles(original, original, "Éducateur"),
  ).rejects.toThrow("session");
  expect(client.from).not.toHaveBeenCalled();
});
it("reports conflicts instead of overwriting another edit", async () => {
  q.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(
    saveProfileRoles(original, original, "Éducateur"),
  ).rejects.toThrow("entre-temps");
});
it("recovers a saved form after a failed role write without resending the profile update", async () => {
  const savedForm = { ...original, bio: "New bio" };
  q.maybeSingle.mockResolvedValueOnce({
    data: null,
    error: { message: "offline" },
  });
  await expect(
    saveProfileRoles(savedForm, original, profileRolesDraft(target)),
  ).rejects.toThrow("sélection est conservée");
  const repository = {
    read: vi.fn().mockResolvedValue(savedForm),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const recovered = await saveProfileSnapshot(
    repository,
    { id: "me", bio: "New bio" },
    { ...original, bio: "Old bio" },
  );
  expect(repository.update).not.toHaveBeenCalled();
  expect(
    await saveProfileRoles(recovered, original, profileRolesDraft(target)),
  ).toEqual(target);
});
it("recognizes a successful role write after its response was lost", async () => {
  expect(
    await saveProfileRoles(target, original, profileRolesDraft(target)),
  ).toEqual(target);
  expect(client.from).not.toHaveBeenCalled();
});
