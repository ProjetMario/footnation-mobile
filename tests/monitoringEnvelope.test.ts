import { describe, expect, it, vi } from "vitest";
import {
  Client,
  Scope,
  createTransport,
  type ClientOptions,
  type Envelope,
  type Event,
} from "@sentry/core";
import {
  monitoringEnvelopePrivacyIntegration,
  sanitizeMonitoringEnvelope,
} from "../src/lib/monitoringEnvelope";
const id = "a".repeat(32),
  debugId = "b4a93f10-1122-3344-5566-778899aabbcc";
class ProbeClient extends Client {
  constructor(options: ClientOptions) {
    super(options);
  }
  eventFromException(): PromiseLike<Event> {
    return Promise.resolve({
      exception: { values: [{ type: "Error", value: "synthetic" }] },
    });
  }
  eventFromMessage(): PromiseLike<Event> {
    return Promise.resolve({ message: "synthetic" });
  }
}

describe("final monitoring envelope privacy", () => {
  it("removes late attachments, tracing headers, user data and SDK extras while retaining matched Debug IDs", () => {
    const envelope: Envelope = [
      {
        event_id: id,
        sent_at: "2026-09-10T00:00:00.000Z",
        trace: { user_segment: "private-member" },
        sdk: { name: "private-sdk", version: "private-version" },
      },
      [
        [
          { type: "event", late: "private-header" },
          {
            event_id: id,
            user: { id: "private-member" },
            extra: { account: "private@example.test" },
            tags: {
              source: "render",
              screen: "profile/[id]",
              key: "private-key",
            },
            debug_meta: {
              images: [
                {
                  type: "sourcemap",
                  debug_id: debugId,
                  code_file: "https://app.test/entry-abcdef.js?token=private",
                },
              ],
            },
            exception: {
              values: [
                {
                  type: "TypeError",
                  value: "private text",
                  stacktrace: {
                    frames: [
                      {
                        filename:
                          "https://app.test/entry-abcdef.js?token=private",
                        lineno: 4,
                        colno: 6,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        [{ type: "attachment", length: 7, filename: "private.txt" }, "private"],
      ],
    ];
    sanitizeMonitoringEnvelope(envelope);
    const json = JSON.stringify(envelope);
    expect(json).not.toContain("private");
    expect(envelope[1]).toHaveLength(1);
    expect(envelope[0].trace).toBeUndefined();
    expect(envelope[0].sdk).toBeUndefined();
    expect(json).toContain(debugId);
    expect(json.match(/app:\/\/\/entry-abcdef.js/g)).toHaveLength(2);
  });
  it("discards sessions and any other non-error envelope items", () => {
    const envelope = [
      { trace: { user_segment: "private" } },
      [
        [{ type: "session" }, { user: "private" }],
        [{ type: "log" }, { message: "private" }],
      ],
    ] as unknown as Envelope;
    sanitizeMonitoringEnvelope(envelope);
    expect(envelope[1]).toEqual([]);
    expect(JSON.stringify(envelope)).not.toContain("private");
  });
  it("fails closed on malformed payloads without leaking the invalid field", () => {
    const envelope = [
      { event_id: id },
      [
        [
          { type: "event" },
          { event_id: id, exception: { values: "private-invalid" } },
        ],
      ],
    ] as unknown as Envelope;
    expect(() => sanitizeMonitoringEnvelope(envelope)).not.toThrow();
    expect(envelope[1]).toEqual([]);
    expect(JSON.stringify(envelope)).not.toContain("private");
  });
  it("covers actual SDK internal errors that skip beforeSend and remains account-independent", async () => {
    const send = vi.fn(async (_envelope: Envelope) => ({})),
      beforeSend = vi.fn((event) => event);
    const client = new ProbeClient({
      dsn: `https://${id}@o1.ingest.sentry.io/123`,
      stackParser: () => [],
      beforeSend,
      integrations: [monitoringEnvelopePrivacyIntegration()],
      transport: () => ({ send, flush: async () => true }),
      sendClientReports: false,
    });
    client.init();
    for (const account of ["private-A", "private-B"]) {
      const scope = new Scope();
      scope.setUser({ id: account, email: `${account}@example.test` });
      scope.setExtra("draft", account);
      scope.addAttachment({ filename: `${account}.txt`, data: account });
      client.captureEvent(
        { exception: { values: [{ type: "Error", value: account }] } },
        { data: { __sentry__: true } },
        scope,
      );
    }
    await client.flush(1000);
    expect(beforeSend).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    for (const [envelope] of send.mock.calls) {
      expect(envelope[1]).toHaveLength(1);
      expect(JSON.stringify(envelope)).not.toContain("private");
      expect(envelope[1][0][0].type).toBe("event");
    }
    await client.close();
  });
  it("caps internal errors too and the real JS transport never requests an empty or non-error envelope", async () => {
    const makeRequest = vi.fn(async () => ({ statusCode: 200 }));
    const client = new ProbeClient({
      dsn: `https://${id}@o1.ingest.sentry.io/123`,
      stackParser: () => [],
      integrations: [monitoringEnvelopePrivacyIntegration()],
      sendClientReports: false,
      transport: (options) => createTransport(options, makeRequest),
    });
    client.init();
    await client.sendEnvelope([
      { sent_at: new Date().toISOString() },
      [
        [
          { type: "session" },
          {
            sid: id,
            init: true,
            started: "2026-09-10T00:00:00.000Z",
            timestamp: "2026-09-10T00:00:00.000Z",
            status: "ok",
            errors: 0,
            attrs: { release: "synthetic" },
          },
        ],
      ],
    ]);
    expect(makeRequest).not.toHaveBeenCalled();
    for (let i = 0; i < 25; i++)
      client.captureEvent(
        { exception: { values: [{ type: "Error", value: `synthetic-${i}` }] } },
        { data: { __sentry__: true } },
      );
    await client.flush(1000);
    expect(makeRequest).toHaveBeenCalledTimes(20);
    await client.close();
  });
});
