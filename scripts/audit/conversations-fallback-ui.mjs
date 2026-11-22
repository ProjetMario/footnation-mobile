// Exercises the legacy conversation fallback in the isolated Web fixture only.
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
const calls = [];
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
};
await context.route("**/*", (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (!["localhost", "127.0.0.1"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) return route.abort();
  if (!["/rest/v1/rpc/get_native_conversations_filtered", "/rest/v1/rpc/get_native_conversations"].includes(url.pathname)) return route.continue();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  if (url.pathname.endsWith("_filtered")) {
    return route.fulfill({ status: 404, headers, json: { code: "PGRST202", message: "Fixture: optional function absent" } });
  }
  const offset = request.postDataJSON()?.page_offset ?? 0;
  calls.push(offset);
  const count = offset < 90 ? 30 : offset === 90 ? 1 : 0;
  const items = Array.from({ length: count }, (_, index) => {
    const n = offset + index;
    const peer = `10000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`;
    return {
      id: `20000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
      sender_id: peer,
      receiver_id: "00000000-0000-4000-8000-000000000003",
      content: `Message fictif ${n}`,
      created_at: "2026-10-01T10:00:00Z",
      read_at: n === 90 ? null : "2026-10-01T11:00:00Z",
      is_blocked: false,
      sender: { id: peer, full_name: n === 90 ? "Ancien contact non lu" : `Contact fictif ${n}` },
      receiver: { id: "00000000-0000-4000-8000-000000000003", full_name: "Recette admin" },
      unread_count: n === 90 ? 1 : 0,
    };
  });
  return route.fulfill({ status: 200, headers, json: items });
});

const page = await context.newPage();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
async function tap(locator) {
  await expect(locator).toBeVisible({ timeout: 30000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("La cible tactile est indisponible.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto("http://localhost:8097/login", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("admin@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect.poll(() => page.url(), { timeout: 30000 }).not.toContain("/login");
  await page.goto("http://localhost:8097/messages", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Contact fictif 0", { exact: true }).first()).toBeVisible({ timeout: 30000 });
  await tap(page.getByRole("button", { name: "Non lues", exact: true }));
  await expect(page.getByText("Aucune conversation non lue parmi les échanges chargés", { exact: true })).toBeVisible({ timeout: 30000 });
  await tap(page.getByRole("button", { name: "Charger les échanges plus anciens", exact: true }));
  await expect(page.getByText("Ancien contact non lu", { exact: true }).first()).toBeVisible({ timeout: 30000 });
  expect(calls).toEqual(expect.arrayContaining([0, 30, 60, 90]));
  await tap(page.getByRole("button", { name: "Tous", exact: true }));
  await expect(page.getByText("Contact fictif 0", { exact: true }).first()).toBeVisible();
  expect(failures).toEqual([]);
  console.log("Messagerie : filtre et pagination de repli vérifiés sur des données fictives (Expo Web).");
} finally {
  await browser.close();
}
