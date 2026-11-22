// Use the isolated recipe on 8097/7097. All users and posts are synthetic.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const output = "/tmp/footnation-social-feed-ui";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const candidates = [],
  postReads = [],
  failures = [],
  forbidden = [];
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (
    url.pathname.includes("opportunity-decisions") ||
    url.hostname === "api.openai.com"
  )
    forbidden.push(url.pathname);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  if (url.pathname === "/rest/v1/posts" && url.searchParams.has("id"))
    postReads.push(url.searchParams.get("id"));
  if (url.pathname !== "/rest/v1/rpc/get_social_feed_candidates")
    return route.continue();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
  };
  if (request.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers });
  candidates.push(request.postDataJSON());
  return route.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    json: [1, 2, 3].map((n) => ({
      post_id: "10000000-0000-4000-8000-" + String(n).padStart(12, "0"),
      created_at: new Date(
        Date.UTC(2026, 8, 12, 9) - (n - 1) * 86400000,
      ).toISOString(),
    })),
  });
});
const page = await context.newPage();
page.on("pageerror", (error) => failures.push(error.message));
try {
  await page.goto("http://localhost:8097/login", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.getByLabel("Adresse e-mail", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .pressSequentially("admin@fixture.test", { delay: 10 });
  await page
    .getByLabel("Mot de passe", { exact: true })
    .pressSequentially("fixture-password", { delay: 10 });
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect
    .poll(() => page.url(), { timeout: 30000 })
    .not.toContain("/login");
  await page.goto("http://localhost:8097/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Publication de recette 1", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText("Dans votre réseau", { exact: true }).first(),
  ).toBeVisible();
  expect(candidates.length).toBeGreaterThan(0);
  expect(
    candidates.every(
      (c) => c.p_snapshot && c.p_before === null && c.p_before_id === null,
    ),
  ).toBe(true);
  expect(
    postReads.some((value) =>
      value.includes("10000000-0000-4000-8000-000000000001"),
    ),
  ).toBe(true);
  expect(failures).toEqual([]);
  expect(forbidden).toEqual([]);
  await page.screenshot({ path: `${output}/feed-mobile.png`, fullPage: true });
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      { status: "passed", candidateReads: candidates.length, failures },
      null,
      2,
    ),
  );
  console.log("Personalized feed browser checks passed");
} catch (error) {
  writeFileSync(
    `${output}/failure.txt`,
    `${error.stack}\n${JSON.stringify(failures)}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await browser.close();
}
