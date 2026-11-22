// Run against the isolated start-ui recipe with AUDIT_SUPER_ADMIN=1,
// AUDIT_WEB_PORT=8097 and AUDIT_API_PORT=7097. No production requests allowed.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = "http://localhost:8097";
const output = "/tmp/footnation-decisions-ui";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const actions = [],
  failures = [],
  external = [];
let enabled = false,
  limit = 500,
  reviewed = false,
  revision = "aaaaaaaa-0000-4000-8000-000000000001";
let conflict = true;
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  ) {
    external.push(url.origin);
    return route.abort();
  }
  if (url.pathname !== "/functions/v1/opportunity-decisions")
    return route.continue();
  if (request.method() === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, apikey, x-client-info, content-type",
      },
    });
  const body = request.postDataJSON();
  actions.push(body);
  const send = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      json: data,
    });
  if (body.action === "status")
    return send({
      ready: true,
      schedulerConfigured: true,
      enabled,
      dailyLimit: limit,
      usedToday: 2,
      pending: 0,
      review: reviewed ? 0 : 1,
      failed: 0,
      lastWorkerAt: new Date().toISOString(),
    });
  if (body.action === "list")
    return send({
      total: reviewed && body.filter === "review" ? 0 : 1,
      nextOffset: null,
      rows:
        reviewed && body.filter === "review"
          ? []
          : [
              {
                opportunity_id: "bbbbbbbb-0000-4000-8000-000000000001",
                revision,
                title: "Annonce fictive · Contrat professionnel garanti",
                description:
                  "Exemple de recette : versez un acompte pour obtenir un contrat professionnel garanti.",
                opportunity_type: "recherche_staff",
                listing_kind: "offer",
                is_active: true,
                status: "completed",
                review_outcome: reviewed ? "validated" : null,
                review_note: reviewed
                  ? "Vérification manuelle effectuée"
                  : null,
                result: {
                  category: "recherche_joueur",
                  categoryConfidence: 0.91,
                  listingKind: "offer",
                  kindConfidence: 0.92,
                  signals: {
                    payment_guarantee: 0.95,
                    sensitive_data: 0.02,
                    pressure: 0.3,
                    spam: 0.1,
                  },
                  incomplete: false,
                },
              },
            ],
    });
  if (body.action === "configure") {
    enabled = body.enabled;
    limit = body.dailyLimit;
    return send({ ok: true });
  }
  if (body.action === "review") {
    if (conflict) {
      conflict = false;
      return send(
        { error: "L’annonce a changé. Actualisez avant de réessayer." },
        409,
      );
    }
    reviewed = true;
    revision = "aaaaaaaa-0000-4000-8000-000000000002";
    return send({ ok: true });
  }
  return send({ processed: 0, completed: 0, failed: 0, superseded: 0 });
});
const page = await context.newPage();
page.on("pageerror", (e) => failures.push(e.message));
try {
  await page.goto(`${origin}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.getByLabel("Adresse e-mail", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  console.log("Login ready");
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .pressSequentially("admin@fixture.test", { delay: 20 });
  await page
    .getByLabel("Mot de passe", { exact: true })
    .pressSequentially("fixture-password", { delay: 20 });
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect
    .poll(() => page.url(), { timeout: 30000 })
    .not.toContain("/login");
  await page.goto(`${origin}/admin?section=decisions`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByText("Annonce fictive · Contrat professionnel garanti", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  console.log("Decisions panel ready");
  const note = page.getByLabel("Motif de ta décision", { exact: true });
  await expect(
    page.getByRole("button", { name: "Valider l’analyse", exact: true }),
  ).toBeDisabled();
  await note.pressSequentially("Vérification manuelle effectuée", {
    delay: 25,
  });
  await expect(note).toHaveValue("Vérification manuelle effectuée");
  await expect(note).toBeFocused();
  await page
    .getByRole("button", { name: "Valider l’analyse", exact: true })
    .click();
  await expect(
    page.getByText("L’annonce a changé. Actualisez avant de réessayer.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(note).toHaveValue("Vérification manuelle effectuée");
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `${output}/mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Valider l’analyse", exact: true })
    .click();
  await expect(
    page.getByText("Décision enregistrée.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Aucune annonce dans cette rubrique", { exact: true }),
  ).toBeVisible();
  expect(actions.filter((a) => a.action === "review")).toHaveLength(2);
  expect(
    actions.filter((a) => a.action === "configure" || a.action === "run"),
  ).toHaveLength(0);
  expect(failures).toEqual([]);
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        status: "passed",
        reviewAttempts: 2,
        widths: [1440, 390, 320],
        externalBlocked: [...new Set(external)],
        failures,
      },
      null,
      2,
    ),
  );
  console.log(`Admin Decisions browser checks passed: ${output}`);
} catch (error) {
  writeFileSync(
    `${output}/failure.txt`,
    `${error.stack}\n${JSON.stringify(failures)}\n${await page.locator("body").innerText()}`,
  );
  await page
    .screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
      timeout: 5000,
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
