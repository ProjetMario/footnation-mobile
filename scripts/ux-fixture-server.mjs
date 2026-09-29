// Local, disposable UI fixtures. Never point this server at a real database.
// Start: node scripts/ux-fixture-server.mjs
import http from "node:http";
import { createSupportSocialFixture } from "./support-social-fixture.mjs";
import { createAdminFixture } from "./admin-fixture.mjs";
import { createSuperAdminFixture } from "./super-admin-fixture.mjs";
import { randomUUID } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const localVideo = fileURLToPath(
  new URL("../../public/videos/footnation-presentation.mp4", import.meta.url),
);
const videoRoute = "/__fixture/media/club-intro.mp4";
const roles = ["player", "coach", "admin", "new", "underage", "parent", "club"];
const ids = Object.fromEntries(
  roles.map((role, index) => [
    role,
    "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
  ]),
);
const profiles = roles.map((role) => ({
  id: ids[role],
  email: role + "@fixture.test",
  full_name: "Recette " + role,
  first_name: "Recette",
  last_name: role,
  club_official_name: role === "club" ? "Club de recette rouge" : null,
  username: role,
  primary_role:
    role === "club" ? "Dirigeant" : role === "coach" ? "Éducateur" : "Joueur",
  account_type: role === "club" ? "club" : "personal",
  avatar_url: null,
  birthdate:
    role === "underage"
      ? "2015-09-01"
      : role === "parent"
        ? "2012-09-01"
        : "2000-01-01",
  is_admin: role === "admin",
  profile_visibility: "public",
  is_suspended: false,
  club: null,
  linked_club_id: null,
  bio: "Compte fictif pour vérifier l’interface.",
  is_profile_complete: true,
}));
const posts = Array.from({ length: 45 }, (_, index) => ({
  id: "10000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
  user_id: ids.player,
  author: profiles[0],
  content: "Publication de recette " + (index + 1),
  created_at: new Date(
    Date.UTC(2026, 8, 12, 9, 0) - index * 86400000,
  ).toISOString(),
  image_url: null,
  video_url: null,
  location: null,
  hashtags: [],
  post_comments: [{ count: 0 }],
  post_reactions: [],
}));
const initialTables = {
  profiles,
  posts,
  profile_followers: [
    {
      id: "f1",
      followed_id: ids.player,
      follower_id: ids.coach,
      created_at: "2026-09-01T10:00:00Z",
      profile: profiles[1],
    },
    {
      id: "f2",
      followed_id: ids.player,
      follower_id: ids.admin,
      created_at: "2026-09-02T10:00:00Z",
      profile: profiles[2],
    },
  ],
  profile_views: [
    { id: "view1", profile_id: ids.player, viewer_id: ids.coach },
  ],
  opportunities: [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: "20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
      created_at: new Date(
        Date.UTC(2026, 8, 12) - index * 86400000,
      ).toISOString(),
      title: "Offre de recette " + index,
      description: "Offre fictive",
      listing_kind: "offer",
      is_active: true,
      opportunity_type: "recherche_joueur",
      user_id: ids.coach,
    })),
    {
      id: "20000000-0000-4000-8000-000000000021",
      created_at: "2026-08-01T10:00:00Z",
      title: "Je cherche un club",
      description: "Demande fictive plus ancienne",
      listing_kind: "request",
      is_active: true,
      opportunity_type: "recherche_joueur",
      user_id: ids.player,
    },
  ],
};
const user = (role) => ({
  id: ids[role],
  email: role + "@fixture.test",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-09-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {
    birthdate: profiles.find((row) => row.id === ids[role]).birthdate,
  },
  created_at: "2026-09-01T00:00:00Z",
});
const token = (role) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: ids[role],
        email: role + "@fixture.test",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 36000,
      }),
    ).toString("base64url"),
    "local-fixture-only",
  ].join(".");
function roleFor(request) {
  try {
    const sub = JSON.parse(
      Buffer.from(
        (request.headers.authorization || "").split(".")[1],
        "base64url",
      ),
    ).sub;
    return roles.find((role) => ids[role] === sub) || null;
  } catch {
    return null;
  }
}
// Deliberately limited PostgREST filters used by the exercised club screens.
// Unknown operators fail visibly rather than returning unrelated profiles.
function splitFilters(value) {
  if (!value.startsWith("(") || !value.endsWith(")"))
    throw new Error("Invalid OR");
  const clauses = [];
  let part = "",
    quoted = false,
    escaped = false;
  for (const char of value.slice(1, -1)) {
    if (escaped) {
      part += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quoted) {
      part += char;
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      clauses.push(part);
      part = "";
    } else part += char;
  }
  if (quoted || escaped || !part) throw new Error("Invalid OR");
  clauses.push(part);
  return clauses;
}
function filterFor(key, value) {
  if (value === "not.is.null") return (row) => row[key] != null;
  if (value === "is.null") return (row) => row[key] == null;
  if (value.startsWith("in.(") || value.startsWith("not.in.(")) {
    const inverse = value.startsWith("not.");
    const values = value.slice(inverse ? 8 : 4, -1).split(",");
    if (!value.endsWith(")")) throw new Error("Invalid IN");
    return (row) => inverse !== values.includes(String(row[key]));
  }
  const separator = value.indexOf(".");
  const operator = value.slice(0, separator);
  const field = (row) =>
    key.split(".").reduce((value, part) => value?.[part], row);
  let expected = value.slice(separator + 1);
  if (expected.startsWith('"')) expected = JSON.parse(expected);
  if (["eq", "neq", "gt", "gte", "lt", "lte"].includes(operator))
    return (row) => {
      const actual =
        typeof field(row) === "number" ? field(row) : String(field(row));
      const wanted = typeof actual === "number" ? Number(expected) : expected;
      return operator === "eq"
        ? actual === wanted
        : operator === "neq"
          ? actual !== wanted
          : operator === "gt"
            ? actual > wanted
            : operator === "gte"
              ? actual >= wanted
              : operator === "lt"
                ? actual < wanted
                : actual <= wanted;
    };
  if (operator === "ilike") {
    const pattern = expected
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    const regex = new RegExp("^" + pattern + "$", "i");
    return (row) => typeof row[key] === "string" && regex.test(row[key]);
  }
  throw new Error("Unknown filter");
}
export function createFixtureServer({
  socialAuth = false,
  superAdmin = false,
  liveMatches = false,
} = {}) {
  const socialProfiles = new Map();
  const needsSocialProfile = (role) =>
    socialAuth && ["new", "parent"].includes(role) && !socialProfiles.has(role);
  const tables = structuredClone(initialTables);
  for (const table of [
    "user_blocks",
    "connections",
    "shorts",
    "short_comments",
    "short_likes",
    "post_comments",
    "post_reactions",
    "saved_posts",
    "match_comments",
    "match_predictions",
    "notifications",
    "club_followers",
    "club_members",
    "club_players",
    "club_staff",
    "club_publications",
    "club_shorts",
    "club_news",
    "club_achievements",
    "club_logos",
    "club_player_rankings",
    "match_mvp_votes",
    "match_player_stats",
    "stories",
    "groups",
    "events",
  ])
    tables[table] ||= [];
  tables.fff_clubs = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Club de recette rouge",
      colors: "Rouge, Blanc",
      city: "Ville fictive",
      department_code: "73",
      type: "club",
      logo_url: null,
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      name: "Club de recette bleu au nom particulièrement long",
      colors: "Bleu",
      city: "Ville fictive",
      department_code: "74",
      type: "club",
      logo_url: null,
    },
  ];
  Object.assign(tables.fff_clubs[0], {
    slug: "club-recette-rouge",
    address: "1 rue de la Recette",
    postal_code: "73000",
    fff_affiliation_number: "RECETTE",
    league: "Ligue fictive",
    district: "District fictif",
    infrastructure: [1, 2, 3].map((index) => ({
      name: "Installation fictive " + index,
      full_address: index + " rue de la Recette",
    })),
  });
  tables.club_matches = [
    {
      id: "40000000-0000-4000-8000-000000000001",
      club_id: tables.fff_clubs[0].id,
      opponent_name: "Club de recette bleu",
      category: "SENIOR M1",
      match_date: new Date(Date.now() + 86400000).toISOString(),
      is_home: true,
      status: "scheduled",
      competition: "Recette",
      opponent_logo_url: null,
    },
  ];
  const redClub = tables.fff_clubs[0];
  const blueClub = tables.fff_clubs[1];
  // These identities and relationships are synthetic, and reset per server.
  Object.assign(
    tables.profiles.find((row) => row.id === ids.player),
    {
      club: redClub.name,
      linked_club_id: redClub.id,
    },
  );
  Object.assign(
    tables.profiles.find((row) => row.id === ids.coach),
    {
      club: redClub.name,
      linked_club_id: redClub.id,
      favorite_amateur_club: redClub.name,
    },
  );
  Object.assign(
    tables.profiles.find((row) => row.id === ids.admin),
    {
      favorite_pro_club: blueClub.name,
    },
  );
  tables.club_followers = [
    {
      id: "50000000-0000-4000-8000-000000000001",
      club_id: redClub.id,
      profile_id: ids.coach,
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      club_id: redClub.id,
      profile_id: ids.admin,
    },
    {
      id: "50000000-0000-4000-8000-000000000003",
      club_id: blueClub.id,
      profile_id: ids.coach,
    },
  ];
  tables.shorts = [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      user_id: ids.coach,
      description:
        "Vidéo de recette locale · présentation FootNation · 10 secondes",
      video_url: videoRoute,
      thumbnail_url: null,
      music_url: null,
      start_time: 0,
      duration: 10,
      created_at: new Date().toISOString(),
    },
  ];
  tables.club_players = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      club_id: redClub.id,
      profile_id: ids.player,
      name: "Recette player",
      category: "SENIOR M1",
      position: "Attaquant",
      jersey_number: 9,
      is_active: true,
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      club_id: redClub.id,
      profile_id: ids.coach,
      name: "Recette coach",
      category: "SENIOR M1",
      position: "Milieu",
      jersey_number: 8,
      is_active: true,
    },
  ];
  tables.club_player_rankings = tables.club_players.map((player, index) => ({
    id: "70000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    club_id: redClub.id,
    player_id: player.id,
    ranking_type: "current",
    goals_total: 5 - index,
    assists_total: index + 1,
  }));
  tables.club_matches.push({
    ...tables.club_matches[0],
    id: "40000000-0000-4000-8000-000000000002",
    match_date: new Date(Date.now() - 86400000).toISOString(),
    status: "finished",
    home_score: 2,
    away_score: 1,
  });
  if (liveMatches) {
    tables.club_matches.push({
      ...tables.club_matches[0],
      id: "40000000-0000-4000-8000-000000000003",
      status: "live",
      match_date: new Date(Date.now() - 1_800_000).toISOString(),
      home_score: 0,
      away_score: 1,
      venue: "Stade de recette",
    });
    tables.live_streams = [
      {
        id: "90000000-0000-4000-8000-000000000001",
        club_id: redClub.id,
        match_id: "40000000-0000-4000-8000-000000000003",
        title: "Diffusion de recette sans vidéo publiée",
        status: "live",
        started_at: new Date().toISOString(),
        ended_at: null,
        expires_at: null,
        video_url: null,
      },
    ];
  } else tables.live_streams = [];
  tables.match_predictions = [
    {
      id: "80000000-0000-4000-8000-000000000001",
      match_id: tables.club_matches[0].id,
      user_id: ids.coach,
      prediction: "home",
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      id: "80000000-0000-4000-8000-000000000002",
      match_id: tables.club_matches[0].id,
      user_id: ids.admin,
      prediction: "away",
      created_at: "2026-09-01T11:00:00Z",
    },
  ];
  const administration = createAdminFixture(tables, ids);
  const superAdministration = superAdmin
    ? createSuperAdminFixture(tables, ids)
    : null;
  const mvpEligible = (matchId, playerId) => {
    const match = tables.club_matches.find((row) => row.id === matchId);
    const player = tables.club_players.find((row) => row.id === playerId);
    if (
      !match ||
      !player ||
      match.status !== "finished" ||
      player.club_id !== match.club_id
    )
      return false;
    const participants = tables.match_player_stats.filter(
      (row) =>
        row.match_id === matchId &&
        tables.club_players.some(
          (person) =>
            person.id === row.player_id && person.club_id === match.club_id,
        ),
    );
    return participants.length
      ? participants.some((row) => row.player_id === playerId)
      : player.is_active === true;
  };
  const predictionStats = () => {
    const stats = new Map();
    for (const vote of tables.match_predictions) {
      const row = stats.get(vote.match_id) || {
        match_id: vote.match_id,
        home_count: 0,
        draw_count: 0,
        away_count: 0,
        total_count: 0,
      };
      row[vote.prediction + "_count"]++;
      row.total_count++;
      stats.set(vote.match_id, row);
    }
    return [...stats.values()];
  };
  const supportSocial = createSupportSocialFixture(ids);
  let scenario = "normal";
  const supportedModes = [
    "normal",
    "empty",
    "error",
    "unauthorized",
    "forbidden",
    "slow",
  ];
  const writable = new Set([
    "club_followers",
    "profile_followers",
    "post_comments",
    "post_reactions",
    "short_comments",
    "short_likes",
    "saved_posts",
    "match_comments",
    "match_predictions",
  ]);
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
    );
    response.setHeader("Access-Control-Expose-Headers", "Content-Range");
    response.setHeader("Content-Type", "application/json");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname === videoRoute) {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405);
        response.end();
        return;
      }
      let size;
      try {
        size = statSync(localVideo).size;
      } catch {
        response.writeHead(503);
        response.end('{"message":"Vidéo locale absente"}');
        return;
      }
      response.setHeader("Content-Type", "video/mp4");
      response.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = size - 1;
      const range = request.headers.range;
      if (range) {
        const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (parts && (parts[1] || parts[2])) {
          start = parts[1]
            ? Number(parts[1])
            : Math.max(0, size - Number(parts[2]));
          end =
            parts[1] && parts[2]
              ? Math.min(size - 1, Number(parts[2]))
              : size - 1;
        } else {
          start = size;
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= size
        ) {
          response.setHeader("Content-Range", `bytes */${size}`);
          response.writeHead(416);
          response.end();
          return;
        }
        response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      }
      response.setHeader("Content-Length", end - start + 1);
      response.writeHead(range ? 206 : 200);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(localVideo, { start, end });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
      return;
    }
    let body = {};
    try {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 65536) throw new Error("large");
      }
      if (raw) body = JSON.parse(raw);
    } catch {
      response.writeHead(400);
      response.end("{}");
      return;
    }
    if (url.pathname === "/__fixture") {
      if (request.method === "POST") {
        if (!supportedModes.includes(body.scenario)) {
          response.writeHead(400);
          response.end('{"error":"Unknown scenario"}');
          return;
        }
        scenario = body.scenario;
      }
      response.end(JSON.stringify({ fixture: true, scenario, roles }));
      return;
    }
    const role = roleFor(request);
    if (process.env.FOOTNATION_FIXTURE_TRACE === "1")
      console.log(request.method, url.pathname, role);
    const send = (value) => response.end(JSON.stringify(value));
    if (url.pathname === "/auth/v1/token") {
      const selected = roles.find(
        (item) =>
          body.email === item + "@fixture.test" ||
          body.refresh_token === "fixture-refresh-" + item,
      );
      if (!selected) {
        response.writeHead(400);
        return send({
          message: "Compte de recette inconnu",
          error_code: "invalid_credentials",
        });
      }
      return send({
        access_token: token(selected),
        refresh_token: "fixture-refresh-" + selected,
        token_type: "bearer",
        expires_in: 36000,
        expires_at: Math.floor(Date.now() / 1000) + 36000,
        user: user(selected),
      });
    }
    if (scenario === "slow")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    if (["error", "unauthorized", "forbidden"].includes(scenario)) {
      response.writeHead(
        { error: 503, unauthorized: 401, forbidden: 403 }[scenario],
      );
      return send({ message: "Erreur simulée : " + scenario });
    }
    if (url.pathname === "/auth/v1/user") {
      if (!role) {
        response.writeHead(401);
        return send({ message: "Session requise" });
      }
      return send(user(role));
    }
    if (url.pathname === "/auth/v1/logout") return send({});
    if (
      socialAuth &&
      [
        "/rest/v1/rpc/get_social_signup_status",
        "/rest/v1/rpc/complete_social_signup",
      ].includes(url.pathname)
    ) {
      if (!role) {
        response.writeHead(401);
        return send({ message: "Session requise" });
      }
      if (request.method !== "POST") {
        response.writeHead(405);
        return send({ message: "POST requis" });
      }
      if (url.pathname.endsWith("get_social_signup_status"))
        return send({
          required: needsSocialProfile(role),
          full_name: "Sam Test",
          username: "",
          birthdate: null,
          account_type: "personal",
          primary_role: "",
          ...socialProfiles.get(role),
        });
      if (
        !body.p_full_name ||
        !body.p_username ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.p_birthdate || "") ||
        body.p_terms_version !== "1.0"
      ) {
        response.writeHead(400);
        return send({ message: "Champs de recette incomplets" });
      }
      socialProfiles.set(role, {
        required: false,
        full_name: body.p_full_name,
        username: body.p_username,
        birthdate: body.p_birthdate,
        account_type: body.p_account_type,
        primary_role: body.p_primary_role,
      });
      const profile = tables.profiles.find((row) => row.id === ids[role]);
      if (profile)
        Object.assign(profile, {
          full_name: body.p_full_name,
          username: body.p_username,
          birthdate: body.p_birthdate,
          primary_role: body.p_primary_role,
        });
      return send({
        state: role === "parent" ? "parent_required" : "eligible",
        allowed: role !== "parent",
        onboarding_required: false,
        resend_available_at: null,
      });
    }
    if (url.pathname === "/rest/v1/rpc/get_member_access_status") {
      if (!role) {
        response.writeHead(401);
        return send({ message: "Session requise" });
      }
      return send({
        state:
          role === "new" && !socialProfiles.has(role)
            ? "birthdate_required"
            : role === "underage"
              ? "underage"
              : role === "parent"
                ? "parent_required"
                : "eligible",
        allowed:
          !["new", "underage", "parent"].includes(role) ||
          (role === "new" && socialProfiles.has(role)),
        ...(socialAuth
          ? { onboarding_required: needsSocialProfile(role) }
          : {}),
        resend_available_at: null,
      });
    }
    if (
      url.pathname === "/rest/v1/rpc/get_native_conversations_filtered" ||
      url.pathname === "/rest/v1/rpc/get_native_conversations"
    )
      return send([]);
    const supportResult = url.pathname.startsWith("/rest/v1/rpc/") ? supportSocial(url.pathname.split("/").at(-1), body, role) : null;
    if (supportResult) { response.writeHead(supportResult.status); return send(supportResult.data); }
    const superResult = url.pathname.startsWith("/rest/v1/rpc/")
      ? superAdministration?.rpc(
          url.pathname.split("/").at(-1),
          body,
          role,
          scenario,
        )
      : url.pathname.startsWith("/functions/v1/")
        ? superAdministration?.edge(url.pathname.split("/").at(-1), body, role)
        : undefined;
    if (superResult) {
      response.writeHead(superResult.status);
      return send(superResult.data);
    }
    const adminResult = url.pathname.startsWith("/rest/v1/rpc/")
      ? administration.rpc(url.pathname.split("/").at(-1), body, role)
      : url.pathname.startsWith("/functions/v1/")
        ? administration.edge(url.pathname.split("/").at(-1), body, role)
        : undefined;
    if (adminResult) {
      response.writeHead(adminResult.status);
      return send(adminResult.data);
    }
    if (url.pathname === "/rest/v1/rpc/get_native_match_mvp_candidates") {
      const offset = body.p_offset === undefined ? 0 : body.p_offset;
      if (!Number.isInteger(offset) || offset < 0) {
        response.writeHead(400);
        return send({ code: "22023", message: "Invalid offset" });
      }
      if (
        !tables.club_matches.some(
          (row) =>
            row.id === body.p_match_id &&
            row.club_id === body.p_club_id &&
            row.status === "finished",
        )
      ) {
        response.writeHead(403);
        return send({
          code: "42501",
          message: "Finished match in this club required",
        });
      }
      if (scenario === "empty") return send([]);
      return send(
        tables.club_players
          .filter(
            (row) =>
              row.club_id === body.p_club_id &&
              mvpEligible(body.p_match_id, row.id),
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            position: row.position,
            jersey_number: row.jersey_number,
            vote_count: tables.match_mvp_votes.filter(
              (vote) =>
                vote.match_id === body.p_match_id && vote.player_id === row.id,
            ).length,
          }))
          .sort(
            (a, b) =>
              b.vote_count - a.vote_count ||
              a.name.localeCompare(b.name) ||
              a.id.localeCompare(b.id),
          )
          .slice(offset, offset + 30),
      );
    }
    if (url.pathname === "/rest/v1/rpc/cast_native_match_mvp_vote") {
      if (!role) {
        response.writeHead(401);
        return send({ code: "42501", message: "Authentication required" });
      }
      if (
        Object.keys(body).some(
          (key) => !["p_id", "p_match_id", "p_player_id"].includes(key),
        )
      ) {
        response.writeHead(400);
        return send({ code: "22023", message: "Unknown vote parameter" });
      }
      const existing = tables.match_mvp_votes.find(
        (row) => row.match_id === body.p_match_id && row.voter_id === ids[role],
      );
      if (existing) {
        if (existing.player_id === body.p_player_id) return send(existing.id);
        response.writeHead(409);
        return send({
          code: "23505",
          message: "You already voted for another player",
        });
      }
      if (
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
          body.p_id || "",
        ) ||
        !mvpEligible(body.p_match_id, body.p_player_id)
      ) {
        response.writeHead(403);
        return send({
          code: "42501",
          message: "Eligible player in a finished match required",
        });
      }
      if (tables.match_mvp_votes.some((row) => row.id === body.p_id)) {
        response.writeHead(409);
        return send({
          code: "23505",
          message: "Vote identifier already exists",
        });
      }
      tables.match_mvp_votes.push({
        id: body.p_id,
        match_id: body.p_match_id,
        player_id: body.p_player_id,
        voter_id: ids[role],
        created_at: new Date().toISOString(),
      });
      return send(body.p_id);
    }
    if (url.pathname === "/functions/v1/club-details")
      return send({ teams: [], upcomingMatches: [], pastMatches: [] });
    if (
      url.pathname.startsWith("/rest/v1/rpc/") ||
      url.pathname.startsWith("/functions/v1/")
    ) {
      response.writeHead(501);
      return send({
        message: "Cette action n’a pas de simulation : aucun succès supposé.",
      });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").at(-1);
      const sourceRows =
        table === "match_prediction_stats"
          ? predictionStats()
          : Object.hasOwn(tables, table)
            ? tables[table]
            : null;
      if (!sourceRows) {
        response.writeHead(501);
        return send({ message: "Table non simulée : " + table });
      }
      let filters;
      try {
        filters = [...url.searchParams].flatMap(([key, value]) => {
          if (
            ["select", "order", "offset", "limit", "on_conflict"].includes(key)
          )
            return [];
          if (key === "or") {
            const clauses = splitFilters(value);
            const tests = clauses.map((clause) => {
              const separator = clause.indexOf(".");
              if (separator < 1) throw new Error("Invalid OR");
              return filterFor(
                clause.slice(0, separator),
                clause.slice(separator + 1),
              );
            });
            return [(row) => tests.some((test) => test(row))];
          }
          return [filterFor(key, value)];
        });
      } catch {
        response.writeHead(501);
        return send({ message: "Filtre non simulé" });
      }
      const matches = (row) => filters.every((test) => test(row));
      if (!["GET", "HEAD"].includes(request.method)) {
        if (!role) {
          response.writeHead(401);
          return send({ message: "Session requise" });
        }
        const adminWrite = administration.mutate(
          table,
          request.method,
          body,
          matches,
          role,
          url.searchParams,
          request.headers.prefer,
        );
        if (adminWrite) {
          response.writeHead(adminWrite.status);
          return send(
            request.headers.accept?.includes("vnd.pgrst.object") &&
              Array.isArray(adminWrite.data)
              ? adminWrite.data[0] || null
              : adminWrite.data,
          );
        }
        if (!writable.has(table)) {
          response.writeHead(501);
          return send({ message: "Écriture non simulée" });
        }
        if (request.method === "POST") {
          const actor =
            table === "profile_followers"
              ? "follower_id"
              : table === "club_followers"
                ? "profile_id"
                : "user_id";
          const inputs = Array.isArray(body) ? body : [body];
          if (inputs.some((row) => row[actor] !== ids[role])) {
            response.writeHead(403);
            return send({ message: "Compte différent" });
          }
          if (
            table === "match_predictions" &&
            inputs.some(
              (row) =>
                !["home", "draw", "away"].includes(row.prediction) ||
                typeof row.match_id !== "string" ||
                !row.match_id.trim(),
            )
          ) {
            response.writeHead(400);
            return send({ code: "23514", message: "Invalid prediction" });
          }
          const conflict = url.searchParams.get("on_conflict")?.split(",");
          if (
            inputs.some((row) =>
              tables[table].some(
                (item) =>
                  ((row.id && item.id === row.id) ||
                    (conflict &&
                      conflict.every((key) => item[key] === row[key]))) &&
                  item[actor] !== ids[role],
              ),
            )
          ) {
            response.writeHead(403);
            return send({ message: "Compte différent" });
          }
          const added = inputs.map((row) => {
            const existing =
              conflict &&
              tables[table].find((item) =>
                conflict.every((key) => item[key] === row[key]),
              );
            if (existing) {
              Object.assign(existing, row);
              return existing;
            }
            const value = {
              id: randomUUID(),
              created_at: new Date().toISOString(),
              is_deleted: false,
              ...row,
            };
            tables[table].push(value);
            return value;
          });
          response.writeHead(201);
          return send(
            request.headers.accept?.includes("vnd.pgrst.object")
              ? added[0]
              : added,
          );
        }
        if (request.method === "DELETE") {
          const actor =
            table === "profile_followers"
              ? "follower_id"
              : table === "club_followers"
                ? "profile_id"
                : "user_id";
          const selected = tables[table].filter(matches);
          if (selected.some((row) => row[actor] !== ids[role])) {
            response.writeHead(403);
            return send({ message: "Compte différent" });
          }
          tables[table] = tables[table].filter(
            (row) => !selected.includes(row),
          );
          if (request.headers.prefer?.includes("return=representation"))
            return send(selected);
          response.writeHead(204);
          response.end();
          return;
        }
        response.writeHead(501);
        return send({ message: "Méthode non simulée" });
      }
      const selection = url.searchParams.get("select") || "*";
      let rows =
        scenario === "empty"
          ? []
          : sourceRows.filter((row) =>
              administration.readable(table, row, role),
            );
      const extraRelations = {
        club_matches: [["club", "fff_clubs", "club_id"]],
        club_competitions: [],
        club_competition_standings: [
          ["competition", "club_competitions", "competition_id"],
        ],
        club_chat_messages: [["author", "profiles", "author_id"]],
        club_chat_group_members: [
          ["profile", "profiles", "profile_id"],
          ["group", "club_chat_groups", "group_id"],
        ],
        club_admins: [["profiles", "profiles", "profile_id"]],
        club_membership_requests: [
          ["profile", "profiles", "profile_id"],
          ["club", "fff_clubs", "club_id"],
        ],
        club_convocation_players: [["player", "club_players", "player_id"]],
        club_attendance_records: [
          ["player", "club_players", "player_id"],
          ["session", "club_attendance_sessions", "session_id"],
        ],
        team_members: [
          ["profiles", "profiles", "profile_id"],
          ["team", "teams", "team_id"],
        ],
        team_invitation_links: [["team", "teams", "team_id"]],
        posts: [
          ["profiles", "profiles", "user_id"],
          ["author", "profiles", "user_id"],
        ],
      };
      const extra = extraRelations[table];
      if (extra && selection.includes("(")) {
        let remainder = selection;
        if (
          table === "club_competitions" &&
          remainder.includes("standings:club_competition_standings(count)")
        ) {
          rows = rows.map((row) => ({
            ...row,
            standings: [
              {
                count: tables.club_competition_standings.filter(
                  (s) => s.competition_id === row.id,
                ).length,
              },
            ],
          }));
          remainder = remainder.replace(
            "standings:club_competition_standings(count)",
            "",
          );
        }

        if (table === "posts") {
          if (remainder.includes("post_comments(count)")) {
            rows = rows.map((row) => ({
              ...row,
              post_comments: [
                {
                  count: tables.post_comments.filter(
                    (comment) => comment.post_id === row.id,
                  ).length,
                },
              ],
            }));
            remainder = remainder.replace("post_comments(count)", "");
          }
          if (/post_reactions\([^()]*\)/.test(remainder)) {
            rows = rows.map((row) => ({
              ...row,
              post_reactions: tables.post_reactions.filter(
                (reaction) => reaction.post_id === row.id,
              ),
            }));
            remainder = remainder.replace(/post_reactions\([^()]*\)/, "");
          }
        }

        if (
          table === "club_chat_group_members" &&
          /group:club_chat_groups!group_id!inner\([^()]*club:fff_clubs!club_id\([^()]*\)\)/.test(
            remainder,
          )
        ) {
          rows = rows.map((row) => {
            const group = tables.club_chat_groups.find(
              (g) => g.id === row.group_id,
            );
            return {
              ...row,
              group: group
                ? {
                    ...group,
                    club:
                      tables.fff_clubs.find((c) => c.id === group.club_id) ||
                      null,
                  }
                : null,
            };
          });
          remainder = remainder.replace(
            /group:club_chat_groups!group_id!inner\([^()]*club:fff_clubs!club_id\([^()]*\)\)/,
            "",
          );
        }

        if (
          table === "team_members" &&
          /team:teams!inner\([^()]*club:fff_clubs!inner\([^()]*\)\)/.test(
            remainder,
          )
        ) {
          rows = rows.map((row) => {
            const team = tables.teams.find((t) => t.id === row.team_id);
            return {
              ...row,
              team: team
                ? {
                    ...team,
                    club:
                      tables.fff_clubs.find((c) => c.id === team.club_id) ||
                      null,
                  }
                : null,
            };
          });
          remainder = remainder.replace(
            /team:teams!inner\([^()]*club:fff_clubs!inner\([^()]*\)\)/,
            "",
          );
        }
        for (const [alias, target, foreign] of extra) {
          const prefix =
            alias === target ? alias : `${alias}:(?:${target}|${foreign})`;
          const pattern = new RegExp(
            `${prefix}(?:![a-zA-Z_0-9]+)*\\([^()]*\\)`,
          );
          if (pattern.test(remainder)) {
            rows = rows.map((row) => ({
              ...row,
              [alias]:
                tables[target].find((item) => item.id === row[foreign]) || null,
            }));
            remainder = remainder.replace(pattern, "");
          }
        }
        if (remainder.includes("(")) {
          response.writeHead(501);
          return send({ message: "Jointure non simulée" });
        }
      }
      rows = rows.filter(matches);
      // Only relationships whose contract is explicitly represented are joined.
      const relations = {
        shorts: {
          pattern: /user:profiles!shorts_user_id_fkey\([^()]*\)/,
          alias: "user",
          target: "profiles",
          key: "user_id",
        },
        short_comments: {
          pattern: /author:profiles!short_comments_user_id_fkey\([^()]*\)/,
          alias: "author",
          target: "profiles",
          key: "user_id",
        },
        club_followers: {
          pattern: /profile:profiles!club_followers_profile_id_fkey\([^()]*\)/,
          alias: "profile",
          target: "profiles",
          key: "profile_id",
        },
        club_players: {
          pattern: /profile:profiles\([^()]*\)/,
          alias: "profile",
          target: "profiles",
          key: "profile_id",
        },
        club_staff: {
          pattern: /profile:profiles\([^()]*\)/,
          alias: "profile",
          target: "profiles",
          key: "profile_id",
        },
        club_player_rankings: {
          pattern: /player:club_players\([^()]*\)/,
          alias: "player",
          target: "club_players",
          key: "player_id",
        },
        match_mvp_votes: {
          pattern: /player:club_players\([^()]*\)/,
          alias: "player",
          target: "club_players",
          key: "player_id",
        },
      };
      const relation = relations[table];
      if (relation && selection.includes("(")) {
        if (
          !relation.pattern.test(selection) ||
          selection.replace(relation.pattern, "").includes("(")
        ) {
          response.writeHead(501);
          return send({ message: "Jointure non simulée" });
        }
        rows = rows.map((row) => ({
          ...row,
          [relation.alias]:
            tables[relation.target].find(
              (target) => target.id === row[relation.key],
            ) || null,
        }));
      }
      if (table === "shorts")
        rows = rows.map((row) => ({
          ...row,
          video_url: `http://127.0.0.1:${request.socket.localPort}${videoRoute}`,
        }));
      const order = url.searchParams.get("order");
      if (order)
        rows.sort((a, b) => {
          for (const item of order.split(",")) {
            const [key, direction] = item.split(".");
            const diff = String(a[key] ?? "").localeCompare(
              String(b[key] ?? ""),
            );
            if (diff) return direction === "desc" ? -diff : diff;
          }
          return 0;
        });
      const count = rows.length,
        start = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || 1000);
      rows = rows.slice(start, start + limit);
      response.setHeader(
        "Content-Range",
        (rows.length ? start + "-" + (start + rows.length - 1) : "*") +
          "/" +
          count,
      );
      if (!selection.includes("(") && selection !== "*") {
        const columns = selection.split(",");
        rows = rows.map((row) =>
          Object.fromEntries(
            columns.map((column) => [column, row[column] ?? null]),
          ),
        );
      }
      if (request.headers.accept?.includes("vnd.pgrst.object"))
        return send(rows[0] || null);
      return send(rows);
    }
    response.writeHead(404);
    send({ error: "Fixture route unavailable" });
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.FOOTNATION_FIXTURE_PORT || 7082);
  createFixtureServer().listen(port, "127.0.0.1", () =>
    console.log("Recette locale : http://127.0.0.1:" + port),
  );
}
