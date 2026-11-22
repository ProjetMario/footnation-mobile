// Opt-in supporters fixture only; no real accounts or writes.
import { chromium, expect } from "@playwright/test";

const origin = "http://localhost:8097";
const api = "http://127.0.0.1:7097";
const auth = await fetch(`${api}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: "fixture-only" },
  body: JSON.stringify({ email: "player@fixture.test", password: "fixture-password" }),
});
const fixtureSession = await auth.json();
if (!fixtureSession.access_token) throw new Error("Session fictive indisponible.");
await fetch(`${api}/rest/v1/rpc/supporter_leave_group`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: "fixture-only", Authorization: `Bearer ${fixtureSession.access_token}` },
  body: JSON.stringify({ p_group_id: "94000000-0000-4000-8000-000000000001" }),
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return ["localhost", "127.0.0.1"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)
    ? route.continue() : route.abort();
});
const page = await context.newPage();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
async function tap(name) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible({ timeout: 30000 });
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (!box) throw new Error("Cible tactile indisponible.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("player@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect.poll(() => page.url(), { timeout: 30000 }).not.toContain("/login");
  await page.goto(`${origin}/supporters/94000000-0000-4000-8000-000000000001`, { waitUntil: "domcontentloaded" });
  await tap("Rejoindre le groupe");
  await expect(page.getByText("Vous faites partie du groupe", { exact: true })).toBeVisible();
  await tap("Quitter");
  await expect(page.getByText("Quitter ce groupe ?", { exact: true })).toBeVisible();
  await tap("Revenir");
  await expect(page.getByText("Vous faites partie du groupe", { exact: true })).toBeVisible();
  await tap("Quitter");
  await tap("Confirmer");
  await expect(page.getByRole("button", { name: "Rejoindre le groupe", exact: true })).toBeVisible();
  expect(failures).toEqual([]);
  console.log("La fenêtre de confirmation du groupe fonctionne dans la recette Web isolée.");
} finally {
  await browser.close();
}
