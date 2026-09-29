import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: vi.fn(),
  supabase: { auth: { getSession: mocks.getSession, getUser: mocks.getUser } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { experienceRepository } from "../src/lib/experienceRepository";
const uid = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: uid }, access_token: "synthetic-A" } },
    error: null,
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc, from: mocks.from });
  mocks.rpc.mockResolvedValue({
    data: { id: uid, experience_history: [], updated_at: null },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("experience repository identity", () => {
  it("verifies the captured JWT and cannot substitute B's later session on an in-flight request", async () => {
    const repo = await experienceRepository(uid, () => {});
    expect(mocks.getUser).toHaveBeenCalledWith("synthetic-A");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: other }, access_token: "synthetic-B" } },
      error: null,
    });
    const options = mocks.createClient.mock.calls[0][2];
    expect(await options.accessToken()).toBe("synthetic-A");
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    await expect(repo.assertIdentity()).rejects.toThrow("session a changé");
  });
  it("rejects a mismatched server-verified user before creating a client", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: other } },
      error: null,
    });
    await expect(experienceRepository(uid, () => {})).rejects.toThrow(
      "identité",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("stops when account changes while identity verification is pending", async () => {
    let active = true;
    mocks.getUser.mockImplementation(async () => {
      active = false;
      return { data: { user: { id: uid } }, error: null };
    });
    await expect(
      experienceRepository(uid, () => {
        if (!active) throw new Error("changed");
      }),
    ).rejects.toThrow("changed");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("sends a full atomic RPC without any caller-supplied profile identity", async () => {
    const repo = await experienceRepository(uid, () => {}),
      expected = [{ old: true }],
      history = [{ new: true }];
    await repo.sync(expected, history);
    expect(mocks.rpc).toHaveBeenCalledWith("save_native_experience_history", {
      p_expected: expected,
      p_history: history,
    });
  });
  it.each([
    null,
    [{ club: "Exact club", startYear: "2020", nested: { a: 1 } }],
  ])(
    "uses real PostgREST serialization to guard JSON history %j without updated_at",
    async (expected) => {
      const actual = await vi.importActual<
        typeof import("@supabase/supabase-js")
      >("@supabase/supabase-js");
      vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://synthetic.example.com");
      vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-key");
      const requests: { url: URL; method: string; body: unknown }[] = [];
      const history = [{ club: "Next club" }];
      mocks.createClient.mockImplementation((url, key, options) =>
        actual.createClient(url, key, {
          ...options,
          global: {
            fetch: async (input, init) => {
              requests.push({
                url: new URL(String(input)),
                method: init?.method || "GET",
                body: init?.body ? JSON.parse(String(init.body)) : null,
              });
              return new Response(
                JSON.stringify({ id: uid, experience_history: history }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              );
            },
          },
        }),
      );
      const repo = await experienceRepository(uid, () => {});
      expect(await repo.read()).toEqual({
        id: uid,
        experience_history: history,
        updated_at: null,
      });
      expect(await repo.update(history, expected)).toEqual({
        id: uid,
        experience_history: history,
        updated_at: null,
      });
      expect(requests[0].url.searchParams.get("select")).toBe(
        "id,experience_history",
      );
      const write = requests[1];
      expect(write.method).toBe("PATCH");
      expect(write.url.searchParams.get("id")).toBe(`eq.${uid}`);
      expect(write.url.searchParams.get("updated_at")).toBeNull();
      if (expected === null)
        expect(write.url.searchParams.get("or")).toBe(
          "(experience_history.is.null,experience_history.eq.null)",
        );
      else
        expect(write.url.searchParams.get("experience_history")).toBe(
          `eq.${JSON.stringify(expected)}`,
        );
      expect(write.body).toEqual({ experience_history: history });
    },
  );
});
