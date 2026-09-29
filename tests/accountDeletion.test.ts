import { describe, expect, it, vi } from "vitest";
import {
  createAccountDeletionHandler,
  DeletionError,
  recentlyAuthenticated,
  type DeletionServices,
} from "../../supabase/functions/account-deletion/handler";
import { createDeletionServices } from "../../supabase/functions/account-deletion/services";

const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const operation = "33333333-3333-4333-8333-333333333333";
const now = Date.UTC(2026, 8, 10, 10);
function token(overrides: Record<string, unknown> = {}) {
  return `header.${btoa(JSON.stringify({ sub: uid, role: "authenticated", aal: "aal1", exp: now / 1000 + 3600, amr: [{ method: "password", timestamp: now / 1000 - 30 }], ...overrides }))}.signature`;
}
function request(
  body: unknown = {
    action: "delete",
    operationId: operation,
    confirmation: "SUPPRIMER",
  },
  bearer = token(),
) {
  return new Request("https://local.test/account-deletion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function fixture() {
  let alive = true,
    locked = false,
    final = false,
    completed: string | null = null,
    currentOperation = "";
  const subscriptions = new Set(["sub_owned"]);
  const checkouts = new Set(["cs_owned"]);
  let objects = [
    {
      bucket: "message-attachments",
      name: `${uid}/${other}/message/photo.jpg`,
    },
  ];
  const services: DeletionServices = {
    enabled: true,
    now: () => now,
    getUser: vi.fn(async (value) =>
      alive && value === token() ? { id: uid } : null,
    ),
    completed: vi.fn(async (value) => value === completed),
    inspect: vi.fn(async () => ({
      subscriptionIds: [...subscriptions],
      checkoutIds: [...checkouts],
    })),
    claim: vi.fn(async (id, idempotency) => {
      expect(id).toBe(uid);
      if (locked) throw new DeletionError("in_progress");
      locked = true;
      currentOperation = idempotency;
      return "lease";
    }),
    assertLease: vi.fn(async () => {
      if (!locked) throw new DeletionError("lease_expired");
    }),
    cancelSubscription: vi.fn(async (id, sub) => {
      expect(id).toBe(uid);
      subscriptions.delete(sub);
    }),
    expireCheckout: vi.fn(async (id, checkout) => {
      expect(id).toBe(uid);
      checkouts.delete(checkout);
    }),
    listObjects: vi.fn(async (id) => {
      expect(id).toBe(uid);
      return objects;
    }),
    removeObjects: vi.fn(async (bucket, paths) => {
      expect(bucket).toBe("message-attachments");
      expect(paths).toEqual([`${uid}/${other}/message/photo.jpg`]);
      objects = [];
    }),
    finalize: vi.fn(async () => {
      final = true;
    }),
    deleteAuthUser: vi.fn(async (id) => {
      expect(id).toBe(uid);
      expect(final).toBe(true);
      expect(objects).toEqual([]);
      expect(subscriptions.size).toBe(0);
      expect(checkouts.size).toBe(0);
      alive = false;
      completed = currentOperation;
      locked = false;
    }),
    release: vi.fn(async () => {
      locked = false;
    }),
  };
  return { services, handle: createAccountDeletionHandler(services) };
}

describe("account deletion authorization", () => {
  it("fails closed when disabled and never contacts a service", async () => {
    const { services, handle } = fixture();
    services.enabled = false;
    expect((await handle(request())).status).toBe(503);
    expect(services.getUser).not.toHaveBeenCalled();
  });
  it("rejects an unvalidated token, including forged recent claims", async () => {
    const { services, handle } = fixture();
    expect(
      (await handle(request(undefined, token({ sub: other })))).status,
    ).toBe(401);
    expect(services.claim).not.toHaveBeenCalled();
  });
  it.each([
    {
      action: "delete",
      operationId: operation,
      confirmation: "SUPPRIMER",
      userId: other,
    },
    {
      action: "delete",
      operationId: operation,
      confirmation: "SUPPRIMER",
      paths: ["other/photo.jpg"],
    },
    {
      action: "delete",
      operationId: operation,
      confirmation: "SUPPRIMER",
      subscriptionId: "sub_other",
    },
    { action: "delete", operationId: operation, confirmation: "supprimer" },
    { action: "delete", operationId: "guessed", confirmation: "SUPPRIMER" },
  ])(
    "accepts no target account, media path, billing ID or weak confirmation: %j",
    async (body) => {
      const { services, handle } = fixture();
      expect((await handle(request(body))).status).toBe(400);
      expect(services.claim).not.toHaveBeenCalled();
    },
  );
  it("bounds the actual streamed body and rejects unsupported methods", async () => {
    const { services, handle } = fixture();
    expect(
      (await handle(request({ action: "delete", content: "x".repeat(2048) })))
        .status,
    ).toBe(400);
    expect(
      (await handle(new Request("https://local.test", { method: "GET" })))
        .status,
    ).toBe(405);
    expect(
      (await handle(new Request("https://local.test", { method: "OPTIONS" })))
        .status,
    ).toBe(204);
    expect(services.getUser).not.toHaveBeenCalled();
  });
  it("requires recent AMR, rather than a freshly refreshed JWT", () => {
    expect(recentlyAuthenticated(token(), uid, now)).toBe(true);
    expect(
      recentlyAuthenticated(
        token({
          iat: now / 1000,
          amr: [{ method: "password", timestamp: now / 1000 - 301 }],
        }),
        uid,
        now,
      ),
    ).toBe(false);
    expect(
      recentlyAuthenticated(
        token({ amr: [{ method: "token_refresh", timestamp: now / 1000 }] }),
        uid,
        now,
      ),
    ).toBe(false);
    expect(
      recentlyAuthenticated(
        token({ amr: [{ method: "password", timestamp: now / 1000 + 31 }] }),
        uid,
        now,
      ),
    ).toBe(false);
    expect(recentlyAuthenticated(token({ exp: now / 1000 }), uid, now)).toBe(
      false,
    );
    expect(recentlyAuthenticated(token({ sub: other }), uid, now)).toBe(false);
    expect(recentlyAuthenticated(token({ is_anonymous: true }), uid, now)).toBe(
      false,
    );
    expect(recentlyAuthenticated("bad-token", uid, now)).toBe(false);
  });
  it("does not let a password-only session bypass enrolled MFA", async () => {
    const { services, handle } = fixture();
    services.getUser = vi.fn(async () => ({ id: uid, requiresAal2: true }));
    expect((await handle(request())).status).toBe(403);
    expect(services.claim).not.toHaveBeenCalled();
    expect(recentlyAuthenticated(token({ aal: "aal2" }), uid, now, true)).toBe(
      true,
    );
  });
  it("inspection is read-only and returns counts rather than account/billing details", async () => {
    const { services, handle } = fixture();
    const result = await handle(request({ action: "inspect" }));
    expect(await result.json()).toEqual({
      ready: true,
      subscriptionCount: 1,
      checkoutCount: 1,
      recentlyAuthenticated: true,
    });
    expect(services.claim).not.toHaveBeenCalled();
    expect(services.deleteAuthUser).not.toHaveBeenCalled();
  });
  it("checks an opaque receipt without authenticating or mutating any account", async () => {
    const { services, handle } = fixture();
    const response = await handle(
      request({ action: "status", operationId: operation }, "receipt-check"),
    );
    expect(await response.json()).toEqual({ deleted: false });
    expect(services.completed).toHaveBeenCalledWith(operation);
    expect(services.getUser).not.toHaveBeenCalled();
    expect(services.claim).not.toHaveBeenCalled();
    expect(services.deleteAuthUser).not.toHaveBeenCalled();
    expect(
      (
        await handle(
          request(
            { action: "status", operationId: operation, userId: other },
            "receipt-check",
          ),
        )
      ).status,
    ).toBe(400);
  });
});

describe("account deletion execution", () => {
  it("expires checkouts, cancels only owned subscriptions, cleans storage then deletes Auth last", async () => {
    const { services, handle } = fixture();
    const response = await handle(request());
    expect(await response.json()).toEqual({ deleted: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(services.expireCheckout).toHaveBeenCalledWith(uid, "cs_owned");
    expect(services.cancelSubscription).toHaveBeenCalledWith(uid, "sub_owned");
    expect(services.deleteAuthUser).toHaveBeenCalledTimes(1);
  });
  it("acknowledges a completed receipt after Auth is gone without deleting twice", async () => {
    const { services, handle } = fixture();
    await handle(request());
    expect(await (await handle(request())).json()).toEqual({ deleted: true });
    expect(services.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(
      (
        await handle(
          request({
            action: "delete",
            operationId: "44444444-4444-4444-8444-444444444444",
            confirmation: "SUPPRIMER",
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("serializes a double click even when the first request is waiting on billing", async () => {
    const { services, handle } = fixture();
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const expire = services.expireCheckout;
    services.expireCheckout = vi.fn(async (...args) => {
      entered();
      await waiting;
      await expire(...args);
    });
    const first = handle(request());
    await reached;
    expect((await handle(request())).status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect(services.deleteAuthUser).toHaveBeenCalledTimes(1);
  });
  it.each([
    "inspect",
    "cancelSubscription",
    "removeObjects",
    "finalize",
  ] as const)(
    "keeps Auth on %s failure and never exposes raw errors",
    async (stage) => {
      const { services, handle } = fixture();
      services[stage] = vi.fn(async () => {
        throw new Error("private profile message token=secret@example.com");
      }) as never;
      const result = await handle(request());
      expect(result.status).toBe(503);
      expect(await result.text()).not.toContain("secret");
      expect(services.deleteAuthUser).not.toHaveBeenCalled();
      expect(services.release).toHaveBeenCalled();
    },
  );
  it("can retry the same intent after partially completed cleanup", async () => {
    const { services, handle } = fixture();
    const remove = services.removeObjects;
    services.removeObjects = vi
      .fn()
      .mockRejectedValueOnce(new DeletionError("media_cleanup_incomplete"))
      .mockImplementation(remove);
    expect((await handle(request())).status).toBe(409);
    expect((await handle(request())).status).toBe(200);
    expect(services.cancelSubscription).toHaveBeenCalledTimes(1);
  });
  it("does not invent a successful deletion when Auth fails or a receipt is missing", async () => {
    const { services, handle } = fixture();
    services.deleteAuthUser = vi.fn(async () => {
      throw new Error("auth failed");
    });
    expect((await handle(request())).status).toBe(503);
    expect(services.release).toHaveBeenCalled();
  });
});

describe("Stripe ownership adapter", () => {
  function checkoutFixture(subscription: string | null = "sub_completed") {
    const records: Record<string, unknown> = {
      subscriptions: null,
      profiles: { is_premium: false },
      native_account_deletion_checkouts: [{ checkout_id: "cs_completed" }],
    };
    const admin = {
      rpc: async () => ({ data: null, error: null }),
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: uid, email: "new@example.test" } },
            error: null,
          }),
        },
      },
      from: (table: string) => {
        const result = { data: records[table], error: null };
        return {
          select: () => ({
            eq: () => ({
              ...result,
              maybeSingle: async () => result,
              single: async () => result,
            }),
          }),
        };
      },
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/checkout/sessions/cs_completed")
        return Response.json({
          id: "cs_completed",
          status: "complete",
          mode: "subscription",
          customer: "cus_checkout",
          subscription,
          metadata: { supabase_user_id: uid },
        });
      if (url.pathname === "/v1/subscriptions/sub_completed")
        return Response.json({
          id: "sub_completed",
          status: "active",
          customer: "cus_subscription",
          metadata: { supabase_user_id: uid },
        });
      return Response.json({ data: [], has_more: false });
    });
    return {
      fetcher,
      services: createDeletionServices(admin as never, {
        enabled: true,
        billingAudited: true,
        stripeSecret: "synthetic-test-key",
        fetch: fetcher as typeof fetch,
      }),
    };
  }
  it("finds a just-completed subscription from Checkout despite stale search and changed email", async () => {
    const { services, fetcher } = checkoutFixture();
    expect(await services.inspect(uid)).toEqual({
      subscriptionIds: ["sub_completed"],
      checkoutIds: [],
    });
    const urls = fetcher.mock.calls.map(([input]) => new URL(String(input)));
    expect(
      urls.some((url) => url.pathname === "/v1/subscriptions/sub_completed"),
    ).toBe(true);
    expect(
      urls
        .filter((url) => url.pathname === "/v1/subscriptions")
        .map((url) => url.searchParams.get("customer")),
    ).toEqual(["cus_checkout", "cus_subscription"]);
  });
  it("blocks a completed subscription checkout whose subscription cannot be verified", async () => {
    const { services } = checkoutFixture(null);
    await expect(services.inspect(uid)).rejects.toMatchObject({
      code: "billing_unavailable",
    });
  });
  it("never cancels another account's subscription, even when its ID is known", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "sub_other",
            status: "active",
            metadata: { supabase_user_id: other },
          }),
        ),
    );
    const services = createDeletionServices({} as never, {
      enabled: true,
      billingAudited: true,
      stripeSecret: "synthetic-test-key",
      fetch: fetcher as typeof fetch,
    });
    await expect(
      services.cancelSubscription(uid, "sub_other"),
    ).rejects.toMatchObject({ code: "billing_ownership_required" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).not.toContain("DELETE");
  });
  it("does not use a missing Stripe attribution as cancellation authority", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "cs_legacy", status: "open", metadata: {} }),
        ),
    );
    const services = createDeletionServices({} as never, {
      enabled: true,
      billingAudited: true,
      stripeSecret: "synthetic-test-key",
      fetch: fetcher as typeof fetch,
    });
    await expect(
      services.expireCheckout(uid, "cs_legacy"),
    ).rejects.toMatchObject({ code: "billing_ownership_required" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("Apple deletion completion", () => {
  it("revokes before media and Auth removal", async () => {
    const { services, handle } = fixture();
    services.revokeApple = vi.fn(async () => {
      expect(services.removeObjects).not.toHaveBeenCalled();
      expect(services.deleteAuthUser).not.toHaveBeenCalled();
      return { manualRequired: false };
    });
    const result = await handle(request());
    expect(result.status).toBe(200);
    expect(services.revokeApple).toHaveBeenCalledWith(uid, "lease");
  });
  it("keeps the account and media on Apple failure for a later retry", async () => {
    const { services, handle } = fixture();
    services.revokeApple = vi.fn(async () => {
      throw new DeletionError("apple_revocation_unavailable", 503);
    });
    expect((await handle(request())).status).toBe(503);
    expect(services.removeObjects).not.toHaveBeenCalled();
    expect(services.deleteAuthUser).not.toHaveBeenCalled();
    expect(services.release).toHaveBeenCalledWith(uid, "lease");
    vi.mocked(services.revokeApple).mockResolvedValue({
      manualRequired: false,
    });
    expect((await handle(request())).status).toBe(200);
  });
  it("preserves legacy manual-revocation instructions on response, status and replay", async () => {
    const { services, handle } = fixture();
    services.revokeApple = vi.fn(async () => ({ manualRequired: true }));
    services.appleRevocationRequiredForReceipt = vi.fn(async () => true);
    expect(await (await handle(request())).json()).toEqual({
      deleted: true,
      appleRevocationRequired: true,
    });
    expect(
      await (
        await handle(request({ action: "status", operationId: operation }))
      ).json(),
    ).toEqual({ deleted: true, appleRevocationRequired: true });
    expect(await (await handle(request())).json()).toEqual({
      deleted: true,
      appleRevocationRequired: true,
    });
  });
});

describe("Deletion of incomplete social accounts", () => {
  function incompleteFixture(
    options: {
      knownPending?: boolean;
      profileError?: unknown;
      guardError?: unknown;
      unownedSubscription?: boolean;
    } = {},
  ) {
    const calls: string[] = [];
    const admin = {
      rpc: vi.fn(async (name: string) => {
        calls.push(name);
        return {
          data:
            name === "account_deletion_profile_optional"
              ? options.knownPending === true
              : null,
          error:
            name === "account_deletion_profile_optional"
              ? options.guardError || null
              : null,
        };
      }),
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: uid, email: "pending@example.test" } },
            error: null,
          }),
        },
      },
      from: (table: string) => {
        const result = {
          data: table === "native_account_deletion_checkouts" ? [] : null,
          error: table === "profiles" ? options.profileError || null : null,
        };
        return {
          select: () => ({
            eq: () => ({ ...result, maybeSingle: async () => result }),
          }),
        };
      },
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return Response.json({
        data:
          options.unownedSubscription &&
          url.pathname.endsWith("/subscriptions/search")
            ? [
                {
                  id: "sub_shared",
                  status: "active",
                  metadata: { supabase_user_id: other },
                },
              ]
            : [],
        has_more: false,
      });
    });
    return {
      calls,
      services: createDeletionServices(admin as never, {
        enabled: true,
        billingAudited: true,
        stripeSecret: "synthetic-test-key",
        fetch: fetcher as typeof fetch,
      }),
    };
  }
  it("allows a genuinely missing profile only when the private signup registry recognizes it", async () => {
    const { services, calls } = incompleteFixture({ knownPending: true });
    expect(await services.inspect(uid)).toEqual({
      subscriptionIds: [],
      checkoutIds: [],
    });
    expect(calls).toContain("account_deletion_profile_optional");
  });
  it("keeps an unexplained missing profile blocked", async () => {
    const { services } = incompleteFixture({ knownPending: false });
    await expect(services.inspect(uid)).rejects.toMatchObject({
      code: "schema_not_ready",
    });
  });
  it("does not interpret a failed profile SELECT as a missing row", async () => {
    const { services, calls } = incompleteFixture({
      knownPending: true,
      profileError: { code: "XX000" },
    });
    await expect(services.inspect(uid)).rejects.toMatchObject({
      code: "schema_not_ready",
    });
    expect(calls).not.toContain("account_deletion_profile_optional");
  });
  it("does not interpret an unavailable signup check as an allowed missing profile", async () => {
    const { services } = incompleteFixture({
      knownPending: true,
      guardError: { code: "42883" },
    });
    await expect(services.inspect(uid)).rejects.toMatchObject({
      code: "schema_not_ready",
    });
  });
  it("retains billing ownership checks for incomplete accounts", async () => {
    const { services } = incompleteFixture({
      knownPending: true,
      unownedSubscription: true,
    });
    await expect(services.inspect(uid)).rejects.toMatchObject({
      code: "billing_ownership_required",
    });
  });
});
