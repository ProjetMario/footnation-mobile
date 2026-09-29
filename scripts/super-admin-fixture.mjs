// Opt-in, in-memory Super admin recipe. No credentials, mail or remote writes.
// The actual authorization/transaction contract is tested in tests/admin-console.sql.
import { createHash, randomUUID } from "node:crypto";

const completionKeys = [
  "full_name",
  "club",
  "primary_role",
  "highest_level",
  "favorite_pro_club",
  "avatar_url",
  "gender",
];
const percent = (row) =>
  Math.round(
    (completionKeys.filter((key) => String(row[key] || "").trim()).length *
      100) /
      7,
  );
const version = (row) =>
  createHash("md5").update(JSON.stringify(row)).digest("hex");
const now = () => new Date().toISOString();
const ok = (data) => ({ status: 200, data });
const failure = (code, message, status = 400) => ({
  status,
  data: { code, message, error: message },
});
const tablesByResource = {
  users: "profiles",
  "incomplete-profiles": "profiles",
  premium: "profiles",
  clubs: "fff_clubs",
  publications: "posts",
  shorts: "shorts",
  photos: "user_photos",
  connections: "connections",
  followers: "profile_followers",
  following: "profile_followers",
  likes: "likes",
  blocks: "user_blocks",
  "blocked-by": "user_blocks",
  "reports-received": "user_reports",
  "reports-sent": "user_reports",
  "favorite-clubs": "user_favorite_clubs",
  "club-follows": "club_followers",
  "saved-posts": "saved_posts",
  "match-follows": "match_follows",
  opportunities: "opportunities",
  applications: "opportunity_applications",
  events: "event_participants",
  "profile-views": "profile_views",
  sessions: "user_sessions",
  "page-views": "user_page_views",
  interactions: "user_interactions",
  "post-reactions": "post_reactions",
  "reactions-received": "post_reactions",
  "short-likes": "short_likes",
  "short-likes-received": "short_likes",
  ratings: "player_ratings",
  "ratings-given": "player_ratings",
  reminders: "profile_reminders",
  "message-reports": "message_reports",
};
const scopeByResource = {
  followers: "followed_id",
  following: "follower_id",
  blocks: "blocker_id",
  "blocked-by": "blocked_id",
  "reports-received": "reported_id",
  "reports-sent": "reporter_id",
  "club-follows": "profile_id",
  applications: "applicant_id",
  "profile-views": "profile_id",
  ratings: "rated_id",
  "ratings-given": "rater_id",
};
export function createSuperAdminFixture(tables, ids) {
  for (const table of Object.values(tablesByResource)) tables[table] ||= [];
  const member = tables.profiles.find((p) => p.id === ids.player);
  Object.assign(member, {
    full_name: "Alexandre Martin · profil de recette",
    department: "73",
    nationality: "France",
    created_at: now(),
  });
  tables.profiles.push(
    ...Array.from({ length: 37 }, (_, i) => ({
      id: `a1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      full_name:
        i === 0
          ? "Jean-Baptiste Dupont de la Roche · nom très long pour vérifier les petites largeurs"
          : `Membre fictif ${String(i + 1).padStart(2, "0")}`,
      primary_role: i % 2 ? "Joueur" : "Éducateur",
      nationality: i % 3 ? "France" : "Portugal",
      department: i % 2 ? "73" : "74",
      is_admin: false,
      is_premium: i < 3,
      is_suspended: i === 4,
      suspended_until: null,
      gender: "Homme",
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    })),
  );
  const seed = (table, fields) => {
    const row = { id: randomUUID(), created_at: now(), ...fields };
    tables[table] ||= [];
    tables[table].push(row);
    return row;
  };
  seed("profile_reminders", {
    user_id: ids.player,
    reminder_number: 1,
    missing_fields: ["club", "avatar_url"],
    sent_at: now(),
  });
  const message = seed("messages", {
    sender_id: ids.player,
    receiver_id: ids.coach,
    content: "Message fictif à examiner",
    is_blocked: false,
  });
  seed("message_reports", {
    message_id: message.id,
    reporter_id: ids.coach,
    reason: "spam",
    status: "pending",
    reviewed_at: null,
  });
  seed("user_reports", {
    reporter_id: ids.coach,
    reported_id: ids.player,
    reason: "spam",
    details: "Signalement fictif",
    content_kind: "post",
    content_id: tables.posts[0].id,
    status: "pending",
    revision: 0,
    admin_notes: null,
    reviewed_at: null,
    report_priority: 2,
  });
  seed("player_ratings", {
    rated_id: ids.player,
    rater_id: ids.coach,
    pace: 80,
    shooting: 70,
    passing: 75,
    dribbling: 82,
    defending: 66,
    physical: 71,
  });
  seed("user_sessions", {
    user_id: ids.player,
    login_at: now(),
    device_type: "mobile",
    browser: "Recette",
  });
  seed("user_page_views", {
    user_id: ids.player,
    page_title: "Mon club",
    page_path: "/clubs",
    time_spent_seconds: 45,
  });
  seed("user_interactions", {
    user_id: ids.player,
    interaction_type: "like",
    target_type: "post",
    target_id: tables.posts[0].id,
  });
  seed("user_favorite_clubs", { user_id: ids.player, club: "ol" });
  seed("saved_posts", { user_id: ids.player, post_id: tables.posts[0].id });
  seed("opportunity_applications", {
    applicant_id: ids.player,
    opportunity_id: tables.opportunities[0].id,
    status: "pending",
    message: "Candidature de recette",
  });
  tables.club_claim_requests ||= [];
  seed("club_claim_requests", {
    user_id: ids.coach,
    club_id: tables.fff_clubs[1].id,
    full_name: "Camille Recette",
    position: "Présidence",
    email: "coach@fixture.test",
    status: "pending",
    updated_at: now(),
    club: tables.fff_clubs[1],
    id_card_front_url: null,
    id_card_back_url: null,
  });
  const audit = [],
    operations = new Map();
  const active = (role) => {
    const p = tables.profiles.find((p) => p.id === ids[role]);
    return (
      p?.is_admin === true &&
      !(
        p.is_suspended &&
        (!p.suspended_until || Date.parse(p.suspended_until) > Date.now())
      )
    );
  };
  function hydrate(row) {
    const copy = { ...row, _version: version(row) };
    copy._profiles = tables.profiles
      .filter((p) =>
        Object.entries(row).some(([k, v]) => k.endsWith("_id") && v === p.id),
      )
      .map(({ id, full_name, avatar_url }) => ({ id, full_name, avatar_url }));
    copy._club = tables.fff_clubs.find((c) => c.id === row.club_id) || null;
    copy._message =
      tables.messages.find((m) => m.id === row.message_id) || null;
    copy._message_version = copy._message ? version(copy._message) : null;
    const reminders = tables.profile_reminders.filter(
      (r) => r.user_id === row.id,
    );
    copy._reminders = {
      count: reminders.length,
      last: reminders.at(-1)?.sent_at || null,
    };
    return copy;
  }
  function page(resource, filters = {}, offset = 0, limit = 30, empty = false) {
    if (
      !tablesByResource[resource] ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      return failure("22023", "Page invalide");
    let rows = empty ? [] : [...tables[tablesByResource[resource]]];
    const needle = String(filters.search || "").toLowerCase();
    rows = rows.filter(
      (r) =>
        (!filters.id || r.id === filters.id) &&
        (!needle ||
          [r.full_name, r.username, r.name, r.content, r.title, r.city]
            .join(" ")
            .toLowerCase()
            .includes(needle)) &&
        (!filters.role || r.primary_role === filters.role) &&
        (!filters.department ||
          (r.department || r.department_code) === filters.department) &&
        (!filters.country ||
          (r.nationality || r.country) === filters.country) &&
        (resource !== "premium" || r.is_premium || r.is_open_premium) &&
        (filters.completion !== "incomplete" || percent(r) < 100) &&
        (filters.completion !== "complete" || percent(r) === 100) &&
        (!filters.status ||
          filters.status === "all" ||
          (filters.status === "suspended"
            ? r.is_suspended
            : r.status === filters.status)) &&
        (!filters.userId ||
          (resource === "connections"
            ? [r.user_id, r.connected_user_id].includes(filters.userId)
            : r[scopeByResource[resource] || "user_id"] === filters.userId)),
    );
    const order = (r) =>
      filters.sort === "name"
        ? r.full_name || r.name || ""
        : filters.sort === "completion"
          ? percent(r)
          : r.created_at || r.login_at || "";
    rows.sort(
      (a, b) =>
        (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0) *
          (filters.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id),
    );
    return ok({
      rows: rows.slice(offset, offset + limit).map(hydrate),
      total: rows.length,
      nextOffset: offset + limit < rows.length ? offset + limit : null,
    });
  }
  function rpc(name, body, role, scenario) {
    if (name === "can_review_content") return ok(active(role));
    if (
      ![
        "admin_console_page",
        "admin_console_overview",
        "admin_console_mutate",
        "review_club_claim",
        "review_content_report",
      ].includes(name)
    )
      return;
    if (!active(role))
      return failure("42501", "Accès administrateur refusé", 403);
    if (name === "admin_console_page")
      return page(
        body.p_resource,
        body.p_filters,
        body.p_offset,
        body.p_limit,
        scenario === "empty",
      );
    if (name === "admin_console_overview") {
      const count = scenario === "empty" ? 0 : tables.profiles.length;
      const breakdowns = Object.fromEntries(
        ["primary_role", "department", "nationality"].map((key) => {
          const grouped = new Map();
          for (const p of scenario === "empty" ? [] : tables.profiles) {
            const label = p[key] || "Non renseigné";
            grouped.set(label, (grouped.get(label) || 0) + 1);
          }
          return [
            key,
            [...grouped].map(([label, count]) => ({ label, count })),
          ];
        }),
      );
      return ok({
        generatedAt: now(),
        counts: {
          users: count,
          completeProfiles:
            scenario === "empty"
              ? 0
              : tables.profiles.filter((p) => percent(p) === 100).length,
          clubs: 2,
          premium: 3,
          reports: tables.user_reports.filter((r) => r.status === "pending")
            .length,
          posts: tables.posts.length,
          activeDay: 1,
          activeWeek: 2,
          activeMonth: 3,
          newToday: 2,
          newWeek: 8,
          newMonth: 31,
          claimed: 1,
          indoor: 0,
          postsToday: 1,
          connections: 2,
          connectionsToday: 0,
          messages: 1,
          messagesWeek: 1,
          profileViews: 1,
          actions5m: 0,
          actions30m: 1,
        },
        breakdowns,
        topUsers:
          scenario === "empty"
            ? []
            : [{ ...member, posts: tables.posts.length }],
        topClubs:
          scenario === "empty"
            ? []
            : tables.fff_clubs.map((c) => ({ ...c, members: 4 })),
        recent: scenario === "empty" ? [] : tables.profiles.slice(0, 5),
        signups: Array.from(
          { length: body.p_period === "day" ? 30 : 12 },
          (_, i) => ({
            period: `2026-09-${String(i + 1).padStart(2, "0")}`,
            value: scenario === "empty" ? 0 : (i * 7) % 13,
          }),
        ),
      });
    }
    if (name === "review_club_claim") {
      const row = tables.club_claim_requests.find(
        (r) => r.id === body.p_claim_id,
      );
      if (
        !row ||
        row.updated_at !== body.p_expected_updated_at ||
        row.status !== "pending"
      )
        return failure("40001", "Demande modifiée", 409);
      Object.assign(row, {
        status: body.p_decision,
        admin_notes: body.p_notes,
        updated_at: now(),
      });
      return ok(row.status);
    }
    if (name === "review_content_report") {
      const row = tables.user_reports.find((r) => r.id === body.p_id);
      if (!row || row.revision !== body.p_revision)
        return failure("40001", "Signalement modifié", 409);
      Object.assign(row, {
        status: {
          review: "reviewed",
          dismiss: "dismissed",
          remove_content: "resolved",
        }[body.p_action],
        revision: row.revision + 1,
        admin_notes: body.p_notes,
        reviewed_at: now(),
      });
      if (body.p_action === "remove_content") {
        const post = tables.posts.find((p) => p.id === row.content_id);
        if (post) post.moderation_hidden = true;
      }
      return ok({ id: row.id, status: row.status });
    }
    const [kind, action] = String(body.p_action).split(".");
    const table = {
      profile: "profiles",
      club: "fff_clubs",
      post: "posts",
      short: "shorts",
      photo: "user_photos",
      connection: "connections",
      follower: "profile_followers",
      block: "user_blocks",
      rating: "player_ratings",
      message: "message_reports",
    }[kind];
    const row = tables[table]?.find((r) => r.id === body.p_id);
    if (!row || version(row) !== body.p_expected)
      return failure("40001", "Cette fiche a changé", 409);
    if (String(body.p_reason || "").trim().length < 3)
      return failure("22023", "Motif requis");
    const values = body.p_values || {};
    if (kind === "profile" && action === "suspend" && row.id === ids[role])
      return failure("42501", "Auto-suspension interdite", 403);
    if (kind === "message") {
      if (action === "block") {
        const msg = tables.messages.find((m) => m.id === row.message_id);
        if (!msg || version(msg) !== values.expected_message)
          return failure("40001", "Message modifié", 409);
        msg.is_blocked = values.blocked;
      }
      Object.assign(row, {
        status: values.status,
        admin_notes: body.p_reason,
        reviewed_at: now(),
      });
    } else if (action === "delete")
      tables[table] = tables[table].filter((r) => r !== row);
    else if (kind === "profile" && action === "completion")
      row._completion_override = values.enabled
        ? { reason: body.p_reason, at: now(), by: ids[role] }
        : null;
    else if (kind === "club" && action === "suspend")
      row.metadata = { ...row.metadata, is_suspended: values.is_suspended };
    else Object.assign(row, values);
    const receipt = {
      id: randomUUID(),
      action: body.p_action,
      target_id: row.id,
    };
    audit.push(receipt);
    return ok(receipt);
  }
  function edge(name, body, role) {
    if (
      ![
        "admin-console-account",
        "ga4-analytics",
        "get-mobile-stats",
        "club-sport-data",
      ].includes(name)
    )
      return;
    if (!active(role)) return failure("42501", "Accès refusé", 403);
    if (name === "get-mobile-stats")
      return ok({ totalInstalls: 123, activeToday: 12, activeWeek: 30 });
    if (name === "ga4-analytics")
      return ok({
        rows: Array.from({ length: 12 }, (_, i) => ({
          period: `2026-09-${String(i + 1).padStart(2, "0")}`,
          users: i + 4,
          sessions: i + 7,
          pageViews: (i + 4) * 3,
          engagementRate: 0.55,
          averageSessionDuration: 82,
        })),
      });
    if (name === "club-sport-data")
      return ok({
        clubs: {
          total: 2,
          checked: 2,
          withTeams: 2,
          incomplete: 0,
          identityUnverified: 0,
          noTeamsPublished: 0,
          sourceUnavailable: 0,
          stale: 0,
        },
        teams: { total: 3 },
        matches: { total: 4, upcoming: 2, played: 2 },
        queue: { pending: 0, running: 0, failed: 0 },
        lastSuccessAt: now(),
        lastAttemptAt: now(),
        recentErrors: [],
      });
    const row = tables.profiles.find((p) => p.id === body.userId);
    if (!row) return failure("P0002", "Compte introuvable", 404);
    if (body.action === "security")
      return ok({ email: row.email || "member@fixture.test" });
    if (body.action === "avatar_upload")
      return failure(
        "55000",
        "Utilisez une URL d’image pour cette recette locale.",
        503,
      );
    if (operations.has(body.operationId))
      return ok(operations.get(body.operationId));
    if (version(row) !== body.expected)
      return failure("40001", "La fiche a changé", 409);
    if (body.action === "update_email") row.email = body.email;
    if (body.action === "delete_account") {
      if (row.id === ids[role])
        return failure("42501", "Auto-suppression interdite", 403);
      tables.profiles = tables.profiles.filter((p) => p.id !== row.id);
    }
    if (body.action === "reminder")
      seed("profile_reminders", {
        user_id: row.id,
        sent_at: now(),
        reminder_number: 2,
        missing_fields: completionKeys.filter((k) => !row[k]),
      });
    const receipt = {
      ok: true,
      userId: row.id,
      detail: "Action simulée confirmée. Aucun e-mail réel envoyé.",
    };
    operations.set(body.operationId, receipt);
    return ok(receipt);
  }
  return { rpc, edge };
}
