// Synthetic accounts/posts only. Never sends a reaction or message to production.
import { chromium, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

const origin = "http://localhost:8097";
const actor = "00000000-0000-4000-8000-000000000003";
const postId = "10000000-0000-4000-8000-000000000002";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["clipboard-read", "clipboard-write"],
});
await context.addInitScript((id) => {
  localStorage.setItem(`footnation:first-login-onboarding:v1:${id}`, "seen");
  localStorage.setItem(
    `footnation:invitation-prompt-until:v1:${id}`,
    String(Date.now() + 86400000),
  );
}, actor);
let reposted = false;
const writes = [];
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  if (request.method() !== "GET" && request.method() !== "OPTIONS")
    writes.push({
      path: url.pathname,
      method: request.method(),
      body: request.postDataJSON(),
    });
  if (
    [
      "get_social_feed_candidates",
      "get_repost_feed",
      "get_video_repost_feed",
    ].some((name) => url.pathname === `/rest/v1/rpc/${name}`)
  )
    return route.fulfill({
      status: 404,
      headers,
      json: {
        code: "PGRST202",
        message: `function public.${url.pathname.split("/").at(-1)} is not present in this fixture`,
      },
    });
  if (
    ["get_post_repost_state", "set_post_repost"].some(
      (name) => url.pathname === `/rest/v1/rpc/${name}`,
    )
  ) {
    if (url.pathname.endsWith("/set_post_repost"))
      reposted = request.postDataJSON().p_reposted;
    return route.fulfill({
      status: 200,
      headers,
      json: [{ reposted, repost_count: reposted ? 1 : 0 }],
    });
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
  if (!box) throw new Error("Missing touch target");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto(`${origin}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("admin@fixture.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("fixture-password");
  await tap(page.getByRole("button", { name: "Se connecter", exact: true }));
  await expect
    .poll(() => page.url(), { timeout: 30000 })
    .not.toContain("/login");
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const card = page.getByTestId(`feed-page-${postId}`);
  await expect(card).toBeAttached({ timeout: 30000 });
  // Tap the actual icon centre, not a programmatic React handler.
  for (let i = 0; i < 2; i++) {
    await tap(card.getByRole("button", { name: "Partager", exact: true }));
    await expect(
      page.getByText("Partager la publication", { exact: true }),
    ).toBeVisible();
    await tap(
      page.getByRole("button", { name: "Copier le lien", exact: true }),
    );
    await expect(page.getByText("Lien copié.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      `/posts/${postId}`,
    );
    await tap(
      page
        .getByRole("button", { name: "Fermer le partage", exact: true })
        .last(),
    );
  }
  const like = card.getByRole("button", { name: /^J’aime\./ });
  const originalLabel = await like.getAttribute("aria-label");
  await tap(like);
  await expect(like).not.toHaveAttribute("aria-label", originalLabel, {
    timeout: 30000,
  });
  await expect(like).toBeEnabled();
  await tap(like);
  await expect(like).toHaveAttribute("aria-label", originalLabel, {
    timeout: 30000,
  });
  await tap(
    card.getByRole("button", {
      name: "Enregistrer la publication",
      exact: true,
    }),
  );
  await tap(
    card.getByRole("button", { name: "Retirer des favoris", exact: true }),
  );
  await expect(
    card.getByRole("button", {
      name: "Enregistrer la publication",
      exact: true,
    }),
  ).toBeEnabled();
  await tap(card.getByRole("button", { name: /^Republier\./ }));
  await tap(card.getByRole("button", { name: /^Annuler la republication\./ }));
  await expect.poll(() => reposted).toBe(false);
  const draft = card.getByLabel("Ajouter un commentaire à cette publication", {
    exact: true,
  });
  await draft.scrollIntoViewIfNeeded();
  await draft.pressSequentially("Bravo le club de recette !", { delay: 25 });
  await expect(draft).toHaveValue("Bravo le club de recette !");
  await tap(
    card.getByRole("button", { name: "Envoyer le commentaire", exact: true }),
  );
  await expect(
    card.getByText("Commentaire publié", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(draft).toHaveValue("");
  for (let i = 0; i < 2; i++) {
    await tap(
      card.getByRole("button", { name: /Ouvrir les commentaires/ }).first(),
    );
    await expect(
      page.getByText("Bravo le club de recette !", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await tap(page.getByRole("button", { name: "Fermer", exact: true }).last());
  }
  expect(errors).toEqual([]);
  for (const table of ["post_reactions", "post_comments", "saved_posts"])
    expect(
      writes.some((r) => r.path === `/rest/v1/${table}` && r.method === "POST"),
    ).toBe(true);
  writeFileSync(
    "/tmp/footnation-post-actions-result.json",
    JSON.stringify({ passed: true, writes, errors }, null, 2),
  );
  console.log(
    "Appuis tactiles : partage/copie, j’aime/retrait, favori/retrait, republication/retrait, saisie/envoi et ouverture répétée des commentaires réussis.",
  );
} catch (error) {
  writeFileSync(
    "/tmp/footnation-post-actions-failure.txt",
    `${error.stack}\n${JSON.stringify({ errors, writes })}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await browser.close();
}
