import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAssignmentPlan,
  buildTeamImportPlan,
  importTeamState,
  validImportSeason,
  type FffTeamSource,
} from "../src/lib/import-clubs/plan";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  header: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession }, rpc: mocks.rpc },
}));
import { clubImportRpc } from "../src/lib/import-clubs/client";
const club = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333",
  targetId = "44444444-4444-4444-8444-444444444444";
const source: FffTeamSource = {
  id: sourceId,
  club_id: club,
  name: "Équipe 1",
  category: "Seniors",
  age_range: null,
  division: "Régional 2",
  level: null,
  updated_at: "2026-09-10T00:00:00Z",
};
describe("preview of actual club teams", () => {
  it("requires an explicit consecutive season without deriving one", () => {
    expect(validImportSeason("2026-2027")).toBe(true);
    for (const value of ["", "2026", "2026/2027", "2026-2028", "2026-2027 "])
      expect(validImportSeason(value)).toBe(false);
  });
  it("keeps the exact source and a stable target ID without fabricating other teams", () => {
    const candidate = { ...source };
    const plan = buildTeamImportPlan(
      club,
      "2026-2027",
      [candidate],
      [],
      () => targetId,
    );
    candidate.name = "Changed later";
    expect(plan).toEqual([{ source, target_id: targetId }]);
  });
  it("rejects another club even if its name is exactly the same", () => {
    expect(() =>
      buildTeamImportPlan(
        club,
        "2026-2027",
        [{ ...source, club_id: other }],
        [],
        () => targetId,
      ),
    ).toThrow("ce club");
  });
  it("marks a missing category as incomplete instead of inventing Seniors or a division", () => {
    expect(
      importTeamState({ ...source, category: null }, [], "2026-2027"),
    ).toBe("incomplete");
    expect(() =>
      buildTeamImportPlan(
        club,
        "2026-2027",
        [{ ...source, category: null }],
        [],
        () => targetId,
      ),
    ).toThrow();
  });
  it("refuses existing equivalent teams rather than silently attaching or overwriting them", () => {
    const teams = [
      {
        id: targetId,
        name: " équipe 1 ",
        category: "seniors",
        age_group: null,
        season: "2026-2027",
      },
    ];
    expect(importTeamState(source, teams, "2026-2027")).toBe("conflict");
    expect(() =>
      buildTeamImportPlan(club, "2026-2027", [source], teams, () => targetId),
    ).toThrow();
    expect(teams[0]).not.toHaveProperty("native_fff_team_id");
    expect(importTeamState(source, teams, "2027-2028")).toBe("ready");
  });
  it("recognizes explicit provenance, including a team since renamed by its admin", () => {
    expect(
      importTeamState(
        source,
        [
          {
            id: targetId,
            name: "Custom name",
            category: "Seniors",
            age_group: null,
            season: "2026-2027",
            native_fff_team_id: sourceId,
          },
        ],
        "2026-2027",
      ),
    ).toBe("imported");
  });
  it("rejects duplicate IDs and ambiguous source rows with equivalent details", () => {
    expect(() =>
      buildTeamImportPlan(
        club,
        "2026-2027",
        [source, source],
        [],
        () => targetId,
      ),
    ).toThrow("distinctes");
    expect(() =>
      buildTeamImportPlan(
        club,
        "2026-2027",
        [source, { ...source, id: other }],
        [],
        () => targetId,
      ),
    ).toThrow("identique");
  });
  it("bounds the batch instead of preparing an unbounded import", () => {
    expect(() =>
      buildTeamImportPlan(club, "2026-2027", [], [], () => targetId),
    ).toThrow();
    expect(() =>
      buildTeamImportPlan(
        club,
        "2026-2027",
        Array(51).fill(source),
        [],
        () => targetId,
      ),
    ).toThrow();
  });
});
describe("explicit member assignment snapshots", () => {
  it("keeps homonyms separate by UUID and preserves the expected primary team", () => {
    expect(
      buildAssignmentPlan([
        { id: club, full_name: "Alex Martin", assignments: [] },
        {
          id: other,
          full_name: "Alex Martin",
          assignments: [
            { team_id: targetId, is_primary: true },
            { team_id: sourceId, is_primary: false },
          ],
        },
      ]),
    ).toEqual([
      { profile_id: club, expected_team_id: null },
      { profile_id: other, expected_team_id: targetId },
    ]);
  });
  it("rejects an ambiguous primary assignment instead of choosing the first row", () => {
    expect(() =>
      buildAssignmentPlan([
        {
          id: club,
          full_name: "Alex",
          assignments: [
            { team_id: sourceId, is_primary: true },
            { team_id: targetId, is_primary: true },
          ],
        },
      ]),
    ).toThrow("plusieurs");
  });
  it("requires selected distinct members, with no automatic matching by role/name", () => {
    expect(() => buildAssignmentPlan([])).toThrow();
    const member = { id: club, full_name: "Seniors Coach", assignments: [] };
    expect(() => buildAssignmentPlan([member, member])).toThrow();
    expect(buildAssignmentPlan([member])).toEqual([
      { profile_id: club, expected_team_id: null },
    ]);
  });
});
describe("club import account binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: club }, access_token: "token-A" } },
      error: null,
    });
    mocks.header.mockResolvedValue({ data: true, error: null });
    mocks.rpc.mockReturnValue({ setHeader: mocks.header });
  });
  it("pins the token and actor while another account becomes current", async () => {
    mocks.rpc.mockImplementation(() => {
      mocks.getSession.mockResolvedValue({
        data: { session: { user: { id: other }, access_token: "token-B" } },
      });
      return { setHeader: mocks.header };
    });
    expect(
      await clubImportRpc(club, "native_club_import_available", {
        p_club_id: other,
      }),
    ).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("native_club_import_available", {
      p_club_id: other,
      p_actor_id: club,
    });
    expect(mocks.header).toHaveBeenCalledWith(
      "Authorization",
      "Bearer token-A",
    );
  });
  it("never starts the RPC after the displayed account changed", async () => {
    await expect(
      clubImportRpc(other, "import_native_club_teams", {}),
    ).rejects.toThrow("session a changé");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports a missing local migration without exposing raw backend errors", async () => {
    mocks.header.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "private-token" },
    });
    await expect(
      clubImportRpc(club, "import_native_club_teams", {}),
    ).rejects.toThrow("activation");
  });
  it.each(["40001", "23505", "40P01"])(
    "offers a safe refresh after transactional conflict %s",
    async (code) => {
      mocks.header.mockResolvedValue({
        data: null,
        error: { code, message: "private-database-detail" },
      });
      await expect(
        clubImportRpc(club, "assign_native_club_primary_teams", {}),
      ).rejects.toThrow("Actualisez l’aperçu avant de réessayer.");
    },
  );
});
