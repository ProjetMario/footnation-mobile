// Disposable Web recipe. Requires the local fixture server from audit:ui.
// The production entrypoint, Supabase client and configuration are never edited.
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

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const repository = resolve(root, "..");
const fixture = await fetch("http://127.0.0.1:7082/__fixture", {
  signal: AbortSignal.timeout(3000),
});
if (!fixture.ok)
  throw new Error("Démarrer d’abord la recette Expo : npm run audit:ui");
const status = await fixture.json();
if (!Object.hasOwn(status, "scenario"))
  throw new Error("Le serveur local n’est pas un serveur de recette reconnu.");

const directory = mkdtempSync(join(tmpdir(), "footnation-web-recette-"));
for (const item of [
  "src",
  "package.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "tailwind.config.ts",
  "postcss.config.js",
])
  cpSync(join(repository, item), join(directory, item), { recursive: true });
symlinkSync(join(repository, "node_modules"), join(directory, "node_modules"));
symlinkSync(join(repository, "public"), join(directory, "public"));

// The normal development entrypoint requires analytics credentials. The isolated
// recipe neither needs analytics nor sends user activity to an external service.
writeFileSync(
  join(directory, "src/lib/posthog.ts"),
  'export default { capture() {}, identify() {}, reset() {}, get_distinct_id() { return "recette-isolee"; } };\n',
);

const clientPath = join(directory, "src/integrations/supabase/client.ts");
let client = readFileSync(clientPath, "utf8");
const replacements = [
  [
    /export const SUPABASE_URL = "[^"]+";/,
    'export const SUPABASE_URL = "http://127.0.0.1:7082";',
  ],
  [
    /export const SUPABASE_PUBLISHABLE_KEY =\s*"[^"]+";/,
    'export const SUPABASE_PUBLISHABLE_KEY = "fixture-only";',
  ],
  [/storageKey: "footnation-auth"/, 'storageKey: "footnation-web-recipe-auth"'],
];
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(client))
    throw new Error(
      "Le client Web a changé : isolation à adapter avant de lancer la recette.",
    );
  client = client.replace(pattern, replacement);
}
writeFileSync(clientPath, client);

const guard = readFileSync(
  join(root, "scripts/audit/network-guard.cjs"),
  "utf8",
)
  .replace('["8081", "7082"]', '["8081", "8083", "7082"]')
  .replace('"http://127.0.0.1:8081"', '"http://127.0.0.1:8083"')
  .replace("module.exports = { permitted, install };", "install();");
if (guard.includes("module.exports") || !guard.includes('"8083"'))
  throw new Error("Le garde réseau a changé : isolation à adapter.");
writeFileSync(join(directory, "audit-guard.js"), guard);
writeFileSync(
  join(directory, "index.html"),
  `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:7082 ws://127.0.0.1:8083 ws://localhost:8083; img-src 'self' data: blob: http://127.0.0.1:7082; media-src 'self' blob: http://127.0.0.1:7082; font-src 'self' data:; frame-src 'none'; form-action 'self'">
<title>FootNation — recette admin isolée</title><script src="/audit-guard.js"></script></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
);
writeFileSync(
  join(directory, "vite.config.ts"),
  `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:8083,strictPort:true},resolve:{alias:{'@':path.resolve(__dirname,'src')}},define:{global:'globalThis'},envDir:__dirname});
`,
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !/^(VITE_|EXPO_PUBLIC_|SUPABASE_|SENTRY_|EXPO_TOKEN)/.test(name),
  ),
);
console.log(
  `RECETTE WEB ISOLÉE — http://127.0.0.1:8083 — copie : ${directory}`,
);
const child = spawn(
  process.execPath,
  [join(repository, "node_modules/vite/bin/vite.js")],
  { cwd: directory, env, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill("SIGTERM"));
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
