import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
import { createAdminApi } from "../src/lib/admin/api";
import {
  adminError,
  adminSections,
  completion,
  isSuspended,
  parsePage,
  safeExternalUrl,
  sectionFrom,
  userSections,
  validateCommand,
} from "../src/lib/admin/contracts";
import {
  clubFields,
  fieldPatch,
  profileFieldGroups,
  ratingFields,
} from "../src/lib/admin/fields";
const row = { id: "test", _version: "revision", full_name: "Initial" };
describe("admin navigation and data contracts", () => {
  it("keeps all Web sections in the same order", () =>
    expect(adminSections.map((s) => s[0])).toEqual([
      "overview",
      "performance",
      "users",
      "incomplete-profiles",
      "clubs",
      "sports-sync",
      "claims",
      "premium",
      "publications",
      "moderation",
      "posthog",
    ]));
  it("provides eight user sections", () =>
    expect(userSections.map((s) => s[0])).toEqual([
      "profile",
      "content",
      "social",
      "favorites",
      "opportunities",
      "activity",
      "completion",
      "admin",
    ]));
  it("normalizes invalid URLs to overview", () => {
    expect(sectionFrom(["users"])).toBe("overview");
    expect(sectionFrom("users")).toBe("users");
  });
  it("does not turn a completion override into invented fields", () =>
    expect(
      completion({ full_name: "Test", _completion_override: { at: "today" } }),
    ).toEqual({
      percent: 14,
      missing: [
        "club",
        "primary_role",
        "highest_level",
        "favorite_pro_club",
        "avatar_url",
        "gender",
      ],
    }));
  it("does not count whitespace as completed", () =>
    expect(completion({ full_name: "  " }).percent).toBe(0));
  it("recognizes expired suspensions", () => {
    expect(
      isSuspended({ is_suspended: true, suspended_until: "2020-01-01" }),
    ).toBe(false);
    expect(isSuspended({ is_suspended: true })).toBe(true);
  });
  it.each([
    null,
    {},
    { rows: [], total: null, nextOffset: null },
    { rows: [{ id: "a" }], total: 1, nextOffset: null },
    { rows: [], total: 1, nextOffset: 0 },
  ])("rejects malformed or misleading page results", (value) =>
    expect(() => parsePage(value)).toThrow(),
  );
  it("distinguishes an empty result from a failure", () =>
    expect(parsePage({ rows: [], total: 0, nextOffset: null })).toEqual({
      rows: [],
      total: 0,
      nextOffset: null,
    }));
  it("requires a reason and a version before mutations", () => {
    expect(() =>
      validateCommand({ action: "post.delete", record: row }),
    ).toThrow();
    expect(() =>
      validateCommand({
        action: "post.delete",
        record: { id: "x", _version: "" },
        reason: "Valid reason",
      }),
    ).toThrow();
  });
  it("does not allow unknown fields into an edit patch", () =>
    expect(
      fieldPatch(
        row,
        profileFieldGroups.flatMap((g) => g.fields),
        { full_name: "Modifié", is_admin: true },
      ),
    ).toEqual({ full_name: "Modifié" }));
  it("preserves untouched null booleans", () =>
    expect(
      fieldPatch(
        { ...row, is_private: null },
        profileFieldGroups.flatMap((g) => g.fields),
        {},
      ),
    ).toEqual({}));
  it("keeps the real text and array column types", () =>
    expect(
      fieldPatch(
        row,
        profileFieldGroups.flatMap((g) => g.fields),
        {
          technical_skills: "Passe\nTir",
          desired_benefits: "Transport\nLogement",
        },
      ),
    ).toEqual({
      technical_skills: "Passe\nTir",
      desired_benefits: ["Transport", "Logement"],
    }));
  it.each(["NaN", "-1", "100", "1.5"])("rejects invalid ratings %s", (pace) =>
    expect(() => fieldPatch(row, ratingFields, { pace })).toThrow(),
  );
  it("rejects nonexistent dates and invalid image URLs", () => {
    expect(() =>
      fieldPatch(row, clubFields, { founded_date: "2026-02-31" }),
    ).toThrow();
    expect(() =>
      fieldPatch(row, clubFields, { logo_url: "javascript:alert(1)" }),
    ).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "http://host.test",
    "https://secret@host.test",
    "not-url",
  ])("rejects unsafe dashboard URL %s", (url) =>
    expect(safeExternalUrl(url)).toBeNull(),
  );
  it("maps conflict and deployment errors without claiming success", () => {
    expect(adminError({ code: "40001" }).message).toContain("entre-temps");
    expect(adminError({ code: "PGRST202" }).message).toContain("activé");
    expect(adminError({ code: "42501" }).message).toContain("révoqué");
  });
});
function client() {
  let current = { user: { id: "admin" }, access_token: "token-for-admin" };
  let result: unknown = { rows: [], total: 0, nextOffset: null };
  let error: unknown = null;
  const setHeader = vi.fn(async () => ({ data: result, error }));
  const rpc = vi.fn(() => ({ setHeader }));
  return {
    fake: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: current },
          error: null,
        })),
      },
      rpc,
    },
    setHeader,
    rpc,
    setUser: (id: string) => {
      current = { user: { id }, access_token: `token-for-${id}` };
    },
    setResult: (data: unknown) => {
      result = data;
    },
    setError: (e: unknown) => {
      error = e;
    },
  };
}
describe("session-bound admin service", () => {
  it("pins the token to a request", async () => {
    const c = client();
    await createAdminApi("admin", c.fake as any).page("users", {
      search: "Alice",
    });
    expect(c.setHeader).toHaveBeenCalledWith(
      "Authorization",
      "Bearer token-for-admin",
    );
    expect(c.rpc).toHaveBeenCalledWith(
      "admin_console_page",
      expect.objectContaining({ p_limit: 30, p_filters: { search: "Alice" } }),
    );
  });
  it("never submits an old admin intent under a new account", async () => {
    const c = client();
    const api = createAdminApi("admin", c.fake as any);
    c.setUser("member");
    await expect(
      api.mutate({
        record: row,
        action: "profile.premium",
        values: { is_premium: true },
        reason: "Approval",
      }),
    ).rejects.toThrow("session");
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("discards data if the account changes during a read", async () => {
    const c = client();
    c.setHeader.mockImplementationOnce(async () => {
      c.setUser("member");
      return { data: { rows: [], total: 0, nextOffset: null }, error: null };
    });
    await expect(
      createAdminApi("admin", c.fake as any).page("users"),
    ).rejects.toThrow("session");
  });
  it("does not treat RLS denial as an empty list", async () => {
    const c = client();
    c.setError({ code: "42501" });
    await expect(
      createAdminApi("admin", c.fake as any).page("users"),
    ).rejects.toThrow("révoqué");
  });
  it("verifies the mutation receipt", async () => {
    const c = client();
    c.setResult({
      id: "receipt",
      target_id: "someone-else",
      action: "post.delete",
    });
    await expect(
      createAdminApi("admin", c.fake as any).mutate({
        record: row,
        action: "post.delete",
        reason: "Reason",
      }),
    ).rejects.toThrow("confirmée");
  });
  it("requires a positive server access decision", async () => {
    const c = client();
    c.setResult(false);
    await expect(
      createAdminApi("admin", c.fake as any).access(),
    ).rejects.toThrow("administrateurs actifs");
  });
});
