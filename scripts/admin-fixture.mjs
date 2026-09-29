// In-memory club administration contract for local acceptance only.
// This exercises client behaviour; it is NOT a substitute for PostgreSQL/RLS tests.
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
const key = (prefix, index) =>
  `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const now = () => new Date().toISOString();
const fail = (status, code, message) => ({
  status,
  data: { code, message, error: message },
});
const ok = (data, status = 200) => ({ status, data });
const forbidden = () =>
  fail(403, "42501", "Accès refusé pour ce club ou cette équipe.");
const invalid = (message = "Valeurs invalides.") => fail(400, "22023", message);
const conflict = () =>
  fail(409, "40001", "Cet élément a changé. Actualisez avant de réessayer.");
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const pick = (row, keys) =>
  Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
const sections = {
  players: [
    "club_players",
    ["name", "category", "position", "jersey_number", "is_active"],
  ],
  staff: ["club_staff", ["name", "role", "category", "is_active"]],
  teams: ["teams", ["name", "category", "age_group", "season", "is_active"]],
  matches: [
    "club_matches",
    [
      "opponent_name",
      "category",
      "match_date",
      "venue",
      "is_home",
      "competition",
      "matchday",
      "home_score",
      "away_score",
      "status",
      "team_id",
    ],
  ],
  convocations: [
    "club_convocations",
    [
      "title",
      "meeting_date",
      "meeting_location",
      "category",
      "description",
      "team_id",
    ],
  ],
  news: [
    "club_news",
    [
      "title",
      "excerpt",
      "content",
      "is_published",
      "is_pinned",
      "published_at",
    ],
  ],
  publications: ["club_publications", ["title", "content", "is_published"]],
  shorts: [
    "club_shorts",
    ["title", "description", "video_url", "thumbnail_url", "is_published"],
  ],
  palmares: [
    "club_achievements",
    ["title", "competition", "year", "category", "description"],
  ],
};
const infoFields = {
  infos: ["name", "short_name", "logo_url", "founded_date"],
  about: ["description", "history"],
  contact: ["address", "city", "postal_code", "phone", "email", "website"],
};
const sessionFields = [
  "session_type",
  "session_date",
  "category",
  "notes",
  "team_id",
];
const attendanceFields = ["id", "session_id", "player_id", "status", "notes"];
const calendarTables = new Set([
  "club_matches",
  "club_convocations",
  "club_attendance_sessions",
]);
const adminTables = new Set([
  ...Object.values(sections).map((v) => v[0]),
  "fff_clubs",
  "team_members",
  "club_admins",
  "club_membership_requests",
  "club_attendance_sessions",
  "club_attendance_records",
  "club_convocation_players",
  "notifications",
  "club_chat_groups",
  "club_chat_group_members",
  "club_chat_messages",
  "club_competitions",
  "club_competition_standings",
]);

export function createAdminFixture(tables, ids) {
  const red = tables.fff_clubs[0].id,
    blue = tables.fff_clubs[1].id;
  const team = key("b", 1),
    reserve = key("b", 2),
    otherTeam = key("b", 3);
  const session = key("c", 1),
    convocation = key("d", 1);
  for (const club of tables.fff_clubs)
    Object.assign(club, {
      short_name: club.id === red ? "CRR" : "CRB",
      founded_date: "1990-01-01",
      description: "Club fictif pour la recette administrateur.",
      history: null,
      phone: null,
      email: null,
      website: null,
      is_verified: false,
      club_status: "active",
      is_suspended: false,
      created_at: now(),
    });
  Object.assign(
    tables.profiles.find((p) => p.id === ids.club),
    { club: tables.fff_clubs[0].name },
  );
  tables.teams = [
    { id: team, club_id: red, name: "Seniors A", category: "SENIOR M1" },
    { id: reserve, club_id: red, name: "Seniors B", category: "SENIOR M2" },
    {
      id: otherTeam,
      club_id: blue,
      name: "Seniors Bleu",
      category: "SENIOR M1",
    },
  ].map((row) => ({
    ...row,
    season: "2026-2027",
    age_group: "Seniors",
    is_active: true,
    created_at: now(),
  }));
  tables.team_members = [
    { id: key("e", 1), team_id: team, profile_id: ids.coach, role: "coach" },
    { id: key("e", 2), team_id: team, profile_id: ids.player, role: "player" },
  ].map((row) => ({
    ...row,
    is_active: true,
    is_primary: true,
    status: "approved",
    joined_at: now(),
    created_at: now(),
    jersey_number: null,
    position: null,
  }));
  tables.club_admins = [
    {
      id: key("f", 1),
      club_id: red,
      profile_id: ids.club,
      role: "admin",
      created_at: now(),
    },
  ];
  tables.club_staff = [
    {
      id: key("6", 3),
      club_id: red,
      profile_id: ids.coach,
      name: "Recette coach",
      role: "Entraîneur",
      category: "SENIOR M1",
      is_active: true,
      created_at: now(),
    },
  ];
  for (const match of tables.club_matches)
    Object.assign(match, {
      team_id: team,
      venue: "Stade de recette",
      matchday: 1,
      home_score: match.home_score ?? null,
      away_score: match.away_score ?? null,
      created_at: now(),
    });
  tables.club_convocations = [
    {
      id: convocation,
      club_id: red,
      team_id: team,
      match_id: tables.club_matches[0].id,
      title: "Rendez-vous Seniors A",
      meeting_date: tables.club_matches[0].match_date,
      meeting_location: "Stade de recette",
      category: "SENIOR M1",
      description: "Apporter les crampons.",
      created_by: ids.club,
      created_at: now(),
    },
  ];
  tables.club_convocation_players = [];
  tables.club_attendance_sessions = [
    {
      id: session,
      club_id: red,
      team_id: team,
      created_by: ids.club,
      session_type: "training",
      session_date: new Date(Date.now() + 3600000).toISOString(),
      category: "SENIOR M1",
      notes: "Séance fictive.",
      created_at: now(),
    },
  ];
  tables.club_attendance_records = [];
  tables.club_news = [
    {
      id: key("9", 1),
      club_id: red,
      title: "Bienvenue au club de recette",
      excerpt: "Actualité fictive",
      content: "Préparation de la nouvelle saison.",
      is_published: true,
      is_pinned: false,
      published_at: now(),
      author_id: ids.club,
      created_at: now(),
    },
  ];
  for (const table of [
    "team_invitation_links",
    "club_membership_requests",
    "club_chat_groups",
    "club_chat_group_members",
    "club_competitions",
    "club_competition_standings",
    "competitions",
    "attendance",
  ])
    tables[table] ||= [];
  tables.club_competitions = [
    {
      id: key("c", 2),
      club_id: red,
      name: "Championnat de recette",
      type: "championship",
      category: "SENIOR M1",
      season: "2026-2027",
      level: "Départemental",
      start_date: null,
      end_date: null,
      external_url: null,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: key("c", 3),
      club_id: blue,
      name: "Coupe bleue",
      type: "cup",
      category: "SENIOR M1",
      season: "2026-2027",
      level: null,
      start_date: null,
      end_date: null,
      external_url: null,
      created_at: now(),
      updated_at: now(),
    },
  ];
  tables.club_competition_standings = [
    {
      id: key("c", 4),
      competition_id: key("c", 2),
      team_name: tables.fff_clubs[0].name,
      position: 1,
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      goals_for: 4,
      goals_against: 1,
      points: 4,
      is_own_team: true,
      updated_at: now(),
    },
  ];
  const chatGroup = key("a", 2);
  tables.club_chat_groups = [
    {
      id: chatGroup,
      club_id: red,
      name: "Organisation Seniors A",
      group_type: "team",
      team_category: "SENIOR M1",
      created_by: ids.club,
      created_at: now(),
      updated_at: now(),
    },
  ];
  tables.club_chat_group_members = ["club", "coach", "player"].map(
    (role, index) => ({
      id: key("a", index + 10),
      group_id: chatGroup,
      profile_id: ids[role],
      joined_at: now(),
    }),
  );
  tables.club_chat_messages = [
    {
      id: key("a", 3),
      group_id: chatGroup,
      author_id: ids.club,
      content: "Bienvenue dans la discussion de recette. Rendez-vous au stade.",
      media_url: null,
      reply_to_id: null,
      is_deleted: false,
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
      blocked_by: null,
      edited_at: null,
      created_at: now(),
    },
  ];
  const chatMember = (role, groupId) =>
    !!role &&
    tables.club_chat_group_members.some(
      (m) => m.group_id === groupId && m.profile_id === ids[role],
    );
  const admin = (role, club) =>
    !!role &&
    club === red &&
    (role === "admin" ||
      tables.club_admins.some(
        (row) => row.club_id === club && row.profile_id === ids[role],
      ));
  const canManage = (role, club, tid) =>
    admin(role, club) ||
    (!!role &&
      tables.teams.some(
        (t) => t.id === tid && t.club_id === club && t.is_active,
      ) &&
      tables.team_members.some(
        (m) =>
          m.team_id === tid &&
          m.profile_id === ids[role] &&
          m.status === "approved" &&
          m.is_active &&
          [
            "coach",
            "entraineur",
            "entraîneur",
            "educateur",
            "éducateur",
            "staff",
            "admin",
          ].includes(String(m.role || "").toLowerCase()),
      ));
  const clubFor = (table, row) =>
    row.club_id ||
    (table === "club_competition_standings"
      ? tables.club_competitions.find((c) => c.id === row.competition_id)
          ?.club_id
      : table === "club_chat_group_members" || table === "club_chat_messages"
        ? tables.club_chat_groups.find((g) => g.id === row.group_id)?.club_id
        : table === "fff_clubs"
          ? row.id
          : table === "team_members"
            ? tables.teams.find((t) => t.id === row.team_id)?.club_id
            : table === "club_convocation_players"
              ? tables.club_convocations.find(
                  (t) => t.id === row.convocation_id,
                )?.club_id
              : table === "club_attendance_records"
                ? tables.club_attendance_sessions.find(
                    (t) => t.id === row.session_id,
                  )?.club_id
                : null);
  const invitationClaims = new Map();
  function validRow(table, row, role) {
    if (table === "club_chat_messages") {
      if (
        row.author_id !== ids[role] ||
        !chatMember(role, row.group_id) ||
        row.is_deleted ||
        row.is_blocked ||
        row.blocked_reason != null ||
        row.blocked_at != null ||
        row.blocked_by != null
      )
        return forbidden();
      if (
        typeof row.content !== "string" ||
        !row.content.trim() ||
        row.content.length > 4000
      )
        return invalid("Le message doit contenir 1 à 4 000 caractères.");
      if (
        row.reply_to_id &&
        !tables.club_chat_messages.some(
          (m) => m.id === row.reply_to_id && m.group_id === row.group_id,
        )
      )
        return forbidden();
      return null;
    }

    if (table === "notifications") {
      const invite = tables.club_membership_requests.find(
        (r) =>
          r.id === row.metadata?.request_id && r.profile_id === row.receiver_id,
      );
      return row.type === "club_invitation" &&
        row.sender_id === ids[role] &&
        invite &&
        admin(role, invite.club_id)
        ? null
        : forbidden();
    }
    const club = clubFor(table, row);
    if (!tables.fff_clubs.some((c) => c.id === club))
      return invalid("Club inconnu.");
    if (
      !(calendarTables.has(table)
        ? canManage(role, club, row.team_id)
        : admin(role, club))
    )
      return forbidden();
    if (
      row.team_id &&
      !tables.teams.some((t) => t.id === row.team_id && t.club_id === club)
    )
      return invalid("Équipe étrangère au club.");
    const required =
      {
        club_chat_groups: ["name"],
        club_competitions: ["name", "type"],
        club_competition_standings: ["team_name"],
        teams: ["name", "category", "season"],
        club_players: ["name", "category"],
        club_staff: ["name", "role"],
        club_matches: ["opponent_name", "match_date"],
        club_convocations: ["title", "meeting_date"],
        club_news: ["title", "content"],
        club_publications: ["title", "content"],
        club_shorts: ["title", "video_url"],
      }[table] || [];
    if (required.some((k) => typeof row[k] !== "string" || !row[k].trim()))
      return invalid("Champ obligatoire manquant.");
    if (
      table === "club_competitions" &&
      !["championship", "cup", "friendly", "tournament"].includes(row.type)
    )
      return invalid("Type de compétition invalide.");
    if (
      table === "club_competition_standings" &&
      [
        "position",
        "played",
        "wins",
        "draws",
        "losses",
        "goals_for",
        "goals_against",
        "points",
      ].some(
        (field) =>
          row[field] != null &&
          (!Number.isInteger(row[field]) ||
            row[field] > 2 ** 31 - 1 ||
            row[field] <
              (field === "points" ? -(2 ** 31) : field === "position" ? 1 : 0)),
      )
    )
      return invalid("Statistique invalide.");
    if (calendarTables.has(table)) {
      const date = row.match_date || row.meeting_date || row.session_date;
      if (!Number.isFinite(Date.parse(date))) return invalid("Date invalide.");
    }
    if (
      table === "club_matches" &&
      (!["scheduled", "live", "finished", "cancelled", "postponed"].includes(
        row.status,
      ) ||
        ["home_score", "away_score"].some(
          (k) => row[k] != null && (!Number.isInteger(row[k]) || row[k] < 0),
        ))
    )
      return invalid("Score ou statut invalide.");
    if (
      table === "club_attendance_sessions" &&
      (!["training", "match", "meeting", "other"].includes(row.session_type) ||
        String(row.notes || "").length > 3000)
    )
      return invalid();
    if (
      table === "club_membership_requests" &&
      (row.invited_by !== ids[role] ||
        row.status !== "pending" ||
        row.responded_at != null ||
        !String(row.requested_role || "").trim() ||
        !tables.profiles.some((p) => p.id === row.profile_id))
    )
      return invalid("Invitation invalide.");
    if (table === "club_convocation_players") {
      if (
        !tables.club_players.some(
          (p) => p.id === row.player_id && p.club_id === club,
        )
      )
        return invalid("player_id doit désigner club_players dans ce club.");
      if (row.status !== "pending" || row.responded_at != null)
        return invalid("Nouvelle convocation en attente requise.");
    }
    if (
      ["club_admins", "team_members", "club_chat_group_members"].includes(
        table,
      ) &&
      !tables.profiles.some((p) => p.id === row.profile_id)
    )
      return invalid("Profil inconnu.");
    return null;
  }
  function mutate(table, method, body, matches, role, search, prefer = "") {
    if (!adminTables.has(table)) return undefined;
    if (!role) return fail(401, "42501", "Session requise.");
    if (table === "club_chat_messages" && method !== "POST")
      return fail(
        501,
        "FIXTURE_UNSUPPORTED",
        "Utiliser la RPC de modification de message.",
      );
    if (table === "club_attendance_records")
      return fail(501, "FIXTURE_UNSUPPORTED", "Utiliser les RPC de pointage.");
    if (table === "club_membership_requests" && method === "PATCH") {
      const selected = tables[table].filter(matches);
      if (
        Object.keys(body).join() !== "status" ||
        body.status !== "rejected" ||
        selected.some(
          (row) => row.profile_id !== ids[role] || row.status !== "pending",
        )
      )
        return forbidden();
      selected.forEach((row) =>
        Object.assign(row, { status: "rejected", responded_at: now() }),
      );
      return ok(selected);
    }
    if (!["POST", "PATCH", "DELETE"].includes(method))
      return fail(501, "FIXTURE_UNSUPPORTED", "Méthode non simulée.");
    const rows = tables[table],
      selected = rows.filter(matches);
    if (
      method !== "POST" &&
      selected.some(
        (row) =>
          !(calendarTables.has(table)
            ? canManage(role, clubFor(table, row), row.team_id)
            : admin(role, clubFor(table, row))),
      )
    )
      return forbidden();
    if (method === "DELETE") {
      if (
        table === "club_competitions" &&
        selected.some((row) =>
          tables.club_competition_standings.some(
            (s) => s.competition_id === row.id,
          ),
        )
      )
        return fail(
          501,
          "FIXTURE_UNSUPPORTED",
          "La suppression d’une compétition avec classement nécessite une vérification du contrat de cascade.",
        );
      if (table === "fff_clubs")
        return fail(
          501,
          "FIXTURE_UNSUPPORTED",
          "Suppression de club non simulée.",
        );
      if (
        table === "teams" &&
        selected.some((row) =>
          [
            ...tables.club_matches,
            ...tables.club_convocations,
            ...tables.club_attendance_sessions,
          ].some((event) => event.team_id === row.id),
        )
      )
        return fail(409, "23503", "Équipe encore utilisée par un événement.");
      tables[table] = rows.filter((row) => !selected.includes(row));
      return ok(selected);
    }
    const inputs =
      method === "POST"
        ? Array.isArray(body)
          ? body
          : [body]
        : selected.map((row) => ({ ...row, ...body }));
    if (inputs.some((row) => !object(row))) return invalid();
    if (
      method === "PATCH" &&
      (Object.hasOwn(body, "id") || Object.hasOwn(body, "club_id"))
    )
      return invalid("Identité immuable.");
    const candidates = inputs.map((row) => ({
      id: randomUUID(),
      created_at: now(),
      ...row,
    }));
    for (const row of candidates) {
      if (["club_competitions", "club_competition_standings"].includes(table))
        row.updated_at = now();
      if (table === "club_chat_groups") {
        if (method === "POST" && row.created_by !== ids[role])
          return forbidden();
        Object.assign(row, {
          group_type: row.group_type ?? "club",
          team_category: row.team_category ?? null,
          updated_at: now(),
        });
      }
      if (table === "club_chat_group_members") row.joined_at ??= now();
      if (table === "club_chat_messages")
        Object.assign(row, {
          media_url: row.media_url ?? null,
          reply_to_id: row.reply_to_id ?? null,
          is_deleted: row.is_deleted ?? false,
          is_blocked: row.is_blocked ?? false,
          edited_at: row.edited_at ?? null,
          blocked_reason: row.blocked_reason ?? null,
          blocked_at: row.blocked_at ?? null,
          blocked_by: row.blocked_by ?? null,
        });
      if (table === "club_convocation_players")
        Object.assign(row, {
          notes: row.notes ?? null,
          responded_at: row.responded_at ?? null,
        });
      if (method === "POST" && row.created_by && row.created_by !== ids[role])
        return forbidden();
      const issue = validRow(table, row, role);
      if (issue) return issue;
    }
    const unique = {
      club_chat_group_members: ["group_id", "profile_id"],
      team_members: ["team_id", "profile_id"],
      club_admins: ["club_id", "profile_id"],
      club_membership_requests: ["club_id", "profile_id"],
      club_convocation_players: ["convocation_id", "player_id"],
    }[table];
    if (
      method === "POST" &&
      candidates.some((row, i) =>
        [...rows, ...candidates.slice(0, i)].some(
          (other) =>
            other.id === row.id ||
            (unique && unique.every((k) => other[k] === row[k])),
        ),
      )
    )
      return fail(409, "23505", "Cet élément existe déjà.");
    if (method === "PATCH")
      selected.forEach((row, i) => Object.assign(row, candidates[i]));
    else rows.push(...candidates);
    return ok(candidates, method === "POST" ? 201 : 200);
  }
  function rpc(name, b, role) {
    if (["is_club_admin", "is_fff_club_admin"].includes(name))
      return ok(admin(role, b.p_club_id));
    if (name === "is_site_admin") return ok(role === "admin");
    if (name === "is_native_club_or_team_staff")
      return ok(
        admin(role, b.p_club_id) ||
          tables.teams.some((t) => canManage(role, b.p_club_id, t.id)),
      );
    if (name === "can_manage_native_calendar_event")
      return ok(canManage(role, b.p_club_id, b.p_team_id));
    if (name === "get_native_calendar_editor_teams")
      return ok(
        tables.teams
          .filter(
            (t) =>
              t.club_id === b.p_club_id && canManage(role, b.p_club_id, t.id),
          )
          .map((t) => pick(t, ["id", "name", "category", "is_active"])),
      );
    if (
      name === "mutate_native_club_record_snapshot" ||
      name === "update_native_attendance_session"
    ) {
      const spec =
        name === "update_native_attendance_session"
          ? ["club_attendance_sessions", sessionFields]
          : sections[b.p_section];
      if (!spec) return invalid("Section non simulée.");
      const [table, fields] = spec,
        row = tables[table].find(
          (r) => r.id === b.p_id && r.club_id === b.p_club_id,
        );
      if (
        !(calendarTables.has(table)
          ? canManage(role, b.p_club_id, row?.team_id)
          : admin(role, b.p_club_id))
      )
        return forbidden();
      if (
        !object(b.p_values) ||
        !object(b.p_expected) ||
        b.p_expected.id !== b.p_id ||
        b.p_expected.club_id !== b.p_club_id
      )
        return invalid("Snapshot complet requis.");
      if (
        row &&
        Object.keys(row).sort().join() !==
          Object.keys(b.p_expected).sort().join()
      )
        return invalid("Snapshot complet requis.");
      if (!row || !isDeepStrictEqual(row, b.p_expected)) return conflict();
      const fieldsChanged = Object.keys(b.p_values);
      if (
        name === "update_native_attendance_session" &&
        [...fieldsChanged].sort().join() !== [...sessionFields].sort().join()
      )
        return invalid("Valeurs de séance complètes requises.");
      if (
        (b.p_delete && fieldsChanged.length) ||
        (!b.p_delete &&
          (!fieldsChanged.length ||
            fieldsChanged.some((k) => !fields.includes(k))))
      )
        return invalid("Champs non autorisés.");
      if (b.p_delete && ["players", "staff"].includes(b.p_section))
        return invalid(
          "Archiver la personne au lieu de supprimer son historique.",
        );
      const result = mutate(
        table,
        b.p_delete ? "DELETE" : "PATCH",
        b.p_values,
        (r) => r.id === row.id,
        role,
      );
      return result.status >= 400 ? result : ok(row.id);
    }
    if (name === "get_native_convocation_candidates") {
      if (!admin(role, b.p_club_id)) return forbidden();
      if (
        !tables.club_convocations.some(
          (c) => c.id === b.p_convocation_id && c.club_id === b.p_club_id,
        )
      )
        return forbidden();
      if (
        !Number.isInteger(b.p_offset ?? 0) ||
        (b.p_offset ?? 0) < 0 ||
        String(b.p_search || "").length > 100
      )
        return invalid();
      if (
        b.p_team_id &&
        !tables.teams.some(
          (t) => t.id === b.p_team_id && t.club_id === b.p_club_id,
        )
      )
        return invalid();
      return ok(
        tables.club_players
          .filter(
            (p) =>
              p.club_id === b.p_club_id &&
              p.is_active &&
              p.name
                .toLowerCase()
                .includes(String(b.p_search || "").toLowerCase()) &&
              (!b.p_team_id ||
                tables.team_members.some(
                  (t) =>
                    t.team_id === b.p_team_id &&
                    t.profile_id === p.profile_id &&
                    t.is_active,
                )) &&
              !tables.club_convocation_players.some(
                (c) =>
                  c.convocation_id === b.p_convocation_id &&
                  c.player_id === p.id,
              ),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(b.p_offset || 0, (b.p_offset || 0) + 30)
          .map((p) => pick(p, ["id", "name", "category"])),
      );
    }
    if (name === "save_native_attendance_record") {
      const parent = tables.club_attendance_sessions.find(
        (s) => s.id === b.p_session_id,
      );
      if (!admin(role, parent?.club_id)) return forbidden();
      if (
        !tables.club_players.some(
          (p) => p.id === b.p_player_id && p.club_id === parent.club_id,
        ) ||
        !["present", "absent", "late", "excused", "injured"].includes(
          b.p_status,
        ) ||
        String(b.p_notes || "").length > 3000 ||
        !b.p_id
      )
        return invalid();
      const row = tables.club_attendance_records.find(
        (r) => r.session_id === b.p_session_id && r.player_id === b.p_player_id,
      );
      if (
        b.p_expected != null &&
        (!object(b.p_expected) ||
          Object.keys(b.p_expected).sort().join() !==
            [...attendanceFields].sort().join() ||
          b.p_expected.id !== b.p_id ||
          b.p_expected.session_id !== b.p_session_id ||
          b.p_expected.player_id !== b.p_player_id)
      )
        return invalid("Snapshot complet requis.");
      if (
        row &&
        row.id === b.p_id &&
        row.status === b.p_status &&
        row.notes === b.p_notes
      )
        return ok(row.id);
      if (
        (row &&
          (!b.p_expected ||
            !isDeepStrictEqual(pick(row, attendanceFields), b.p_expected))) ||
        (!row && b.p_expected)
      )
        return conflict();
      if (row) Object.assign(row, { status: b.p_status, notes: b.p_notes });
      else
        tables.club_attendance_records.push({
          id: b.p_id,
          session_id: b.p_session_id,
          player_id: b.p_player_id,
          status: b.p_status,
          notes: b.p_notes,
          created_at: now(),
        });
      return ok(b.p_id);
    }
    if (
      [
        "delete_native_attendance_record",
        "delete_native_convocation_player",
      ].includes(name)
    ) {
      const attendance = name === "delete_native_attendance_record",
        table = attendance
          ? "club_attendance_records"
          : "club_convocation_players",
        fk = attendance ? "session_id" : "convocation_id",
        parentId = attendance ? b.p_session_id : b.p_convocation_id;
      const parent = tables[
        attendance ? "club_attendance_sessions" : "club_convocations"
      ].find((r) => r.id === parentId);
      if (!admin(role, parent?.club_id)) return forbidden();
      const row = tables[table].find(
        (r) => r.id === b.p_id && r[fk] === parentId,
      );
      if (
        !row ||
        !isDeepStrictEqual(
          attendance ? pick(row, attendanceFields) : row,
          b.p_expected,
        )
      )
        return conflict();
      tables[table] = tables[table].filter((r) => r !== row);
      return ok(row.id);
    }
    if (name === "update_native_club_message_snapshot") {
      const fields = [
        "content",
        "edited_at",
        "is_blocked",
        "is_deleted",
        "media_url",
      ];
      if (!role || !chatMember(role, b.p_group_id)) return forbidden();
      if (
        !object(b.p_expected) ||
        typeof b.p_delete !== "boolean" ||
        Object.keys(b.p_expected).sort().join() !== fields.sort().join()
      )
        return invalid("Snapshot complet du message requis.");
      if (
        !b.p_delete &&
        (typeof b.p_content !== "string" ||
          !b.p_content.trim() ||
          b.p_content.length > 4000)
      )
        return invalid();
      const row = tables.club_chat_messages.find(
        (m) =>
          m.id === b.p_message_id &&
          m.group_id === b.p_group_id &&
          m.author_id === ids[role],
      );
      if (
        !row ||
        row.is_deleted ||
        row.is_blocked ||
        !isDeepStrictEqual(pick(row, fields), b.p_expected)
      )
        return conflict();
      Object.assign(
        row,
        b.p_delete
          ? { content: "", media_url: null, is_deleted: true }
          : { content: b.p_content, edited_at: now() },
      );
      return ok(row.id);
    }
    if (name === "set_native_primary_team") {
      if (!admin(role, b.p_club_id)) return forbidden();
      const profile = tables.profiles.find(
        (p) => p.id === b.p_profile_id && p.linked_club_id === b.p_club_id,
      );
      if (!profile) return invalid("Ce membre ne fait plus partie du club.");
      if (
        b.p_team_id &&
        !tables.teams.some(
          (t) =>
            t.id === b.p_team_id && t.club_id === b.p_club_id && t.is_active,
        )
      )
        return invalid("Équipe indisponible.");
      const assignments = tables.team_members.filter(
        (m) =>
          m.profile_id === profile.id &&
          tables.teams.some(
            (t) => t.id === m.team_id && t.club_id === b.p_club_id,
          ),
      );
      const primary = assignments.filter((m) => m.is_active && m.is_primary);
      if (primary.length > 1) return invalid("Plusieurs équipes principales.");
      const previous = primary[0]?.team_id ?? null;
      if (previous === b.p_team_id) return ok(null);
      if (previous !== b.p_expected_team_id) return conflict();
      assignments.forEach((m) => {
        m.is_primary = false;
      });
      if (b.p_team_id) {
        const existing = assignments.find((m) => m.team_id === b.p_team_id);
        if (existing)
          Object.assign(existing, {
            is_primary: true,
            is_active: true,
            left_at: null,
          });
        else
          tables.team_members.push({
            id: randomUUID(),
            team_id: b.p_team_id,
            profile_id: profile.id,
            role: profile.primary_role,
            position: profile.position || "",
            status: "approved",
            is_active: true,
            is_primary: true,
            created_at: now(),
          });
      }
      return ok(null);
    }
    if (name === "create_native_team_invitation_link") {
      if (!canManage(role, b.p_club_id, b.p_team_id)) return forbidden();
      if (
        !tables.teams.some(
          (t) =>
            t.id === b.p_team_id && t.club_id === b.p_club_id && t.is_active,
        ) ||
        !String(b.p_role ?? "Joueur").trim() ||
        !Number.isInteger(b.p_max_uses ?? 1) ||
        (b.p_max_uses ?? 1) < 1 ||
        (b.p_max_uses ?? 1) > 200 ||
        (b.p_jersey_number != null &&
          (!Number.isInteger(b.p_jersey_number) ||
            b.p_jersey_number < 0 ||
            b.p_jersey_number > 999)) ||
        (b.p_expires_at != null &&
          (!Number.isFinite(Date.parse(b.p_expires_at)) ||
            Date.parse(b.p_expires_at) <= Date.now()))
      )
        return invalid();
      const row = {
        id: randomUUID(),
        club_id: b.p_club_id,
        team_id: b.p_team_id,
        invited_by: ids[role],
        code:
          "TEST" +
          (tables.team_invitation_links.length + 1)
            .toString(31)
            .split("")
            .map((c) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[parseInt(c, 31)])
            .join("")
            .padStart(6, "A"),
        role: String(b.p_role ?? "Joueur").trim(),
        position: b.p_position ?? null,
        jersey_number: b.p_jersey_number ?? null,
        max_uses: b.p_max_uses ?? 1,
        uses_count: 0,
        status: "active",
        expires_at: b.p_expires_at ?? null,
        created_at: now(),
      };
      tables.team_invitation_links.push(row);
      return ok(row);
    }
    if (name === "accept_club_membership_request") {
      const row = tables.club_membership_requests.find(
        (r) => r.id === b.request_id && r.profile_id === ids[role],
      );
      if (!role || !row) return forbidden();
      if (row.status === "accepted") return ok(null);
      if (row.status !== "pending") return conflict();
      const profile = tables.profiles.find((p) => p.id === ids[role]);
      Object.assign(profile, {
        linked_club_id: row.club_id,
        primary_role: row.requested_role,
      });
      Object.assign(row, { status: "accepted", responded_at: now() });
      return ok(null);
    }
    if (name === "accept_native_team_invitation_link") {
      if (!role) return forbidden();
      const code = String(b.p_code || "")
        .trim()
        .toUpperCase();
      if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code))
        return invalid("Code d’invitation invalide.");
      const row = tables.team_invitation_links.find((r) => r.code === code);
      if (!row) return forbidden();
      if (
        !tables.teams.some(
          (t) =>
            t.id === row.team_id && t.club_id === row.club_id && t.is_active,
        )
      )
        return conflict();
      const receiptKey = row.id + ":" + ids[role],
        receipt = invitationClaims.get(receiptKey);
      const member = tables.team_members.find(
        (m) =>
          m.team_id === row.team_id &&
          m.profile_id === ids[role] &&
          m.role === row.role,
      );
      const active = member?.is_active && member.status === "approved";
      if (receipt)
        return isDeepStrictEqual(
          receipt,
          pick(row, ["club_id", "team_id", "role"]),
        ) && active
          ? ok(row)
          : conflict();
      if (
        row.status !== "active" ||
        row.uses_count >= row.max_uses ||
        (row.expires_at && Date.parse(row.expires_at) <= Date.now())
      )
        return conflict();
      if (!active) {
        Object.assign(
          tables.profiles.find((p) => p.id === ids[role]),
          { linked_club_id: row.club_id, primary_role: row.role },
        );
        const values = {
          team_id: row.team_id,
          profile_id: ids[role],
          role: row.role,
          position: row.position || "",
          jersey_number: row.jersey_number,
          is_active: true,
          is_primary: true,
          status: "approved",
          joined_at: now(),
        };
        if (member) Object.assign(member, values);
        else
          tables.team_members.push({
            id: randomUUID(),
            created_at: now(),
            ...values,
          });
        row.uses_count++;
        if (row.uses_count >= row.max_uses) row.status = "expired";
      }
      invitationClaims.set(
        receiptKey,
        pick(row, ["club_id", "team_id", "role"]),
      );
      return ok(row);
    }
    if (name === "get_native_member_calendar") {
      if (!role) return forbidden();
      const offset = b.p_offset ?? 0,
        limit = b.p_limit ?? 30,
        period = b.p_period ?? "future",
        scope = b.p_scope ?? "teams",
        at = b.p_at ?? now();
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 30 ||
        !["future", "past"].includes(period) ||
        !["teams", "club"].includes(scope) ||
        !Number.isFinite(Date.parse(at))
      )
        return invalid();
      const recipient = (event) =>
        tables.team_members.some(
          (m) =>
            m.profile_id === ids[role] &&
            m.is_active &&
            m.status === "approved" &&
            tables.teams.some(
              (t) => t.id === m.team_id && t.club_id === b.p_club_id,
            ) &&
            (!event?.team_id || m.team_id === event.team_id),
        );
      if (!recipient()) return forbidden();
      const events = [
        ...tables.club_matches.map((m) => ({
          ...m,
          kind: "match",
          sort_date: m.match_date,
        })),
        ...tables.club_attendance_sessions.map((s) => ({
          ...s,
          kind: "training",
          sort_date: s.session_date,
        })),
      ]
        .filter(
          (e) =>
            e.club_id === b.p_club_id &&
            recipient(e) &&
            (scope === "teams"
              ? e.team_id && (!b.p_team_id || e.team_id === b.p_team_id)
              : !e.team_id) &&
            (period === "future" ? e.sort_date >= at : e.sort_date < at),
        )
        .map((e) => ({
          ...e,
          team_name: tables.teams.find((t) => t.id === e.team_id)?.name ?? null,
        }));
      events.sort(
        (a, b) =>
          (period === "future" ? 1 : -1) *
            a.sort_date.localeCompare(b.sort_date) || a.id.localeCompare(b.id),
      );
      return ok(events.slice(offset, offset + limit));
    }
    if (name === "get_native_member_convocations") {
      if (!role) return fail(401, "42501", "Session requise.");
      const offset = b.p_offset ?? 0,
        limit = b.p_limit ?? 30;
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 30
      )
        return invalid();
      return ok(
        tables.club_convocation_players
          .filter((row) =>
            tables.club_players.some(
              (p) => p.id === row.player_id && p.profile_id === ids[role],
            ),
          )
          .map((row) => ({
            ...pick(row, ["id", "status", "responded_at"]),
            convocation: tables.club_convocations.find(
              (c) => c.id === row.convocation_id,
            ),
          }))
          .sort((a, b) =>
            b.convocation.meeting_date.localeCompare(
              a.convocation.meeting_date,
            ),
          )
          .slice(offset, offset + limit),
      );
    }
    if (name === "respond_native_member_convocation") {
      if (!role) return fail(401, "42501", "Session requise.");
      if (
        !["accepted", "declined"].includes(b.p_status) ||
        !b.p_expected_status
      )
        return invalid();
      const row = tables.club_convocation_players.find(
        (r) =>
          r.id === b.p_id &&
          tables.club_players.some(
            (p) => p.id === r.player_id && p.profile_id === ids[role],
          ),
      );
      if (!row || !["pending", "accepted", "declined"].includes(row.status))
        return forbidden();
      if (row.status === b.p_status && row.responded_at) return ok(row.id);
      if (
        row.status !== b.p_expected_status ||
        row.responded_at !== b.p_expected_responded_at
      )
        return conflict();
      Object.assign(row, { status: b.p_status, responded_at: now() });
      return ok(row.id);
    }
    return undefined;
  }
  function edge(name, b, role) {
    if (name !== "update-club-info") return undefined;
    if (!admin(role, b.clubId)) return forbidden();
    const fields = infoFields[b.section],
      row = tables.fff_clubs.find((c) => c.id === b.clubId);
    if (
      !fields ||
      !object(b.expected) ||
      Object.keys(b.expected).sort().join() !== [...fields].sort().join()
    )
      return invalid("Snapshot de rubrique requis.");
    if (!isDeepStrictEqual(pick(row, fields), b.expected)) return conflict();
    if (b.section === "infos" && (!b.name || !String(b.name).trim()))
      return invalid("Le nom est obligatoire.");
    const values = pick(b, fields);
    Object.assign(row, values);
    return ok({ values: pick(row, fields) });
  }
  const privateTables = new Set([
    "club_admins",
    "club_membership_requests",
    "team_invitation_links",
    "club_attendance_sessions",
    "club_attendance_records",
    "club_convocations",
    "club_convocation_players",
  ]);
  function readable(table, row, role) {
    if (table === "club_chat_groups")
      return admin(role, row.club_id) || chatMember(role, row.id);
    if (table === "club_chat_group_members")
      return (
        !!role &&
        (row.profile_id === ids[role] || admin(role, clubFor(table, row)))
      );
    if (table === "club_chat_messages") return chatMember(role, row.group_id);

    if (table === "notifications")
      return !!role && row.receiver_id === ids[role];
    if (["club_news", "club_publications", "club_shorts"].includes(table))
      return row.is_published === true || admin(role, row.club_id);
    if (!privateTables.has(table)) return true;
    const club = clubFor(table, row);
    if (admin(role, club)) return true;
    if (calendarTables.has(table)) return canManage(role, club, row.team_id);
    if (table === "club_convocation_players")
      return tables.club_players.some(
        (p) => p.id === row.player_id && p.profile_id === ids[role],
      );
    if (table === "team_invitation_links")
      return canManage(role, row.club_id, row.team_id);
    return (
      ["club_admins", "club_membership_requests"].includes(table) &&
      row.profile_id === ids[role]
    );
  }
  return {
    rpc,
    edge,
    mutate,
    readable,
    ids: {
      red,
      blue,
      team,
      reserve,
      otherTeam,
      session,
      convocation,
      chatGroup,
    },
  };
}
