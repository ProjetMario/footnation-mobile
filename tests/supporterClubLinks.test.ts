import { describe, expect, it } from "vitest";
import {
  resolveSupporterClubAffinities,
  supporterClubSeed,
  supporterDiscoveryPath,
  supporterReturnPath,
} from "../src/lib/supporterClubLinks";
import { authGateReturnPath, authReturnPath } from "../src/lib/authReturn";
import { memberAccessRoutePath } from "../src/lib/memberAccess";

const paris = {
  id: "11000000-0000-4000-8000-000000000001",
  name: "Paris Saint-Germain",
  short_name: "PSG",
  city: "Paris",
};
const amateur = {
  id: "11000000-0000-4000-8000-000000000002",
  name: "Club amateur",
  city: "Nice",
};
const profile = {
  id: "12000000-0000-4000-8000-000000000001",
  favorite_pro_club: "PSG",
  favorite_amateur_club: "Club amateur",
  linked_club_id: amateur.id,
  club: "Ancien nom",
  city: "Marseille",
};
describe("club affinities remain independent from community membership", () => {
  it("keeps the three origins when the same club is a favorite, followed and current", () => {
    const result = resolveSupporterClubAffinities(
      profile,
      [amateur, paris],
      [amateur, paris],
    );
    expect(result.clubs).toEqual([
      { ...paris, reasons: ["heart", "followed"] },
      { ...amateur, reasons: ["heart", "current", "followed"] },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/membership|admin|organizer/);
  });
  it("does not confuse same-name clubs or silently infer an id for a manually saved favorite", () => {
    const duplicate = {
      ...amateur,
      id: "11000000-0000-4000-8000-000000000003",
      city: "Lyon",
    };
    const result = resolveSupporterClubAffinities(
      {
        ...profile,
        linked_club_id: null,
        club: "Club amateur",
        favorite_pro_club: "Unknown",
      },
      [],
      [amateur, duplicate],
    );
    expect(result.clubs).toEqual([]);
    expect(result.unresolved).toContainEqual({
      name: "Club amateur",
      reason: "heart",
    });
    expect(result.unresolved).toContainEqual({
      name: "Club amateur",
      reason: "current",
    });
    expect(result.unresolved).toContainEqual({
      name: "Unknown",
      reason: "heart",
    });
  });
  it("uses stable current-club identity despite a stale profile name", () => {
    expect(
      resolveSupporterClubAffinities(
        {
          ...profile,
          favorite_pro_club: null,
          favorite_amateur_club: null,
          club: "Paris Saint-Germain",
        },
        [],
        [amateur, paris],
      ).clubs,
    ).toEqual([{ ...amateur, reasons: ["current"] }]);
  });
});
describe("supporter club links", () => {
  it("encodes search names and user city without auto-selecting a club", () => {
    const path = supporterDiscoveryPath({
      club: "L’US & amis",
      city: "Marseille",
    });
    const params = new URL(path, "https://example.test").searchParams;
    expect(params.get("club")).toBe("L’US & amis");
    expect(params.get("city")).toBe("Marseille");
    expect(params.has("clubId")).toBe(false);
    expect(
      supporterClubSeed({ clubId: "bad", club: ["PSG"], city: "a\nb" }),
    ).toEqual({ clubId: undefined, club: "", city: "" });
    expect(supporterDiscoveryPath({ club: "a".repeat(180) })).toContain(
      "a".repeat(180),
    );
  });
  it("preserves the selected club through login and onboarding, without /app in native routes", () => {
    const seed = { clubId: paris.id, city: "Marseille" };
    const path = supporterDiscoveryPath(seed, true);
    expect(authGateReturnPath("/supporters/new", seed)).toBe(path);
    expect(authReturnPath(`/app${path}`)).toBe(path);
    expect(
      memberAccessRoutePath({ name: "supporters/new", params: seed }),
    ).toBe(path);
    expect(supporterDiscoveryPath({ ...seed, club: "Spoof" })).not.toContain(
      "Spoof",
    );
  });
  it("rejects ambiguous or mutation-bearing return links", () => {
    for (const query of [
      "join=1",
      "clubId=bad",
      "club=PSG&club=OM",
      "city=%0A",
      "club=PSG#fragment",
      "redirect=https://evil.test",
    ]) {
      expect(supporterReturnPath(`/supporters?${query}`)).toBeNull();
      expect(authReturnPath(`/supporters/new?${query}`)).toBeNull();
    }
  });
});
