const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const errors = [];
try {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    ["your-project.supabase.co", "configuration-required.supabase.co"].includes(
      parsed.hostname,
    )
  )
    throw new Error();
} catch {
  errors.push(
    "EXPO_PUBLIC_SUPABASE_URL : renseigner l’origine HTTPS du projet Supabase.",
  );
}
let publicKey =
  typeof key === "string" && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
if (key && !publicKey) {
  try {
    const parts = key.split(".");
    publicKey =
      parts.length === 3 &&
      parts.every(Boolean) &&
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ===
        "anon";
  } catch {}
}
if (!publicKey)
  errors.push(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY : utiliser une clé publique anon ou publishable, jamais une clé serveur.",
  );
const reporting = process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED;
if (reporting && reporting !== "true" && reporting !== "false")
  errors.push(
    "EXPO_PUBLIC_ERROR_REPORTING_ENABLED : utiliser exactement true ou false.",
  );
if (reporting === "true") {
  const environment = process.env.EXPO_PUBLIC_APP_ENV;
  if (environment !== "preview" && environment !== "production")
    errors.push(
      "EXPO_PUBLIC_APP_ENV : choisir explicitement preview ou production pour le suivi des erreurs.",
    );
  const profile = process.env.EAS_BUILD_PROFILE;
  if (
    (profile === "production" || profile === "preview") &&
    environment !== profile
  )
    errors.push(
      "EXPO_PUBLIC_APP_ENV : doit correspondre au profil EAS preview/production choisi.",
    );
  try {
    const dsn = new URL(process.env.EXPO_PUBLIC_SENTRY_DSN);
    if (
      dsn.protocol !== "https:" ||
      !/^[a-f0-9]{32}$/i.test(dsn.username) ||
      dsn.password ||
      dsn.search ||
      dsn.hash ||
      !/^\/\d+$/.test(dsn.pathname) ||
      !dsn.hostname.includes(".")
    )
      throw new Error();
  } catch {
    errors.push(
      "EXPO_PUBLIC_SENTRY_DSN : renseigner le DSN public HTTPS du projet Sentry.",
    );
  }
  for (const name of ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"]) {
    if (!process.env[name]?.trim())
      errors.push(
        `${name} : nécessaire pour rattacher les erreurs aux sources de cette build.`,
      );
  }
}
if (errors.length) {
  console.error(
    "Configuration du build FootNation incomplète :\n" + errors.join("\n"),
  );
  console.error(
    "Configurer ces variables dans l’environnement EAS du profil choisi, puis relancer.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Configuration publique du build présente (valeurs masquées). Ce contrôle ne vérifie pas l’authenticité de la clé ni l’accès réseau.",
  );
}
