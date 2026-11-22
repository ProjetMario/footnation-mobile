// Inspect direct tab links in the isolated fixture; no real account is used.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return ["localhost", "127.0.0.1"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)
    ? route.continue() : route.abort();
});
const page = await context.newPage();
const outcomes = [];
try {
  await page.goto("http://localhost:8097/login", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("admin@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect.poll(() => page.url(), { timeout: 30000 }).not.toContain("/login");
  for (const path of ["/home", "/messages", "/shorts", "/search", "/clubs", "/network", "/opportunities", "/more", "/my-profile"]) {
    await page.goto("http://localhost:8097" + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    outcomes.push({ requested: path, actual: new URL(page.url()).pathname, body: (await page.locator("body").innerText()).slice(0, 180) });
    if (path === "/messages" || path === "/search") {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      outcomes.push({ requested: `${path} puis actualisation`, actual: new URL(page.url()).pathname, body: (await page.locator("body").innerText()).slice(0, 180) });
    }
  }
  console.log(JSON.stringify(outcomes, null, 2));
} finally { await browser.close(); }
