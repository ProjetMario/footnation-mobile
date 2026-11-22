import test from "node:test";
import assert from "node:assert/strict";
import { matchTeamLogo, effectiveClubLogo, exactAmateurClubLogo, isProfessionalClub, projectClubLogos, projectProviderScoreboardLogos } from "../src/lib/clubLogoPolicy.mjs";
import { clubLogoFetch, clubLogoSelection, projectSelectedClubLogos } from "../src/lib/clubLogoFetch.mjs";

const badge = "https://images.example/club.png";
const base = "https://test.supabase.co";
const json = data => new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "content-range": "0-1/2" } });

test("explicit and canonically verified professional identities suppress every candidate", () => {
  for (const identity of [
    { is_pro: true }, { clubProfessional: true }, { professional_status: "verified" }, {is_pro: null, metadata: {professional_status: "verified"}},
    { providerContext: "professional" }, { clubKind: "professional" },
    { id: "club", canonicalClub: { id: "club", is_pro: true } },
    { club_id: "club", canonicalClub: { id: "club", professional_status: "verified" } },
  ]) assert.equal(effectiveClubLogo(identity, badge), null);
  assert.equal(effectiveClubLogo({ id: "other", canonicalClub: { id: "club", is_pro: true } }, badge), badge);
});

test("amateur and national badges remain, names and divisions do not classify a club", () => {
  for (const club of [
    { is_pro: false }, { providerContext: "national" }, { clubKind: "national" },
    { name: "Real Madrid local academy", division: "Premier League" },
  ]) assert.equal(effectiveClubLogo(club, badge), badge);
  assert.equal(isProfessionalClub({ professional_status: "unknown" }), false);
});

test("public projection is immutable and removes all known badge fallbacks, preserving avatars", () => {
  const club = { is_pro: true, logo_url: badge, logo: badge, metadata: { logo: badge, logo_url: badge, colors: "blue" }, avatar_url: "person", profile: { avatar_url: "other-person" } };
  const result = projectClubLogos(club);
  assert.equal(result.logo_url, null); assert.equal(result.logo, null);
  assert.deepEqual(result.metadata, { logo: null, logo_url: null, colors: "blue" });
  assert.equal(result.avatar_url, "person"); assert.equal(result.profile, club.profile);
  assert.equal(club.metadata.logo, badge); assert.equal(club.logo_url, badge);
});

test("verified professional status in metadata also suppresses generated badge projections", () => {
  const club = {is_pro:null,logo_url:badge,metadata:{professional_status:'verified',logo:badge}};
  const result = projectClubLogos(club);
  assert.equal(result.logo_url,null);
  assert.equal(result.metadata.logo,null);
  assert.equal(result.metadata.professional_status,'verified');
  assert.equal(club.logo_url,badge);
});

test("fallback requires one exact known amateur; ambiguous, unknown, professional and fuzzy rows fail closed", () => {
  const amateur = { name: "Étoile FC", is_pro: false, logo_url: badge };
  assert.equal(exactAmateurClubLogo("Etoile F.C.", [amateur]), badge);
  assert.equal(exactAmateurClubLogo("Etoile", [amateur]), null);
  assert.equal(exactAmateurClubLogo(amateur.name, [amateur, { ...amateur, is_pro: true }]), null);
  assert.equal(exactAmateurClubLogo(amateur.name, [{ ...amateur, is_pro: null }]), null);
  assert.equal(exactAmateurClubLogo(amateur.name, [{ ...amateur, is_pro: true }]), null);
});

test("select projection is limited to explicit club relations including nested aliases", () => {
  const selection = clubLogoSelection("id,club:profiles(id,avatar_url),team:teams(id,organisation:fff_clubs!inner(id,badge:logo_url,details:metadata))");
  assert.equal(selection.select, "id,club:profiles(id,avatar_url),team:teams(id,organisation:fff_clubs!inner(id,badge:logo_url,details:metadata,is_pro,__fn_professional_status:metadata->>professional_status))");
  const input = { id: "member", club: { id: "person", avatar_url: badge }, team: { id: "t", organisation: { id: "c", is_pro: true, badge, details: { logo: badge, city: "Paris" } } } };
  const output = projectSelectedClubLogos(input, selection);
  assert.equal(output.club, input.club);
  assert.equal(output.team.organisation.badge, null);
  assert.deepEqual(output.team.organisation.details, { logo: null, city: "Paris" });
  assert.equal(input.team.organisation.badge, badge);
});

test("read adapter requests classification before projecting direct clubs, preserving counts and headers", async () => {
  let received;
  const init = { headers: { Authorization: "Bearer test-only" }, signal: new AbortController().signal };
  const fetcher = clubLogoFetch(base, async (url, options) => {
    received = { url, options };
    return json([{ id: "pro", is_pro: true, logo_url: badge }, { id: "amateur", is_pro: false, logo_url: badge }]);
  });
  const response = await fetcher(`${base}/rest/v1/fff_clubs?select=id,logo_url&limit=30`, init);
  assert.equal(new URL(received.url).searchParams.get("select"), "id,logo_url,is_pro,__fn_professional_status:metadata->>professional_status");
  assert.equal(new URL(received.url).searchParams.get("limit"), "30");
  assert.equal(received.options, init);
  assert.equal(response.headers.get("content-range"), "0-1/2");
  assert.deepEqual((await response.json()).map(row => row.logo_url), [null, badge]);
});

test("joined singular and array clubs are projected, null relationships and people stay intact", async () => {
  const rows = [{ club: { is_pro: true, logo_url: badge }, author: { avatar_url: badge } }, { club: null }, { club: [{ is_pro: true, logo_url: badge }, { is_pro: false, logo_url: badge }] }];
  const fetcher = clubLogoFetch(base, async () => json(rows));
  const response = await fetcher(`${base}/rest/v1/club_followers?select=club:fff_clubs(logo_url),author:profiles(avatar_url)`);
  const result = await response.json();
  assert.equal(result[0].club.logo_url, null); assert.equal(result[0].author.avatar_url, badge);
  assert.equal(result[1].club, null); assert.deepEqual(result[2].club.map(row => row.logo_url), [null, badge]);
});

test("projects metadata-only professional status without leaking its internal select alias", async () => {
  const fetcher = clubLogoFetch(base, async () => json([{id:'verified',is_pro:null,logo_url:badge,__fn_professional_status:'verified'},{id:'amateur',is_pro:false,logo_url:badge,__fn_professional_status:null}]));
  const response = await fetcher(`${base}/rest/v1/fff_clubs?select=id,logo_url`);
  const rows = await response.json();
  assert.deepEqual(rows.map(row=>row.logo_url),[null,badge]);
  assert.ok(rows.every(row=>!Object.hasOwn(row,'__fn_professional_status')&&!Object.hasOwn(row,'professional_status')));
});

test("auth, RPC, storage, foreign origins, unrelated tables and all writes pass through unchanged", async () => {
  for (const [url, method] of [
    [`${base}/auth/v1/user`, "GET"], [`${base}/storage/v1/object/fff_clubs`, "GET"],
    [`${base}/rest/v1/rpc/fff_clubs`, "POST"], [`${base}/rest/v1/profiles?select=avatar_url`, "GET"],
    [`${base}/rest/v1/fff_clubs?select=id,name`, "GET"], [`${base}/rest/v1/fff_clubs?select=count()`, "GET"],
    ["https://elsewhere.example/rest/v1/fff_clubs", "GET"],
    ...["POST", "PATCH", "DELETE", "HEAD"].map(method => [`${base}/rest/v1/fff_clubs?select=*`, method]),
  ]) {
    const response = json({ is_pro: true, logo_url: badge });
    const init = { method };
    const fetcher = clubLogoFetch(base, async (received, options) => {
      assert.equal(received, url); assert.equal(options, init); return response;
    });
    assert.equal(await fetcher(url, init), response);
  }
});

test("Request inputs retain authorization and server failures are passed through", async () => {
  const request = new Request(`${base}/rest/v1/fff_clubs?select=logo_url`, { headers: { Authorization: "Bearer test-only" } });
  const failure = new Response('{"message":"denied"}', { status: 403, headers: { "content-type": "application/json" } });
  const fetcher = clubLogoFetch(base, async received => {
    assert.equal(received.headers.get("authorization"), "Bearer test-only");
    assert.equal(new URL(received.url).searchParams.get("select"), "logo_url,is_pro,__fn_professional_status:metadata->>professional_status");
    return failure;
  });
  assert.equal(await fetcher(request), failure);
});

test("match feeds keep provider badges while club profile suppression stays independent", () => {
  const pro = { id: "pro", logo: badge, name: "Professional" };
  const national = { id: "national", logo: badge, name: "National" };
  const amateur = { id: "amateur", logo: badge, name: "Amateur", is_pro: false };
  const data = { matches: [{ national: false, home: pro, away: amateur }, { national: true, home: national, away: national }], teams: [pro, national, amateur] };
  const result = projectProviderScoreboardLogos(data, match => match.national);
  assert.deepEqual(result.teams.map(team => team.logo), [badge, badge, badge]);
  assert.equal(result.matches[0].home.logo, badge);
  assert.equal(effectiveClubLogo({is_pro:true}, badge), null);
  assert.equal(result.matches[0].away.logo, badge);
  assert.equal(data.matches[0].home.logo, badge);
});

test("metadata scalar city selections are untouched while logo aliases are suppressed", () => {
  assert.equal(clubLogoSelection("city:metadata->>city", true).hasClubs, false);
  const selection = clubLogoSelection("city:metadata->>city,badge:metadata->>logo", true);
  assert.deepEqual(projectSelectedClubLogos({ city: "Paris", badge, is_pro: true }, selection), { city: "Paris", badge: null, is_pro: true, logo_url: null });
});

 test("match feeds reject unsafe or malformed image URLs", () => {
  for (const value of [null, "", "http://example.com/logo.png", "javascript:alert(1)", "https://user:password@example.com/logo.png", "/logo.png"])
    assert.equal(matchTeamLogo(value), null);
  assert.equal(matchTeamLogo(badge), badge);
});
