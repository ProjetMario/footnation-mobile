import { expect, it } from "vitest";
import {
  createErrorLimiter,
  sanitizeMonitoringEvent,
  screenTemplate,
  validMonitoringDsn,
} from "../src/lib/monitoringPrivacy";

it("removes member content, auth data, request URLs, console history and extra contexts", () => {
  const secret = "private@example.com bearer-private-value";
  const event = sanitizeMonitoringEvent({
    user: { email: secret, id: "member-id" },
    message: secret,
    request: {
      url: `https://backend.test?token=${secret}`,
      headers: { Authorization: secret },
    },
    extra: { form: secret },
    contexts: { profile: { bio: secret } },
    breadcrumbs: [{ message: secret }],
    tags: { source: "query", screen: "profile/[id]", queryKey: secret },
    exception: {
      values: [
        {
          type: "TypeError",
          value: secret,
          stacktrace: {
            frames: [
              {
                filename: `https://app.test/_expo/entry-a1.js?token=${secret}`,
                lineno: 32,
                colno: 4,
                vars: { token: secret },
                pre_context: [secret],
                context_line: secret,
              },
            ],
          },
        },
      ],
    },
  });
  const json = JSON.stringify(event);
  expect(json).not.toContain(secret);
  expect(json).not.toContain("member-id");
  expect(json).not.toContain("queryKey");
  expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
    filename: "app:///entry-a1.js",
    function: undefined,
    lineno: 32,
    colno: 4,
    in_app: undefined,
  });
  expect(event.tags).toEqual({ source: "query", screen: "profile/[id]" });
});

it("keeps error type and debugging coordinates but replaces unsafe exception fields", () => {
  const event = sanitizeMonitoringEvent({
    exception: {
      values: [
        {
          type: "alice@example.com",
          value: "secret",
          mechanism: {
            type: "custom",
            handled: false,
            data: { token: "secret" },
          },
          stacktrace: {
            frames: [
              {
                filename: "/Users/alice/private.dat",
                function: "alice@example.com",
                vars: { token: "secret" },
              },
            ],
          },
        },
      ],
    },
  });
  expect(event.exception?.values?.[0].type).toBe("Error");
  expect(event.exception?.values?.[0].mechanism?.handled).toBe(false);
  expect(JSON.stringify(event)).not.toMatch(/alice|secret|private/);
});

it("accepts a public HTTPS DSN and rejects credentials, query parameters and placeholders", () => {
  const dsn = `https://${"a".repeat(32)}@o1.ingest.sentry.io/123`;
  expect(validMonitoringDsn(dsn)).toBe(dsn);
  for (const bad of [
    undefined,
    "",
    "https://your-dsn",
    dsn.replace("https", "http"),
    dsn.replace("@", ":secret@"),
    `${dsn}?token=secret`,
    `${dsn}#secret`,
  ])
    expect(validMonitoringDsn(bad)).toBeUndefined();
});

it("keeps matching Debug IDs for symbolication without raw bundle URLs or SDK extra data", () => {
  const debugId = "b4a93f10-1122-3344-5566-778899aabbcc";
  for (const filename of [
    "app:///main.jsbundle",
    "https://app.test/entry-a1.js?token=private",
  ]) {
    const event = sanitizeMonitoringEvent({
      sdk: {
        name: "custom-private",
        version: "7.11.0",
        integrations: ["private"],
        settings: { infer_ip: "auto" },
      },
      debug_meta: {
        images: [
          { type: "sourcemap", debug_id: debugId, code_file: filename },
          { type: "sourcemap", debug_id: "private", code_file: "/private.dat" },
        ],
      },
      exception: {
        values: [
          { stacktrace: { frames: [{ filename, function: "private" }] } },
        ],
      },
    });
    expect(event.debug_meta?.images).toHaveLength(1);
    expect(event.debug_meta?.images?.[0].code_file).toBe(
      event.exception?.values?.[0].stacktrace?.frames?.[0].filename,
    );
    expect(event.debug_meta?.images?.[0].debug_id).toBe(debugId);
    expect(JSON.stringify(event)).not.toContain("private");
    expect(event.sdk?.settings?.infer_ip).toBe("never");
  }
});

it("reports each error once, ignores expected disconnections and bounds report bursts", () => {
  let now = 0;
  const allow = createErrorLimiter(() => now);
  const error = new Error("failure");
  expect(
    allow(Object.assign(new Error("Offline"), { name: "OfflineError" })),
  ).toBe(false);
  expect(allow(new Error("Failed to fetch"))).toBe(false);
  expect(allow(error)).toBe(true);
  expect(allow(error)).toBe(false);
  for (let i = 0; i < 19; i++) expect(allow(new Error("failure"))).toBe(true);
  expect(allow(new Error("failure"))).toBe(false);
  now = 60_000;
  expect(allow(new Error("failure"))).toBe(true);
});

it("uses route templates without query strings or user-entered labels", () => {
  expect(screenTemplate(["(tabs)", "index"])).toBe("(tabs)/index");
  expect(screenTemplate(["profile", "[id]"])).toBe("profile/[id]");
  expect(screenTemplate(["callback?access_token=private"])).toBe("unknown");
  expect(screenTemplate(["alice@example.com"])).toBe("unknown");
});

it("drops arbitrary basenames and malformed envelope identifiers while preserving real release bundles", () => {
  const event = sanitizeMonitoringEvent({
    event_id: "private-member-id",
    timestamp: Number.NaN,
    exception: {
      values: [
        {
          stacktrace: {
            frames: [
              {
                filename: "https://host.test/private-member.js",
                lineno: -1,
                colno: Infinity,
              },
              { filename: "app:///index.android.bundle", lineno: 1, colno: 42 },
              {
                filename: "file:///private/entry-abcdef.hbc",
                lineno: 1,
                colno: 5,
              },
            ],
          },
        },
      ],
    },
  });
  expect(event.event_id).toBeUndefined();
  expect(event.timestamp).toBeUndefined();
  expect(JSON.stringify(event)).not.toContain("private");
  expect(
    event.exception?.values?.[0].stacktrace?.frames?.map(
      (frame) => frame.filename,
    ),
  ).toEqual([
    undefined,
    "app:///index.android.bundle",
    "app:///entry-abcdef.hbc",
  ]);
});
