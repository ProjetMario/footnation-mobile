import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  AppleAuthError,
  appleSubjects,
  appleTokenBinding,
  createAppleClientSecret,
  createAppleProvider,
  decryptAppleToken,
  digest,
  encryptAppleToken,
  verifyAppleIdentity,
  type AppleConfig,
} from "../../supabase/functions/_shared/apple-auth";
import {
  createAppleCredentialHandler,
  type AppleCredentialServices,
} from "../../supabase/functions/apple-auth-credentials/handler";
import {
  createAppleCredentialServices,
  createAppleRevoker,
} from "../../supabase/functions/apple-auth-credentials/services";
const uid = "11111111-1111-4111-8111-111111111111";
const now = Date.now();
const b64 = (value: string | Uint8Array) =>
  Buffer.from(value).toString("base64url");
let signing: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };
let config: AppleConfig;
beforeAll(async () => {
  signing = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  jwk = {
    ...(await crypto.subtle.exportKey("jwk", signing.publicKey)),
    kid: "apple-test",
    alg: "RS256",
    use: "sig",
  };
  const signingClient = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  config = {
    teamId: "TEAMID1234",
    keyId: "KEYID12345",
    privateKey: b64(
      new Uint8Array(
        await crypto.subtle.exportKey("pkcs8", signingClient.privateKey),
      ),
    ),
    nativeClientId: "com.test.app",
    webClientId: "com.test.web",
    encryptionKey: b64(new Uint8Array(32).fill(7)),
  };
});
async function identity(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) {
  const start = `${b64(JSON.stringify({ alg: "RS256", kid: "apple-test", ...header }))}.${b64(JSON.stringify({ iss: "https://appleid.apple.com", aud: config.nativeClientId, sub: "apple-subject", iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300, ...claims }))}`;
  return `${start}.${b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey, new TextEncoder().encode(start))))}`;
}
function input(
  body: unknown = {
    authorizationCode: "single-use-code",
    nonce: "random-nonce-123456",
  },
  headers: Record<string, string> = {},
) {
  return new Request("https://local.test/apple-auth-credentials", {
    method: "POST",
    headers: {
      Authorization: "Bearer validated-session",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
function fixture() {
  const services: AppleCredentialServices = {
    enabled: true,
    getUser: vi.fn(async () => ({ id: uid, subjects: ["apple-subject"] })),
    begin: vi.fn(async () => "lease"),
    capture: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  return { services, handler: createAppleCredentialHandler(services) };
}
describe("Apple authenticated credential endpoint", () => {
  it("derives identity from the remotely verified session and stores only after a lease", async () => {
    const { services, handler } = fixture();
    const result = await handler(input());
    expect(await result.json()).toEqual({ stored: true });
    expect(services.getUser).toHaveBeenCalledWith("validated-session");
    expect(services.begin).toHaveBeenCalledWith(
      uid,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(services.capture).toHaveBeenCalledWith(
      { id: uid, subjects: ["apple-subject"] },
      { authorizationCode: "single-use-code", nonce: "random-nonce-123456" },
      "lease",
      expect.any(String),
    );
  });
  it("accepts OAuth provider refresh credentials without trusting a client ID", async () => {
    const { handler } = fixture();
    expect(
      (await handler(input({ providerRefreshToken: "provider-refresh" })))
        .status,
    ).toBe(200);
  });
  it.each([
    null,
    [],
    {},
    { userId: uid, providerRefreshToken: "secret" },
    { authorizationCode: "code" },
    { authorizationCode: "code", nonce: "tiny" },
    {
      authorizationCode: "code",
      nonce: "random-nonce-123456",
      providerRefreshToken: "secret",
    },
    { providerRefreshToken: "" },
    { providerRefreshToken: "secret with spaces" },
    { refreshToken: "wrong-key" },
  ])("rejects invalid or identity-spoofing body %j", async (body) => {
    const { services, handler } = fixture();
    expect((await handler(input(body))).status).toBe(400);
    expect(services.getUser).not.toHaveBeenCalled();
  });
  it("rejects a missing bearer", async () => {
    const { handler } = fixture();
    expect(
      (await handler(input(undefined, { Authorization: "" }))).status,
    ).toBe(401);
  });
  it("rejects false Auth validation", async () => {
    const { services, handler } = fixture();
    vi.mocked(services.getUser).mockResolvedValue(null);
    expect((await handler(input())).status).toBe(401);
    expect(services.begin).not.toHaveBeenCalled();
  });
  it("rejects accounts without a server-linked Apple identity", async () => {
    const { services, handler } = fixture();
    vi.mocked(services.getUser).mockResolvedValue({ id: uid, subjects: [] });
    expect((await handler(input())).status).toBe(403);
  });
  it("returns only safe errors and releases a failed lease", async () => {
    const { services, handler } = fixture();
    vi.mocked(services.capture).mockRejectedValue(
      new Error("provider token SECRET"),
    );
    const response = await handler(input());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET");
    expect(services.release).toHaveBeenCalledWith(uid, "lease");
  });
  it("acknowledges a recorded exact replay without exchanging the code again", async () => {
    const { services, handler } = fixture();
    vi.mocked(services.begin).mockResolvedValue(null);
    expect((await handler(input())).status).toBe(200);
    expect(services.capture).not.toHaveBeenCalled();
  });
  it("bounds the streamed body independently from Content-Length", async () => {
    const { services, handler } = fixture();
    expect(
      (
        await handler(
          input(
            { providerRefreshToken: "a".repeat(13000) },
            { "Content-Length": "1" },
          ),
        )
      ).status,
    ).toBe(413);
    expect(services.getUser).not.toHaveBeenCalled();
  });
  it("requires JSON", async () => {
    const { handler } = fixture();
    expect(
      (await handler(input(undefined, { "Content-Type": "text/plain" })))
        .status,
    ).toBe(415);
  });
  it("handles CORS and rejects unsupported methods", async () => {
    const { handler } = fixture();
    expect(
      (await handler(new Request("https://local", { method: "OPTIONS" })))
        .status,
    ).toBe(204);
    expect((await handler(new Request("https://local"))).status).toBe(405);
  });
  it("fails closed when disabled", async () => {
    const { handler, services } = fixture();
    services.enabled = false;
    expect((await handler(input())).status).toBe(503);
    expect(services.getUser).not.toHaveBeenCalled();
  });
});
describe("Apple verification and encrypted storage", () => {
  it("only trusts linked identity subjects, never editable metadata or email", () => {
    expect(
      appleSubjects({
        identities: [
          { provider: "google", identity_data: { sub: "google" } },
          { provider: "apple", identity_data: { sub: "apple" } },
        ],
      }),
    ).toEqual(["apple"]);
  });
  it("verifies signed native identity, correct client and nonce", async () => {
    const nonce = "random-nonce-123456";
    expect(
      await verifyAppleIdentity(
        await identity({ nonce: await digest(nonce) }),
        config.nativeClientId,
        [jwk],
        now,
        nonce,
      ),
    ).toBe("apple-subject");
  });
  it.each([
    { iss: "https://attacker.test" },
    { aud: "other.client" },
    { sub: "" },
    { exp: Math.floor(now / 1000) - 1 },
    { iat: Math.floor(now / 1000) + 120 },
    { iat: Math.floor(now / 1000) - 800 },
    { nonce: "wrong" },
  ])("rejects invalid signed claims %j", async (claims) => {
    await expect(
      verifyAppleIdentity(
        await identity(claims),
        config.nativeClientId,
        [jwk],
        now,
        "random-nonce-123456",
      ),
    ).rejects.toMatchObject({ code: "credential_invalid" });
  });
  it("rejects unsigned algorithms and signature tampering", async () => {
    await expect(
      verifyAppleIdentity(
        await identity({}, { alg: "none" }),
        config.nativeClientId,
        [jwk],
        now,
      ),
    ).rejects.toThrow();
    const token = await identity();
    await expect(
      verifyAppleIdentity(
        token.slice(0, -8) + "wrongSig",
        config.nativeClientId,
        [jwk],
        now,
      ),
    ).rejects.toThrow();
  });
  it("encrypts with unique IVs and binds user, client and subject", async () => {
    const binding = appleTokenBinding(
      uid,
      config.nativeClientId,
      "apple-subject",
    );
    const first = await encryptAppleToken(
      "refresh-secret",
      binding,
      config.encryptionKey,
    );
    const second = await encryptAppleToken(
      "refresh-secret",
      binding,
      config.encryptionKey,
    );
    expect(first).not.toBe(second);
    expect(first).not.toContain("refresh-secret");
    expect(await decryptAppleToken(first, binding, config.encryptionKey)).toBe(
      "refresh-secret",
    );
    await expect(
      decryptAppleToken(
        first,
        appleTokenBinding("other", config.nativeClientId, "apple-subject"),
        config.encryptionKey,
      ),
    ).rejects.toThrow();
    await expect(
      decryptAppleToken(
        first.slice(0, -3) + "xxx",
        binding,
        config.encryptionKey,
      ),
    ).rejects.toThrow();
  });
  it("rejects missing or short encryption keys", async () => {
    await expect(
      encryptAppleToken("token", "binding", "invalid"),
    ).rejects.toThrow();
  });
  it("signs a five-minute client secret for a configured audience only", async () => {
    const secret = await createAppleClientSecret(
      config,
      config.nativeClientId,
      now,
    );
    expect(
      JSON.parse(Buffer.from(secret.split(".")[1], "base64url").toString()),
    ).toMatchObject({
      sub: config.nativeClientId,
      iss: config.teamId,
      aud: "https://appleid.apple.com",
      exp: Math.floor(now / 1000) + 300,
    });
    await expect(
      createAppleClientSecret(config, "client-from-request", now),
    ).rejects.toThrow();
  });
});
async function providerFetch(subject = "apple-subject", oauth = false) {
  const token = await identity({
    sub: subject,
    aud: oauth ? config.webClientId : config.nativeClientId,
    nonce: await digest("random-nonce-123456"),
  });
  return vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/keys")
      ? Response.json({ keys: [jwk] })
      : Response.json({ id_token: token, refresh_token: "provider-secret" }),
  ) as unknown as typeof fetch;
}
describe("Apple server adapter", () => {
  it("does not acknowledge an unexpected lease response as successful capture", async () => {
    const services = createAppleCredentialServices(
      {
        rpc: vi.fn(async () => ({ data: false })),
        auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
      },
      config,
      true,
    );
    await expect(services.begin(uid, "digest")).rejects.toMatchObject({
      code: "storage_failed",
    });
  });

  it("exchanges a native code, rechecks linked identity and stores ciphertext only", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const admin = {
      rpc,
      auth: {
        getUser: vi.fn(),
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                identities: [
                  {
                    provider: "apple",
                    identity_data: { sub: "apple-subject" },
                  },
                ],
              },
            },
          })),
        },
      },
    };
    const services = createAppleCredentialServices(
      admin,
      config,
      true,
      await providerFetch(),
    );
    await services.capture(
      { id: uid, subjects: ["apple-subject"] },
      { authorizationCode: "native-code", nonce: "random-nonce-123456" },
      "lease",
      "digest",
    );
    const [name, payload] = rpc.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("apple_credential_store");
    expect(payload).toMatchObject({
      p_user: uid,
      p_client: config.nativeClientId,
      p_subject: "apple-subject",
    });
    expect(JSON.stringify(payload)).not.toContain("provider-secret");
    expect(
      await decryptAppleToken(
        payload.p_ciphertext as string,
        appleTokenBinding(uid, config.nativeClientId, "apple-subject"),
        config.encryptionKey,
      ),
    ).toBe("provider-secret");
  });
  it("rejects valid Apple tokens belonging to another Apple account", async () => {
    const rpc = vi.fn();
    const services = createAppleCredentialServices(
      { rpc, auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } } },
      config,
      true,
      await providerFetch("another-subject"),
    );
    await expect(
      services.capture(
        { id: uid, subjects: ["apple-subject"] },
        { authorizationCode: "native-code", nonce: "random-nonce-123456" },
        "lease",
        "digest",
      ),
    ).rejects.toMatchObject({ code: "apple_identity_required" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the Web services ID when validating a Supabase OAuth refresh token", async () => {
    const request = await providerFetch("apple-subject", true);
    const provider = createAppleProvider(config, request);
    const result = await provider.validate({
      providerRefreshToken: "oauth-secret",
    });
    expect(result.clientId).toBe(config.webClientId);
    const requestBody = vi.mocked(request).mock.calls[0][1]
      ?.body as URLSearchParams;
    expect(requestBody.get("grant_type")).toBe("refresh_token");
    expect(requestBody.get("client_id")).toBe(config.webClientId);
  });
  it("does not treat invalid-client revocation as already revoked", async () => {
    const provider = createAppleProvider(
      config,
      vi.fn(async () => new Response("{}", { status: 400 })) as typeof fetch,
    );
    await expect(
      provider.revoke(config.nativeClientId, "token"),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
  it("accepts Apple HTTP 200 for idempotent revocation", async () => {
    const provider = createAppleProvider(
      config,
      vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch,
    );
    await expect(
      provider.revoke(config.nativeClientId, "token"),
    ).resolves.toBeUndefined();
  });
  it("retries only outstanding stored tokens and erases ciphertext only after Apple success", async () => {
    const ciphertext = await encryptAppleToken(
      "provider-secret",
      appleTokenBinding(uid, config.nativeClientId, "apple-subject"),
      config.encryptionKey,
    );
    const order: string[] = [];
    const rpc = vi.fn(async (name: string, args: any) => {
      order.push(name);
      return {
        data:
          name === "apple_credentials_for_deletion"
            ? [
                { id: "old", revoked_at: "done" },
                {
                  id: "new",
                  client_id: config.nativeClientId,
                  apple_subject: "apple-subject",
                  ciphertext,
                },
              ]
            : null,
      };
    });
    const request = vi.fn(async () => {
      order.push("apple-http");
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const admin = {
      rpc,
      auth: {
        getUser: vi.fn(),
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                identities: [
                  {
                    provider: "apple",
                    identity_data: { sub: "apple-subject" },
                  },
                ],
              },
            },
          })),
        },
      },
    };
    expect(
      await createAppleRevoker(admin, config, request)(uid, "lease"),
    ).toEqual({ manualRequired: false });
    expect(order).toEqual([
      "apple_credentials_for_deletion",
      "account_deletion_lease",
      "apple-http",
      "apple_credential_mark_revoked",
      "apple_deletion_revocation_done",
    ]);
    expect(
      rpc.mock.calls.find((c) => c[0] === "apple_credential_mark_revoked")?.[1]
        .p_id,
    ).toBe("new");
  });
  it("records a durable explicit manual instruction for legacy missing tokens", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "apple_credentials_for_deletion" ? [] : null,
    }));
    const admin = {
      rpc,
      auth: {
        getUser: vi.fn(),
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                identities: [
                  {
                    provider: "apple",
                    identity_data: { sub: "apple-subject" },
                  },
                ],
              },
            },
          })),
        },
      },
    };
    expect(await createAppleRevoker(admin, config)(uid, "lease")).toEqual({
      manualRequired: true,
    });
    expect(rpc).toHaveBeenCalledWith("apple_deletion_revocation_done", {
      p_user: uid,
      p_lease: "lease",
      p_manual: true,
    });
  });
  it("retains a token after Apple failure and never marks deletion ready", async () => {
    const ciphertext = await encryptAppleToken(
      "provider-secret",
      appleTokenBinding(uid, config.nativeClientId, "apple-subject"),
      config.encryptionKey,
    );
    const rpc = vi.fn(async (name: string) => ({
      data:
        name === "apple_credentials_for_deletion"
          ? [
              {
                id: "new",
                client_id: config.nativeClientId,
                apple_subject: "apple-subject",
                ciphertext,
              },
            ]
          : null,
    }));
    const admin = {
      rpc,
      auth: {
        getUser: vi.fn(),
        admin: { getUserById: vi.fn(async () => ({ data: { user: {} } })) },
      },
    };
    await expect(
      createAppleRevoker(
        admin,
        config,
        vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch,
      )(uid, "lease"),
    ).rejects.toThrow();
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain(
      "apple_credential_mark_revoked",
    );
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain(
      "apple_deletion_revocation_done",
    );
  });
});
