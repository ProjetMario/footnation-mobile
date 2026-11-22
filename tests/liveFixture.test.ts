import { afterAll, beforeAll, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";

const server = createFixtureServer({ live: true });
const actor = "00000000-0000-4000-8000-000000000001";
const viewer = "00000000-0000-4000-8000-000000000002";
let base: string;
let creator: ReturnType<typeof createClient>;
let audience: ReturnType<typeof createClient>;
let streamId: string;
const streamSelection =
  "id,club_id,match_id,title,home_team,away_team,status,started_at,ended_at,expires_at,video_url,broadcaster_id,broadcaster:profiles!live_streams_broadcaster_id_fkey(id,full_name,username,avatar_url)";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  creator = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  audience = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (
      await creator.auth.signInWithPassword({
        email: "player@fixture.test",
        password: "fixture",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await audience.auth.signInWithPassword({
        email: "coach@fixture.test",
        password: "fixture",
      })
    ).error,
  ).toBeNull();
});
afterAll(async () => {
  creator.auth.stopAutoRefresh();
  audience.auth.stopAutoRefresh();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const fault = (value: string) =>
  fetch(base + "/__fixture/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fault: value }),
  });

it("creates a simple live using the exact ClubLive payload and returns its broadcaster without fabricating video", async () => {
  const payload = {
    match_id: `simple:${actor}:${Date.now()}`,
    club_id: null,
    broadcaster_id: actor,
    title: "Live de recette",
    status: "live",
    started_at: new Date().toISOString(),
    home_team: "Recette player",
    away_team: null,
  };
  expect(
    (await audience.from("live_streams").insert(payload)).error,
  ).not.toBeNull();
  await fault("create");
  expect(
    (await creator.from("live_streams").insert(payload).select("id").single())
      .error,
  ).not.toBeNull();
  await fault("none");
  const created = await creator
    .from("live_streams")
    .insert(payload)
    .select("id")
    .single();
  expect(created.error).toBeNull();
  streamId = created.data.id;
  const listed = await audience
    .from("live_streams")
    .select(streamSelection)
    .eq("status", "live")
    .is("ended_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  expect(listed.error).toBeNull();
  expect(listed.data).toHaveLength(1);
  expect(listed.data?.[0]).toMatchObject({
    id: streamId,
    broadcaster: { full_name: "Recette player" },
    video_url: null,
  });
});

it("can fail network notifications without losing the already-created live", async () => {
  const rows = [
    {
      sender_id: actor,
      receiver_id: viewer,
      type: "live_started",
      content: "Recette player est en live sur FootNation",
      link: `/live/${streamId}`,
      metadata: { stream_id: streamId, kind: "simple_live" },
    },
  ];
  await fault("notifications");
  expect(
    (await creator.from("notifications").insert(rows)).error,
  ).not.toBeNull();
  expect(
    (
      await creator
        .from("live_streams")
        .select("id")
        .eq("id", streamId)
        .single()
    ).data?.id,
  ).toBe(streamId);
  await fault("none");
  expect((await creator.from("notifications").insert(rows)).error).toBeNull();
  expect(
    (
      await audience
        .from("notifications")
        .select("id")
        .eq("receiver_id", viewer)
    ).data,
  ).toHaveLength(1);
});

it("persists actual viewer heartbeat, comments and likes with profile joins and actor checks", async () => {
  const now = new Date().toISOString();
  const absent = await audience
    .from("live_stream_viewers")
    .update({ last_seen: now })
    .eq("stream_id", streamId)
    .eq("user_id", viewer)
    .select("stream_id")
    .maybeSingle();
  expect(absent.error).toBeNull();
  expect(absent.data).toBeNull();
  expect(
    (
      await audience
        .from("live_stream_viewers")
        .insert({
          stream_id: streamId,
          user_id: viewer,
          joined_at: now,
          last_seen: now,
        })
    ).error,
  ).toBeNull();
  expect(
    (
      await audience
        .from("live_stream_viewers")
        .update({ last_seen: now })
        .eq("stream_id", streamId)
        .eq("user_id", viewer)
        .select("stream_id")
        .maybeSingle()
    ).data?.stream_id,
  ).toBe(streamId);
  expect(
    (
      await audience
        .from("live_stream_comments")
        .insert({ stream_id: streamId, user_id: viewer, body: "Bravo" })
    ).error,
  ).toBeNull();
  expect(
    (
      await audience
        .from("live_stream_likes")
        .insert({ stream_id: streamId, user_id: viewer })
    ).error,
  ).toBeNull();
  const people = await creator
    .from("live_stream_viewers")
    .select("user_id,profile:profiles(id,full_name,username,avatar_url)")
    .eq("stream_id", streamId)
    .gt("last_seen", new Date(Date.now() - 45000).toISOString());
  expect(people.error).toBeNull();
  expect(people.data?.[0]).toMatchObject({
    user_id: viewer,
    profile: { full_name: "Recette coach" },
  });
  expect(
    (
      await creator
        .from("live_stream_likes")
        .select("stream_id", { count: "exact", head: true })
        .eq("stream_id", streamId)
    ).count,
  ).toBe(1);
  expect(
    (await creator.from("live_stream_viewers").delete().eq("user_id", viewer))
      .error,
  ).not.toBeNull();
  expect(
    (
      await audience
        .from("live_stream_viewers")
        .delete()
        .eq("stream_id", streamId)
        .eq("user_id", viewer)
    ).error,
  ).toBeNull();
});

it("can fail stopping and later recover the same stream; another account cannot stop it", async () => {
  const end = { status: "ended", ended_at: new Date().toISOString() };
  expect(
    (await audience.from("live_streams").update(end).eq("id", streamId)).error,
  ).not.toBeNull();
  await fault("stop");
  expect(
    (await creator.from("live_streams").update(end).eq("id", streamId)).error,
  ).not.toBeNull();
  expect(
    (
      await creator
        .from("live_streams")
        .select("status")
        .eq("id", streamId)
        .single()
    ).data?.status,
  ).toBe("live");
  await fault("none");
  expect(
    (await creator.from("live_streams").update(end).eq("id", streamId)).error,
  ).toBeNull();
  expect(
    (
      await creator
        .from("live_streams")
        .select("status,ended_at")
        .eq("id", streamId)
        .single()
    ).data,
  ).toEqual(end);
  expect(
    (await creator.from("live_streams").update(end).eq("id", streamId)).error,
  ).toBeNull();
});
