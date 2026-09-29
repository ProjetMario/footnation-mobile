import { expect, it, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
import { memberContext, type TeamMembership } from "../src/lib/clubMembership";
function row(id: string, status: string, primary = false): TeamMembership {
  return {
    id,
    team_id: id,
    status,
    updated_at: null,
    is_primary: primary,
    team: { id, name: id, category: null },
  };
}
it("refuse une appartenance seulement en attente ou rejetée", () => {
  expect(
    memberContext(false, [row("a", "pending", true), row("b", "rejected")])
      .allowed,
  ).toBe(false);
});
it("choisit une équipe approuvée et privilégie la principale", () => {
  const context = memberContext(false, [
    row("pending", "pending", true),
    row("secondary", "approved"),
    row("primary", "approved", true),
  ]);
  expect(context.allowed).toBe(true);
  expect(context.primaryTeam?.id).toBe("primary");
});
it("un profil rattaché sans équipe reste membre sans inventer une équipe", () => {
  expect(memberContext(true, [])).toEqual({
    allowed: true,
    primaryTeam: null,
    memberships: [],
  });
  expect(memberContext(false, []).allowed).toBe(false);
});
