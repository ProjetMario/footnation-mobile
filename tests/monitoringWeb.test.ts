import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  load: vi.fn(),
  reportError: vi.fn(),
  setMonitoringScreen: vi.fn(),
}));
vi.mock("../src/lib/monitoringRuntime", () => {
  state.load();
  return {
    monitoringConfigured: true,
    reportError: state.reportError,
    setMonitoringScreen: state.setMonitoringScreen,
  };
});
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", false);
  vi.stubEnv("EXPO_PUBLIC_ERROR_REPORTING_ENABLED", "true");
  vi.stubEnv(
    "EXPO_PUBLIC_SENTRY_DSN",
    `https://${"a".repeat(32)}@o1.ingest.sentry.io/123`,
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each(["false", undefined])(
  "does not download the SDK when reporting is %s",
  async (flag) => {
    vi.stubEnv("EXPO_PUBLIC_ERROR_REPORTING_ENABLED", flag);
    const client = await import("../src/lib/monitoring.web");
    client.reportError(new Error("local only"), "render");
    client.setMonitoringScreen("shorts");
    await vi.dynamicImportSettled();
    expect(state.load).not.toHaveBeenCalled();
    expect(state.reportError).not.toHaveBeenCalled();
    expect(client.monitoringConfigured).toBe(false);
  },
);

it("delivers early events and the current screen through the existing privacy runtime", async () => {
  const client = await import("../src/lib/monitoring.web");
  const error = new Error("test failure");
  client.reportError(error, "render");
  client.setMonitoringScreen("shorts");
  await vi.dynamicImportSettled();
  expect(state.load).toHaveBeenCalledOnce();
  expect(client.monitoringConfigured).toBe(true);
  expect(state.reportError).toHaveBeenCalledWith(error, "render");
  expect(state.setMonitoringScreen).toHaveBeenLastCalledWith("shorts");
});
