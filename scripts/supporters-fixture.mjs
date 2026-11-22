// Disposable, opt-in UI fixtures. This module never connects to Supabase.
import { randomUUID } from "node:crypto";

export function createSupportersFixture(ids, profiles, clubs = []) {
  const parisId = "93000000-0000-4000-8000-000000000001";
  const marseilleId = "93000000-0000-4000-8000-000000000002";
  clubs.push(
    {
      id: parisId,
      name: "Paris Saint-Germain",
      short_name: "PSG",
      city: "Paris",
      type: "club",
      logo_url: null,
    },
    {
      id: marseilleId,
      name: "Olympique de Marseille",
      short_name: "OM",
      city: "Marseille",
      type: "club",
      logo_url: null,
    },
  );
  Object.assign(
    profiles.find((p) => p.id === ids.player),
    {
      favorite_pro_club: "Paris Saint-Germain",
      city: "Montpellier",
      linked_club_id: "30000000-0000-4000-8000-000000000001",
    },
  );
  const now = () => new Date().toISOString();
  const future = (days) =>
    new Date(Date.now() + days * 86_400_000).toISOString();
  const groupIds = [1, 2, 3].map(
    (n) => `94000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  );
  const groups = [
    {
      id: groupIds[0],
      name: "Paris ensemble à Montpellier",
      club_name: "Paris Saint-Germain",
      club_id: parisId,
      city: "Montpellier",
      description:
        "Un groupe de recette pour partager notre passion du PSG et regarder les matchs ensemble.",
      created_by: ids.coach,
      member_count: 1,
      created_at: now(),
    },
    {
      id: groupIds[1],
      name: "Les Marseillais de Lyon",
      club_name: "Olympique de Marseille",
      club_id: marseilleId,
      city: "Lyon",
      description:
        "Une communauté fictive pour vérifier les filtres club et ville.",
      created_by: ids.admin,
      member_count: 1,
      created_at: now(),
    },
    {
      id: groupIds[2],
      name: "Paris au bord du Rhône",
      club_name: "Paris Saint-Germain",
      club_id: parisId,
      city: "Lyon",
      description:
        "Retrouvons-nous autour des matchs dans notre ville. Données de recette uniquement.",
      created_by: ids.coach,
      member_count: 1,
      created_at: now(),
    },
  ];
  const memberships = groups.map((g) => ({
    group_id: g.id,
    user_id: g.created_by,
    joined_at: now(),
  }));
  const messages = [
    {
      id: "95000000-0000-4000-8000-000000000001",
      group_id: groupIds[0],
      author_id: ids.coach,
      content: "Bienvenue ! Qui nous rejoint au prochain rendez-vous ?",
      created_at: now(),
    },
  ];
  const meetups = [
    {
      id: "96000000-0000-4000-8000-000000000001",
      group_id: groupIds[0],
      created_by: ids.coach,
      title: "Le prochain match ensemble",
      kind: "watch_party",
      starts_at: future(7),
      location: "Café de recette, Montpellier",
      description:
        "Rendez-vous fictif pour tester la participation. Aucune réservation réelle.",
      capacity: 2,
      attendee_count: 0,
      status: "scheduled",
      created_at: now(),
    },
    {
      id: "96000000-0000-4000-8000-000000000002",
      group_id: groupIds[0],
      created_by: ids.coach,
      title: "Tous au stade",
      kind: "stadium_trip",
      starts_at: future(14),
      location: "Gare de recette, Montpellier",
      description: "Point de rencontre fictif avant le déplacement.",
      capacity: null,
      attendee_count: 0,
      status: "scheduled",
      created_at: now(),
    },
  ];
  const attendees = [];
  const tables = {
    supporter_groups: groups,
    supporter_memberships: memberships,
    supporter_messages: messages,
    supporter_meetups: meetups,
    supporter_meetup_attendees: attendees,
  };
  const ok = (data) => ({ status: 200, data });
  const failure = (
    message = "Rejoignez ce groupe pour participer.",
    code = "42501",
  ) => ({ status: code === "22023" ? 400 : 403, data: { message, code } });
  const member = (groupId, uid) =>
    memberships.some((r) => r.group_id === groupId && r.user_id === uid);
  const owner = (groupId, uid) =>
    groups.some((g) => g.id === groupId && g.created_by === uid);
  const validText = (value, min, max) =>
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max;
  const recount = () => {
    groups.forEach((g) => {
      g.member_count = memberships.filter((m) => m.group_id === g.id).length;
    });
    meetups.forEach((m) => {
      m.attendee_count = attendees.filter((a) => a.meetup_id === m.id).length;
    });
  };
  const remove = (rows, predicate) => {
    for (let index = rows.length - 1; index >= 0; index--)
      if (predicate(rows[index])) rows.splice(index, 1);
  };

  function rpc(name, b, uid) {
    if (name === "update_native_profile_snapshot") {
      const profile = profiles.find((p) => p.id === uid);
      const values = b?.p_values ?? {},
        expected = b?.p_expected ?? {};
      if (
        !profile ||
        !Object.keys(values).length ||
        Object.keys(values).some(
          (key) =>
            !["favorite_pro_club", "favorite_amateur_club"].includes(key),
        )
      )
        return failure("Fixture: only favorite fields supported.");
      if (
        Object.keys(values).some(
          (key) => (profile[key] ?? null) !== expected[key],
        )
      )
        return failure("Le profil a changé.", "40001");
      Object.assign(profile, values);
      return ok(profile);
    }
    if (!name.startsWith("supporter_")) return null;
    if (!uid) return failure("Connectez-vous avec un compte actif.");
    if (name === "supporter_create_group") {
      const linked = b.p_club_id
        ? clubs.find((c) => c.id === b.p_club_id)
        : null;
      if (b.p_club_id && !linked) return failure("Club introuvable.", "22023");
      if (
        !validText(b.p_name, 3, 100) ||
        !validText(b.p_club_name, 2, 120) ||
        !validText(b.p_city, 2, 120) ||
        !validText(b.p_description ?? "", 0, 1500)
      )
        return failure("Vérifiez les informations du groupe.", "22023");
      const group = {
        id: randomUUID(),
        name: b.p_name.trim(),
        club_name: linked?.name ?? b.p_club_name.trim(),
        club_id: linked?.id ?? null,
        city: b.p_city.trim(),
        description: (b.p_description ?? "").trim(),
        created_by: uid,
        member_count: 1,
        created_at: now(),
      };
      groups.unshift(group);
      memberships.push({ group_id: group.id, user_id: uid, joined_at: now() });
      return ok(group);
    }
    if (name === "supporter_join_group") {
      if (!groups.some((g) => g.id === b.p_group_id))
        return failure("Groupe introuvable.");
      if (!member(b.p_group_id, uid))
        memberships.push({
          group_id: b.p_group_id,
          user_id: uid,
          joined_at: now(),
        });
      recount();
      return ok(true);
    }
    if (name === "supporter_leave_group") {
      if (owner(b.p_group_id, uid))
        return failure(
          "L’organisateur doit rester membre de son groupe.",
          "P0001",
        );
      remove(
        memberships,
        (r) => r.group_id === b.p_group_id && r.user_id === uid,
      );
      remove(
        attendees,
        (r) =>
          r.user_id === uid &&
          meetups.some(
            (m) => m.id === r.meetup_id && m.group_id === b.p_group_id,
          ),
      );
      recount();
      return ok(true);
    }
    if (name === "supporter_post_message") {
      if (!member(b.p_group_id, uid)) return failure();
      if (!validText(b.p_content, 1, 2000))
        return failure(
          "Le message doit contenir entre 1 et 2 000 caractères.",
          "22023",
        );
      const message = {
        id: randomUUID(),
        group_id: b.p_group_id,
        author_id: uid,
        content: b.p_content.trim(),
        created_at: now(),
      };
      messages.push(message);
      return ok(message);
    }
    if (name === "supporter_delete_message") {
      const message = messages.find((m) => m.id === b.p_message_id);
      if (message && message.author_id !== uid && !owner(message.group_id, uid))
        return failure();
      remove(messages, (m) => m.id === b.p_message_id);
      return ok(true);
    }
    if (name === "supporter_create_meetup") {
      if (!owner(b.p_group_id, uid))
        return failure("Seul l’organisateur peut créer un rendez-vous.");
      if (
        !validText(b.p_title, 3, 160) ||
        !validText(b.p_location, 3, 240) ||
        !validText(b.p_description ?? "", 0, 2000) ||
        !["watch_party", "stadium_trip"].includes(b.p_kind) ||
        !(Date.parse(b.p_starts_at) > Date.now()) ||
        (b.p_capacity != null &&
          (!Number.isInteger(b.p_capacity) ||
            b.p_capacity < 1 ||
            b.p_capacity > 5000))
      )
        return failure("Vérifiez les informations du rendez-vous.", "22023");
      const meetup = {
        id: randomUUID(),
        group_id: b.p_group_id,
        created_by: uid,
        title: b.p_title.trim(),
        kind: b.p_kind,
        starts_at: b.p_starts_at,
        location: b.p_location.trim(),
        description: (b.p_description ?? "").trim(),
        capacity: b.p_capacity ?? null,
        attendee_count: 0,
        status: "scheduled",
        created_at: now(),
      };
      meetups.push(meetup);
      return ok(meetup);
    }
    if (name === "supporter_set_attendance") {
      const meetup = meetups.find((m) => m.id === b.p_meetup_id);
      if (!meetup) return failure("Rendez-vous introuvable.");
      if (!b.p_attending) {
        remove(
          attendees,
          (a) => a.meetup_id === meetup.id && a.user_id === uid,
        );
        recount();
        return ok(true);
      }
      if (!member(meetup.group_id, uid)) return failure();
      if (
        meetup.status !== "scheduled" ||
        Date.parse(meetup.starts_at) <= Date.now()
      )
        return failure("Les inscriptions sont fermées.", "P0001");
      if (attendees.some((a) => a.meetup_id === meetup.id && a.user_id === uid))
        return ok(true);
      if (meetup.capacity != null && meetup.attendee_count >= meetup.capacity)
        return failure("Ce rendez-vous est complet.", "P0001");
      attendees.push({ meetup_id: meetup.id, user_id: uid, created_at: now() });
      recount();
      return ok(true);
    }
    if (name === "supporter_cancel_meetup") {
      const meetup = meetups.find((m) => m.id === b.p_meetup_id);
      if (!meetup || !owner(meetup.group_id, uid)) return failure();
      meetup.status = "cancelled";
      return ok(true);
    }
    return {
      status: 404,
      data: { message: `Unknown supporter fixture RPC: ${name}` },
    };
  }

  return (url, method, body, role, headers = {}) => {
    const uid = ids[role];
    if (url.pathname === "/__fixture/supporters")
      return ok({
        fixture: true,
        groupIds,
        meetupIds: meetups.map((m) => m.id),
      });
    if (url.pathname.startsWith("/rest/v1/rpc/"))
      return rpc(url.pathname.split("/").at(-1), body, uid);
    const table = url.pathname.split("/").at(-1);
    if (!url.pathname.startsWith("/rest/v1/") || !(table in tables))
      return null;
    if (!["GET", "HEAD"].includes(method))
      return failure("Les écritures directes sont interdites.");
    const publicTable = ["supporter_groups", "supporter_meetups"].includes(
      table,
    );
    if (!publicTable && !uid)
      return failure("Connectez-vous avec un compte actif.");
    let rows = tables[table].filter(
      (row) =>
        publicTable ||
        (table === "supporter_messages"
          ? member(row.group_id, uid)
          : row.user_id === uid),
    );
    if (table === "supporter_meetup_attendees")
      rows = rows.map((row) => ({
        ...row,
        meetup: meetups.find((m) => m.id === row.meetup_id),
      }));
    const field = (row, key) =>
      key.split(".").reduce((value, part) => value?.[part], row);
    for (const [key, expression] of url.searchParams) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      const separator = expression.indexOf(".");
      const op = expression.slice(0, separator),
        value = expression.slice(separator + 1);
      if (op === "eq")
        rows = rows.filter((row) => String(field(row, key)) === value);
      else if (op === "gte")
        rows = rows.filter((row) => String(field(row, key)) >= value);
      else if (op === "ilike") {
        const needle = value
          .replace(/^%|%$/g, "")
          .replace(/\\([%_\\])/g, "$1")
          .toLocaleLowerCase();
        rows = rows.filter((row) =>
          String(row[key]).toLocaleLowerCase().includes(needle),
        );
      } else if (op === "in")
        rows = rows.filter((row) =>
          value.slice(1, -1).split(",").includes(String(row[key])),
        );
      else
        return {
          status: 400,
          data: {
            message: `Unsupported supporter fixture filter: ${key}=${expression}`,
          },
        };
    }
    const order = url.searchParams.get("order") || "";
    if (order)
      rows = [...rows].sort((a, b) => {
        for (const column of order.split(",")) {
          const [key, direction] = column.split(".");
          const compared = String(a[key] ?? "").localeCompare(
            String(b[key] ?? ""),
          );
          if (compared) return direction === "desc" ? -compared : compared;
        }
        return 0;
      });
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 20);
    rows = rows.slice(offset, offset + limit);
    if (table === "supporter_messages")
      rows = rows.map((row) => {
        const profile = profiles.find((p) => p.id === row.author_id);
        return {
          ...row,
          author: profile
            ? {
                full_name: profile.full_name,
                username: profile.username,
                avatar_url: profile.avatar_url,
              }
            : null,
        };
      });
    return ok(
      headers.accept?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows,
    );
  };
}
