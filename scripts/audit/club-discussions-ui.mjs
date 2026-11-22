// Run only with scripts/audit/start-ui.mjs on these local ports. All discussion
// state below is disposable and browser-intercepted; no production calls.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
const origin = "http://localhost:8098", api = "http://127.0.0.1:7098";
const output = "/tmp/footnation-club-discussions-ui";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const clubId = "30000000-0000-4000-8000-000000000001", slug = "club-recette-rouge";
const userId = "00000000-0000-4000-8000-000000000001";
if (!(await fetch(`${api}/rest/v1/fff_clubs?select=id&limit=1`)).ok) throw new Error("Local fixtures required");
mkdirSync(output, { recursive: true });
const topics = Array.from({ length: 22 }, (_, index) => ({
  id: `94000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  club_id: clubId, club_slug: slug, club_name: "Club de recette rouge",
  title: index === 0 ? "Préparer le prochain match ensemble" : `Sujet de recette ${index + 1}`,
  content: "Une discussion fictive pour partager les idées des supporters du club.",
  category: "matches", language: "fr", replies_count: 0, is_locked: false, is_pinned: false,
  following: false, score: 0, my_vote: 0, deleted: false, media: null,
  created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:00:00Z",
  author: { id: userId, name: "Recette player", avatar_url: null }, can_edit: false, can_moderate: false,
}));
const replies = [];
const mutations = [], uploads = [], reads = [], errors = [], externalRequests = [];
let losePublishResponse = true;
let loseVoteResponse = true, holdVoteRead = false, voteReadRequested = false;
let releaseVoteRead;
const voteReadGate = new Promise(resolve => { releaseVoteRead = resolve; });
let rejectPublicationOnce = true;
let professionalBadgeRequests = 0;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (!["localhost", "127.0.0.1"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
    externalRequests.push(url.origin); return route.abort();
  }
  if (url.pathname === "/__fixture/pro-badge.png") {
    professionalBadgeRequests++;
    return route.fulfill({ status: 200, contentType: "image/png", body: png });
  }
  if (url.pathname === "/rest/v1/fff_clubs" && request.method() === "GET") {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const rows = await response.json();
    const withBadge = row => row?.id === clubId ? { ...row, is_pro: true, logo_url: `${api}/__fixture/pro-badge.png`, metadata: { ...row.metadata, logo: `${api}/__fixture/pro-badge.png` } } : row;
    return route.fulfill({ response, json: Array.isArray(rows) ? rows.map(withBadge) : withBadge(rows) });
  }
  if (url.pathname === "/functions/v1/discussion-media") {
    if (request.method() === "POST") {
      uploads.push({ id: request.headers()["x-upload-id"], mime: request.headers()["content-type"], size: request.postDataBuffer().length });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: uploads.at(-1).id }) });
    }
    return route.fulfill({ status: 200, contentType: "image/png", body: png });
  }
  if (!url.pathname.startsWith("/rest/v1/rpc/")) return route.continue();
  const rpc = url.pathname.split("/").at(-1);
  if (!rpc.includes("club_discussion")) return route.continue();
  const args = request.postDataJSON() || {};
  const signedIn = (request.headers().authorization || "").includes(".");
  const view = topic => topic && ({ ...topic, can_edit: signedIn && topic.author?.id === userId && !topic.is_locked && !topic.deleted });
  const send = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  if (rpc === "get_club_discussions") {
    reads.push(args);
    const rows = topics.filter(row => (!args.p_club_id || row.club_id === args.p_club_id) &&
      (!args.p_category || row.category === args.p_category) &&
      (!args.p_query || `${row.title} ${row.content}`.toLowerCase().includes(args.p_query.toLowerCase())));
    const offset = args.p_offset || 0, limit = args.p_limit || 20;
    return send({ items: rows.slice(offset, offset + limit).map(view), total: rows.length, has_more: rows.length > offset + limit });
  }
  if (rpc === "get_club_discussion") {
    if (holdVoteRead) { voteReadRequested = true; await voteReadGate; }
    const topic = topics.find(row => row.id === args.p_topic_id);
    const rows = replies.filter(row => row.topic_id === args.p_topic_id);
    return send({ topic: view(topic) || null, replies: rows, total: rows.length, has_more: false });
  }
  if (!signedIn) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "Sign in required" }) });
  mutations.push({ rpc, args });
  if (rpc === "publish_club_discussion") {
    if (rejectPublicationOnce && args.p_title.startsWith("Rejet contrôlé")) {
      rejectPublicationOnce = false;
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "22023", message: "Contenu refusé dans cette recette : corrigez votre texte." }) });
    }
    if (!topics.some(row => row.id === args.p_id)) topics.unshift({ ...topics[0], id: args.p_id, title: args.p_title, content: args.p_content, category: args.p_category, language: args.p_language, is_locked: args.p_title.startsWith("Sujet corrigé"), media: args.p_media_id ? { id: args.p_media_id, mime_type: "image/png", size_bytes: png.length } : null });
    if (losePublishResponse) { losePublishResponse = false; return route.abort("failed"); }
    return send(args.p_id);
  }
  if (rpc === "publish_club_discussion_reply") {
    if (!replies.some(row => row.id === args.p_id)) {
      replies.push({ ...topics[0], id: args.p_id, topic_id: args.p_topic_id, parent_id: args.p_parent_id, content: args.p_content, can_edit: true });
      topics.find(row => row.id === args.p_topic_id).replies_count++;
    }
    return send(args.p_id);
  }
  if (rpc === "vote_club_discussion") {
    const item = args.p_reply_id ? replies.find(row => row.id === args.p_reply_id) : topics.find(row => row.id === args.p_topic_id);
    item.my_vote = item.my_vote === args.p_value ? 0 : args.p_value; item.score = item.my_vote;
    if (loseVoteResponse) { loseVoteResponse = false; holdVoteRead = true; return route.abort("failed"); }
    return send(true);
  }
  if (rpc === "remove_club_discussion") {
    const topic = topics.find(row => row.id === args.p_id);
    topic.deleted = true; topic.content = ""; topic.media = null;
    return send(true);
  }
  if (rpc === "follow_club_discussion") { topics.find(row => row.id === args.p_topic_id).following = args.p_follow; return send(true); }
  return send(true);
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on("pageerror", error => errors.push(error.message));
const go = path => page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 120000 });
async function type(label, text) {
  const input = page.getByRole("textbox", { name: label, exact: true });
  await input.click(); await input.fill(""); await input.pressSequentially(text, { delay: 25 });
  await expect(input).toHaveValue(text);
}
async function dismissInvitations() {
  for (const name of ["Fermer l’invitation", "Plus tard"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}
try {
  await go(`/club/${clubId}`);
  await expect(page.getByText("Discussions du club", { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="discussion-card"]:visible')).toHaveCount(3);
  await page.getByText("Discussions du club", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/club-preview-desktop.png` });
  expect(professionalBadgeRequests).toBe(0);
  await page.getByRole("tab", { name: "Discussions", exact: true }).first().click();
  await expect(page.getByPlaceholder("Rechercher dans les discussions")).toBeVisible();
  await expect(page.locator('[data-testid="discussion-card"]:visible')).toHaveCount(20);
  await page.getByRole("button", { name: "Charger plus de sujets", exact: true }).click();
  await expect(page.locator('[data-testid="discussion-card"]:visible')).toHaveCount(22);
  expect(mutations).toEqual([]);
  await page.getByRole("button", { name: "+ Créer un sujet", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/club/${slug}/discussions/new`));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await type("Adresse e-mail", "player@fixture.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/club/${slug}/discussions/new`));
  await dismissInvitations();
  const title = "Le prochain match : échangeons nos idées";
  const message = "Voici mes idées pour le prochain match du club et son ambiance.";
  await type("Titre du sujet", title); await type("Votre message", message);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Joindre une image ou une vidéo", exact: true }).click();
  await (await chooser).setFiles({ name: "discussion-fixture.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("discussion-fixture.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publier le sujet", exact: true }).dblclick();
  await expect(page.getByRole("button", { name: "Réessayer le même envoi", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Titre du sujet", exact: true })).toHaveValue(title);
  await expect(page.getByRole("textbox", { name: "Votre message", exact: true })).toHaveValue(message);
  await page.screenshot({ path: `${output}/retry-preserved-draft.png` });
  await page.getByRole("button", { name: "Réessayer le même envoi", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const attempts = mutations.filter(row => row.rpc === "publish_club_discussion");
  expect(attempts).toHaveLength(2); expect(attempts[0].args).toEqual(attempts[1].args);
  expect(uploads).toHaveLength(2); expect(uploads[0]).toEqual(uploads[1]);
  expect(uploads[0].mime).toBe("image/png"); expect(uploads[0].size).toBe(png.length);
  expect(topics.filter(row => row.title === title)).toHaveLength(1);
  await type("Votre réponse", "Oui, organisons un accueil chaleureux pour toute l’équipe !");
  await page.getByRole("button", { name: "Publier la réponse", exact: true }).click();
  await expect(page.getByText("Oui, organisons un accueil chaleureux pour toute l’équipe !", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Vote positif", exact: true }).first().click();
  await expect.poll(() => topics[0].score).toBe(1);
  await expect.poll(() => voteReadRequested).toBe(true);
  await expect(page.getByRole("button", { name: "Vote positif", exact: true }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Vote négatif", exact: true }).first()).toBeDisabled();
  expect(mutations.filter(row => row.rpc === "vote_club_discussion")).toHaveLength(1);
  holdVoteRead = false; releaseVoteRead();
  await expect(page.getByText("L’état du vote a été actualisé.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vote positif", exact: true }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: "Vote positif", exact: true }).first().locator("..").getByText("1", { exact: true })).toBeVisible();
  expect(mutations.filter(row => row.rpc === "vote_club_discussion")).toHaveLength(1);
  expect(topics[0].score).toBe(1);
  await page.getByRole("button", { name: "Suivre le sujet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ne plus suivre", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/topic-mobile.png` });
  await page.getByRole("link", { name: "← Discussions · Club de recette rouge", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/club/${slug}/discussions$`));
  const search = page.getByPlaceholder("Rechercher dans les discussions");
  await search.pressSequentially("échangeons", { delay: 40 }); await expect(search).toHaveValue("échangeons");
  await expect(page.locator('[data-testid="discussion-card"]:visible')).toHaveCount(1);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `${output}/discussion-search-desktop.png` });
  await go(`/club/${slug}/discussions/new`);
  await type("Titre du sujet", "Rejet contrôlé de la recette");
  await type("Votre message", "Un texte fictif qui sera refusé une fois par le serveur de recette.");
  await page.getByRole("button", { name: "Publier le sujet", exact: true }).click();
  await expect(page.getByText("Contenu refusé dans cette recette : corrigez votre texte.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Titre du sujet", exact: true })).toBeEditable();
  await type("Titre du sujet", "Sujet corrigé après le rejet définitif");
  await type("Votre message", "Voici un texte corrigé après le rejet définitif et sans doublon.");
  await page.getByRole("button", { name: "Publier le sujet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sujet corrigé après le rejet définitif", exact: true })).toBeVisible();
  const correction = mutations.filter(row => row.rpc === "publish_club_discussion").slice(-2);
  expect(correction[0].args.p_id).not.toBe(correction[1].args.p_id);
  expect(topics.some(row => row.title === "Rejet contrôlé de la recette")).toBe(false);
  expect(topics[0].is_locked).toBe(true);
  await expect(page.getByText("Ce sujet n’accepte plus de nouvelles réponses.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Options", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Modifier", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Supprimer", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirmer la suppression", exact: true }).click();
  await expect(page.getByText("Ce contenu a été retiré.", { exact: true }).first()).toBeVisible();
  expect(mutations.filter(row => row.rpc === "remove_club_discussion")).toHaveLength(1);
  expect(topics[0].deleted).toBe(true);
  expect(errors).toEqual([]);
  expect(professionalBadgeRequests).toBe(0);
  writeFileSync(`${output}/report.json`, JSON.stringify({ passed: true, mutationCount: mutations.length, retrySameId: true, uploadRetrySameId: true, lostVoteReconciledWithoutToggleRetry: true, lockedAuthorCanDelete: true, editableAfterDefiniteRejection: true, professionalBadgeRequests, replies: replies.length, reads: reads.length, blockedExternalOrigins: [...new Set(externalRequests)], screenshots: output }, null, 2));
  rmSync(`${output}/failure.json`, { force: true }); rmSync(`${output}/failure.png`, { force: true });
  console.log(`Discussion UI checks passed: ${output}`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), url: page.url(), text: await page.locator("body").innerText().catch(() => ""), errors, mutations, uploads, reads }, null, 2));
  throw error;
} finally { await browser.close(); }
