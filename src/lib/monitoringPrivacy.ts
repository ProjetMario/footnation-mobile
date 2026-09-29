import type { ErrorEvent, StackFrame } from "@sentry/react-native";

export type ErrorSource =
  | "render"
  | "query"
  | "mutation"
  | "media"
  | "auth"
  | "member-access"
  | "unhandled";
const sources: ErrorSource[] = [
  "render",
  "query",
  "mutation",
  "media",
  "auth",
  "member-access",
  "unhandled",
];
const errorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "AggregateError",
]);

export function validMonitoringDsn(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512) return;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !/^[a-f0-9]{32}$/i.test(url.username) ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/\d+$/.test(url.pathname) ||
      !url.hostname.includes(".")
    )
      return;
    return value;
  } catch {
    return;
  }
}

export function screenTemplate(segments: readonly string[]): string {
  // useSegments returns route file names, including [id], never resolved params.
  const value = segments.join("/") || "(tabs)/index";
  return value.length <= 120 && /^[a-zA-Z0-9_()[\]/.-]+$/.test(value)
    ? value
    : "unknown";
}

function safeFilename(value?: string): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  const raw = value.split(/[?#]/)[0].split("/").pop();
  // Release bundles only. An arbitrary file basename may itself contain an
  // account identifier; source paths are recovered from uploaded source maps.
  return raw &&
    /^(?:(?:main|index|entry)(?:\.(?:android|ios))?\.(?:js|bundle|jsbundle)|entry-[a-f0-9]{2,64}\.(?:js|hbc))$/i.test(
      raw,
    )
    ? `app:///${raw}`
    : undefined;
}

function safeFrame(frame: StackFrame): StackFrame {
  return {
    filename: safeFilename(frame.filename),
    lineno:
      Number.isSafeInteger(frame.lineno) && frame.lineno! >= 0
        ? frame.lineno
        : undefined,
    colno:
      Number.isSafeInteger(frame.colno) && frame.colno! >= 0
        ? frame.colno
        : undefined,
    in_app: typeof frame.in_app === "boolean" ? frame.in_app : undefined,
  };
}

// Rebuild an allowlisted JS event instead of attempting to redact arbitrary data.
// No account, request, query values, console history, message text or attachments.
export function sanitizeMonitoringEvent(
  event: Omit<ErrorEvent, "type">,
): ErrorEvent {
  const source = sources.includes(event.tags?.source as ErrorSource)
    ? (event.tags!.source as ErrorSource)
    : "unhandled";
  const screen =
    typeof event.tags?.screen === "string"
      ? screenTemplate(event.tags.screen.split("/"))
      : "unknown";
  return {
    type: undefined,
    event_id:
      typeof event.event_id === "string" &&
      /^[a-f0-9]{32}$/i.test(event.event_id)
        ? event.event_id
        : undefined,
    timestamp:
      typeof event.timestamp === "number" &&
      Number.isFinite(event.timestamp) &&
      event.timestamp >= 0
        ? event.timestamp
        : undefined,
    platform: "javascript",
    level: event.level === "fatal" ? "fatal" : "error",
    release:
      event.release &&
      /^com\.footnation\.app@[\w.+-]{1,50}$/.test(event.release)
        ? event.release
        : undefined,
    dist:
      event.dist && /^[\w.-]{1,30}$/.test(event.dist) ? event.dist : undefined,
    environment: event.environment === "production" ? "production" : "preview",
    sdk: {
      name: "sentry.javascript.react-native",
      version:
        event.sdk?.version &&
        /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(event.sdk.version)
          ? event.sdk.version
          : undefined,
      settings: { infer_ip: "never" },
    },
    debug_meta: {
      images: event.debug_meta?.images
        ?.filter(
          (image) =>
            image.type === "sourcemap" &&
            /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
              image.debug_id || "",
            ) &&
            !!safeFilename(image.code_file),
        )
        .slice(0, 40)
        .map((image) => ({
          type: "sourcemap",
          debug_id: image.debug_id,
          code_file: safeFilename(image.code_file)!,
        })),
    },
    tags: { source, screen },
    exception: {
      values: event.exception?.values?.slice(0, 3).map((exception) => ({
        type: errorTypes.has(exception.type || "") ? exception.type : "Error",
        value: `FootNation ${source} error`,
        mechanism: exception.mechanism
          ? {
              type: "generic",
              handled:
                typeof exception.mechanism.handled === "boolean"
                  ? exception.mechanism.handled
                  : undefined,
            }
          : undefined,
        stacktrace: exception.stacktrace
          ? { frames: exception.stacktrace.frames?.slice(-40).map(safeFrame) }
          : undefined,
      })) || [{ type: "Error", value: `FootNation ${source} error` }],
    },
  };
}

export function isExpectedConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return (
    candidate.name === "OfflineError" ||
    candidate.name === "AbortError" ||
    (typeof candidate.message === "string" &&
      /^(Network request failed|Failed to fetch|Load failed)$/i.test(
        candidate.message,
      ))
  );
}

export function createErrorLimiter(now: () => number = Date.now) {
  let start = now(),
    count = 0;
  const seen = new WeakSet<object>();
  return (error: unknown) => {
    const time = now();
    if (time - start >= 60_000) {
      start = time;
      count = 0;
    }
    if (count >= 20 || isExpectedConnectivityError(error)) return false;
    if (error && typeof error === "object") {
      if (seen.has(error)) return false;
      seen.add(error);
    }
    count++;
    return true;
  };
}
