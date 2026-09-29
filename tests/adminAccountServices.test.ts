import { describe, expect, it, vi } from "vitest";
import { createAdminAccountServices } from "../../supabase/functions/admin-console-account/services";
import type { DeletionServices } from "../../supabase/functions/account-deletion/handler";
const actor = "aaaaaaaa-0000-4000-8000-000000000001";
const target = "bbbbbbbb-0000-4000-8000-000000000001";
function fixture() {
  const state = {
    profile: {
      is_admin: true,
      is_suspended: false,
      suspended_until: null as string | null,
    },
    override: null as unknown,
    target: { id: target, email: "recipient@fixture.test" },
    receipt: "new",
  };
  const tables: Record<string, any> = {
    profiles: state.profile,
    admin_profile_overrides: null,
    profile_reminders: [],
  };
  const inserted: any[] = [];
  const from = vi.fn((table: string) => {
    const q: any = {};
    for (const method of ["select", "eq", "order", "limit"])
      q[method] = () => q;
    q.insert = (value: unknown) => {
      inserted.push({ table, value });
      return q;
    };
    const response = () => ({
      data:
        table === "admin_profile_overrides" ? state.override : tables[table],
      error: null,
    });
    q.single = q.maybeSingle = async () => response();
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(response()).then(resolve);
    return q;
  });
  const client = {
    from,
    rpc: vi.fn(async (name: string) => ({
      data: name.endsWith("complete") ? true : state.receipt,
      error: null,
    })),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: actor, factors: [] } },
        error: null,
      })),
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: state.target },
          error: null,
        })),
        updateUserById: vi.fn(async (id: string) => ({
          data: { user: { id } },
          error: null,
        })),
      },
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn(async () => ({
          data: { token: "synthetic-upload-token" },
          error: null,
        })),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://fixture.test/${path}` },
        }),
      })),
    },
  };
  const deletion = {
    enabled: true,
    now: () => Date.now(),
    completed: vi.fn(async () => true),
    claim: vi.fn(async () => "lease"),
    assertLease: vi.fn(async () => {}),
    inspect: vi.fn(async () => ({ subscriptionIds: [], checkoutIds: [] })),
    revokeApple: vi.fn(async () => ({ manualRequired: false })),
    listObjects: vi.fn(async () => []),
    finalize: vi.fn(async () => {}),
    deleteAuthUser: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  } as unknown as DeletionServices;
  const request = vi.fn(
    async () => new Response('{"id":"test-mail"}', { status: 200 }),
  );
  const service = createAdminAccountServices(client, {
    deletion,
    resendKey: "fixture-only",
    resendFrom: "FootNation <mail@fixture.test>",
    siteUrl: "https://foot-nation.com",
    fetch: request,
  });
  return { state, tables, inserted, client, deletion, request, service };
}
describe("admin account server adapter", () => {
  it("verifies the exact bearer and active admin state", async () => {
    const f = fixture();
    expect(await f.service.authorize("exact-token")).toEqual({
      id: actor,
      requiresAal2: false,
    });
    expect(f.client.auth.getUser).toHaveBeenCalledWith("exact-token");
    f.state.profile.is_suspended = true;
    expect(await f.service.authorize("exact-token")).toBeNull();
    f.state.profile.suspended_until = "2000-01-01";
    expect(await f.service.authorize("exact-token")).toBeTruthy();
    f.state.profile.is_admin = false;
    expect(await f.service.authorize("exact-token")).toBeNull();
  });
  it("reads only the requested Auth email and updates only the requested Auth user", async () => {
    const f = fixture();
    expect(
      await f.service.run(actor, { action: "security", userId: target }),
    ).toEqual({ email: "recipient@fixture.test" });
    await f.service.run(actor, {
      action: "update_email",
      userId: target,
      email: "replacement@fixture.test",
    });
    expect(f.client.auth.admin.updateUserById).toHaveBeenCalledWith(target, {
      email: "replacement@fixture.test",
    });
    expect(f.request).not.toHaveBeenCalled();
  });
  it("pins reset e-mails to the Auth address and fixed callback", async () => {
    const f = fixture();
    await f.service.run(actor, { action: "reset_password", userId: target });
    expect(f.client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "recipient@fixture.test",
      { redirectTo: "https://foot-nation.com/reset-password" },
    );
  });
  it("maps generated avatar paths to the target for account deletion", async () => {
    const f = fixture();
    const result = await f.service.run(actor, {
      action: "avatar_upload",
      userId: target,
      mimeType: "image/png",
    });
    expect(result.path).toMatch(
      new RegExp(`^admin-avatars/${target}/[0-9a-f-]+\\.png$`),
    );
    expect(f.inserted[0]).toEqual({
      table: "admin_console_media",
      value: { target_id: target, bucket: "avatars", path: result.path },
    });
    expect(f.client.storage.from).toHaveBeenCalledWith("avatars");
  });
  it("skips reminder mail for an explicit override or genuinely complete profile", async () => {
    const f = fixture();
    f.state.override = { profile_id: target };
    expect(
      await f.service.run(actor, { action: "reminder", userId: target }),
    ).toMatchObject({ detail: expect.stringContaining("aucune relance") });
    f.state.override = null;
    f.tables.profiles = {
      full_name: "Test",
      club: "Test",
      primary_role: "Joueur",
      highest_level: "R1",
      favorite_pro_club: "Test",
      avatar_url: "https://fixture.test/avatar.png",
      gender: "Homme",
    };
    expect(
      await f.service.run(actor, { action: "reminder", userId: target }),
    ).toMatchObject({ detail: expect.stringContaining("aucune relance") });
    expect(f.request).not.toHaveBeenCalled();
  });
  it("records a confirmed reminder and uses a provider idempotency key", async () => {
    const f = fixture();
    await f.service.run(actor, {
      action: "reminder",
      userId: target,
      operationId: "test-operation",
    });
    const [, options] = f.request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(options.headers).toMatchObject({
      "Idempotency-Key": "admin-reminder-test-operation",
    });
    expect(JSON.parse(String(options.body)).to).toEqual([
      "recipient@fixture.test",
    ]);
    expect(f.inserted.at(-1).table).toBe("profile_reminders");
  });
  it("uses the complete account-deletion workflow including Apple revocation", async () => {
    const f = fixture();
    await f.service.run(actor, {
      action: "delete_account",
      userId: target,
      operationId: "test-operation",
    });
    expect(f.deletion.claim).toHaveBeenCalledWith(target, "test-operation");
    expect(f.deletion.revokeApple).toHaveBeenCalledWith(target, "lease");
    expect(f.deletion.finalize).toHaveBeenCalledWith(target, "lease");
    expect(f.deletion.deleteAuthUser).toHaveBeenCalledWith(target);
    expect(f.deletion.completed).toHaveBeenCalledWith("test-operation");
  });
  it("does not replay an uncertain external account mutation", async () => {
    const f = fixture();
    f.state.receipt = "pending";
    await expect(
      f.service.claim(actor, { action: "update_email", userId: target }),
    ).rejects.toThrow("déjà été engagée");
    expect(f.client.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
