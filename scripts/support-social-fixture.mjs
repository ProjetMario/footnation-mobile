// Only imported by the isolated UI fixture server. No real requests or accounts.
import { randomUUID } from "node:crypto";
export function createSupportSocialFixture(ids) {
  const tickets = new Map();
  const messages = new Map();
  const collections = new Map();
  let sequence = 0;
  const now = () => new Date().toISOString();
  const source = {
    source_id: "70000000-0000-4000-8000-000000000001",
    media_url: "",
    caption: "Entraînement de recette",
    created_at: now(),
  };
  const reply = (id, uid, staff, body, kind = "message") => {
    const row = {
      id: randomUUID(),
      sequence: ++sequence,
      author_id: uid,
      author_kind: staff ? "support" : "member",
      body,
      kind,
      created_at: now(),
    };
    messages.set(id, [...(messages.get(id) || []), row]);
    return row;
  };
  return (name, b, role) => {
    const uid = ids[role];
    if (!uid) return null;
    const staff = role === "admin";
    const ok = (data) => ({ status: 200, data });
    const fail = () => ({
      status: 403,
      data: { message: "Demande inaccessible", code: "42501" },
    });
    if (name === "set_profile_presence") return ok(null);
    if (name === "read_profile_presence") return ok(true);
    if (name === "create_support_request") {
      if (tickets.has(b.p_id)) return ok(b.p_id);
      tickets.set(b.p_id, {
        id: b.p_id,
        user_id: uid,
        ticket_number: "FN-" + b.p_id.replaceAll("-", "").toUpperCase(),
        subject: b.p_subject,
        category: b.p_category,
        status: "in_progress",
        revision: 1,
        created_at: now(),
        updated_at: now(),
      });
      reply(b.p_id, uid, false, b.p_message);
      return ok(b.p_id);
    }
    if (name === "list_support_requests") {
      const all = [...tickets.values()].filter(
        (t) => staff || t.user_id === uid,
      );
      return ok({
        staff,
        tickets: all.filter((t) => !b.p_status || t.status === b.p_status),
        counts: Object.fromEntries(
          ["in_progress", "resolved", "closed"].map((s) => [
            s,
            all.filter((t) => t.status === s).length,
          ]),
        ),
      });
    }
    if (
      [
        "read_support_request",
        "reply_support_request",
        "set_support_request_status",
      ].includes(name)
    ) {
      const t = tickets.get(b.p_request_id || b.p_id);
      if (!t || (!staff && t.user_id !== uid)) return fail();
      if (name === "read_support_request")
        return ok({
          staff,
          ticket: t,
          messages: [...(messages.get(t.id) || [])].reverse(),
        });
      if (name === "reply_support_request") {
        reply(t.id, uid, staff, b.p_message);
        t.status = "in_progress";
      } else {
        t.status = b.p_status;
        reply(t.id, uid, staff, b.p_status, "status");
      }
      t.revision++;
      t.updated_at = now();
      return ok(b.p_id);
    }
    if (name === "list_my_story_sources") return ok([source]);
    if (name === "list_profile_story_collections")
      return ok(
        [...collections.values()].filter((c) => c.user_id === b.p_profile_id),
      );
    if (name === "save_profile_story_collection") {
      collections.set(b.p_id, {
        id: b.p_id,
        user_id: uid,
        title: b.p_title,
        revision: (collections.get(b.p_id)?.revision || 0) + 1,
        items: b.p_story_ids.map((id) => ({ ...source, source_id: id })),
      });
      return ok(b.p_id);
    }
    if (name === "delete_profile_story_collection") {
      collections.delete(b.p_id);
      return ok(null);
    }
    return null;
  };
}
