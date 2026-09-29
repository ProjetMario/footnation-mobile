import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ own: null as any, error: null as any }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: (options: any) => options }));
vi.mock("../src/lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "me" } } }) }));
vi.mock("../src/lib/matchingSchema", () => ({ supportsClubMatching: async () => false }));
vi.mock("../src/lib/supabase", () => ({ supabase: { from(table: string) {
  const builder: any = {
    select: () => builder, eq: () => builder, neq: () => builder, order: () => builder, in: () => builder, or: () => builder,
    maybeSingle: async () => ({ data: state.own, error: state.error }),
    range: () => builder,
    then(resolve: any) { return Promise.resolve({ data: table === "profiles" ? [{ id: "other", full_name: "Joueur", city: "Paris" }] : [], error: null }).then(resolve); },
  }; return builder;
} } }));
import { useMatchingEntities } from "../src/hooks/useMatchingEntities";
describe("matching profile loading", () => {
  beforeEach(() => { state.own = null; state.error = null; });
  it("shows suggestions without fabricated compatibility for an absent profile", async () => {
    const query: any = useMatchingEntities({ entityType: "profile" });
    const result = await query.queryFn({ pageParam: 0 });
    expect(result.hasProfile).toBe(false);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].compatibility_score).toBe(0);
  });
  it("keeps service failures visible", async () => {
    state.error = { message: "Service indisponible" };
    const query: any = useMatchingEntities({ entityType: "profile" });
    await expect(query.queryFn({ pageParam: 0 })).rejects.toThrow("Service indisponible");
  });
  it("recognizes a stored profile", async () => {
    state.own = { id: "me", full_name: "Moi", city: "Paris" };
    const query: any = useMatchingEntities({ entityType: "profile" });
    expect((await query.queryFn({ pageParam: 0 })).hasProfile).toBe(true);
  });
});
