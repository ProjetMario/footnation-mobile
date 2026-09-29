import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const instructions = [];
const add = (line) => instructions.push(line);

function assert(condition, message) {
  add(`${condition ? "✅" : "❗"} ${message}`);
  return condition;
}

const root = path.resolve(import.meta.dirname, "..");
const env = { ...process.env };

let hasLocalConfig = false;
try {
  const { loadProjectEnv } = await import("@expo/env");
  await loadProjectEnv(root, { mode: "production", silent: true, systemEnv: env });
  hasLocalConfig = true;
} catch {
  hasLocalConfig = false;
}

const getProjectId = () => {
  const cfg = spawnSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(JSON.stringify(require('@expo/config').getConfig(process.cwd(), {isPublicConfig:true}).exp.extra?.eas?.projectId || null))",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 20_000,
      env,
    },
  );
  if (cfg.status !== 0) return null;
  const value = cfg.stdout.trim();
  return value && value !== "null" ? value : null;
};

const projectId = getProjectId();
const pushEnabled = process.env.EXPO_PUBLIC_NATIVE_PUSH_ENABLED === "true";
const hasEasConfig = projectId && /^[0-9a-f-]{36}$/i.test(projectId);
const hasSecretHint = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

add("Plan de lancement pilote FootNation");
add("1) Vérifier la recette locale");
assert(hasLocalConfig, "Variables locales chargées dans l’environnement");
add("2) Build preview");
add("   - npx eas build --platform ios --profile preview");
add("   - npx eas build --platform android --profile preview");
assert(
  hasEasConfig,
  "extra.eas.projectId présent dans la config Expo (identifiant EAS connu)",
);
assert(
  hasLocalConfig && process.env.EXPO_PUBLIC_SUPABASE_URL,
  "EXPO_PUBLIC_SUPABASE_URL présent",
);
assert(
  hasLocalConfig && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  "EXPO_PUBLIC_SUPABASE_ANON_KEY présent",
);
add("3) Préparer les serveurs");
add("   - déployer native-push, account-deletion et message-attachment-cleanup sur Supabase");
add(`   - valider NATIVE_PUSH_PROJECT_ID avec l'UUID EAS ${projectId || "<à renseigner>"}`);
add(
  `   - vérification active du worker push : EXPO_NATIVE_PUSH_ENABLED=${pushEnabled ? "true" : "false"}`,
);
add("4) Exécuter le worker push");
add("   - appeler l’endpoint natif push depuis votre planificateur sécurisé (Bearer secret dédié)");
assert(
  hasSecretHint,
  "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY disponibles pour les fonctions serveurs",
);
add("5) Tests appareils réels");
add("   - installer les builds preview sur Android et iPhone");
add(
  "   - tester inscription, connexion, notification, clic, convocation, message et déconnexion",
);

const outputPath = path.join(root, "docs", "pilot-launch-plan.txt");
const out = instructions.join("\n") + "\n";
writeFileSync(outputPath, out);
console.log(out);
process.exitCode = 0;

