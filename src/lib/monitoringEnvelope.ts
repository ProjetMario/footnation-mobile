import type { Envelope, Integration } from "@sentry/core";
import type { ErrorEvent } from "@sentry/react-native";
import {
  createErrorLimiter,
  sanitizeMonitoringEvent,
} from "./monitoringPrivacy";

/**
 * Final privacy boundary. Sentry's internal pipeline errors bypass beforeSend,
 * and envelope creation can append SDK metadata and attachment items afterwards.
 * Never send these through the raw SDK event/attachment path.
 */
export function sanitizeMonitoringEnvelope(envelope: Envelope): void {
  const errors: [{ type: "event" }, ErrorEvent][] = [];
  try {
    for (const [header, payload] of envelope[1]) {
      if (
        header.type !== "event" ||
        !payload ||
        typeof payload !== "object" ||
        payload instanceof Uint8Array
      )
        continue;
      const event = sanitizeMonitoringEvent(payload as ErrorEvent);
      // SDK-created event IDs are mandatory at this last boundary. An invalid
      // payload is discarded without interpolating its contents in an error.
      if (event.event_id) errors.push([{ type: "event" }, event]);
      if (errors.length === 1) break;
    }
  } catch {
    errors.length = 0;
  }
  // Rebuild headers too: dynamic sampling context can include user segments,
  // release strings and public keys that were not part of beforeSend's event.
  envelope[0] = {
    event_id: errors[0]?.[1].event_id,
    sent_at: new Date().toISOString(),
  };
  envelope[1] = errors;
}
export function monitoringEnvelopePrivacyIntegration(): Integration {
  // Internal SDK errors also bypass the beforeSend rate limiter. A second
  // counter caps the final output, including those internal reports.
  const allow = createErrorLimiter();
  return {
    name: "FootNationEnvelopePrivacy",
    afterAllSetup(client) {
      client.on("beforeEnvelope", (envelope) => {
        sanitizeMonitoringEnvelope(envelope);
        if (envelope[1].length && !allow(envelope[1][0][1])) envelope[1] = [];
        // The SDK's standard JS transport skips empty envelopes entirely.
      });
    },
  };
}
