import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import { eventSearchFilter, searchFootNation } from "../src/lib/globalSearch";
beforeEach(() => client.from.mockReset());
function query(data: unknown[], error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const q = {
    select: vi.fn(),
    or: vi.fn(),
    eq: vi.fn(),
    contains: vi.fn(),
    neq: vi.fn(),
    not: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: result.then.bind(result),
  };
  for (const method of [
    q.select,
    q.or,
    q.eq,
    q.contains,
    q.neq,
    q.not,
    q.ilike,
    q.order,
    q.range,
  ])
    method.mockReturnValue(q);
  return q;
}
it("does not query the database for blank searches or signed-out viewers", async () => {
  expect(await searchFootNation("me", "  ", "all", 0)).toEqual({
    rows: [],
    hasMore: false,
  });
  expect(await searchFootNation("", "football", "all", 0)).toEqual({
    rows: [],
    hasMore: false,
  });
  expect(client.from).not.toHaveBeenCalled();
});
it("quotes punctuation and escapes wildcard characters in every event search field", () => {
  const term = 'Nice%,status.eq.draft_"';
  const pattern = JSON.stringify('%Nice\\%,status.eq.draft\\_"%');
  expect(eventSearchFilter(term)).toBe(
    [
      "title",
      "description",
      "location",
      "location_city",
      "location_department_name",
    ]
      .map((field) => `${field}.ilike.${pattern}`)
      .join(","),
  );
});
it("excludes blocked authors before pagination and only searches published events", async () => {
  const blocks = query([{ blocker_id: "blocked", blocked_id: "me" }]);
  const profiles = query([]),
    clubs = query([]),
    posts = query([]),
    events = query([]);
  const tables: Record<string, ReturnType<typeof query>> = {
    user_blocks: blocks,
    profiles,
    fff_clubs: clubs,
    posts,
    events,
  };
  client.from.mockImplementation((table) => tables[table]);
  await searchFootNation("me", "Nice", "all", 20);
  expect(profiles.not).toHaveBeenCalledWith("id", "in", "(blocked)");
  expect(posts.not).toHaveBeenCalledWith("user_id", "in", "(blocked)");
  expect(events.not).toHaveBeenCalledWith("organizer_id", "in", "(blocked)");
  expect(events.eq).toHaveBeenCalledWith("status", "published");
  for (const q of [profiles, clubs, posts, events])
    expect(q.range).toHaveBeenCalledWith(20, 39);
});
it("keeps pagination available when a full profile page is filtered for suspension", async () => {
  client.from.mockImplementation((table) =>
    table === "user_blocks"
      ? query([])
      : query(
          Array.from({ length: 20 }, (_, i) => ({
            id: String(i),
            is_suspended: true,
            suspended_until: null,
          })),
        ),
  );
  expect(await searchFootNation("me", "test", "profiles", 0)).toEqual({
    rows: [],
    hasMore: true,
  });
});
it("propagates an unavailable category instead of claiming no results", async () => {
  client.from.mockImplementation((table) =>
    table === "user_blocks" ? query([]) : query([], new Error("unavailable")),
  );
  await expect(searchFootNation("me", "test", "posts", 0)).rejects.toThrow(
    "unavailable",
  );
});

it("searches only an allowlisted About field and keeps block filtering", async () => {
  const profiles = query([]);
  client.from.mockImplementation((table) =>
    table === "user_blocks"
      ? query([{ blocker_id: "me", blocked_id: "hidden" }])
      : profiles,
  );
  await searchFootNation("me", "Milieu central", "profiles", 0, "position");
  expect(profiles.eq).toHaveBeenCalledWith("position", "Milieu central");
  expect(profiles.or).not.toHaveBeenCalled();
  expect(profiles.not).toHaveBeenCalledWith("id", "in", "(hidden)");
});
it("matches a single array skill instead of treating the array as text", async () => {
  const profiles = query([]);
  client.from.mockImplementation((table) =>
    table === "user_blocks" ? query([]) : profiles,
  );
  await searchFootNation("me", "Relance", "profiles", 0, "skills");
  expect(profiles.contains).toHaveBeenCalledWith("skills", ["Relance"]);
});
it.each(["is_admin", "__proto__", "position,or(id.neq.null)"])(
  "rejects an untrusted profile field %s",
  async (field) => {
    const profiles = query([]);
    client.from.mockImplementation((table) =>
      table === "user_blocks" ? query([]) : profiles,
    );
    await searchFootNation("me", "Alex", "profiles", 0, field);
    expect(profiles.eq).not.toHaveBeenCalled();
    expect(profiles.or).toHaveBeenCalled();
  },
);

it("browses players without search text, including amateurs and excluding blocked profiles", async () => {
  const profiles = query([
    { id: "player", full_name: "Alex", avatar_url: "avatar.png" },
  ]);
  client.from.mockImplementation((table) =>
    table === "user_blocks"
      ? query([{ blocker_id: "hidden", blocked_id: "me" }])
      : profiles,
  );
  const result = await searchFootNation(
    "me",
    "",
    "profiles",
    20,
    undefined,
    true,
  );
  expect(profiles.or).toHaveBeenCalledWith(
    "primary_role.ilike.joueu%,position.not.is.null",
  );
  expect(profiles.not).toHaveBeenCalledWith("id", "in", "(hidden)");
  expect(profiles.range).toHaveBeenCalledWith(20, 39);
  expect(result.rows[0].link).toBe("/profile/player");
});
it("browses recent visible posts without an empty text filter", async () => {
  const posts = query([]);
  client.from.mockImplementation((table) =>
    table === "user_blocks" ? query([]) : posts,
  );
  await searchFootNation("me", "", "posts", 0, undefined, true);
  expect(posts.ilike).not.toHaveBeenCalled();
  expect(posts.or).toHaveBeenCalledWith(
    "moderation_hidden.is.null,moderation_hidden.eq.false",
  );
  expect(posts.order).toHaveBeenCalledWith("created_at", { ascending: false });
});
it("keeps club logos when browsing the directory", async () => {
  client.from.mockImplementation((table) =>
    table === "user_blocks"
      ? query([])
      : query([{ id: "club", name: "Club", logo_url: "logo.png" }]),
  );
  const result = await searchFootNation("me", "", "clubs", 0, undefined, true);
  expect(result.rows[0].image).toBe("logo.png");
});
