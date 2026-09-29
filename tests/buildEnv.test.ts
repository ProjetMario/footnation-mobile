import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
const run = (url = "", key = "") =>
  spawnSync(process.execPath, ["scripts/check-build-env.cjs"], {
    encoding: "utf8",
    env: { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key },
  });
const jwt = (role: string) =>
  `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
it("stops builds with absent or placeholder configuration", () => {
  expect(run().status).toBe(1);
  expect(
    run("https://your-project.supabase.co", "your-public-anon-key").status,
  ).toBe(1);
});
it("accepts public anon JWT and publishable key formats", () => {
  expect(run("https://example.supabase.co", jwt("anon")).status).toBe(0);
  expect(
    run("https://example.supabase.co", "sb_publishable_example").status,
  ).toBe(0);
});
it("rejects server keys without printing their value", () => {
  for (const key of [
    jwt("service_role"),
    "sb_secret_privatevalue",
    "invalid-key",
  ]) {
    const result = run("https://example.supabase.co", key);
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).not.toContain(key);
  }
});
it("rejects insecure or credential-bearing backend URLs", () => {
  for (const url of [
    "http://example.supabase.co",
    "https://user:private@example.supabase.co",
    "https://example.supabase.co/rest/v1",
    "https://example.supabase.co?key=private",
  ]) {
    const result = run(url, jwt("anon"));
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(url);
  }
});

it("requires complete Sentry build configuration only when reporting is enabled", () => {
  const vars = {
    EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_example",
    EXPO_PUBLIC_ERROR_REPORTING_ENABLED: "true",
    EXPO_PUBLIC_SENTRY_DSN: `https://${"a".repeat(32)}@o1.ingest.sentry.io/123`,
    EXPO_PUBLIC_APP_ENV: "preview",
    SENTRY_ORG: "footnation",
    SENTRY_PROJECT: "native",
    SENTRY_AUTH_TOKEN: "private-build-token",
  };
  const check = (env: typeof vars) =>
    spawnSync(process.execPath, ["scripts/check-build-env.cjs"], {
      encoding: "utf8",
      env,
    });
  expect(check(vars).status).toBe(0);
  for (const missing of [
    "EXPO_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_APP_ENV",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
  ] as const) {
    const result = check({ ...vars, [missing]: "" });
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).not.toContain(vars.SENTRY_AUTH_TOKEN);
    expect(result.stderr + result.stdout).not.toContain(
      vars.EXPO_PUBLIC_SENTRY_DSN,
    );
  }
});

it("refuses ambiguous activation or a production build classified as preview, without printing values", () => {
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_example",
    EXPO_PUBLIC_ERROR_REPORTING_ENABLED: "true",
    EXPO_PUBLIC_SENTRY_DSN: `https://${"a".repeat(32)}@o1.ingest.sentry.io/123`,
    EXPO_PUBLIC_APP_ENV: "preview",
    SENTRY_ORG: "project-org",
    SENTRY_PROJECT: "project",
    SENTRY_AUTH_TOKEN: "synthetic-private-token",
  };
  for (const extra of [
    { EXPO_PUBLIC_ERROR_REPORTING_ENABLED: "TRUE" },
    { EXPO_PUBLIC_APP_ENV: "private-typo" },
    { EAS_BUILD_PROFILE: "production" },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-build-env.cjs"],
      { encoding: "utf8", env: { ...env, ...extra } },
    );
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(env.SENTRY_AUTH_TOKEN);
    expect(result.stdout + result.stderr).not.toContain("private-typo");
  }
  expect(
    spawnSync(process.execPath, ["scripts/check-build-env.cjs"], {
      env: {
        ...env,
        EAS_BUILD_PROFILE: "production",
        EXPO_PUBLIC_APP_ENV: "production",
      },
    }).status,
  ).toBe(0);
});
