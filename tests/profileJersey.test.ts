import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  parseJerseyNumber,
  visibleJerseyNumber,
} from "../src/lib/profileJersey";
import {
  editableProfileField,
  inlineProfilePayload,
  saveInlineProfile,
} from "../src/lib/profileInlineEdit";
import { profileAboutSections } from "../src/lib/profileAbout";
import {
  publicPreviewProfileFields,
  readPublicPreviewProfile,
} from "../src/lib/publicPreviewData";
import type { Profile } from "../src/lib/models";

const player: Profile = {
  id: "player",
  full_name: "Alex Martin",
  username: "alex",
  avatar_url: null,
  primary_role: "Joueur amateur",
  jersey_number: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: player.id } } });
});

it("parses valid numbers and clearing without truncating invalid values", () => {
  expect(parseJerseyNumber(" 10 ")).toBe(10);
  expect(parseJerseyNumber("01")).toBe(1);
  expect(parseJerseyNumber("99")).toBe(99);
  expect(parseJerseyNumber(" ")).toBeNull();
  for (const input of [
    "0",
    "00",
    "100",
    "001",
    "-1",
    "1.5",
    "1,5",
    "1e1",
    "#10",
    "abc",
  ])
    expect(() => parseJerseyNumber(input)).toThrow("1 et 99");
  for (const invalid of [null, undefined, 0, 100, 1.5, "10", NaN])
    expect(visibleJerseyNumber(invalid)).toBeNull();
});

it("only exposes jersey editing and display for player profiles", () => {
  expect(editableProfileField(player, "Numéro de maillot")?.keys).toEqual([
    "jersey_number",
  ]);
  for (const profile of [
    { ...player, primary_role: "Entraîneur" },
    { ...player, account_type: "club" },
  ]) {
    expect(editableProfileField(profile, "Numéro de maillot")).toBeNull();
    expect(
      profileAboutSections({ ...profile, jersey_number: 10 }, false)
        .flatMap((s) => s.fields)
        .find((f) => f.label === "Numéro de maillot"),
    ).toBeUndefined();
  }
  const field = (p: Profile, own: boolean) =>
    profileAboutSections(p, own)
      .flatMap((s) => s.fields)
      .find((f) => f.label === "Numéro de maillot");
  expect(field(player, false)).toBeUndefined();
  expect(field(player, true)?.value).toBeNull();
  expect(field({ ...player, jersey_number: 10 }, false)?.value).toBe("10");
  expect(field({ ...player, jersey_number: 100 }, false)).toBeUndefined();
});

it("saves numeric values and null through the owner snapshot RPC", async () => {
  const field = editableProfileField(player, "Numéro de maillot")!;
  expect(
    inlineProfilePayload(player, field, {
      jersey_number: "10",
      is_admin: "true",
    }),
  ).toEqual({ jersey_number: 10 });
  client.rpc
    .mockResolvedValueOnce({
      data: { ...player, jersey_number: 10 },
      error: null,
    })
    .mockResolvedValueOnce({ data: player, error: null });
  const saved = await saveInlineProfile(player, field, { jersey_number: "10" });
  expect(client.rpc).toHaveBeenLastCalledWith(
    "update_native_profile_snapshot",
    { p_values: { jersey_number: 10 }, p_expected: { jersey_number: null } },
  );
  await saveInlineProfile(saved, field, { jersey_number: "" });
  expect(client.rpc).toHaveBeenLastCalledWith(
    "update_native_profile_snapshot",
    { p_values: { jersey_number: null }, p_expected: { jersey_number: 10 } },
  );
  expect(client.from).not.toHaveBeenCalled();
});

it("retains conflict and session protections", async () => {
  const field = editableProfileField(player, "Numéro de maillot")!;
  client.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  await expect(
    saveInlineProfile(player, field, { jersey_number: "9" }),
  ).rejects.toThrow("entre-temps");
  client.rpc.mockClear();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "other" } } });
  await expect(
    saveInlineProfile(player, field, { jersey_number: "9" }),
  ).rejects.toThrow("session");
  expect(client.rpc).not.toHaveBeenCalled();
});

it("fetches the shirt number in public previews while preserving privacy filters", async () => {
  expect(publicPreviewProfileFields.split(",")).toContain("jersey_number");
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const key of ["select", "eq", "or"]) query[key].mockReturnValue(query);
  const backend: any = { from: () => query };
  query.maybeSingle.mockResolvedValue({
    data: { ...player, jersey_number: 10 },
    error: null,
  });
  expect(
    (await readPublicPreviewProfile(backend, player.id))?.jersey_number,
  ).toBe(10);
  expect(query.or).toHaveBeenCalledWith(
    "is_private.is.null,is_private.eq.false",
  );
  query.maybeSingle.mockResolvedValue({
    data: { ...player, jersey_number: 10, is_private: true },
    error: null,
  });
  expect(await readPublicPreviewProfile(backend, player.id)).toBeNull();
});
