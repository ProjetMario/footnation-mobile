import { beforeEach, expect, it, vi } from "vitest";
const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: backend }));
import { loadGeographyProfiles } from "../src/lib/geographyProfiles";
const uid = "11111111-1111-4111-8111-111111111111";
function query(data: unknown, error: unknown = null) {
  const chain: Record<string, any> = {};
  for (const name of ["select", "eq", "or", "order", "limit", "abortSignal"])
    chain[name] = vi.fn(() => chain);
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data, error }).then(resolve, reject);
  return chain;
}
beforeEach(() => backend.from.mockReset());
it("reads published profiles using the exact site nationality, never a made-up residence or FFF filter", async () => {
  const profiles = query([{ id: "public", is_suspended: false }]);
  backend.from.mockReturnValue(profiles);
  const signal = new AbortController().signal;
  expect(await loadGeographyProfiles("espagne", undefined, signal)).toEqual([
    { id: "public", is_suspended: false },
  ]);
  expect(backend.from).toHaveBeenCalledWith("profiles");
  expect(profiles.eq.mock.calls).toEqual([
    ["nationality", "Espagnole"],
    ["is_published", true],
  ]);
  expect(profiles.limit).toHaveBeenCalledWith(24);
  expect(profiles.abortSignal).toHaveBeenCalledWith(signal);
});
it("performs no speculative query for a country without an existing dossier", async () => {
  expect(await loadGeographyProfiles("japon")).toEqual([]);
  expect(backend.from).not.toHaveBeenCalled();
});
it("removes both directions of blocking and suspended profiles but keeps expired suspensions", async () => {
  backend.from
    .mockReturnValueOnce(
      query([
        { blocker_id: uid, blocked_id: "blocked" },
        { blocker_id: "reverse", blocked_id: uid },
      ]),
    )
    .mockReturnValueOnce(
      query([
        { id: "blocked" },
        { id: "reverse" },
        { id: "suspended", is_suspended: true, suspended_until: null },
        {
          id: "expired",
          is_suspended: true,
          suspended_until: "2000-01-01T00:00:00Z",
        },
        { id: "public", is_suspended: false },
      ]),
    );
  expect(
    (await loadGeographyProfiles("france", uid)).map((profile) => profile.id),
  ).toEqual(["expired", "public"]);
});
it("keeps service failure distinct from an empty country selection", async () => {
  backend.from.mockReturnValue(query(null, { message: "Lookup failed" }));
  await expect(loadGeographyProfiles("bresil")).rejects.toMatchObject({
    message: "Lookup failed",
  });
});
it("does not expose profiles when checking the current account's blocks fails", async () => {
  backend.from.mockReturnValue(query(null, { message: "Block check failed" }));
  await expect(loadGeographyProfiles("france", uid)).rejects.toMatchObject({
    message: "Block check failed",
  });
  expect(backend.from).toHaveBeenCalledTimes(1);
});
