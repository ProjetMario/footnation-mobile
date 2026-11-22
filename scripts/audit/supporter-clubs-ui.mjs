// Only run against the opt-in local Supporters fixtures. Never contacts production.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = "http://localhost:8097",
  api = "http://127.0.0.1:7097";
const output = "/tmp/footnation-supporter-clubs-ui";
if (!(await fetch(`${api}/__fixture/supporters`)).ok)
  throw new Error("Supporters fixture required");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  mutations = [];
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return ["localhost", "127.0.0.1"].includes(url.hostname) ||
    ["data:", "blob:"].includes(url.protocol)
    ? route.continue()
    : route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (req) => {
  if (req.method() === "POST" && req.url().includes("/rpc/supporter_"))
    mutations.push(req.url().split("/").at(-1));
});
const paris = "93000000-0000-4000-8000-000000000001";
const red = "30000000-0000-4000-8000-000000000001";
const go = (path) =>
  page.goto(origin + path, { timeout: 120000, waitUntil: "domcontentloaded" });
async function type(label, value) {
  const input = page.getByRole("textbox", { name: label, exact: true });
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 50 });
  await expect(input).toHaveValue(value);
}
try {
  // A public club opens only its own groups, then keeps its identity through login.
  await go(`/club/${red}`);
  const discover = page.getByRole("link", {
    name: /Découvrir les communautés de supporters de Club de recette rouge/,
  });
  await expect(discover).toBeVisible();
  await discover.click();
  await expect(page).toHaveURL(new RegExp(`/supporters\\?clubId=${red}`));
  await expect(
    page.getByRole("textbox", { name: "Ton club", exact: true }),
  ).toHaveValue("Club de recette rouge");
  await expect(
    page.getByText("Pas encore de groupe ici", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Créer un groupe de supporters", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/supporters/new\\?clubId=${red}`));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await type("Adresse e-mail", "player@fixture.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/supporters/new\\?clubId=${red}`));
  const invite = page.getByRole("button", { name: "Fermer l’invitation" });
  if (
    await invite.waitFor({ state: "visible", timeout: 4000 }).then(
      () => true,
      () => false,
    )
  )
    await invite.click();
  await expect(
    page.getByRole("textbox", { name: "Club soutenu *", exact: true }),
  ).toHaveValue("Club de recette rouge");
  await expect(
    page.getByRole("textbox", { name: "Ville *", exact: true }),
  ).toHaveValue("Montpellier");
  expect(mutations).toEqual([]);
  await page.screenshot({ path: `${output}/prefilled-mobile.png` });

  await go("/supporters");
  await expect(page.getByText("Pour tes clubs", { exact: true })).toBeVisible();
  await expect(page.getByText("Club de cœur", { exact: true })).toBeVisible();
  await expect(page.getByText("Club actuel", { exact: true })).toBeVisible();
  const cards = page.getByRole("button", {
    name: /^Découvrir .*supporters de/,
  });
  await expect(cards.first()).toHaveAccessibleName(
    /Paris ensemble à Montpellier/,
  );
  const visibleNames = await cards.allTextContents();
  expect(
    visibleNames.filter((n) => n.includes("Paris ensemble à Montpellier")),
  ).toHaveLength(1);
  await page.screenshot({ path: `${output}/for-your-clubs-mobile.png` });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.screenshot({ path: `${output}/for-your-clubs-desktop.png` });
  await page
    .getByRole("button", {
      name: "Communautés de Paris Saint-Germain",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/supporters\\?clubId=${paris}`));
  await expect(
    page.getByRole("button", { name: /^Découvrir .*supporters de/ }),
  ).toHaveCount(2);
  expect(mutations).toEqual([]);
  // Text route is a search, and manual name editing removes the previous club identity.
  await type("Ton club", "Olympique de Marseille");
  await page
    .getByRole("button", { name: "Trouver des supporters", exact: true })
    .click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAccessibleName(/Les Marseillais de Lyon/);
  await expect(
    page.getByText("Communautés rattachées à Paris Saint-Germain", {
      exact: false,
    }),
  ).toHaveCount(0);
  // A saved favorite offers discovery without automatically joining a community.
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/my-profile");
  const later = page.getByRole("button", { name: "Plus tard", exact: true });
  if (
    await later.waitFor({ state: "visible", timeout: 4000 }).then(
      () => true,
      () => false,
    )
  ) {
    await later.click();
    await expect(page).toHaveURL(origin + "/home");
    await go("/my-profile");
  }
  await page.getByRole("tab", { name: "À propos", exact: true }).click();
  await page
    .getByRole("button", { name: "Clubs favoris", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Ouvrir Club professionnel : Paris Saint-Germain",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Club professionnel : Paris Saint-Germain · Ligue 1 Uber Eats",
      exact: true,
    })
    .click();
  await type("Rechercher · club professionnel", "Marseille");
  await page
    .getByRole("button", {
      name: "Olympique de Marseille · Ligue 1 Uber Eats",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByText("Retrouve ses supporters près de chez toi", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/favorite-invitation-mobile.png` });
  await page
    .getByRole("link", {
      name: "Découvrir les communautés de supporters de Olympique de Marseille",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/supporters" &&
    url.searchParams.get("club") === "Olympique de Marseille" &&
    url.searchParams.get("city") === "Montpellier" &&
    !url.searchParams.has("clubId")
  );
  await expect(
    page.getByRole("textbox", { name: "Ton club", exact: true }),
  ).toHaveValue("Olympique de Marseille");
  await expect(
    page.getByRole("textbox", { name: "Ta ville", exact: true }),
  ).toHaveValue("Montpellier");
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify(
      {
        passed: true,
        errors,
        mutations,
        scenarios: [
          "club entry",
          "club identity survives login",
          "prefilled club and user city",
          "personal affinities before other groups",
          "local groups first",
          "no duplicate cards",
          "320px and desktop",
          "explicit search unlocks selected club",
          "confirmed favorite save offers optional local discovery",
          "no automatic memberships or admin actions",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Supporter club browser scenarios passed");
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  writeFileSync(
    `${output}/failure.txt`,
    (await page
      .locator("body")
      .innerText()
      .catch(() => "")) +
      "\n" +
      String(error),
  );
  throw error;
} finally {
  await browser.close();
}
