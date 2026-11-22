// Run against the isolated start-ui recipe on ports 8097/7097.
// This exercises touch targets in Expo Web; native hit testing still requires a device.
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function tap(locator) {
  await expect(locator).toBeVisible({ timeout: 30000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("La cible n'a pas de dimensions visibles.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function home() {
  await page.goto("http://localhost:8097/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Changer la langue" }),
  ).toBeVisible({ timeout: 30000 });
}

try {
  await page.goto("http://localhost:8097/login", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("admin@fixture.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect
    .poll(() => page.url(), { timeout: 30000 })
    .not.toContain("/login");
  await home();
  // A new synthetic account receives the first-login dialog. Its close
  // control must be visible before scrolling and must unblock the header.
  await expect(page.getByText("Bienvenue sur FootNation", { exact: true })).toBeVisible({ timeout: 30000 });
  const later = page.getByRole("button", { name: "Plus tard", exact: true });
  const closeWelcome = page.getByRole("button", { name: "Fermer", exact: true });
  await expect(closeWelcome).toBeInViewport();
  await tap(closeWelcome);
  await expect(later).not.toBeVisible();
  const closeInvite = page.getByRole("button", { name: "Fermer l’invitation", exact: true });
  if (await closeInvite.isVisible()) await tap(closeInvite);

  await tap(page.getByRole("button", { name: "Changer la langue" }));
  await expect(
    page.getByRole("button", { name: "Fermer le choix de langue" }),
  ).toBeVisible();
  await tap(page.getByRole("button", { name: "Fermer le choix de langue" }));

  await tap(page.getByRole("button", { name: "Ouvrir mon espace" }));
  await expect(
    page.getByRole("button", { name: "Fermer le menu du compte" }),
  ).toBeVisible();
  await home();

  await tap(page.getByRole("button", { name: "Messagerie", exact: true }));
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
    .toContain("messages");
  await home();

  await tap(page.getByRole("button", { name: /Notifications/ }).first());
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
    .toContain("notifications");
  expect(errors).toEqual([]);
  console.log(
    "Les quatre commandes de l’en-tête répondent aux appuis dans la recette Web isolée.",
  );
} catch (error) {
  await page.screenshot({ path: "/tmp/footnation-header-ui-failure.png" });
  console.error((await page.locator("body").innerText()).slice(0, 3000));
  throw error;
} finally {
  await browser.close();
}
