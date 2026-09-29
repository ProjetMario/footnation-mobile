import { describe, expect, it, vi } from "vitest";
import {
  handlePushRequest,
  pushMessage,
  runPushDelivery,
  type PushJob,
  type PushPorts,
} from "../../supabase/functions/native-push/worker";

const job: PushJob = {
  id: "job",
  notification_id: "10000000-0000-4000-8000-000000000001",
  installation_id: "device",
  lease_id: "lease",
  claim_id: "claim",
  token: "ExpoPushToken[synthetic_test]",
  ticket_id: null,
  attempts: 1,
};
function setup(send = [job], receipts: PushJob[] = []) {
  const ports: PushPorts = {
    claim: vi.fn(async (phase) => (phase === "send" ? send : receipts)),
    finish: vi.fn(async () => {}),
    fetch: vi.fn(async () =>
      Response.json({ data: [{ status: "ok", id: "ticket" }] }),
    ),
  };
  return ports;
}
describe("local native push worker", () => {
  it("limits database acknowledgements to five concurrent requests", async () => {
    const jobs = Array.from({ length: 16 }, (_, index) => ({
      ...job,
      id: `job-${index}`,
    }));
    const ports = setup(jobs);
    vi.mocked(ports.fetch).mockResolvedValueOnce(
      Response.json({
        data: jobs.map((item) => ({ status: "ok", id: `ticket-${item.id}` })),
      }),
    );
    let running = 0,
      peak = 0;
    vi.mocked(ports.finish).mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });
    await runPushDelivery(ports, "send");
    expect(peak).toBe(5);
    expect(ports.finish).toHaveBeenCalledTimes(16);
  });
  it("sends only generic content and a notification ID through the fixed Expo endpoint", async () => {
    const ports = setup();
    ports.accessToken = "synthetic-provider-access";
    await runPushDelivery(ports, "send");
    const [url, request] = vi.mocked(ports.fetch).mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(String(request?.body))).toEqual([
      {
        to: job.token,
        title: "FootNation",
        body: "Vous avez une nouvelle notification.",
        data: { notificationId: job.notification_id },
        channelId: "footnation",
        ttl: 3600,
      },
    ]);
    expect(ports.finish).toHaveBeenCalledWith(job, "accepted", "ticket");
  });
  it("does not contact Expo without work or with an invalid token", async () => {
    const ports = setup([{ ...job, token: "https://evil.test" }]);
    await runPushDelivery(ports);
    expect(ports.fetch).not.toHaveBeenCalled();
    expect(pushMessage({ ...job, token: null })).toBeNull();
  });
  it("bounds each claimed batch to 100", async () => {
    const ports = setup(Array.from({ length: 101 }, () => job));
    await expect(runPushDelivery(ports, "send")).rejects.toThrow("limit");
    expect(ports.fetch).not.toHaveBeenCalled();
  });
  it("preserves ticket order and invalidates only the matching job", async () => {
    const second = { ...job, id: "other", lease_id: "other-lease" };
    const ports = setup([job, second]);
    vi.mocked(ports.fetch).mockResolvedValueOnce(
      Response.json({
        data: [
          { status: "ok", id: "ticket-a" },
          {
            status: "error",
            message: "PRIVATE TOKEN",
            details: { error: "DeviceNotRegistered" },
          },
        ],
      }),
    );
    await runPushDelivery(ports, "send");
    expect(ports.finish).toHaveBeenCalledWith(job, "accepted", "ticket-a");
    expect(ports.finish).toHaveBeenCalledWith(
      second,
      "invalid",
      undefined,
      "DeviceNotRegistered",
    );
    expect(JSON.stringify(vi.mocked(ports.finish).mock.calls)).not.toContain(
      "PRIVATE TOKEN",
    );
  });
  it.each([429, 500, 503])(
    "schedules bounded backoff after HTTP %s",
    async (status) => {
      const ports = setup();
      vi.mocked(ports.fetch).mockResolvedValueOnce(
        new Response("private upstream error", { status }),
      );
      await runPushDelivery(ports, "send");
      expect(ports.finish).toHaveBeenCalledWith(
        job,
        "retry",
        undefined,
        "ProviderUnavailable",
      );
    },
  );
  it("keeps an ambiguous timed-out send unknown instead of duplicating it", async () => {
    const ports = setup();
    vi.mocked(ports.fetch).mockRejectedValueOnce(
      new Error("timeout including token"),
    );
    await runPushDelivery(ports, "send");
    expect(ports.finish).toHaveBeenCalledWith(
      job,
      "unknown",
      undefined,
      "TransportUnknown",
    );
  });
  it("actually aborts a stalled provider request", async () => {
    vi.useFakeTimers();
    try {
      const ports = setup();
      vi.mocked(ports.fetch).mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new Error("timeout")),
              { once: true },
            );
          }),
      );
      const run = runPushDelivery(ports, "send");
      await vi.advanceTimersByTimeAsync(10001);
      await run;
      expect(ports.finish).toHaveBeenCalledWith(
        job,
        "unknown",
        undefined,
        "TransportUnknown",
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not mismatch receipts when a ticket is absent", async () => {
    const first = { ...job, ticket_id: "ticket-a" };
    const second = { ...job, id: "other", ticket_id: "ticket-b" };
    const ports = setup([], [first, second]);
    vi.mocked(ports.fetch).mockResolvedValueOnce(
      Response.json({
        data: {
          "ticket-b": {
            status: "error",
            details: { error: "DeviceNotRegistered" },
          },
        },
      }),
    );
    await runPushDelivery(ports, "receipts");
    expect(ports.finish).toHaveBeenCalledWith(
      first,
      "receipt_retry",
      undefined,
      "ReceiptMissing",
    );
    expect(ports.finish).toHaveBeenCalledWith(
      second,
      "invalid",
      undefined,
      "DeviceNotRegistered",
    );
  });
  it("accepts a successful receipt as provider delivery", async () => {
    const receipt = { ...job, ticket_id: "ticket" };
    const ports = setup([], [receipt]);
    vi.mocked(ports.fetch).mockResolvedValueOnce(
      Response.json({ data: { ticket: { status: "ok" } } }),
    );
    await runPushDelivery(ports, "receipts");
    expect(ports.finish).toHaveBeenCalledWith(receipt, "delivered");
  });
  it("retries rate errors but retains registrations for credential failures", async () => {
    for (const [code, outcome] of [
      ["MessageRateExceeded", "retry"],
      ["InvalidCredentials", "failed"],
    ]) {
      const ports = setup();
      vi.mocked(ports.fetch).mockResolvedValueOnce(
        Response.json({
          data: [{ status: "error", details: { error: code } }],
        }),
      );
      await runPushDelivery(ports, "send");
      expect(ports.finish).toHaveBeenCalledWith(job, outcome, undefined, code);
    }
  });
  it("treats malformed or truncated ticket arrays as ambiguous", async () => {
    const ports = setup();
    vi.mocked(ports.fetch).mockResolvedValueOnce(Response.json({ data: [] }));
    await runPushDelivery(ports, "send");
    expect(ports.finish).toHaveBeenCalledWith(
      job,
      "unknown",
      undefined,
      "InvalidResponse",
    );
  });
  it("stays closed without both server enablement and the invocation secret", async () => {
    const ports = setup();
    const secret = "synthetic-worker-secret-at-least-32-characters";
    const request = (value: string) =>
      new Request("https://local.invalid", {
        method: "POST",
        headers: { Authorization: `Bearer ${value}` },
      });
    expect(
      (
        await handlePushRequest(request(secret), ports, {
          enabled: false,
          secret,
        })
      ).status,
    ).toBe(503);
    expect(
      (
        await handlePushRequest(request("wrong"), ports, {
          enabled: true,
          secret,
        })
      ).status,
    ).toBe(401);
    expect(ports.claim).not.toHaveBeenCalled();
    expect(
      (
        await handlePushRequest(request(secret), ports, {
          enabled: true,
          secret,
        })
      ).status,
    ).toBe(200);
  });
  it("does not expose private error details or return device tokens", async () => {
    const ports = setup();
    const secret = "synthetic-worker-secret-at-least-32-characters";
    vi.mocked(ports.claim).mockRejectedValueOnce(
      new Error("PRIVATE DATABASE SECRET"),
    );
    const response = await handlePushRequest(
      new Request("https://local.invalid", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      }),
      ports,
      { enabled: true, secret },
    );
    expect(await response.text()).toBe(
      '{"error":"Push processing unavailable"}',
    );
  });
});
