// Browser recipe with synthetic responses only. It cannot contact production.
import { chromium, expect } from "@playwright/test";

const webPort = Number(process.env.AUDIT_WEB_PORT || 8097);
const postId = "10000000-0000-4000-8000-000000000001";
const commentId = "20000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000003";
const comment = {
  id: commentId,
  post_id: postId,
  user_id: actor,
  content: "Commentaire de recette",
  created_at: "2026-11-01T12:00:00Z",
  author: {
    id: actor,
    full_name: "Recette admin",
    username: "admin",
    avatar_url: null,
  },
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
await context.addInitScript((account) => {
  localStorage.setItem(
    `footnation:first-login-onboarding:v1:${account}`,
    "seen",
  );
  localStorage.setItem(
    `footnation:invitation-prompt-until:v1:${account}`,
    String(Date.now() + 86_400_000),
  );
}, actor);
let liked = false;
let failFirstWrite = true;
let writes = 0;
await context.route("**/*", (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  if (url.pathname === "/rest/v1/post_comments" && request.method() === "GET")
    return route.fulfill({ status: 200, headers, json: [comment] });
  if (url.pathname === "/rest/v1/rpc/read_post_comment_likes")
    return route.fulfill({
      status: 200,
      headers,
      json: [{ comment_id: commentId, likes_count: liked ? 2 : 1, liked }],
    });
  if (url.pathname === "/rest/v1/rpc/set_post_comment_like") {
    writes++;
    if (failFirstWrite) {
      failFirstWrite = false;
      return route.fulfill({
        status: 503,
        headers,
        json: { code: "FIXTURE_ERROR", message: "Erreur fictive" },
      });
    }
    const payload = request.postDataJSON();
    if (
      payload.p_comment_id !== commentId ||
      typeof payload.p_liked !== "boolean"
    )
      throw new Error("Requête de réaction inattendue");
    liked = payload.p_liked;
    return route.fulfill({ status: 200, headers, json: liked });
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
  if (!box) throw new Error("Cible tactile indisponible");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto(`http://localhost:${webPort}/login`, {
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
  await page.goto(`http://localhost:${webPort}/posts/${postId}?comments=1`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByText("Commentaire de recette", { exact: true }).last(),
  ).toBeVisible({ timeout: 30000 });
  const like = page.getByRole("button", {
    name: "Aimer ce commentaire",
    exact: true,
  });
  await tap(like);
  await expect(page.getByText("Échec, réessaie.", { exact: true })).toBeVisible(
    { timeout: 30000 },
  );
  await expect(like).toBeVisible();
  await tap(like);
  const unlike = page.getByRole("button", {
    name: "Retirer ma réaction au commentaire",
    exact: true,
  });
  await expect(unlike).toBeVisible({ timeout: 30000 });
  await tap(unlike);
  await expect(like).toBeVisible({ timeout: 30000 });
  expect(writes).toBe(3);
  expect(errors).toEqual([]);
  console.log(
    "Réactions aux commentaires : échec conservé, nouvel essai, ajout et retrait vérifiés en recette Web isolée.",
  );
} finally {
  await browser.close();
}
