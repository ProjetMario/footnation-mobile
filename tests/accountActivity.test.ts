import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import { activityKinds, loadAccountActivity } from "../src/lib/accountActivity";
beforeEach(() => client.from.mockReset());
function query(data: unknown[], error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    in: vi.fn(),
  };
  for (const method of [builder.select, builder.eq, builder.neq, builder.order])
    method.mockReturnValue(builder);
  builder.range.mockResolvedValue({ data, error });
  builder.in.mockResolvedValue({ data, error });
  return builder;
}
it("scopes each activity category to the recipient and excludes their own actions before pagination", async () => {
  for (const kind of activityKinds) {
    const events = query([]);
    client.from.mockReturnValue(events);
    expect(await loadAccountActivity("viewer", kind.key, 30)).toEqual([]);
    expect(events.eq).toHaveBeenCalledWith(kind.owner, "viewer");
    expect(events.neq).toHaveBeenCalledWith(kind.actor, "viewer");
    expect(events.range).toHaveBeenCalledWith(30, 59);
  }
  expect(client.from).toHaveBeenCalledTimes(activityKinds.length);
});
it("resolves visible authors and preserves a neutral fallback for unavailable profiles", async () => {
  const events = query([
    {
      id: "a",
      created_at: "2026-09-08",
      user_id: "visible",
      post_id: "post-one",
    },
    {
      id: "b",
      created_at: "2026-09-07",
      user_id: "hidden",
      post_id: "post-two",
    },
  ]);
  const profiles = query([
    { id: "visible", full_name: "Camille", avatar_url: null },
  ]);
  client.from.mockImplementation((table) =>
    table === "profiles" ? profiles : events,
  );
  const rows = await loadAccountActivity("viewer", "reactions", 0);
  expect(profiles.in).toHaveBeenCalledWith("id", ["visible", "hidden"]);
  expect(rows[0].content).toBe("Camille a réagi à votre publication");
  expect(rows[1].name).toBe("Un membre");
  expect(rows.map((row) => row.link)).toEqual([
    "/posts/post-one",
    "/posts/post-two",
  ]);
});
it("reports source and author lookup failures instead of presenting an empty activity history", async () => {
  client.from.mockReturnValue(query([], new Error("activity unavailable")));
  await expect(loadAccountActivity("viewer", "followers", 0)).rejects.toThrow(
    "activity unavailable",
  );
  client.from.mockImplementation((table) =>
    table === "profiles"
      ? query([], new Error("profiles unavailable"))
      : query([{ id: "a", created_at: "2026-09-08", follower_id: "actor" }]),
  );
  await expect(loadAccountActivity("viewer", "followers", 0)).rejects.toThrow(
    "profiles unavailable",
  );
});
