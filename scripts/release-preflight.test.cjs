const { test } = require("node:test");
const assert = require("node:assert/strict");
const { inspectReadiness } = require("./release-preflight.cjs");

function fixture(overrides = {}) {
  return {
    env: {
      EXPO_PUBLIC_NATIVE_PUSH_ENABLED: "true",
      EXPO_PUBLIC_ERROR_REPORTING_ENABLED: "true",
    },
    expo: {
      extra: { eas: { projectId: "12345678-1234-4234-a234-123456789abc" } },
      ios: { bundleIdentifier: "com.footnation.app" },
      android: {
        package: "com.footnation.app",
        googleServicesFile: "./synthetic.json",
      },
      plugins: [
        "expo-notifications",
        "expo-image-picker",
        "expo-audio",
        "@config-plugins/react-native-webrtc",
        "expo-secure-store",
      ],
    },
    eas: {
      build: {
        preview: { environment: "preview" },
        production: { environment: "production" },
      },
    },
    profile: "preview",
    buildCheckPassed: true,
    nodeVersion: "22.13.0",
    fileExists: () => true,
    ...overrides,
  };
}

test("local success never certifies deployment or physical devices", () => {
  const report = inspectReadiness(fixture());
  assert.equal(report.localConfiguration, "PASS");
  assert.equal(report.releaseDecision, "MANUAL_VALIDATION_REQUIRED");
  assert.equal(
    report.checks.find((c) => c.id === "device-acceptance").status,
    "MANUAL",
  );
});

test("unlinked project and disabled observability/push block the club beta", () => {
  const report = inspectReadiness(fixture({ env: {}, expo: {} }));
  assert.equal(report.localConfiguration, "BLOCKED");
  for (const id of ["eas-project", "error-monitoring", "push-client"]) {
    assert.equal(report.checks.find((c) => c.id === id).status, "FAIL");
  }
});

test("Node minimum, build validation and EAS environment are enforced", () => {
  for (const overrides of [
    { nodeVersion: "22.12.9" },
    { buildCheckPassed: false },
    { eas: { build: { preview: { environment: "production" } } } },
  ]) {
    assert.equal(
      inspectReadiness(fixture(overrides)).localConfiguration,
      "BLOCKED",
    );
  }
  assert.equal(
    inspectReadiness(fixture({ nodeVersion: "24.0.0" })).localConfiguration,
    "PASS",
  );
});

test("accidental server secrets in public variables fail without disclosure", () => {
  const secrets = [
    ["EXPO_PUBLIC_SERVER_SECRET", "credential-synthetic-private"],
    ["EXPO_PUBLIC_UNKNOWN", "sb_secret_synthetic-private"],
    [
      "EXPO_PUBLIC_UNKNOWN",
      `head.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
    ],
  ];
  for (const [name, value] of secrets) {
    const input = fixture();
    input.env[name] = value;
    const report = inspectReadiness(input);
    assert.equal(
      report.checks.find((c) => c.id === "public-secrets").status,
      "FAIL",
    );
    assert.equal(JSON.stringify(report).includes(value), false);
  }
});

test("sensitive config and env values are never part of the report", () => {
  const input = fixture();
  input.env.SENTRY_AUTH_TOKEN = "synthetic-private-build-token";
  input.env.TURN_SHARED_SECRET = "synthetic-private-relay-secret";
  input.expo.extra.arbitrary = "synthetic-private-extra";
  const output = JSON.stringify(inspectReadiness(input));
  assert.equal(output.includes("synthetic-private"), false);
});

test("ambiguous push flag fails; an absent EAS file remains an explicit manual check", () => {
  const input = fixture({ fileExists: () => false });
  input.env.EXPO_PUBLIC_NATIVE_PUSH_ENABLED = "TRUE";
  const report = inspectReadiness(input);
  assert.equal(
    report.checks.find((c) => c.id === "push-flag-format").status,
    "FAIL",
  );
  assert.equal(
    report.checks.find((c) => c.id === "android-fcm-file").status,
    "MANUAL",
  );
});
