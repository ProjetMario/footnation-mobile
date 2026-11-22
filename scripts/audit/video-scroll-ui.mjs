// Local accounts and local MP4 only; all non-fixture requests are blocked.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
});
const actor = "00000000-0000-4000-8000-000000000003";
const clips = [1, 2, 3].map((n) => ({
  id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  user_id: actor,
  created_at: `2026-11-15T12:0${4 - n}:00Z`,
  video_url: `http://127.0.0.1:7097/__fixture/media/club-intro.mp4?clip=${n}`,
  description: `Vidéo de recette ${n}`,
  thumbnail_url: null,
  user: {
    id: actor,
    full_name: "Recette admin",
    username: "admin",
    avatar_url: null,
  },
}));
let homeMode = false;
await context.addInitScript((id) => {
  localStorage.setItem(`footnation:first-login-onboarding:v1:${id}`, "seen");
  localStorage.setItem(
    `footnation:invitation-prompt-until:v1:${id}`,
    String(Date.now() + 86400000),
  );
}, actor);
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) &&
    !["data:", "blob:"].includes(url.protocol)
  )
    return route.abort();
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  if (route.request().method() === "GET" && url.pathname === "/rest/v1/shorts")
    return route.fulfill({ status: 200, headers, json: clips });
  if (route.request().method() === "GET" && url.pathname === "/rest/v1/posts")
    return route.fulfill({
      status: 200,
      headers,
      json: homeMode
        ? clips.map((clip) => ({
            ...clip,
            content: clip.description,
            author: clip.user,
            image_url: null,
            post_comments: [{ count: 0 }],
            post_reactions: [],
          }))
        : [],
    });
  if (
    [
      "get_video_repost_feed",
      "get_repost_feed",
      "get_social_feed_candidates",
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
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
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
  await page.goto("http://localhost:8097/shorts", {
    waitUntil: "domcontentloaded",
  });
  const playing = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("video")]
        .filter((v) => !v.paused && !v.ended)
        .map((v) => ({ src: v.currentSrc, time: v.currentTime })),
    );
  await expect
    .poll(playing, { timeout: 30000 })
    .toEqual([
      expect.objectContaining({ src: expect.stringContaining("clip=1") }),
    ]);
  // Retain a reference: a pause/remount during the transition must be detected.
  await page.evaluate(() => {
    const video = document.querySelector("video");
    window.__scrollVideo = video;
    let parent = video.parentElement;
    while (
      parent &&
      !(
        parent.scrollHeight > parent.clientHeight + 100 &&
        /auto|scroll/.test(getComputedStyle(parent).overflowY)
      )
    )
      parent = parent.parentElement;
    if (!parent) throw new Error("Scroll container absent");
    window.__videoScroller = parent;
    parent.style.scrollSnapType = "none";
    parent.scrollTop = parent.clientHeight * 0.5;
  });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({
    connected: window.__scrollVideo.isConnected,
    paused: window.__scrollVideo.paused,
    time: window.__scrollVideo.currentTime,
  }));
  expect(before.connected).toBe(true);
  expect(before.paused).toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__scrollVideo.currentTime), {
      timeout: 5000,
    })
    .toBeGreaterThan(before.time + 0.15);
  await page.evaluate(() => {
    window.__videoScroller.scrollTop = window.__videoScroller.clientHeight;
  });
  await expect
    .poll(playing, { timeout: 30000 })
    .toEqual([
      expect.objectContaining({ src: expect.stringContaining("clip=2") }),
    ]);
  await page.evaluate(() => {
    window.__videoScroller.scrollTop = 0;
  });
  await expect
    .poll(playing, { timeout: 30000 })
    .toEqual([
      expect.objectContaining({ src: expect.stringContaining("clip=1") }),
    ]);
  await page
    .getByRole("button", { name: "Mettre le short en pause", exact: true })
    .first()
    .click();
  await expect.poll(playing).toEqual([]);
  await page.evaluate(() => {
    window.__videoScroller.scrollTop = 30;
  });
  await page.waitForTimeout(1000);
  expect(await playing()).toEqual([]);
  await page
    .getByRole("button", { name: "Reprendre le short", exact: true })
    .first()
    .click();
  await expect
    .poll(playing)
    .toEqual([
      expect.objectContaining({ src: expect.stringContaining("clip=1") }),
    ]);
  homeMode = true;
  await page.goto("http://localhost:8097/", { waitUntil: "domcontentloaded" });
  const row = page.getByTestId(`feed-page-${clips[1].id}`);
  await expect(row).toBeAttached({ timeout: 30000 });
  await row.evaluate((node) =>
    node.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await expect
    .poll(playing, { timeout: 30000 })
    .toEqual([
      expect.objectContaining({ src: expect.stringContaining("clip=2") }),
    ]);
  await page.evaluate(() => {
    const video = [...document.querySelectorAll("video")].find(
      (v) => !v.paused,
    );
    window.__scrollVideo = video;
    let parent = video.parentElement;
    while (
      parent &&
      !(
        parent.scrollHeight > parent.clientHeight + 100 &&
        /auto|scroll/.test(getComputedStyle(parent).overflowY)
      )
    )
      parent = parent.parentElement;
    if (!parent) throw new Error("Scroll accueil absent");
    parent.scrollTop += 35;
  });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => window.__scrollVideo.isConnected && !window.__scrollVideo.paused,
    ),
  ).toBe(true);
  const homeTime = await page.evaluate(() => window.__scrollVideo.currentTime);
  await expect
    .poll(() => page.evaluate(() => window.__scrollVideo.currentTime))
    .toBeGreaterThan(homeTime + 0.15);
  expect(errors).toEqual([]);
  console.log(
    "Shorts et accueil : lecture pendant le scroll, transition, retour, pause volontaire et lecteur unique vérifiés.",
  );
} catch (error) {
  console.log(
    await page.evaluate(() => ({
      text: document.body.innerText.slice(-1400),
      videos: [...document.querySelectorAll("video")].map((v) => ({
        src: v.currentSrc,
        paused: v.paused,
        ready: v.readyState,
        rect: v.getBoundingClientRect().toJSON(),
      })),
      rows: [...document.querySelectorAll('[data-testid^="feed-page-"]')].map(
        (v) => ({
          id: v.getAttribute("data-testid"),
          rect: v.getBoundingClientRect().toJSON(),
        }),
      ),
    })),
  );
  throw error;
} finally {
  await browser.close();
}
