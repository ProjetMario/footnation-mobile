import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAccountError,
  createAdminAccountHandler,
  parseAccountInput,
  type AdminAccountServices,
} from "../../supabase/functions/admin-console-account/handler";
const admin = "aaaaaaaa-0000-4000-8000-000000000001",
  target = "bbbbbbbb-0000-4000-8000-000000000001";
const input = {
  action: "update_email",
  userId: target,
  email: "new@fixture.test",
  operationId: "cccccccc-0000-4000-8000-000000000001",
  expected: "a".repeat(32),
  reason: "Test modification",
};
let services: AdminAccountServices;
beforeEach(() => {
  services = {
    authorize: vi.fn(async () => ({ id: admin })),
    recentlyAuthenticated: vi.fn(() => true),
    claim: vi.fn(async () => "new"),
    complete: vi.fn(async () => {}),
    run: vi.fn(async () => ({})),
  };
});
function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request("https://local.test/admin-console-account", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
describe("admin account boundary", () => {
  it("denies missing credentials before account lookup", async () => {
    const r = await createAdminAccountHandler(services)(
      request(input, { Authorization: "" }),
    );
    expect(r.status).toBe(401);
    expect(services.run).not.toHaveBeenCalled();
  });
  it("denies ordinary, suspended and revoked accounts", async () => {
    vi.mocked(services.authorize).mockResolvedValue(null);
    expect((await createAdminAccountHandler(services)(request())).status).toBe(
      403,
    );
    expect(services.claim).not.toHaveBeenCalled();
  });
  it("rechecks authorization before side effects", async () => {
    vi.mocked(services.authorize)
      .mockResolvedValueOnce({ id: admin })
      .mockResolvedValueOnce(null);
    expect((await createAdminAccountHandler(services)(request())).status).toBe(
      403,
    );
    expect(services.run).not.toHaveBeenCalled();
  });
  it("requires recent authentication for credential edits", async () => {
    vi.mocked(services.recentlyAuthenticated).mockReturnValue(false);
    expect((await createAdminAccountHandler(services)(request())).status).toBe(
      403,
    );
    expect(services.claim).not.toHaveBeenCalled();
  });
  it("returns only a confirmed account receipt", async () => {
    const r = await createAdminAccountHandler(services)(request());
    expect(await r.json()).toEqual({ ok: true, userId: target });
    expect(services.complete).toHaveBeenCalledWith(admin, input);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("does not replay completed side effects", async () => {
    vi.mocked(services.claim).mockResolvedValue("done");
    expect((await createAdminAccountHandler(services)(request())).status).toBe(
      200,
    );
    expect(services.run).not.toHaveBeenCalled();
  });
  it("does not claim success after an uncertain write", async () => {
    vi.mocked(services.run).mockRejectedValue(
      new Error("private credential value"),
    );
    const r = await createAdminAccountHandler(services)(request());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private credential");
    expect(services.complete).not.toHaveBeenCalled();
  });
  it("does not delete the calling administrator", async () => {
    const r = await createAdminAccountHandler(services)(
      request({
        ...input,
        action: "delete_account",
        email: undefined,
        userId: admin,
      }),
    );
    expect(r.status).toBe(403);
    expect(services.run).not.toHaveBeenCalled();
  });
  it("validates self-contained read requests", async () => {
    expect(
      (
        await createAdminAccountHandler(services)(
          request({ action: "security", userId: target }),
        )
      ).status,
    ).toBe(200);
    expect(services.claim).not.toHaveBeenCalled();
  });
  it("forbids spoofed actor IDs and unbounded input", async () => {
    expect(
      (
        await createAdminAccountHandler(services)(
          request({ ...input, actorId: admin }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await createAdminAccountHandler(services)(
          request({ ...input, reason: "x".repeat(5000) }),
        )
      ).status,
    ).toBe(413);
    expect(services.run).not.toHaveBeenCalled();
  });
  it("never forwards arbitrary storage paths", () =>
    expect(() =>
      parseAccountInput({
        action: "avatar_upload",
        userId: target,
        mimeType: "image/png",
        path: "other-user/avatar.png",
      }),
    ).toThrow());
  it.each(["GET", "DELETE", "PUT"])("rejects %s", async (method) =>
    expect(
      (
        await createAdminAccountHandler(services)(
          new Request("https://local.test", { method }),
        )
      ).status,
    ).toBe(405),
  );
  it("allows preflight without identity", async () =>
    expect(
      (
        await createAdminAccountHandler(services)(
          new Request("https://local.test", { method: "OPTIONS" }),
        )
      ).status,
    ).toBe(204));
  it.each(["short", "a".repeat(129)])(
    "rejects invalid password lengths",
    (password) =>
      expect(() =>
        parseAccountInput({
          userId: target,
          operationId: input.operationId,
          expected: input.expected,
          reason: input.reason,
          action: "update_password",
          password,
        }),
      ).toThrow("entre 12 et 128"),
  );
  it("preserves a safe conflict message", async () => {
    vi.mocked(services.claim).mockRejectedValue(
      new AdminAccountError(409, "La fiche a changé."),
    );
    const r = await createAdminAccountHandler(services)(request());
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "La fiche a changé." });
  });
});
