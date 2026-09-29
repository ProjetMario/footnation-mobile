const { spawnSync } = require("node:child_process");
const path = require("node:path");

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--code-only")) {
  console.error("Usage : node scripts/release-verify.cjs [--code-only]");
  process.exit(2);
}
const projectRoot = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  ["TypeScript", ["run", "typecheck"]],
  ["Interfaces natives", ["run", "check:native"]],
  ["Tests cœur", ["run", "test:core"]],
  ["Tests applicatifs", ["run", "test:calls"]],
  ["Contrôles de préparation", ["run", "test:release"]],
  ...(!args.includes("--code-only")
    ? [["Préparation de la bêta", ["run", "release:preflight"]]]
    : []),
];
const results = [];
for (const [name, command] of steps) {
  console.log(`\nFootNation — ${name}`);
  const result = spawnSync(npm, command, {
    cwd: projectRoot,
    stdio: "inherit",
    timeout: 10 * 60 * 1000,
    env: { ...process.env, CI: "1" },
  });
  const passed = result.status === 0 && !result.error;
  results.push({ name, passed });
  if (result.signal === "SIGINT" || result.signal === "SIGTERM")
    process.exit(130);
}
console.log("\nBilan des contrôles locaux");
for (const result of results)
  console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
console.log(
  "Aucun déploiement, migration, envoi de message, export ni build natif exécuté. Ce bilan ne valide pas les appareils ni les services distants.",
);
process.exitCode = results.every((result) => result.passed) ? 0 : 1;
