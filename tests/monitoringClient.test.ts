import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventHint } from "@sentry/react-native";

type InitOptions = Parameters<typeof import("@sentry/react-native").init>[0];

const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: InitOptions) => void>(),
  captureException: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@sentry/react-native", () => sentry);
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0" } },
}));

const publicDsn = `https://${"a".repeat(32)}@o1.ingest.sentry.io/123`;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal("__DEV__", false);
  vi.stubEnv("EXPO_PUBLIC_ERROR_REPORTING_ENABLED", "true");
  vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", publicDsn);
  vi.stubEnv("EXPO_PUBLIC_APP_ENV", "preview");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("optional monitoring client", () => {
  it.each([
    {
      name: "missing activation flag",
      flag: undefined,
      dsn: publicDsn,
      dev: false,
    },
    { name: "disabled flag", flag: "false", dsn: publicDsn, dev: false },
    { name: "missing DSN", flag: "true", dsn: undefined, dev: false },
    { name: "invalid DSN", flag: "true", dsn: "https://your-dsn", dev: false },
    { name: "development runtime", flag: "true", dsn: publicDsn, dev: true },
  ])("stays inert with $name", async ({ flag, dsn, dev }) => {
    vi.stubEnv("EXPO_PUBLIC_ERROR_REPORTING_ENABLED", flag);
    vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", dsn);
    vi.stubGlobal("__DEV__", dev);

    const client = await import("../src/lib/monitoring");
    client.reportError(new Error("A local error"), "render");
    client.setMonitoringScreen("profile/[id]");

    expect(client.monitoringConfigured).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.setTag).not.toHaveBeenCalled();
  });

  it("initializes only the private JavaScript error pipeline when enabled", async () => {
    vi.stubEnv("EXPO_PUBLIC_APP_ENV", "production");
    const client = await import("../src/lib/monitoring");

    expect(client.monitoringConfigured).toBe(true);
    expect(sentry.init).toHaveBeenCalledOnce();
    const options = sentry.init.mock.calls[0][0];
    expect(options).toMatchObject({
      dsn: publicDsn,
      environment: "production",
      enableNative: false,
      enableNativeNagger: false,
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      enableLogs: false,
      sendClientReports: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableAutoSessionTracking: false,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      enableUserInteractionTracing: false,
      enableAppHangTracking: false,
    });
    expect(options.beforeBreadcrumb?.({ message: "private text" })).toBeNull();
    expect(typeof options.integrations).toBe("function");
    if (typeof options.integrations !== "function")
      throw new Error("Missing integration filter");
    const retained = options.integrations([
      { name: "Breadcrumbs" },
      { name: "HttpContext" },
      { name: "ExpoContext" },
      { name: "MobileReplay" },
      { name: "ReactNativeErrorHandlers" },
    ]);
    expect(retained.map(({ name }) => name)).toEqual([
      "ReactNativeErrorHandlers",
      "FootNationEnvelopePrivacy",
    ]);
  });

  it("routes SDK events through the sanitizer, drops attachments and suppresses duplicate errors", async () => {
    await import("../src/lib/monitoring");
    const options = sentry.init.mock.calls[0][0];
    expect(options.environment).toBe("preview");
    const originalException = new Error("private profile text");
    const hint: EventHint = {
      originalException,
      attachments: [{ filename: "profile.txt", data: "private profile text" }],
    };
    const event = {
      message: "private profile text",
      user: { email: "private@example.test" },
      tags: { source: "render", screen: "profile/[id]" },
      exception: { values: [{ type: "Error", value: "private profile text" }] },
    };

    const result = await options.beforeSend?.(event, hint);
    expect(result).not.toBeNull();
    expect(result?.tags).toEqual({ source: "render", screen: "profile/[id]" });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(hint.attachments).toEqual([]);
    expect(await options.beforeSend?.(event, { originalException })).toBeNull();
  });

  it("reports errors with their source, replaces unknown values and tracks route templates", async () => {
    const client = await import("../src/lib/monitoring");
    const error = new TypeError("private exception text");
    client.reportError(error, "render");
    client.reportError(
      { message: "private message", token: "private token" },
      "query",
    );
    client.setMonitoringScreen("conversation/[id]");

    expect(sentry.captureException).toHaveBeenNthCalledWith(1, error, {
      tags: { source: "render" },
    });
    const replacement = sentry.captureException.mock.calls[1][0];
    expect(replacement).toBeInstanceOf(Error);
    expect(replacement.message).toBe("FootNation operation failed");
    expect(sentry.captureException.mock.calls[1][1]).toEqual({
      tags: { source: "query" },
    });
    expect(sentry.setTag).toHaveBeenCalledWith("screen", "conversation/[id]");
  });

  it("keeps the application usable and reporting inert when SDK initialization fails", async () => {
    sentry.init.mockImplementationOnce(() => {
      throw new Error("SDK unavailable");
    });
    const client = await import("../src/lib/monitoring");

    expect(client.monitoringConfigured).toBe(false);
    expect(() =>
      client.reportError(new Error("Local failure"), "mutation"),
    ).not.toThrow();
    expect(() => client.setMonitoringScreen("(tabs)/index")).not.toThrow();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.setTag).not.toHaveBeenCalled();
  });

  it("never lets a failing SDK capture or route tag break the user action", async () => {
    const client = await import("../src/lib/monitoring");
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error("Capture unavailable");
    });
    sentry.setTag.mockImplementationOnce(() => {
      throw new Error("Scope unavailable");
    });

    expect(() =>
      client.reportError(new Error("Player unavailable"), "media"),
    ).not.toThrow();
    expect(() => client.setMonitoringScreen("shorts")).not.toThrow();
  });
});
