import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import { loadPublicTalent, publicTalentFields } from "../src/lib/publicTalent";
beforeEach(() => client.from.mockReset());
function query(data: unknown, error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  client.from.mockReturnValueOnce(q);
  return q;
}
it("cherche un slug publié sans demander les coordonnées personnelles", async () => {
  const q = query({ id: "profile", is_suspended: false });
  expect((await loadPublicTalent("joueur"))?.id).toBe("profile");
  expect(q.eq.mock.calls).toEqual([
    ["slug", "joueur"],
    ["is_published", true],
  ]);
  for (const field of ["email", "phone", "birthdate"])
    expect(publicTalentFields.split(",")).not.toContain(field);
});
it("utilise le secours UUID seulement après un slug absent et conserve published", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  query(null);
  const q = query({ id, is_suspended: false });
  expect((await loadPublicTalent(id))?.id).toBe(id);
  expect(q.eq.mock.calls).toEqual([
    ["id", id],
    ["is_published", true],
  ]);
  client.from.mockReset();
  query(null);
  expect(await loadPublicTalent("not-a-uuid")).toBeNull();
  expect(client.from).toHaveBeenCalledTimes(1);
});
it("ne masque pas une erreur par une tentative de secours", async () => {
  query(null, new Error("Réseau"));
  await expect(
    loadPublicTalent("00000000-0000-0000-0000-000000000001"),
  ).rejects.toThrow("Réseau");
  expect(client.from).toHaveBeenCalledTimes(1);
});
it("ne montre pas un profil suspendu et ne requête pas un lien vide", async () => {
  expect(await loadPublicTalent("")).toBeNull();
  expect(client.from).not.toHaveBeenCalled();
  query({ id: "profile", is_suspended: true });
  expect(await loadPublicTalent("joueur")).toBeNull();
});

it("affiche le nom professionnel du type de compte actif", async () => {
  const { publicProfileName } = await import("../src/lib/publicTalent");
  const profile = {
    id: "p",
    full_name: "Nom du profil",
    username: null,
    avatar_url: null,
    club_official_name: "Club officiel",
    business_name: "Entreprise",
    institution_name: "Institution",
  };
  expect(publicProfileName({ ...profile, account_type: "club" })).toBe(
    "Club officiel",
  );
  expect(publicProfileName({ ...profile, account_type: "business" })).toBe(
    "Entreprise",
  );
  expect(publicProfileName({ ...profile, account_type: "institution" })).toBe(
    "Institution",
  );
  expect(publicProfileName({ ...profile, account_type: "personal" })).toBe(
    "Nom du profil",
  );
  expect(
    publicProfileName({
      ...profile,
      account_type: "business",
      business_name: " ",
    }),
  ).toBe("Nom du profil");
});
