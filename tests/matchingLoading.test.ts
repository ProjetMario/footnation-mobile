import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  own: null as any,
  error: null as any,
  profileStatus: "missing",
  ownReads: 0,
  candidates: [] as any[],
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useInfiniteQuery: (options: any) => options,
}));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: { user: { id: "me" } },
    profileStatus: state.profileStatus,
  }),
}));
vi.mock("../src/lib/matchingSchema", () => ({
  supportsClubMatching: async () => false,
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      let columns = "*";
      const builder: any = {
        select: (value: string) => {
          columns = value;
          return builder;
        },
        eq: () => builder,
        neq: () => builder,
        order: () => builder,
        in: () => builder,
        or: () => builder,
        maybeSingle: async () => {
          state.ownReads++;
          return { data: state.own, error: state.error };
        },
        range: () => builder,
        then(resolve: any) {
          const rows = table === "profiles" ? state.candidates : [];
          const data = rows.map((row) =>
            columns === "*"
              ? row
              : Object.fromEntries(
                  columns.split(",").map((key) => [key, row[key]]),
                ),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  },
}));
import { useMatchingEntities } from "../src/hooks/useMatchingEntities";
describe("matching profile loading", () => {
  beforeEach(() => {
    state.own = null;
    state.error = null;
    state.profileStatus = "missing";
    state.ownReads = 0;
    state.candidates = [{ id: "other", full_name: "Joueur", city: "Paris" }];
  });
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
    await expect(query.queryFn({ pageParam: 0 })).rejects.toThrow(
      "Service indisponible",
    );
  });
  it("recognizes a stored profile", async () => {
    state.own = { id: "me", full_name: "Moi", city: "Paris" };
    const query: any = useMatchingEntities({ entityType: "profile" });
    expect((await query.queryFn({ pageParam: 0 })).hasProfile).toBe(true);
  });

  it("reads the saved profile immediately instead of reusing the missing-profile cache", async () => {
    const client = new QueryClient();
    try {
      const before: any = useMatchingEntities({ entityType: "profile" });
      const initial: any = await client.fetchInfiniteQuery(before);
      expect(initial.pages[0].hasProfile).toBe(false);

      state.own = { id: "me", full_name: "Moi", city: "Paris" };
      state.profileStatus = "ready";
      const after: any = useMatchingEntities({ entityType: "profile" });
      const refreshed: any = await client.fetchInfiniteQuery(after);
      expect(after.queryKey).not.toEqual(before.queryKey);
      expect(refreshed.pages[0].hasProfile).toBe(true);
      expect(state.ownReads).toBe(2);
    } finally {
      client.clear();
    }
  });

  it("rechecks server eligibility when a previously ready profile becomes missing", async () => {
    const client = new QueryClient();
    try {
      state.own = { id: "me", full_name: "Moi" };
      state.profileStatus = "ready";
      const ready: any = useMatchingEntities({ entityType: "profile" });
      await client.fetchInfiniteQuery(ready);

      state.own = null;
      state.profileStatus = "missing";
      const missing: any = useMatchingEntities({ entityType: "profile" });
      const refreshed: any = await client.fetchInfiniteQuery(missing);
      expect(refreshed.pages[0].hasProfile).toBe(false);
      expect(state.ownReads).toBe(2);
    } finally {
      client.clear();
    }
  });

  it.each([
    [{ full_name: "  Mario Zelenika  ", username: "mario" }, "Mario Zelenika"],
    [
      { first_name: "Mario", last_name: "Zelenika", username: "mario" },
      "Mario Zelenika",
    ],
    [{ username: "mario" }, "mario"],
    [{}, "Membre FootNation"],
  ])(
    "uses the available profile identity rather than Anonyme: %j",
    async (identity, name) => {
      state.candidates = [{ id: "other", ...identity }];
      const query: any = useMatchingEntities({ entityType: "profile" });
      const result = await query.queryFn({ pageParam: 0 });
      expect(result.entities[0].name).toBe(name);
    },
  );
});
