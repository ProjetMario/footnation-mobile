import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { monitoringEnvelopePrivacyIntegration } from "./monitoringEnvelope";
import {
  createErrorLimiter,
  screenTemplate,
  sanitizeMonitoringEvent,
  validMonitoringDsn,
  type ErrorSource,
} from "./monitoringPrivacy";

const dsn = validMonitoringDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);
const enabled =
  process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED === "true" &&
  !!dsn &&
  !__DEV__;
const allow = createErrorLimiter();
export let monitoringConfigured = false;

if (enabled) {
  try {
    Sentry.init({
      dsn,
      enabled: true,
      release: `com.footnation.app@${Constants.expoConfig?.version || "1.0.0"}`,
      environment:
        process.env.EXPO_PUBLIC_APP_ENV === "production"
          ? "production"
          : "preview",
      // JS events always pass through our allowlist. Native crash payloads use
      // a separate pipeline; enable only after a native scrubber is validated.
      enableNative: false,
      enableNativeNagger: false,
      sendDefaultPii: false,
      enableLogs: false,
      sendClientReports: false,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableAutoSessionTracking: false,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      enableUserInteractionTracing: false,
      enableAppHangTracking: false,
      maxCacheItems: 20,
      integrations: (defaults) => [
        ...defaults.filter(
          (integration) =>
            ![
              "Breadcrumbs",
              "HttpContext",
              "ExpoContext",
              "MobileReplay",
            ].includes(integration.name),
        ),
        monitoringEnvelopePrivacyIntegration(),
      ],
      beforeSend: (event, hint) => {
        try {
          if (!allow(hint.originalException || event)) return null;
          hint.attachments = [];
          return sanitizeMonitoringEvent(event);
        } catch {
          return null;
        }
      },
    });
    monitoringConfigured = true;
  } catch {
    // An unavailable reporting SDK must never prevent the app from opening.
  }
}

export function reportError(error: unknown, source: ErrorSource): void {
  if (!monitoringConfigured) return;
  try {
    // Raw values, query keys and mutation variables are deliberately not sent.
    Sentry.captureException(
      error instanceof Error ? error : new Error("FootNation operation failed"),
      { tags: { source } },
    );
  } catch {
    // Monitoring must never break the user's action or its recovery screen.
  }
}

export function setMonitoringScreen(screen: string): void {
  if (!monitoringConfigured) return;
  try {
    Sentry.setTag("screen", screenTemplate(screen.split("/")));
  } catch {
    /* No effect on navigation. */
  }
}
