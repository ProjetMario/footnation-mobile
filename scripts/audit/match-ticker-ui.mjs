// Run against the isolated start-ui recipe on ports 8097/7097.
// Fixture matches are synthetic. This checks Expo Web, not native iOS touches.
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
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
  const pairs = [
    ["Paris Saint-Germain", "Real Madrid"],
    ["Arsenal", "Liverpool"],
    ["Barcelona", "Atletico Madrid"],
  ];
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
      matches: pairs.map(([home, away], index) => ({
        external_match_id:
          index === 1 ? "espn:fra.1:12345" : `fixture-match-${index + 1}`,
        home: { id: null, name: home },
        away: { id: null, name: away },
        tournament: { id: null, name: "Match de recette" },
        kickoff_at: new Date(
          Date.now() - (33 - index) * 60 * 1000,
        ).toISOString(),
        status: "LIVE",
        score: { home: 1, away: 0 },
      })),
    },
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function tap(locator) {
  await expect(locator).toBeVisible({ timeout: 30000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("La cible n'a pas de dimensions visibles.");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function home() {
  await page.goto("http://localhost:8097/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Voir tous les matchs" }),
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
  await page.waitForTimeout(2500);
  const later = page.getByRole("button", { name: "Plus tard", exact: true });
  if (await later.count()) {
    await later.scrollIntoViewIfNeeded();
    await tap(later);
    await expect(later).not.toBeVisible();
  }
  const closeInvite = page.getByRole("button", {
    name: "Fermer l’invitation",
    exact: true,
  });
  if (await closeInvite.isVisible()) await tap(closeInvite);

  const firstMatch = page
    .getByRole("button", { name: /Paris Saint-Germain contre Real Madrid/ })
    .first();
  await expect(firstMatch).toBeVisible({ timeout: 30000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("match-ticker-copy")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByTestId("match-ticker-copy")).toHaveCount(1, {
    timeout: 10000,
  });
  await tap(firstMatch);
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toContain("/match/fixture-match-1");
  await expect(
    page.getByText("Paris Saint-Germain", { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText("Real Madrid", { exact: true }).first(),
  ).toBeVisible();

  await home();
  const espnMatch = page
    .getByRole("button", { name: /Arsenal contre Liverpool/ })
    .first();
  await expect(espnMatch).toBeVisible({ timeout: 30000 });
  await espnMatch.scrollIntoViewIfNeeded();
  await tap(espnMatch);
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).pathname))
    .toContain("/match/espn:fra.1:12345");
  await expect
    .poll(() => new URL(page.url()).searchParams.has("date"))
    .toBe(true);
  // The external ESPN service is deliberately blocked in this fixture.
  // The detail screen should still show the selected match from the ticker.
  await expect(page.getByText("Arsenal", { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("Liverpool", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Actualisation indisponible · dernières informations connues.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText("Match de recette · Score à actualiser", { exact: true }),
  ).toBeVisible();
  await tap(
    page.getByRole("button", { name: "Réessayer", exact: true }).first(),
  );
  await expect(
    page.getByText("Arsenal", { exact: true }).first(),
  ).toBeVisible();

  await home();
  await tap(page.getByRole("button", { name: "Voir tous les matchs" }));
  await expect.poll(() => new URL(page.url()).pathname).toContain("/matches");
  // With ESPN blocked, the list should use the available local fixture API.
  await expect(
    page.getByRole("button", {
      name: "Voir le match Paris Saint-Germain contre Real Madrid",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("Scores d’une autre source · ESPN indisponible", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });

  await home();
  await tap(page.getByRole("button", { name: "Tous les matchs", exact: true }));
  await expect.poll(() => new URL(page.url()).pathname).toContain("/matches");
  await expect(
    page.getByRole("button", {
      name: "Voir le match Paris Saint-Germain contre Real Madrid",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
  console.log(
    "Le match, Tous et MATCHS répondent aux appuis dans la recette Web isolée.",
  );
} finally {
  await browser.close();
}
