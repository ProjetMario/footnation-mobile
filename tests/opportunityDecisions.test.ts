import { describe, expect, it, vi } from "vitest";
import {
  analyze,
  decisionRequest,
  MODEL,
  parseDecision,
} from "../../supabase/functions/opportunity-decisions/decisions";
import {
  createHandler,
  parseInput,
  type Services,
} from "../../supabase/functions/opportunity-decisions/handler";
import { createServices } from "../../supabase/functions/opportunity-decisions/services";
import { createDecisionApi } from "../src/lib/admin/opportunityDecisions";
const evidence = {
  title: "Recherche gardien",
  description: "Club amateur recherche un gardien bénévole.",
  opportunity_type: "recherche_joueur",
  listing_kind: "offer",
};
const answer = () => ({
  model: MODEL,
  usage: { input_tokens: 100 },
  answers: [
    {
      name: "category",
      type: "choice",
      choice: "recherche_joueur",
      confidence: 0.95,
    },
    { name: "listing_kind", type: "choice", choice: "offer", confidence: 0.9 },
    ...["payment_guarantee", "sensitive_data", "pressure", "spam"].map(
      (name) => ({ name, type: "predicate", probability: 0.02 }),
    ),
  ],
});
function services(): Services {
  return {
    authorize: vi.fn(async (token) => token === "admin"),
    worker: vi.fn(async (secret) => secret === "worker"),
    ready: true,
    schedulerConfigured: true,
    admin: vi.fn(async () => ({ ok: true })),
    run: vi.fn(async () => ({ processed: 1 })),
  };
}
const request = (
  body: unknown,
  token: string | null = "admin",
  extra: Record<string, string> = {},
) =>
  new Request("https://fixture.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  });
describe("Decisions provider boundary", () => {
  it("sends only bounded announcement text and categories, with no contacts or profile", () => {
    const data = decisionRequest({
      ...evidence,
      description: "x".repeat(7000),
      contact_email: "private@example.com",
    } as any);
    expect(JSON.stringify(data)).not.toContain("private@example.com");
    expect(data.input[0].content[0].data.description).toHaveLength(6000);
    expect(data.questions).toHaveLength(6);
  });
  it("keeps an ordinary announcement out of the suspicion queue", () =>
    expect(parseDecision(answer()).needsReview).toBe(false));
  it("flags explicit signals and low confidence without changing publication state", () => {
    const v = answer();
    (v.answers[2] as any).probability = 0.8;
    expect(parseDecision(v)).toMatchObject({
      needsReview: true,
      signals: { payment_guarantee: 0.8 },
    });
    expect(parseDecision(v)).not.toHaveProperty("is_active");
    (v.answers[0] as any).confidence = 0.4;
    expect(parseDecision(v).needsReview).toBe(true);
  });
  it("does not interpret refusal or truncation as safe", () => {
    const v = answer();
    v.answers[2] = { name: "payment_guarantee", type: "refusal" } as any;
    expect(parseDecision(v)).toMatchObject({
      incomplete: true,
      needsReview: true,
      signals: { payment_guarantee: null },
    });
    expect(parseDecision(answer(), true).needsReview).toBe(true);
  });
  it.each([
    "missing",
    "duplicate",
    "nan",
    "range",
    "unknown",
    "tokens",
    "model",
  ])("rejects a malformed provider response: %s", (kind) => {
    const v = answer();
    if (kind === "missing") v.answers.pop();
    if (kind === "duplicate") v.answers[1] = v.answers[0];
    if (kind === "nan") (v.answers[2] as any).probability = NaN;
    if (kind === "range") (v.answers[2] as any).probability = 1.2;
    if (kind === "unknown") (v.answers[0] as any).choice = "delete_account";
    if (kind === "tokens") v.usage.input_tokens = -1;
    if (kind === "model") v.model = "other";
    expect(() => parseDecision(v)).toThrow("invalid_decision");
  });
  it("uses the Decisions endpoint and never exposes upstream errors", async () => {
    const fetcher = vi.fn(
      async () => new Response("secret-provider-body", { status: 429 }),
    );
    await expect(analyze(evidence, "fixture-key", fetcher)).rejects.toThrow(
      "provider_unavailable",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/decisions",
    );
  });
});
describe("authenticated HTTP boundary", () => {
  it.each([null, "member", "suspended", "forged"])(
    "denies %s without executing actions",
    async (token) => {
      const s = services();
      const response = await createHandler(s)(
        request({ action: "run" }, token),
      );
      expect(response.status).toBe(token ? 403 : 401);
      expect(s.run).not.toHaveBeenCalled();
      expect(s.admin).not.toHaveBeenCalled();
    },
  );
  it("accepts a verified admin and exposes configuration readiness without a key", async () => {
    const s = services();
    s.ready = false;
    expect(
      await (await createHandler(s)(request({ action: "status" }))).json(),
    ).toMatchObject({ ready: false });
    expect(
      (
        await createHandler(s)(
          request({ action: "configure", enabled: true, dailyLimit: 500 }),
        )
      ).status,
    ).toBe(503);
    expect((await createHandler(s)(request({ action: "run" }))).status).toBe(
      503,
    );
  });
  it("permits scheduler execution only, with its own secret", async () => {
    const s = services();
    const h = createHandler(s);
    expect(
      (
        await h(
          request({ action: "run" }, null, {
            "x-decision-worker-secret": "worker",
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await h(
          request({ action: "status" }, null, {
            "x-decision-worker-secret": "worker",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await h(
          request({ action: "run" }, null, {
            "x-decision-worker-secret": "wrong",
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("handles CORS, method, content type, JSON and streamed size limits", async () => {
    const h = createHandler(services());
    expect(
      (await h(new Request("https://fixture.test", { method: "OPTIONS" })))
        .status,
    ).toBe(204);
    expect((await h(new Request("https://fixture.test"))).status).toBe(405);
    expect(
      (await h(request({}, "admin", { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (
        await h(
          new Request("https://fixture.test", {
            method: "POST",
            headers: {
              Authorization: "Bearer admin",
              "Content-Type": "application/json",
            },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await h(request({ action: "status", padding: "x".repeat(9000) })))
        .status,
    ).toBe(413);
  });
  it.each([
    { action: "run", userId: "spoof" },
    { action: "configure", enabled: "true", dailyLimit: 500 },
    { action: "configure", enabled: true, dailyLimit: 5001 },
    { action: "list", filter: "all", offset: -1 },
    { action: "review", id: "bad" },
    { action: "__proto__" },
  ])("rejects invalid actions %j", (v) =>
    expect(() => parseInput(v)).toThrow(),
  );
  it("sanitizes unknown service exceptions", async () => {
    const s = services();
    s.run = async () => {
      throw new Error("fixture-secret");
    };
    const r = await createHandler(s)(request({ action: "run" }));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("fixture-secret");
  });
});
describe("server identity, persistence and client session", () => {
  it("checks Auth and current admin RPC, rejecting anonymous users", async () => {
    const user = { rpc: vi.fn(async () => ({ data: false })) };
    const admin = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "member" } } })),
      },
    };
    const s = createServices({
      admin,
      userClient: () => user,
      apiKey: "",
      workerSecret: "",
    });
    expect(await s.authorize("jwt")).toBe(false);
    expect(user.rpc).toHaveBeenCalledWith("can_review_content", {});
    admin.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "anon", is_anonymous: true } },
    } as any);
    expect(await s.authorize("jwt")).toBe(false);
  });
  it("binds completion to the reserved source revision and claim", async () => {
    const admin = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: "id", revision: "rev", claim: "claim", evidence }],
        })
        .mockResolvedValueOnce({ data: false }),
    };
    const s = createServices({
      admin,
      userClient: () => ({}),
      apiKey: "fixture-key",
      workerSecret: "",
      request: vi.fn(async () => Response.json(answer())),
    });
    expect(await s.run()).toMatchObject({ completed: 0, superseded: 1 });
    expect(admin.rpc.mock.calls[1][1]).toMatchObject({
      p_id: "id",
      p_revision: "rev",
      p_claim: "claim",
    });
  });
  it("cannot execute an old admin's intent after a session switch", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: { user: { id: "member" }, access_token: "member-jwt" },
          },
          error: null,
        })),
      },
      functions: { invoke: vi.fn() },
    };
    await expect(createDecisionApi("admin", client).run()).rejects.toThrow(
      "session a changé",
    );
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it("rejects a response when the account changed while the request was pending", async () => {
    const session = (id: string) => ({
      data: { session: { user: { id }, access_token: "jwt" } },
      error: null,
    });
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValueOnce(session("admin"))
          .mockResolvedValueOnce(session("member")),
      },
      functions: {
        invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
      },
    };
    await expect(
      createDecisionApi("admin", client).configure(true, 100),
    ).rejects.toThrow("session a changé");
  });
});
