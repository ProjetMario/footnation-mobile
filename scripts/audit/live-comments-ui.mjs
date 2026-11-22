// Isolated live fixture only. No real users, streams, messages or network calls.
import { chromium, expect } from "@playwright/test";

const api = "http://127.0.0.1:7097";
const streamId = "90000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000003";
const auth = await fetch(`${api}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: "fixture-only" },
  body: JSON.stringify({ email: "admin@fixture.test", password: "fixture-password" }),
});
const session = await auth.json();
if (!session.access_token) throw new Error("Session fictive indisponible.");
const seed = await fetch(`${api}/rest/v1/live_stream_comments`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: "fixture-only",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify(Array.from({ length: 6 }, (_, index) => ({
    stream_id: streamId,
    user_id: userId,
    body: `Commentaire fictif ${index + 1}`,
  }))),
});
if (!seed.ok) throw new Error("Impossible de préparer les commentaires fictifs.");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.addInitScript((account) => {
  localStorage.setItem(`footnation:first-login-onboarding:v1:${account}`, "seen");
  localStorage.setItem(`footnation:invitation-prompt-until:v1:${account}`, String(Date.now() + 86_400_000));
}, userId);
let rejectFirstSend = true;
await context.route("**/*", (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (!["localhost", "127.0.0.1"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) return route.abort();
  if (url.pathname === "/rest/v1/live_stream_comments" && request.method() === "POST" && rejectFirstSend) {
    rejectFirstSend = false;
    return route.fulfill({
      status: 503,
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { code: "FIXTURE_ERROR", message: "Envoi fictif interrompu" },
    });
  }
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function tap(locator) {
  await expect(locator).toBeVisible({ timeout: 30000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Cible tactile indisponible.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto("http://localhost:8097/login", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("admin@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect.poll(() => page.url(), { timeout: 30000 }).not.toContain("/login");
  await page.goto(`http://localhost:8097/live/watch/${streamId}`, { waitUntil: "domcontentloaded" });
  await tap(page.getByRole("button", { name: "Voir les commentaires", exact: true }));
  await expect(page.getByText("Commentaires du live", { exact: true })).toBeVisible();
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByText(`Commentaire fictif ${i}`, { exact: false }).last()).toBeAttached({ timeout: 30000 });
  }
  const input = page.getByLabel("Message du live", { exact: true }).last();
  await input.pressSequentially("Essai conservé", { delay: 10 });
  await tap(page.getByRole("button", { name: "Envoyer le message", exact: true }).last());
  await expect(page.getByText("Envoi impossible. Ton message est conservé.", { exact: true }).last()).toBeVisible({ timeout: 30000 });
  await expect(input).toHaveValue("Essai conservé");
  await tap(page.getByRole("button", { name: "Envoyer le message", exact: true }).last());
  await expect(input).toHaveValue("", { timeout: 30000 });
  await expect(page.getByText("Essai conservé", { exact: false }).last()).toBeVisible({ timeout: 30000 });
  await tap(page.getByRole("button", { name: "Fermer les commentaires", exact: true }).last());
  await expect(page.getByText("Commentaires du live", { exact: true })).not.toBeVisible();
  expect(errors).toEqual([]);
  console.log("Commentaires du live : ouverture, liste, échec, conservation du texte et nouvel envoi vérifiés en recette Web isolée.");
} finally {
  await browser.close();
}
