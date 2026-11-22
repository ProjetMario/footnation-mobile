// Run after FOOTNATION_FIXTURE_SUPPORTERS=1 node scripts/audit/start-ui.mjs.
// Only loopback fixture accounts/data are used; no real message is published.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const web = `http://localhost:${process.env.AUDIT_WEB_PORT || 8097}`;
const api = `http://127.0.0.1:${process.env.AUDIT_API_PORT || 7097}`;
const output = process.env.AUDIT_SUPPORTERS_OUTPUT || "/tmp/footnation-supporters-ui";
const fixture = await fetch(`${api}/__fixture/supporters`);
if (!fixture.ok) throw new Error("Start the opt-in Supporters fixture server first.");
mkdirSync(output, { recursive: true });
const group = "94000000-0000-4000-8000-000000000001";
// Idempotent setup when a preceding assertion interrupted a test run.
const loginResponse = await fetch(`${api}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { "Content-Type": "application/json", apikey: "fixture-only" },
  body: JSON.stringify({ email: "player@fixture.test", password: "fixture-password" }),
});
const fixtureSession = await loginResponse.json();
if (!fixtureSession.access_token) throw new Error("Fixture session unavailable.");
await fetch(`${api}/rest/v1/rpc/supporter_leave_group`, {
  method: "POST", headers: { "Content-Type": "application/json", apikey: "fixture-only", Authorization: `Bearer ${fixtureSession.access_token}` },
  body: JSON.stringify({ p_group_id: group }),
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const results = [];
const runId = Date.now();
async function pageFor(viewport) {
  const context = await browser.newContext({ viewport });
  // All app network traffic stays within the disposable local recipe.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(20000);
  return page;
}
async function go(page, path) {
  await page.goto(web + path, { waitUntil: "domcontentloaded", timeout: 90000 });
}
async function type(page, label, value) {
  const field = page.getByRole("textbox", { name: label, exact: true });
  await field.fill("");
  await field.pressSequentially(value, { delay: 15 });
  await expect(field).toHaveValue(value);
}
async function login(page, account) {
  await type(page, "Adresse e-mail", `${account}@fixture.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/supporters/${group}(?:\\?.*)?$`));
  const inviteClose = page.getByRole("button", { name: "Fermer l’invitation" });
  if (await inviteClose.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false)) await inviteClose.click();
}
try {
  const mobile = await pageFor({ width: 390, height: 844 });
  await go(mobile, "/supporters");
  await expect.poll(() => mobile.getByRole("button", { name: /^Découvrir / }).count()).toBeGreaterThanOrEqual(3);
  await mobile.screenshot({ path: `${output}/directory-mobile.png` });
  await type(mobile, "Ton club", "Paris");
  await type(mobile, "Ta ville", "Montpellier");
  await mobile.getByRole("button", { name: "Trouver des supporters", exact: true }).click();
  await expect(mobile.getByRole("button", { name: /^Découvrir / })).toHaveCount(1);
  await mobile.getByRole("button", { name: /^Découvrir Paris ensemble/ }).click();
  await mobile.getByRole("tab", { name: "Discussions" }).click();
  await expect(mobile.getByText("Une discussion entre supporters", { exact: true })).toBeVisible();
  await expect(mobile.getByLabel("Votre message", { exact: true })).toHaveCount(0);
  await mobile.getByRole("button", { name: "Se connecter pour rejoindre" }).click();
  await login(mobile, "player");
  await mobile.getByRole("button", { name: "Rejoindre le groupe", exact: true }).click();
  await expect(mobile.getByText("Vous faites partie du groupe", { exact: true }).filter({ visible: true })).toBeVisible();
  await mobile.getByRole("tab", { name: "Discussions" }).click();
  await type(mobile, "Votre message", "On se retrouve avant le match ? Recette locale.");
  await mobile.getByRole("button", { name: "Publier le message" }).click();
  await expect(mobile.getByText("On se retrouve avant le match ? Recette locale.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(mobile.getByLabel("Votre message", { exact: true })).toHaveValue("");
  await mobile.screenshot({ path: `${output}/discussion-mobile.png` });
  await mobile.getByRole("tab", { name: "Rendez-vous" }).click();
  await mobile.getByRole("button", { name: "Je participe", exact: true }).first().click();
  await expect(mobile.getByRole("button", { name: "Annuler ma participation" })).toHaveCount(1);
  await mobile.getByRole("button", { name: "Annuler ma participation" }).click();
  await expect(mobile.getByRole("button", { name: "Annuler ma participation" })).toHaveCount(0);
  await mobile.getByRole("button", { name: "Quitter", exact: true }).click();
  await mobile.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(mobile.getByRole("button", { name: "Rejoindre le groupe", exact: true })).toBeVisible();
  await mobile.getByRole("tab", { name: "Discussions" }).click();
  await expect(mobile.getByLabel("Votre message", { exact: true })).toHaveCount(0);
  results.push("mobile: public discovery/filters, member-only discussion, auth return, join, message, RSVP/cancel, leave");

  const desktop = await pageFor({ width: 1440, height: 1000 });
  await go(desktop, "/supporters");
  await expect.poll(() => desktop.getByRole("button", { name: /^Découvrir / }).count()).toBeGreaterThanOrEqual(3);
  await desktop.screenshot({ path: `${output}/directory-desktop.png` });
  await go(desktop, `/login?next=/supporters/${group}`);
  await login(desktop, "coach");
  await expect(desktop.getByText("Vous organisez cette communauté", { exact: true })).toBeVisible();
  await desktop.getByRole("button", { name: "Organiser un rendez-vous", exact: true }).first().click();
  const meetupTitle = `Rendez-vous de recette ${runId}`;
  await type(desktop, "Titre", meetupTitle);
  await desktop.getByRole("button", { name: "Mois suivant" }).click();
  await desktop.getByRole("button", { name: "Choisir le 15", exact: true }).click();
  await type(desktop, "Date et heure du rendez-vous heure", "20:30");
  const hour = desktop.getByLabel("Date et heure du rendez-vous heure");
  await hour.press("End"); await hour.press("Backspace"); await hour.pressSequentially("5");
  await expect(hour).toHaveValue("20:35");
  await type(desktop, "Lieu du rendez-vous", "Café de recette uniquement");
  await type(desktop, "Nombre de places (facultatif)", "8");
  await desktop.setViewportSize({ width: 320, height: 900 });
  expect(await desktop.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await desktop.screenshot({ path: `${output}/meetup-form-mobile.png` });
  await desktop.setViewportSize({ width: 1440, height: 1000 });
  await desktop.getByRole("button", { name: "Publier le rendez-vous" }).click();
  await expect(desktop.getByText(meetupTitle, { exact: true })).toBeVisible();
  await desktop.screenshot({ path: `${output}/group-desktop.png` });
  results.push("desktop: discovery, organiser auth, meetup creation and sequential date/time typing");
  for (const width of [320, 768]) {
    await desktop.setViewportSize({ width, height: 900 });
    const overflow = await desktop.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow, `no horizontal overflow at ${width}px`).toBe(false);
  }
  results.push("responsive: no document overflow at 320px/768px");
  await go(desktop, "/supporters/new");
  const groupName = `Supporters recette ${runId}`;
  await type(desktop, "Nom du groupe *", groupName);
  await type(desktop, "Club soutenu *", "Club de recette");
  await type(desktop, "Ville *", "Nancy");
  await desktop.getByRole("button", { name: "Créer mon groupe" }).click();
  await expect(desktop.getByText(groupName, { exact: true })).toBeVisible();
  await expect(desktop.getByText("Vous organisez cette communauté", { exact: true }).filter({ visible: true })).toBeVisible();
  await desktop.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await desktop.getByRole("button", { name: "Copier le lien", exact: true }).click();
  await expect(desktop.getByText("Lien d’invitation copié.", { exact: true })).toBeVisible();
  const copied = await desktop.evaluate(() => navigator.clipboard.readText());
  const createdId = new URL(desktop.url()).pathname.split("/").pop();
  expect(copied).toBe(`https://www.foot-nation.com/app/supporters/${createdId}`);
  results.push("create: group creation, organiser auto-membership and canonical HTTPS invitation copied");
  expect(errors).toEqual([]);
  writeFileSync(`${output}/results.json`, JSON.stringify({ passed: results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results, errors, output }, null, 2));
} catch (error) {
  for (const [index, context] of browser.contexts().entries()) {
    for (const page of context.pages()) {
      await page.screenshot({ path: `${output}/failure-${index}.png` }).catch(() => {});
      writeFileSync(`${output}/failure-${index}.txt`, await page.locator("body").innerText());
      console.log("failure context", index, await page.evaluate(() => ({ url: location.pathname, focus: document.activeElement?.outerHTML.slice(0, 300) })));
    }
  }
  throw error;
} finally {
  await browser.close();
}
