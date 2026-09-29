const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPrivatePublicValue(name, value) {
  if (!name.startsWith("EXPO_PUBLIC_") || !value) return false;
  if (/SERVICE_ROLE|SECRET|AUTH_TOKEN|PRIVATE_KEY|PASSWORD/.test(name))
    return true;
  if (value.startsWith("sb_secret_")) return true;
  try {
    return (
      JSON.parse(Buffer.from(value.split(".")[1], "base64url")).role ===
      "service_role"
    );
  } catch {
    return false;
  }
}

// Only controlled labels/statuses leave this function. Never retain env or config
// in the report: even a malformed value could be a credential.
function inspectReadiness({
  env,
  expo,
  eas,
  profile,
  buildCheckPassed,
  nodeVersion,
  fileExists,
}) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const [major, minor] = nodeVersion.split(".").map(Number);
  add(
    "node",
    major > 22 || (major === 22 && minor >= 13) ? "PASS" : "FAIL",
    "Expo 57 : Node 22.13 minimum.",
  );
  add(
    "public-build-config",
    buildCheckPassed ? "PASS" : "FAIL",
    "Configuration Supabase publique et configuration Sentry si activée ; format local uniquement, sans authentification distante.",
  );
  add(
    "public-secrets",
    Object.entries(env).some(([name, value]) =>
      isPrivatePublicValue(name, value),
    )
      ? "FAIL"
      : "PASS",
    "Aucun nom ou format connu de secret serveur dans les variables EXPO_PUBLIC_. Contrôle local partiel, pas un audit du bundle.",
  );
  const linked = UUID.test(expo.extra?.eas?.projectId || "");
  add(
    "eas-project",
    linked ? "PASS" : "FAIL",
    "extra.eas.projectId doit contenir l’UUID du projet EAS existant ; liaison et droits distants non vérifiés.",
  );
  add(
    "app-identifiers",
    expo.ios?.bundleIdentifier === "com.footnation.app" &&
      expo.android?.package === "com.footnation.app"
      ? "PASS"
      : "FAIL",
    "Identifiants iOS/Android conservés : com.footnation.app.",
  );
  const build = eas.build?.[profile];
  add(
    "eas-profile",
    build?.environment === profile ? "PASS" : "FAIL",
    "Le profil EAS choisi doit déclarer son environnement homonyme.",
  );
  const plugins = new Set(
    (expo.plugins || []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    ),
  );
  add(
    "native-plugins",
    [
      "expo-notifications",
      "expo-image-picker",
      "expo-audio",
      "@config-plugins/react-native-webrtc",
      "expo-secure-store",
    ].every((plugin) => plugins.has(plugin))
      ? "PASS"
      : "FAIL",
    "Plugins caméra, micro, notifications, WebRTC et stockage sécurisé déclarés ; compilation et permissions sur appareil à valider.",
  );
  const reporting = env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED;
  add(
    "error-monitoring",
    reporting === "true" ? (buildCheckPassed ? "PASS" : "FAIL") : "FAIL",
    "La bêta exige EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true, EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_APP_ENV et SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN côté build. Réception non vérifiée.",
  );
  const push = env.EXPO_PUBLIC_NATIVE_PUSH_ENABLED;
  add(
    "push-client",
    push === "true" ? (linked ? "PASS" : "FAIL") : "FAIL",
    "Notifications natives requises pour la bêta club. Activer EXPO_PUBLIC_NATIVE_PUSH_ENABLED uniquement après validation du worker, APNs/FCM et de la livraison réelle.",
  );
  if (push && !["true", "false"].includes(push))
    add(
      "push-flag-format",
      "FAIL",
      "EXPO_PUBLIC_NATIVE_PUSH_ENABLED doit être exactement true ou false.",
    );
  const googleServices = expo.android?.googleServicesFile;
  add(
    "android-fcm-file",
    typeof googleServices === "string" && fileExists(googleServices)
      ? "PASS"
      : "MANUAL",
    "google-services.json : vérifier le fichier Android utilisé par EAS et les credentials FCM v1. Le fichier ne prouve pas la validité des credentials.",
  );
  for (const [id, detail] of [
    [
      "backend-services",
      "Vérifier les déploiements account-deletion, native-push et message-attachment-cleanup, leurs guards, secrets et planificateurs. Ne pas activer un flag pour masquer une absence de service.",
    ],
    [
      "schema-access",
      "Confirmer migrations, RLS et accès croisés sur un environnement de recette autorisé. Aucun appel Supabase n’est effectué ici.",
    ],
    [
      "turn",
      "Vérifier call-ice-config et le relais TURN sur deux réseaux ; une fonction déployée ne prouve pas un relais opérationnel.",
    ],
    [
      "monitoring-received",
      "Vérifier erreur synthétique reçue, source symboliquée et alerte. Crashs natifs/ANR non couverts par le transport JavaScript actuel.",
    ],
    [
      "device-acceptance",
      "Installation et recette iPhone/Android : NON EXÉCUTÉES par ce contrôle. Compléter device-acceptance.csv séparément pour chaque plateforme.",
    ],
    [
      "beta-operations",
      "Confirmer modération, support, sauvegarde/restauration et coûts/limites médias avant d’élargir les clubs pilotes.",
    ],
  ])
    add(id, "MANUAL", detail);
  return {
    schemaVersion: 1,
    scope: "local-only",
    profile,
    localConfiguration: checks.some((check) => check.status === "FAIL")
      ? "BLOCKED"
      : "PASS",
    releaseDecision: "MANUAL_VALIDATION_REQUIRED",
    environmentPresence: Object.fromEntries(
      [
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY",
        "EXPO_PUBLIC_ERROR_REPORTING_ENABLED",
        "EXPO_PUBLIC_SENTRY_DSN",
        "EXPO_PUBLIC_APP_ENV",
        "SENTRY_ORG",
        "SENTRY_PROJECT",
        "SENTRY_AUTH_TOKEN",
        "EXPO_PUBLIC_NATIVE_PUSH_ENABLED",
      ].map((name) => [
        name,
        typeof env[name] === "string" && env[name].trim()
          ? "PRESENT"
          : "ABSENT",
      ]),
    ),
    checks,
  };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const profileArg = args.find((arg) => arg.startsWith("--profile="));
  const profile = profileArg?.slice("--profile=".length) || "preview";
  if (
    !["preview", "production"].includes(profile) ||
    args.some((arg) => arg !== "--json" && arg !== profileArg)
  ) {
    console.error(
      "Usage : node scripts/release-preflight.cjs [--profile=preview|production] [--json]",
    );
    process.exitCode = 2;
    return;
  }
  const projectRoot = path.resolve(__dirname, "..");
  try {
    // Match Expo dotenv precedence, silently; inherited EAS variables win.
    const env = { ...process.env };
    require("@expo/env").loadProjectEnv(projectRoot, {
      mode: "production",
      systemEnv: env,
      silent: true,
    });
    const configEnv = { ...env, EAS_BUILD_PROFILE: profile };
    // Resolve the real dynamic config in a child: its stdout is private input,
    // not displayed. Do not send secrets to another service or create a build.
    const config = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify(require('@expo/config').getConfig(process.cwd(), {isPublicConfig:true}).exp))",
      ],
      {
        cwd: projectRoot,
        env: configEnv,
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (config.status !== 0) throw new Error("config");
    const expo = JSON.parse(config.stdout);
    const eas = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "eas.json"), "utf8"),
    );
    const buildCheck = spawnSync(
      process.execPath,
      [path.join(__dirname, "check-build-env.cjs")],
      {
        cwd: projectRoot,
        env: configEnv,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    const report = inspectReadiness({
      env: configEnv,
      expo,
      eas,
      profile,
      buildCheckPassed: buildCheck.status === 0,
      nodeVersion: process.versions.node,
      fileExists: (file) => fs.existsSync(path.resolve(projectRoot, file)),
    });
    report.checkedAt = new Date().toISOString();
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        "FootNation — préparation locale de la bêta (valeurs masquées)",
      );
      for (const check of report.checks)
        console.log(`[${check.status}] ${check.id}: ${check.detail}`);
      console.log(
        `Configuration locale : ${report.localConfiguration}. Validation sur appareils et services toujours requise.`,
      );
    }
    process.exitCode = report.localConfiguration === "PASS" ? 0 : 1;
  } catch {
    // Configuration tools may put credential-bearing values in exceptions.
    const error = {
      scope: "local-only",
      localConfiguration: "BLOCKED",
      error:
        "Lecture de configuration impossible ; vérifier les dépendances locales et les fichiers Expo/EAS. Aucun détail sensible affiché.",
    };
    console.error(json ? JSON.stringify(error) : error.error);
    process.exitCode = 1;
  }
}

module.exports = { inspectReadiness };
if (require.main === module) main();
