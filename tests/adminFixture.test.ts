import { isProfileMinimumComplete } from "../../src/lib/profileCompletion";
import { createProContent } from "../src/lib/proContentSave";
import { loadClubAttendanceSummary } from "../src/lib/clubAttendanceSummary";
const serviceClient = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  supabase: { from: (...args: any[]) => serviceClient.current.from(...args) },
}));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";
let server: ReturnType<typeof createFixtureServer>;
let base: string;
const clients: ReturnType<typeof createClient>[] = [];
const red = "30000000-0000-4000-8000-000000000001",
  blue = "30000000-0000-4000-8000-000000000002";
const team = "b0000000-0000-4000-8000-000000000001",
  reserve = "b0000000-0000-4000-8000-000000000002",
  other = "b0000000-0000-4000-8000-000000000003";
const session = "c0000000-0000-4000-8000-000000000001",
  convocation = "d0000000-0000-4000-8000-000000000001";
const player = "60000000-0000-4000-8000-000000000001",
  profile = "00000000-0000-4000-8000-000000000001";
const match = "40000000-0000-4000-8000-000000000001";
beforeEach(async () => {
  server = createFixtureServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) client.auth.stopAutoRefresh();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function sign(role = "club") {
  const client = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  expect(
    (
      await client.auth.signInWithPassword({
        email: `${role}@fixture.test`,
        password: "fixture-only",
      })
    ).error,
  ).toBeNull();
  return client;
}
it("scopes the club owner to red and the coach to Seniors A, and reflects revoked membership", async () => {
  const owner = await sign(),
    coach = await sign("coach"),
    member = await sign("player");
  for (const name of ["is_club_admin", "is_fff_club_admin"]) {
    expect((await owner.rpc(name, { p_club_id: red })).data).toBe(true);
    expect((await owner.rpc(name, { p_club_id: blue })).data).toBe(false);
    expect((await coach.rpc(name, { p_club_id: red })).data).toBe(false);
  }
  expect(
    (await owner.rpc("get_native_calendar_editor_teams", { p_club_id: red }))
      .data,
  ).toHaveLength(2);
  expect(
    (
      await coach.rpc("get_native_calendar_editor_teams", { p_club_id: red })
    ).data?.map((t: any) => t.id),
  ).toEqual([team]);
  expect(
    (await member.rpc("get_native_calendar_editor_teams", { p_club_id: red }))
      .data,
  ).toEqual([]);
  expect(
    (
      await owner
        .from("team_members")
        .update({ is_active: false })
        .eq("profile_id", "00000000-0000-4000-8000-000000000002")
    ).error,
  ).toBeNull();
  expect(
    (
      await coach.rpc("can_manage_native_calendar_event", {
        p_club_id: red,
        p_team_id: team,
      })
    ).data,
  ).toBe(false);
});
it("creates a team, rejects duplicate IDs and checks full snapshots before update/delete", async () => {
  const owner = await sign();
  const id = randomUUID();
  const row = {
    id,
    club_id: red,
    name: "U17 recette",
    category: "U17",
    season: "2026-2027",
    is_active: true,
    age_group: "U17",
  };
  expect((await owner.from("teams").insert(row)).error).toBeNull();
  expect((await owner.from("teams").insert(row)).error?.code).toBe("23505");
  const saved = (await owner.from("teams").select("*").eq("id", id).single())
    .data;
  const args = {
    p_section: "teams",
    p_club_id: red,
    p_id: id,
    p_expected: saved,
    p_values: { name: "U17 modifié" },
    p_delete: false,
  };
  expect(
    (await owner.rpc("mutate_native_club_record_snapshot", args)).data,
  ).toBe(id);
  expect(
    (await owner.rpc("mutate_native_club_record_snapshot", args)).error?.code,
  ).toBe("40001");
  const fresh = (await owner.from("teams").select("*").eq("id", id).single())
    .data;
  expect(
    (
      await owner.rpc("mutate_native_club_record_snapshot", {
        ...args,
        p_expected: fresh,
        p_values: {},
        p_delete: true,
      })
    ).error,
  ).toBeNull();
  expect((await owner.from("teams").select("*").eq("id", id)).data).toEqual([]);
  expect((await owner.from("teams").delete().eq("id", team)).error?.code).toBe(
    "23503",
  );
});
it("allows the coach to plan its own team but rejects unassigned, reserve, foreign-team and spoofed records", async () => {
  const coach = await sign("coach");
  const row = {
    club_id: red,
    team_id: team,
    opponent_name: "Adversaire fictif",
    match_date: new Date().toISOString(),
    status: "scheduled",
    is_home: true,
  };
  expect((await coach.from("club_matches").insert(row)).error).toBeNull();
  for (const teamId of [null, reserve, other])
    expect(
      (await coach.from("club_matches").insert({ ...row, team_id: teamId }))
        .status,
    ).toBe(403);
  expect(
    (await coach.from("club_matches").insert({ ...row, created_by: profile }))
      .status,
  ).toBe(403);
  expect(
    (
      await coach
        .from("club_news")
        .insert({ club_id: red, title: "Non", content: "Non" })
    ).status,
  ).toBe(403);
});
it("persists a finished score in the public match source and rejects negative scores", async () => {
  const owner = await sign(),
    spectator = await sign("player");
  const saved = (
    await owner.from("club_matches").select("*").eq("id", match).single()
  ).data;
  const args = {
    p_section: "matches",
    p_club_id: red,
    p_id: match,
    p_expected: saved,
    p_delete: false,
  };
  expect(
    (
      await owner.rpc("mutate_native_club_record_snapshot", {
        ...args,
        p_values: { status: "finished", home_score: -1, away_score: 0 },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await owner.rpc("mutate_native_club_record_snapshot", {
        ...args,
        p_values: { status: "finished", home_score: 3, away_score: 1 },
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await spectator
        .from("club_matches")
        .select("home_score,away_score,status")
        .eq("id", match)
        .single()
    ).data,
  ).toEqual({ home_score: 3, away_score: 1, status: "finished" });
});
it("keeps news drafts private, publishes to the public feed, then deletes explicitly", async () => {
  const owner = await sign(),
    spectator = await sign("player");
  const id = randomUUID();
  expect(
    (
      await owner.from("club_news").insert({
        id,
        club_id: red,
        title: "Article brouillon",
        content: "Fictif",
        is_published: false,
      })
    ).error,
  ).toBeNull();
  expect(
    (await spectator.from("club_news").select("*").eq("id", id)).data,
  ).toEqual([]);
  expect(
    (await owner.from("club_news").update({ is_published: true }).eq("id", id))
      .error,
  ).toBeNull();
  expect(
    (await spectator.from("club_news").select("title").eq("id", id).single())
      .data?.title,
  ).toBe("Article brouillon");
  expect(
    (await owner.from("club_news").delete().eq("id", id)).error,
  ).toBeNull();
  expect(
    (await spectator.from("club_news").select("*").eq("id", id)).data,
  ).toEqual([]);
});
it("invites a club player, exposes the member response, rejects profile-ID confusion and stale removals", async () => {
  const owner = await sign(),
    member = await sign("player");
  const id = randomUUID();
  const args = {
    p_club_id: red,
    p_convocation_id: convocation,
    p_team_id: team,
    p_search: "player",
    p_offset: 0,
  };
  expect(
    (await owner.rpc("get_native_convocation_candidates", args)).data?.map(
      (p: any) => p.id,
    ),
  ).toEqual([player]);
  expect(
    (
      await owner.from("club_convocation_players").insert({
        convocation_id: convocation,
        player_id: profile,
        status: "pending",
      })
    ).error?.code,
  ).toBe("22023");
  expect(
    (
      await owner.from("club_convocation_players").insert({
        id,
        convocation_id: convocation,
        player_id: player,
        status: "pending",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner.from("club_convocation_players").insert({
        convocation_id: convocation,
        player_id: player,
        status: "pending",
      })
    ).error?.code,
  ).toBe("23505");
  const baseline = (
    await owner
      .from("club_convocation_players")
      .select("*")
      .eq("id", id)
      .single()
  ).data;
  const mine = await member.rpc("get_native_member_convocations", {
    p_offset: 0,
    p_limit: 30,
  });
  expect(mine.data?.[0].convocation.id).toBe(convocation);
  const reply = {
    p_id: id,
    p_status: "accepted",
    p_expected_status: "pending",
    p_expected_responded_at: null,
  };
  expect(
    (await member.rpc("respond_native_member_convocation", reply)).data,
  ).toBe(id);
  expect(
    (await member.rpc("respond_native_member_convocation", reply)).data,
  ).toBe(id);
  expect(
    (
      await owner.rpc("delete_native_convocation_player", {
        p_id: id,
        p_convocation_id: convocation,
        p_expected: baseline,
      })
    ).error?.code,
  ).toBe("40001");
  const joined = await owner
    .from("club_convocation_players")
    .select("id,player:club_players!player_id(name)")
    .eq("id", id)
    .single();
  expect(joined.error).toBeNull();
  expect((joined.data as any).player.name).toBe("Recette player");
});
it("saves attendance idempotently, rejects stale updates, then corrects and removes the local record", async () => {
  const owner = await sign(),
    coach = await sign("coach");
  const id = randomUUID();
  const args = {
    p_id: id,
    p_session_id: session,
    p_player_id: player,
    p_status: "present",
    p_notes: null,
    p_expected: null,
  };
  expect((await coach.rpc("save_native_attendance_record", args)).status).toBe(
    403,
  );
  expect((await owner.rpc("save_native_attendance_record", args)).data).toBe(
    id,
  );
  expect((await owner.rpc("save_native_attendance_record", args)).data).toBe(
    id,
  );
  const snapshot = (
    await owner
      .from("club_attendance_records")
      .select("id,session_id,player_id,status,notes")
      .eq("id", id)
      .single()
  ).data;
  expect(Object.keys(snapshot)).toHaveLength(5);
  expect(
    (
      await owner.rpc("save_native_attendance_record", {
        ...args,
        p_status: "absent",
      })
    ).error?.code,
  ).toBe("40001");
  expect(
    (
      await owner.rpc("save_native_attendance_record", {
        ...args,
        p_status: "late",
        p_expected: snapshot,
      })
    ).data,
  ).toBe(id);
  expect(
    (
      await owner.rpc("delete_native_attendance_record", {
        p_id: id,
        p_session_id: session,
        p_expected: snapshot,
      })
    ).error?.code,
  ).toBe("40001");
  const fresh = (
    await owner
      .from("club_attendance_records")
      .select("id,session_id,player_id,status,notes")
      .eq("id", id)
      .single()
  ).data;
  expect(
    (
      await owner.rpc("delete_native_attendance_record", {
        p_id: id,
        p_session_id: session,
        p_expected: fresh,
      })
    ).data,
  ).toBe(id);
});
it("updates the exact nine-field session snapshot and rejects lost changes", async () => {
  const owner = await sign();
  const row = (
    await owner
      .from("club_attendance_sessions")
      .select("*")
      .eq("id", session)
      .single()
  ).data;
  expect(Object.keys(row)).toHaveLength(9);
  const args = {
    p_id: session,
    p_club_id: red,
    p_expected: row,
    p_values: {
      session_type: "training",
      session_date: row.session_date,
      category: "SENIOR M1",
      notes: "Nouveau programme",
      team_id: team,
    },
  };
  expect((await owner.rpc("update_native_attendance_session", args)).data).toBe(
    session,
  );
  expect(
    (await owner.rpc("update_native_attendance_session", args)).error?.code,
  ).toBe("40001");
});
it("persists identity through the edge contract, detects stale forms and refuses foreign-club updates", async () => {
  const owner = await sign();
  const baseline = (
    await owner
      .from("fff_clubs")
      .select("name,short_name,logo_url,founded_date")
      .eq("id", red)
      .single()
  ).data;
  const body = {
    clubId: red,
    section: "infos",
    ...baseline,
    name: "Club de recette renommé",
    expected: baseline,
  };
  const saved = await owner.functions.invoke("update-club-info", { body });
  expect(saved.error).toBeNull();
  expect(saved.data.values.name).toBe(body.name);
  expect(
    (await owner.functions.invoke("update-club-info", { body })).error,
  ).toBeTruthy();
  expect(
    (await owner.from("fff_clubs").update({ name: "Interdit" }).eq("id", blue))
      .status,
  ).toBe(403);
  const spectator = await sign("player");
  expect(
    (await spectator.from("fff_clubs").select("name").eq("id", red).single())
      .data?.name,
  ).toBe(body.name);
});
it("joins admin and team profiles while preserving unknown RPC and join failures", async () => {
  const owner = await sign();
  const admins = await owner
    .from("club_admins")
    .select("id,profile_id,role,profiles(full_name,avatar_url)")
    .eq("club_id", red);
  expect(admins.error).toBeNull();
  expect((admins.data?.[0] as any).profiles.full_name).toBe("Recette club");
  const members = await owner
    .from("team_members")
    .select("id,team:teams!inner(name,club_id)")
    .eq("team.club_id", red);
  expect(members.error).toBeNull();
  expect(members.data).toHaveLength(2);
  expect((await owner.rpc("unimplemented_admin_action")).status).toBe(501);
  expect(
    (await owner.from("team_members").select("unknown_table(*)")).status,
  ).toBe(501);
});

it("changes primary assignments with a concurrency guard and validates a local team invitation", async () => {
  const owner = await sign(),
    coach = await sign("coach");
  const args = {
    p_club_id: red,
    p_profile_id: profile,
    p_team_id: reserve,
    p_expected_team_id: team,
  };
  expect((await owner.rpc("set_native_primary_team", args)).error).toBeNull();
  expect((await owner.rpc("set_native_primary_team", args)).error).toBeNull();
  expect(
    (await owner.rpc("set_native_primary_team", { ...args, p_team_id: null }))
      .error?.code,
  ).toBe("40001");
  const invite = await coach.rpc("create_native_team_invitation_link", {
    p_club_id: red,
    p_team_id: team,
    p_role: "Joueur",
    p_max_uses: 3,
  });
  expect(invite.error).toBeNull();
  expect(invite.data.code).toHaveLength(10);
  expect(invite.data).toMatchObject({
    uses_count: 0,
    max_uses: 3,
    status: "active",
  });
  expect(
    (
      await coach.rpc("create_native_team_invitation_link", {
        p_club_id: red,
        p_team_id: reserve,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await coach.rpc("create_native_team_invitation_link", {
        p_club_id: red,
        p_team_id: team,
        p_max_uses: 201,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await coach
        .from("team_invitation_links")
        .select("id,team:teams(name,category)")
    ).data,
  ).toHaveLength(1);
});
it("shows the created calendar session only to members of its actual team", async () => {
  const owner = await sign(),
    member = await sign("player");
  const row = {
    id: randomUUID(),
    club_id: red,
    team_id: team,
    session_type: "training",
    session_date: new Date(Date.now() + 7200000).toISOString(),
    category: "SENIOR M1",
    notes: null,
    created_by: "00000000-0000-4000-8000-000000000007",
  };
  expect(
    (await owner.from("club_attendance_sessions").insert(row)).error,
  ).toBeNull();
  expect(
    (
      await owner
        .from("club_attendance_sessions")
        .insert({ ...row, id: randomUUID(), team_id: reserve })
    ).error,
  ).toBeNull();
  const events = await member.rpc("get_native_member_calendar", {
    p_club_id: red,
    p_scope: "teams",
    p_period: "future",
    p_limit: 30,
    p_offset: 0,
  });
  expect(events.error).toBeNull();
  expect(events.data.some((e: any) => e.id === row.id)).toBe(true);
  expect(events.data.every((e: any) => e.team_id === team)).toBe(true);
  expect(
    (await member.rpc("get_native_member_calendar", { p_club_id: blue }))
      .status,
  ).toBe(403);
});
it("stores an invitation notification only for its intended fictitious recipient", async () => {
  const owner = await sign(),
    recipient = await sign("admin"),
    stranger = await sign("player");
  const requestId = randomUUID(),
    receiver = "00000000-0000-4000-8000-000000000003";
  expect(
    (
      await owner.from("club_membership_requests").insert({
        id: requestId,
        club_id: red,
        profile_id: receiver,
        requested_role: "Joueur",
        status: "pending",
        invited_by: "00000000-0000-4000-8000-000000000007",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner.from("notifications").insert({
        type: "club_invitation",
        sender_id: "00000000-0000-4000-8000-000000000007",
        receiver_id: receiver,
        content: "Invitation fictive",
        metadata: { request_id: requestId, club_id: red },
      })
    ).error,
  ).toBeNull();
  expect((await recipient.from("notifications").select("*")).data).toHaveLength(
    1,
  );
  expect((await stranger.from("notifications").select("*")).data).toEqual([]);
});
it("accepts a team invitation once, acknowledges retries after exhaustion, and detects revoked membership", async () => {
  const owner = await sign(),
    invited = await sign("admin"),
    stranger = await sign("player");
  const link = (
    await owner.rpc("create_native_team_invitation_link", {
      p_club_id: red,
      p_team_id: reserve,
      p_role: "Joueur",
      p_max_uses: 1,
    })
  ).data;
  expect(link.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  expect(
    (
      await invited.rpc("accept_native_team_invitation_link", {
        p_code: link.code,
      })
    ).data.uses_count,
  ).toBe(1);
  expect(
    (
      await invited.rpc("accept_native_team_invitation_link", {
        p_code: link.code,
      })
    ).data.uses_count,
  ).toBe(1);
  expect(
    (
      await stranger.rpc("accept_native_team_invitation_link", {
        p_code: link.code,
      })
    ).error?.code,
  ).toBe("40001");
  const joined = await invited
    .from("team_members")
    .select(
      "id,role,team:teams!inner(id,name,category,season,club_id,club:fff_clubs!inner(id,name,logo_url))",
    )
    .eq("profile_id", "00000000-0000-4000-8000-000000000003");
  expect(joined.error).toBeNull();
  expect((joined.data?.[0] as any).team.club.id).toBe(red);
  await owner
    .from("team_members")
    .update({ is_active: false })
    .eq("team_id", reserve)
    .eq("profile_id", "00000000-0000-4000-8000-000000000003");
  expect(
    (
      await invited.rpc("accept_native_team_invitation_link", {
        p_code: link.code,
      })
    ).error?.code,
  ).toBe("40001");
});
it("lets only the intended recipient accept or reject a membership request", async () => {
  const owner = await sign(),
    recipient = await sign("admin"),
    stranger = await sign("player");
  const requestId = randomUUID();
  expect(
    (
      await owner.from("club_membership_requests").insert({
        id: requestId,
        club_id: red,
        profile_id: "00000000-0000-4000-8000-000000000003",
        requested_role: "Dirigeant",
        invited_by: "00000000-0000-4000-8000-000000000007",
        status: "pending",
      })
    ).error,
  ).toBeNull();
  const invites = await recipient
    .from("club_membership_requests")
    .select("id,requested_role,club:club_id(id,name,logo_url)")
    .eq("id", requestId);
  expect(invites.error).toBeNull();
  expect((invites.data?.[0] as any).club.id).toBe(red);
  expect(
    (
      await stranger.rpc("accept_club_membership_request", {
        request_id: requestId,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await recipient.rpc("accept_club_membership_request", {
        request_id: requestId,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await recipient.rpc("accept_club_membership_request", {
        request_id: requestId,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await recipient
        .from("club_membership_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
    ).status,
  ).toBe(403);
});

const chatGroup = "a0000000-0000-4000-8000-000000000002";
it("creates a private group, adds members, joins names and keeps outsider messages inaccessible", async () => {
  const owner = await sign(),
    coach = await sign("coach"),
    outsider = await sign("admin");
  const groupId = randomUUID();
  const create = {
    id: groupId,
    club_id: red,
    name: "Discussion privée fictive",
    created_by: "00000000-0000-4000-8000-000000000007",
  };
  expect(
    (await owner.from("club_chat_groups").insert(create)).error,
  ).toBeNull();
  expect(
    (
      await owner.from("club_chat_group_members").insert({
        group_id: groupId,
        profile_id: "00000000-0000-4000-8000-000000000007",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await coach.from("club_chat_group_members").insert({
        group_id: groupId,
        profile_id: "00000000-0000-4000-8000-000000000002",
      })
    ).status,
  ).toBe(403);
  const members = await owner
    .from("club_chat_group_members")
    .select("id,profile_id,profile:profiles!profile_id(full_name,username)")
    .eq("group_id", groupId);
  expect(members.error).toBeNull();
  expect((members.data?.[0] as any).profile.full_name).toBe("Recette club");
  const message = {
    id: randomUUID(),
    group_id: groupId,
    author_id: create.created_by,
    content: "Message privé de recette",
    reply_to_id: null,
  };
  expect(
    (await owner.from("club_chat_messages").insert(message)).error,
  ).toBeNull();
  expect(
    (
      await outsider
        .from("club_chat_messages")
        .select("*")
        .eq("group_id", groupId)
    ).data,
  ).toEqual([]);
  const read = await owner
    .from("club_chat_messages")
    .select("id,content,author:profiles!author_id(full_name)")
    .eq("group_id", groupId);
  expect(read.error).toBeNull();
  expect((read.data?.[0] as any).author.full_name).toBe("Recette club");
});
it("reconciles a lost message response with the real creation helper and denies sends after revocation", async () => {
  const owner = await sign(),
    member = await sign("player");
  const id = randomUUID();
  const row = {
    id,
    group_id: chatGroup,
    author_id: profile,
    content: "Message de recette une seule fois",
    reply_to_id: null,
  };
  let inserts = 0;
  const repository = {
    read: async (key: string) => {
      const r = await member
        .from("club_chat_messages")
        .select("id,group_id,author_id,content,reply_to_id")
        .eq("id", key)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    insert: async (value: Record<string, unknown>) => {
      inserts++;
      const r = await member.from("club_chat_messages").insert(value);
      if (r.error) throw r.error;
      throw new Error("Réponse perdue après écriture locale");
    },
  };
  await expect(createProContent(repository, row)).rejects.toThrow(
    "Réponse perdue",
  );
  await expect(createProContent(repository, row)).resolves.toBeUndefined();
  expect(inserts).toBe(1);
  const list = await member
    .from("club_chat_group_members")
    .select(
      "id,group:club_chat_groups!group_id!inner(id,name,team_category,club_id,club:fff_clubs!club_id(name))",
    )
    .eq("profile_id", profile)
    .eq("group.club_id", red);
  expect(list.error).toBeNull();
  expect((list.data?.[0] as any).group.name).toBe("Organisation Seniors A");
  expect(
    (
      await owner
        .from("club_chat_group_members")
        .delete()
        .eq("group_id", chatGroup)
        .eq("profile_id", profile)
    ).error,
  ).toBeNull();
  expect(
    (
      await member
        .from("club_chat_messages")
        .insert({ ...row, id: randomUUID() })
    ).status,
  ).toBe(403);
  expect(
    (
      await member
        .from("club_chat_messages")
        .select("*")
        .eq("group_id", chatGroup)
    ).data,
  ).toEqual([]);
});
it("guards message authors, replies, moderation fields and stale edit snapshots", async () => {
  const owner = await sign(),
    member = await sign("player");
  const id = randomUUID();
  const row = {
    id,
    group_id: chatGroup,
    author_id: profile,
    content: "Avant",
    reply_to_id: null,
  };
  expect(
    (
      await member
        .from("club_chat_messages")
        .insert({ ...row, author_id: "00000000-0000-4000-8000-000000000007" })
    ).status,
  ).toBe(403);
  expect(
    (
      await member
        .from("club_chat_messages")
        .insert({ ...row, is_blocked: true })
    ).status,
  ).toBe(403);
  expect(
    (
      await member
        .from("club_chat_messages")
        .insert({ ...row, reply_to_id: randomUUID() })
    ).status,
  ).toBe(403);
  expect(
    (await member.from("club_chat_messages").insert(row)).error,
  ).toBeNull();
  const snapshot = (
    await member
      .from("club_chat_messages")
      .select("content,edited_at,is_blocked,is_deleted,media_url")
      .eq("id", id)
      .single()
  ).data;
  const args = {
    p_message_id: id,
    p_group_id: chatGroup,
    p_content: "Après",
    p_delete: false,
    p_expected: snapshot,
  };
  expect(
    (await owner.rpc("update_native_club_message_snapshot", args)).error?.code,
  ).toBe("40001");
  expect(
    (await member.rpc("update_native_club_message_snapshot", args)).data,
  ).toBe(id);
  expect(
    (await member.rpc("update_native_club_message_snapshot", args)).error?.code,
  ).toBe("40001");
});
it("loads the actual attendance summary through the HTTP fixture with both joined parents", async () => {
  const owner = await sign();
  serviceClient.current = owner;
  expect(
    (
      await owner.rpc("save_native_attendance_record", {
        p_id: randomUUID(),
        p_session_id: session,
        p_player_id: player,
        p_status: "present",
        p_notes: null,
        p_expected: null,
      })
    ).error,
  ).toBeNull();
  const authorize = async () => {
    expect(
      (await owner.rpc("is_fff_club_admin", { p_club_id: red })).data,
    ).toBe(true);
  };
  const summary = await loadClubAttendanceSummary(red, null, authorize);
  expect(summary.eventCount).toBe(1);
  expect(summary.rows.find((row) => row.id === player)).toMatchObject({
    present: 1,
    recordings: 1,
    name: "Recette player",
  });
  const empty = await loadClubAttendanceSummary(red, randomUUID(), authorize);
  expect(empty.eventCount).toBe(0);
});
it("retains the feed post author and reaction joins when opening home from admin", async () => {
  const client = await sign();
  const result = await client
    .from("posts")
    .select(
      "*,author:profiles!posts_user_id_fkey(id,full_name,username,avatar_url,position,club),post_comments(count),post_reactions(id,user_id,reaction_type)",
    )
    .order("created_at", { ascending: false })
    .range(0, 19);
  expect(result.error).toBeNull();
  expect(result.data).toHaveLength(20);
  expect((result.data?.[0] as any).author.full_name).toBe("Recette player");
  expect((result.data?.[0] as any).post_comments).toEqual([{ count: 0 }]);
});
it("reads scoped standings, persists edits and rejects stale or foreign competition writes", async () => {
  const owner = await sign();
  const competition = "c0000000-0000-4000-8000-000000000002";
  const list = await owner
    .from("club_competitions")
    .select("id,name,type,standings:club_competition_standings(count)")
    .eq("club_id", red);
  expect(list.error).toBeNull();
  expect((list.data?.[0] as any).standings).toEqual([{ count: 1 }]);
  const read = await owner
    .from("club_competition_standings")
    .select(
      "id,team_name,points,position,competition:club_competitions!competition_id!inner(club_id)",
    )
    .eq("competition_id", competition)
    .eq("competition.club_id", red);
  expect(read.error).toBeNull();
  const row = read.data?.[0] as any;
  expect(row.team_name).toBe("Club de recette rouge");
  expect(
    (
      await owner
        .from("club_competition_standings")
        .update({ points: 1 })
        .eq("id", row.id)
        .eq("points", 4)
        .select("id")
    ).data,
  ).toHaveLength(1);
  expect(
    (
      await owner
        .from("club_competition_standings")
        .update({ points: 9 })
        .eq("id", row.id)
        .eq("points", 4)
        .select("id")
    ).data,
  ).toEqual([]);
  expect(
    (
      await owner
        .from("club_competition_standings")
        .update({ position: -1 })
        .eq("id", row.id)
    ).status,
  ).toBe(400);
  expect(
    (
      await owner.from("club_competition_standings").insert({
        competition_id: "c0000000-0000-4000-8000-000000000003",
        team_name: "Autre club",
      })
    ).status,
  ).toBe(403);
  const created = randomUUID();
  expect(
    (
      await owner.from("club_competitions").insert({
        id: created,
        club_id: red,
        name: "Tournoi test",
        type: "tournament",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner
        .from("club_competitions")
        .delete()
        .eq("id", created)
        .eq("club_id", red)
        .select("id")
    ).data,
  ).toHaveLength(1);
});
it("supplies the real Web minimum-completion fields for existing club and personal accounts", async () => {
  for (const role of ["club", "player", "coach", "admin"]) {
    const client = await sign(role);
    const auth = await client.auth.getUser();
    const profile = await client
      .from("profiles")
      .select("*")
      .eq("id", auth.data.user!.id)
      .single();
    expect(profile.error).toBeNull();
    expect(isProfileMinimumComplete(profile.data)).toBe(true);
    if (role === "club")
      expect(profile.data.club_official_name).toBe("Club de recette rouge");
    else
      expect(profile.data).toMatchObject({
        first_name: "Recette",
        last_name: role,
      });
  }
});
