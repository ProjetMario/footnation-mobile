// Read-only page openings against the isolated start-ui fixture on 8097/7097.
// This detects render crashes, not successful completion of every workflow.
import { chromium, expect } from "@playwright/test";
import { readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
const origin = "http://localhost:8097";
const routes = [...new Set(files(join(root, "app"))
  .filter((file) => /\.tsx?$/.test(file) && !/\/(?:_layout|\+[^/]+)\./.test(file))
  .map((file) => relative(join(root, "app"), file))
  .filter((file) => !file.includes("["))
  .map((file) => "/" + file.replace(/\.tsx?$/, "").split("/")
    .filter((part) => !/^\(.*\)$/.test(part) && part !== "index").join("/"))
  .filter((route) => !["/auth/callback", "/login", "/signup", "/reset-password"].includes(route)))].sort();
// Representative parameterized routes use only fixture IDs.
routes.push(
  "/profile/00000000-0000-4000-8000-000000000001",
  "/club/30000000-0000-4000-8000-000000000001",
  "/posts/10000000-0000-4000-8000-000000000001",
  "/club-admin/30000000-0000-4000-8000-000000000001",
);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (!["localhost", "127.0.0.1"].includes(url.hostname) &&
      !["data:", "blob:"].includes(url.protocol)) return route.abort();
  return route.continue();
});
const page = await context.newPage();
let currentErrors = [];
page.on("pageerror", (error) => currentErrors.push(error.message));
const outcomes = [];
try {
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("admin@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect.poll(() => page.url(), { timeout: 30000 }).not.toContain("/login");
  for (const path of routes) {
    currentErrors = [];
    try {
      await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => document.querySelector("#root")?.textContent?.trim().length > 0, null, { timeout: 12000 });
      await page.waitForTimeout(350);
      const text = await page.locator("body").innerText();
      outcomes.push({ path, destination: new URL(page.url()).pathname,
        crash: text.includes("Une erreur est survenue"),
        notFound: text.includes("Cette page est introuvable"),
        errors: [...currentErrors] });
    } catch (error) {
      outcomes.push({ path, error: String(error).slice(0, 500), errors: [...currentErrors] });
    }
    if (outcomes.length % 20 === 0) console.log(`${outcomes.length}/${routes.length} routes ouvertes`);
  }
  const failed = outcomes.filter((result) => result.crash || result.notFound || result.error || result.errors.length);
  writeFileSync("/tmp/footnation-expo-route-smoke.json", JSON.stringify({ generated: new Date().toISOString(), outcomes, failed }, null, 2));
  console.log(JSON.stringify({ opened: outcomes.length, flagged: failed.length, paths: failed.map((result) => result.path) }));
} finally {
  await browser.close();
}
