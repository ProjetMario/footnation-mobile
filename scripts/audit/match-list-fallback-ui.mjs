// Isolated fixture only: the ESPN host is blocked, and the backup API is synthetic.
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.addInitScript(() => {
  const account = "00000000-0000-4000-8000-000000000003";
  localStorage.setItem(
    `footnation:first-login-onboarding:v1:${account}`,
    "seen",
  );
  localStorage.setItem(
    `footnation:invitation-prompt-until:v1:${account}`,
    String(Date.now() + 86_400_000),
  );
});
let backupRequests = 0;
await context.route("**/*", (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  if (url.pathname !== "/functions/v1/matches") return route.continue();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
  };
  if (request.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers });
  backupRequests++;
  return route.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    json: {
      date: url.searchParams.get("date"),
      fetched_at: new Date().toISOString(),
      source: "fixture",
      tournaments: [],
      teams: [],
      matches: [
        {
          external_match_id: "fixture-match-1",
          home: { id: null, name: "Paris Saint-Germain" },
          away: { id: null, name: "Real Madrid" },
          tournament: { id: null, name: "Match de recette" },
          kickoff_at: new Date(Date.now() - 30 * 60_000).toISOString(),
          status: "LIVE",
          score: { home: 1, away: 0 },
        },
      ],
    },
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function tap(button) {
  await expect(button).toBeVisible({ timeout: 30000 });
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (!box) throw new Error("Cible tactile indisponible.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
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
  await page.goto("http://localhost:8097/", { waitUntil: "domcontentloaded" });
  await expect(
    page
      .getByRole("button", { name: /Paris Saint-Germain contre Real Madrid/ })
      .first(),
  ).toBeVisible({ timeout: 30000 });
  const requestsBeforeTap = backupRequests;
  await tap(
    page.getByRole("button", { name: "Voir tous les matchs", exact: true }),
  );
  await expect.poll(() => new URL(page.url()).pathname).toContain("/matches");
  await expect(
    page.getByRole("button", {
      name: "Voir le match Paris Saint-Germain contre Real Madrid",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText("Scores d’une autre source · ESPN indisponible", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await expect.poll(() => backupRequests).toBeGreaterThan(requestsBeforeTap);
  expect(errors).toEqual([]);
  console.log(
    "La liste affiche et recharge les scores de secours quand ESPN est indisponible (Expo Web isolé).",
  );
} finally {
  await browser.close();
}
