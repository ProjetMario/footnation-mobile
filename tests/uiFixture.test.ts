import { afterAll, beforeAll, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";
import { permitted, install } from "../scripts/audit/network-guard.cjs";
import { applyClubFollowIntent } from "../src/lib/clubFollowIntent";
import { publishShortComment } from "../src/lib/shortComments";
const server = createFixtureServer();
let base: string;
let client: ReturnType<typeof createClient>;
const actor = "00000000-0000-4000-8000-000000000001";
const author = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  client = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({
    email: "player@fixture.test",
    password: "fixture-only",
  });
  expect(signed.error).toBeNull();
});
afterAll(async () => {
  client.auth.stopAutoRefresh();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it("reads two distinct pages and resolves actual fixture names", async () => {
  const first = await client.from("posts").select("*").range(0, 19);
  const next = await client.from("posts").select("*").range(20, 39);
  expect(first.data).toHaveLength(20);
  expect(next.data).toHaveLength(20);
  expect(first.data?.[0].id).not.toBe(next.data?.[0].id);
  const profile = await client
    .from("profiles")
    .select("*")
    .eq("id", actor)
    .single();
  expect(profile.data.full_name).toBe("Recette player");
});
it("follows then unfollows through the real intent service and a persistent local HTTP mock", async () => {
  const read = async () => {
    const r = await client
      .from("club_followers")
      .select("id")
      .eq("profile_id", actor)
      .eq("club_id", author)
      .maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  };
  const api = {
    read,
    insert: async () => {
      const r = await client
        .from("club_followers")
        .insert({ profile_id: actor, club_id: author });
      if (r.error) throw r.error;
    },
    remove: async (id: string) => {
      const r = await client
        .from("club_followers")
        .delete()
        .eq("id", id)
        .eq("profile_id", actor)
        .select("id");
      if (r.error) throw r.error;
      return r.data.length === 1;
    },
  };
  await applyClubFollowIntent(api, true, null);
  const row = await read();
  expect(row.id).toBeTruthy();
  await applyClubFollowIntent(api, false, row.id);
  expect(await read()).toBeNull();
});
it("persists a short comment through the production validation service without any external database", async () => {
  await publishShortComment(client, {
    shortId: "local-short",
    userId: actor,
    content: "Bravo l’équipe !",
  });
  const r = await client
    .from("short_comments")
    .select("*")
    .eq("short_id", "local-short");
  expect(r.data?.[0]).toMatchObject({
    content: "Bravo l’équipe !",
    user_id: actor,
  });
});
it("returns errors, never false success, for unknown operations and foreign-account writes", async () => {
  expect((await client.rpc("not_simulated")).status).toBe(501);
  expect((await client.from("unknown_table").select("*")).status).toBe(501);
  expect((await client.from("__proto__").select("*")).status).toBe(501);
  expect(
    (
      await client
        .from("post_comments")
        .insert({ user_id: author, content: "wrong user" })
    ).status,
  ).toBe(403);
});
it("switches between empty, forbidden, expired-session and error fixtures then recovers", async () => {
  for (const [scenario, status] of [
    ["empty", 200],
    ["forbidden", 403],
    ["unauthorized", 401],
    ["error", 503],
    ["normal", 200],
  ] as const) {
    await fetch(base + "/__fixture", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    });
    const result = await client.from("posts").select("*").retry(false);
    expect(result.status).toBe(status);
    if (scenario === "empty") expect(result.data).toEqual([]);
    if (scenario === "normal") expect(result.data).toHaveLength(45);
  }
});
it("restricts the UI transport to the exact recipe servers", async () => {
  for (const url of [
    "https://www.foot-nation.com",
    "http://evil.test",
    "http://localhost:9999",
    "http://localhost.evil.test:7082",
    "http://user@localhost:7082",
    "file:///tmp/x",
  ])
    expect(permitted(url)).toBe(false);
  expect(permitted("http://127.0.0.1:7082/rest/v1/posts")).toBe(true);
  let calls = 0;
  const target: any = {
    fetch: async () => {
      calls++;
      return "local";
    },
  };
  install(target);
  await expect(target.fetch("https://example.com")).rejects.toThrow("bloquée");
  expect(calls).toBe(0);
});

it("distinguishes a member from a simulated club manager without granting every club", async () => {
  const clubId = "30000000-0000-4000-8000-000000000001";
  expect((await client.rpc("is_club_admin", { p_club_id: clubId })).data).toBe(
    false,
  );
  const manager = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await manager.auth.signInWithPassword({
    email: "club@fixture.test",
    password: "fixture-only",
  });
  expect((await manager.rpc("is_club_admin", { p_club_id: clubId })).data).toBe(
    true,
  );
  expect(
    (await manager.rpc("is_club_admin", { p_club_id: "another-club" })).data,
  ).toBe(false);
  manager.auth.stopAutoRefresh();
});

it("provides contrasting club fixtures and three installations without altering real clubs", async () => {
  const result = await client.from("fff_clubs").select("*").order("id");
  expect(result.data).toHaveLength(2);
  expect(result.data?.[0].infrastructure).toHaveLength(3);
  expect(result.data?.[0].colors).not.toBe(result.data?.[1].colors);
});

const redClub = "30000000-0000-4000-8000-000000000001";
const blueClub = "30000000-0000-4000-8000-000000000002";
const futureMatch = "40000000-0000-4000-8000-000000000001";
const finishedMatch = "40000000-0000-4000-8000-000000000002";
const playerId = "60000000-0000-4000-8000-000000000001";

it("joins FootLovers to their real fixture profiles and keeps followers, members and fans distinct", async () => {
  const readFollowers = () =>
    client
      .from("club_followers")
      .select(
        "id,profile:profiles!club_followers_profile_id_fkey(id,full_name,first_name,last_name,username,avatar_url)",
      )
      .eq("club_id", redClub)
      .order("id");
  const initial = await readFollowers();
  expect(initial.error).toBeNull();
  expect(initial.data?.map((row: any) => row.profile.full_name)).toEqual([
    "Recette coach",
    "Recette admin",
  ]);
  const count = await client
    .from("club_followers")
    .select("id", { count: "exact", head: true })
    .eq("club_id", redClub);
  expect(count.count).toBe(2);
  expect(
    (
      await client
        .from("club_followers")
        .insert({ profile_id: actor, club_id: redClub })
    ).error,
  ).toBeNull();
  const followed = await readFollowers();
  expect(followed.data).toHaveLength(3);
  expect(
    followed.data?.some(
      (row: any) =>
        row.profile.id === actor && row.profile.full_name === "Recette player",
    ),
  ).toBe(true);
  expect(
    (
      await client
        .from("club_followers")
        .delete()
        .eq("club_id", redClub)
        .eq("profile_id", actor)
    ).error,
  ).toBeNull();
  expect((await readFollowers()).data).toHaveLength(2);
  const members = await client
    .from("profiles")
    .select("id,full_name")
    .eq("club", "Club de recette rouge");
  expect(members.data?.map((row) => row.id)).toEqual([
    actor,
    author,
    "00000000-0000-4000-8000-000000000007",
  ]);
  const name = JSON.stringify("Club de recette rouge");
  const fans = await client
    .from("profiles")
    .select("id,full_name")
    .or(`favorite_pro_club.eq.${name},favorite_amateur_club.eq.${name}`);
  expect(fans.error).toBeNull();
  expect(fans.data?.map((row) => row.id)).toEqual([author]);
  const noFans = await client
    .from("profiles")
    .select("id")
    .or(
      'favorite_pro_club.eq."No club, at all",favorite_amateur_club.eq."No club, at all"',
    );
  expect(noFans.data).toEqual([]);
  expect(
    (
      await client
        .from("club_followers")
        .delete()
        .eq("club_id", redClub)
        .eq("profile_id", author)
    ).status,
  ).toBe(403);
});

it("recalculates prediction totals after a vote, changed choice and withdrawal without leaking another match", async () => {
  const stats = () =>
    client
      .from("match_prediction_stats")
      .select("*")
      .eq("match_id", futureMatch)
      .maybeSingle();
  expect((await stats()).data).toMatchObject({
    home_count: 1,
    away_count: 1,
    draw_count: 0,
    total_count: 2,
  });
  const vote = (prediction: string, user_id = actor) =>
    client
      .from("match_predictions")
      .upsert(
        { match_id: futureMatch, user_id, prediction },
        { onConflict: "match_id,user_id" },
      )
      .select("id")
      .single();
  expect((await vote("draw")).error).toBeNull();
  expect((await stats()).data).toMatchObject({
    home_count: 1,
    away_count: 1,
    draw_count: 1,
    total_count: 3,
  });
  expect((await vote("home")).error).toBeNull();
  expect((await stats()).data).toMatchObject({
    home_count: 2,
    away_count: 1,
    draw_count: 0,
    total_count: 3,
  });
  expect((await vote("draw", author)).status).toBe(403);
  expect((await vote("invalid")).status).toBe(400);
  const voters = await client
    .from("match_predictions")
    .select("user_id,prediction,created_at")
    .eq("match_id", futureMatch)
    .order("created_at");
  const voterProfiles = await client
    .from("profiles")
    .select("id,full_name")
    .in(
      "id",
      voters.data!.map((row) => row.user_id),
    );
  expect(voterProfiles.data?.map((row) => row.full_name)).toEqual([
    "Recette player",
    "Recette coach",
    "Recette admin",
  ]);
  expect(
    (
      await client
        .from("match_prediction_stats")
        .select("*")
        .eq("match_id", finishedMatch)
        .maybeSingle()
    ).data,
  ).toBeNull();
  expect(
    (
      await client
        .from("match_predictions")
        .delete()
        .eq("match_id", futureMatch)
        .eq("user_id", actor)
    ).error,
  ).toBeNull();
  expect((await stats()).data.total_count).toBe(2);
});

it("implements the MVP RPC contract for finished fixture matches and derives voter identity from the session", async () => {
  const candidates = () =>
    client.rpc("get_native_match_mvp_candidates", {
      p_match_id: finishedMatch,
      p_club_id: redClub,
      p_offset: 0,
    });
  const first = await candidates();
  expect(first.error).toBeNull();
  expect(first.data).toHaveLength(2);
  expect(first.data.every((row: any) => row.vote_count === 0)).toBe(true);
  expect(
    (
      await client.rpc("get_native_match_mvp_candidates", {
        p_match_id: finishedMatch,
        p_club_id: blueClub,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await client.rpc("get_native_match_mvp_candidates", {
        p_match_id: futureMatch,
        p_club_id: redClub,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await client.rpc("get_native_match_mvp_candidates", {
        p_match_id: finishedMatch,
        p_club_id: redClub,
        p_offset: -1,
      })
    ).error?.code,
  ).toBe("22023");
  const args = {
    p_id: "90000000-0000-4000-8000-000000000001",
    p_match_id: finishedMatch,
    p_player_id: playerId,
  };
  expect(
    (
      await client.rpc("cast_native_match_mvp_vote", {
        ...args,
        voter_id: author,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await client.rpc("cast_native_match_mvp_vote", {
        ...args,
        p_match_id: futureMatch,
      })
    ).error?.code,
  ).toBe("42501");
  expect((await client.rpc("cast_native_match_mvp_vote", args)).data).toBe(
    args.p_id,
  );
  expect((await client.rpc("cast_native_match_mvp_vote", args)).data).toBe(
    args.p_id,
  );
  expect(
    (
      await client.rpc("cast_native_match_mvp_vote", {
        ...args,
        p_player_id: "60000000-0000-4000-8000-000000000002",
      })
    ).error?.code,
  ).toBe("23505");
  const own = await client
    .from("match_mvp_votes")
    .select("id,player_id,player:club_players(name)")
    .eq("match_id", finishedMatch)
    .eq("voter_id", actor)
    .maybeSingle();
  expect(own.data).toMatchObject({
    voter_id: actor,
    player: { name: "Recette player" },
  });
  expect((await candidates()).data[0]).toMatchObject({
    id: playerId,
    vote_count: 1,
  });
  expect(
    (
      await client.from("match_mvp_votes").insert({
        voter_id: actor,
        match_id: finishedMatch,
        player_id: playerId,
      })
    ).status,
  ).toBe(501);
  const anonymous = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await anonymous.rpc("cast_native_match_mvp_vote", args)).status).toBe(
    401,
  );
});

it("supports explicit club filters and joins while rejecting unsupported fixture queries", async () => {
  const future = await client
    .from("club_matches")
    .select("*")
    .eq("club_id", redClub)
    .or(`match_date.gte.${new Date().toISOString()},status.eq.live`);
  expect(future.data?.map((row) => row.id)).toEqual([futureMatch]);
  const roster = await client
    .from("club_players")
    .select("id,name,profile:profiles(id,avatar_url)")
    .eq("club_id", redClub)
    .eq("is_active", true)
    .ilike("name", "%player%");
  expect(roster.data).toHaveLength(1);
  expect(roster.data?.[0].profile.id).toBe(actor);
  const ranking = await client
    .from("club_player_rankings")
    .select("id,goals_total,assists_total,player:club_players(name)")
    .eq("club_id", redClub)
    .eq("ranking_type", "current")
    .order("goals_total", { ascending: false });
  expect(ranking.data?.[0].player.name).toBe("Recette player");
  expect(
    (await client.from("club_followers").select("id,unknown:profiles(id)"))
      .status,
  ).toBe(501);
  expect(
    (
      await client
        .from("profiles")
        .select("*")
        .textSearch("full_name", "player")
    ).status,
  ).toBe(501);
});

it("does not allow upserts to reassign another user's fixture row", async () => {
  const result = await client.from("club_followers").upsert(
    {
      id: "50000000-0000-4000-8000-000000000001",
      profile_id: actor,
      club_id: redClub,
    },
    { onConflict: "id" },
  );
  expect(result.status).toBe(403);
  const original = await client
    .from("club_followers")
    .select("profile_id")
    .eq("id", "50000000-0000-4000-8000-000000000001")
    .single();
  expect(original.data.profile_id).toBe(author);
});

it("serves a local portrait presentation short with its author and byte ranges for media playback", async () => {
  const shorts = await client
    .from("shorts")
    .select(
      "*,user:profiles!shorts_user_id_fkey(id,full_name,username,avatar_url)",
    )
    .order("created_at", { ascending: false });
  expect(shorts.error).toBeNull();
  expect(shorts.data).toHaveLength(1);
  const short = shorts.data![0];
  expect(short.user.full_name).toBe("Recette coach");
  expect(short.duration).toBe(10);
  expect(short.video_url).toBe(`${base}/__fixture/media/club-intro.mp4`);
  const head = await fetch(short.video_url, { method: "HEAD" });
  expect(head.status).toBe(200);
  expect(head.headers.get("content-type")).toBe("video/mp4");
  expect(head.headers.get("accept-ranges")).toBe("bytes");
  const size = Number(head.headers.get("content-length"));
  expect(size).toBeGreaterThan(1000);
  const beginning = await fetch(short.video_url, {
    headers: { Range: "bytes=0-63" },
  });
  expect(beginning.status).toBe(206);
  expect(beginning.headers.get("content-range")).toBe(`bytes 0-63/${size}`);
  const bytes = Buffer.from(await beginning.arrayBuffer());
  expect(bytes.length).toBe(64);
  expect(bytes.toString("ascii", 4, 8)).toBe("ftyp");
  const ending = await fetch(short.video_url, {
    headers: { Range: "bytes=-16" },
  });
  expect(ending.status).toBe(206);
  expect(ending.headers.get("content-range")).toBe(
    `bytes ${size - 16}-${size - 1}/${size}`,
  );
  expect((await ending.arrayBuffer()).byteLength).toBe(16);
  const invalid = await fetch(short.video_url, {
    headers: { Range: `bytes=${size}-` },
  });
  expect(invalid.status).toBe(416);
  expect((await fetch(short.video_url, { method: "POST" })).status).toBe(405);
  expect((await fetch(`${base}/__fixture/media/unknown.mp4`)).status).toBe(404);
  await publishShortComment(client, {
    shortId: short.id,
    userId: actor,
    content: "Commentaire de recette vidéo",
  });
  const comments = await client
    .from("short_comments")
    .select(
      "id,user_id,content,author:profiles!short_comments_user_id_fkey(id,full_name,username,avatar_url)",
    )
    .eq("short_id", short.id);
  expect(comments.data?.[0].author.full_name).toBe("Recette player");
});
