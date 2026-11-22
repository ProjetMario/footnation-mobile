import { validMonitoringDsn, type ErrorSource } from "./monitoringPrivacy";

// Optional diagnostics must not make every visitor download the reporting SDK.
// Native builds retain synchronous initialization; web loads it only when enabled.
const enabled =
  process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED === "true" &&
  !!validMonitoringDsn(process.env.EXPO_PUBLIC_SENTRY_DSN) &&
  !__DEV__;
type Runtime = typeof import("./monitoringRuntime");
let runtime: Runtime | undefined;
let screen: string | undefined;
let loadingFailed = false;
const pending: { error: unknown; source: ErrorSource }[] = [];
export let monitoringConfigured = false;

if (enabled) {
  void import("./monitoringRuntime")
    .then((loaded) => {
      runtime = loaded;
      monitoringConfigured = loaded.monitoringConfigured;
      if (screen) loaded.setMonitoringScreen(screen);
      // The existing runtime still applies its privacy allowlist and rate limit.
      for (const event of pending.splice(0))
        loaded.reportError(event.error, event.source);
    })
    .catch(() => {
      loadingFailed = true;
      pending.length = 0;
    });
}

export function reportError(error: unknown, source: ErrorSource): void {
  if (!enabled || loadingFailed) return;
  if (runtime) runtime.reportError(error, source);
  else if (pending.length < 5) pending.push({ error, source });
}

export function setMonitoringScreen(value: string): void {
  if (!enabled || loadingFailed) return;
  screen = value;
  runtime?.setMonitoringScreen(value);
}
