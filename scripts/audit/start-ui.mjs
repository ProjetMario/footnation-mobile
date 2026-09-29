// A disposable copy: no fixture code, session or configuration enters release builds.
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createFixtureServer } from "../ux-fixture-server.mjs";
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const webPort = Number(process.env.AUDIT_WEB_PORT || 8081);
const apiPort = Number(process.env.AUDIT_API_PORT || 7082);
if (
  ![webPort, apiPort].every(
    (p) => Number.isInteger(p) && p >= 1024 && p <= 65535,
  ) ||
  webPort === apiPort
) {
  throw new Error("Deux ports locaux valides et distincts sont nécessaires.");
}
const directory = mkdtempSync(join(tmpdir(), "footnation-recette-"));
for (const item of [
  "app",
  "src",
  "assets",
  "app.json",
  "app.config.js",
  "tsconfig.json",
])
  cpSync(join(root, item), join(directory, item), { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(directory, "package.json"),
  JSON.stringify({ ...pkg, main: "audit-entry.js" }),
);
symlinkSync(join(root, "node_modules"), join(directory, "node_modules"));
cpSync(
  join(root, "scripts/audit/network-guard.cjs"),
  join(directory, "audit-guard.cjs"),
);
writeFileSync(
  join(directory, "audit-entry.js"),
  `require("./audit-guard.cjs").install(globalThis, ${JSON.stringify([String(webPort), String(apiPort)])});\nrequire("expo-router/entry");\n`,
);
writeFileSync(
  join(directory, "metro.config.js"),
  `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Asset modules contain paths relative to this disposable project. Never reuse
// their transforms from a previous copy whose directory may have been removed.
config.cacheVersion = __dirname;
config.watchFolders = [${JSON.stringify(join(root, "node_modules"))}];
config.resolver.nodeModulesPaths = [${JSON.stringify(join(root, "node_modules"))}];
module.exports = config;\n`,
);
// Distinct sessions ensure a real stored session can never be refreshed against the mock.
const clientFile = join(directory, "src/lib/supabase.ts");
writeFileSync(
  clientFile,
  readFileSync(clientFile, "utf8").replace(
    '"footnation-native-auth"',
    '"footnation-recipe-auth"',
  ),
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^(EXPO_PUBLIC_|SUPABASE_|SENTRY_|EXPO_TOKEN)/.test(name),
  ),
);
Object.assign(env, {
  EXPO_NO_DOTENV: "1",
  CI: "1",
  EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "fixture-only",
  EXPO_PUBLIC_ERROR_REPORTING_ENABLED: "false",
  EXPO_PUBLIC_NATIVE_PUSH_ENABLED: "false",
  EXPO_PUBLIC_GOOGLE_AUTH_ENABLED:
    process.env.AUDIT_SOCIAL_AUTH === "1" ? "true" : "false",
  EXPO_PUBLIC_APPLE_AUTH_ENABLED:
    process.env.AUDIT_SOCIAL_AUTH === "1" ? "true" : "false",
});
const server = createFixtureServer({
  liveMatches: process.env.AUDIT_LIVE_MATCHES === "1",
  socialAuth: process.env.AUDIT_SOCIAL_AUTH === "1",
  superAdmin: process.env.AUDIT_SUPER_ADMIN === "1",
});
server.on("error", (error) => {
  console.error("Impossible de démarrer les fixtures :", error.code);
  process.exitCode = 1;
});
server.listen(apiPort, "127.0.0.1", () => {
  console.log(
    `RECETTE ISOLÉE — http://localhost:${webPort} — copie : ${directory}`,
  );
  console.log(
    "Comptes : player/coach/club/admin@fixture.test ; mot de passe fictif au choix. Aucune donnée réelle.",
  );
  const child = spawn(
    process.execPath,
    [
      join(root, "node_modules/expo/bin/cli"),
      "start",
      "--web",
      "--localhost",
      "--port",
      String(webPort),
    ],
    { cwd: directory, env, stdio: "inherit" },
  );
  const stop = () => child.kill("SIGTERM");
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  child.on("exit", (code) => {
    server.close();
    process.exitCode = code || 0;
  });
});
