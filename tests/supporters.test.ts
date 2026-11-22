import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), require: vi.fn(), clipboard: vi.fn(), open: vi.fn(), share: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc }, requireBackend: mocks.require }));
vi.mock("expo-clipboard", () => ({ setStringAsync: mocks.clipboard }));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, Linking: { openURL: mocks.open }, Share: { share: mocks.share } }));
import {
  createSupporterGroup, createSupporterMeetup, joinSupporterGroup, leaveSupporterGroup,
  postSupporterMessage, setSupporterAttendance, listSupporterGroups, listSupporterMessages,
  listMySupporterAttendances, supporterInviteUrl, copySupporterInvite, whatsappSupporterInvite,
  shareSupporterInvite, listGroupsForMyClubs, type SupporterGroup,
} from "../src/lib/supporters";
import { incomingPath } from "../src/lib/incomingPath";

const gid = "00000000-0000-4000-8000-000000000081";
const uid = "00000000-0000-4000-8000-000000000082";
const group: SupporterGroup = { id: gid, name: "Paris & Sud", club_name: "Paris", city: "Montpellier", description: "", created_by: uid, member_count: 1, created_at: "2026-01-01" };
function query(data: unknown = []) {
  const q: Record<string, any> = {};
  for (const name of ["select", "eq", "ilike", "in", "gte", "order", "range", "limit", "maybeSingle"]) q[name] = vi.fn(() => q);
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  mocks.from.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.clipboard.mockResolvedValue(true);
});
describe("Supporters permissions and requests", () => {
  it("derives mutation identity server-side and trims group input", async () => {
    mocks.rpc.mockResolvedValue({ data: group, error: null });
    await createSupporterGroup({ name: " Paris Sud ", clubName: " Paris ", city: " Montpellier ", description: " Bonjour " });
    expect(mocks.rpc).toHaveBeenCalledWith("supporter_create_group", { p_name: "Paris Sud", p_club_name: "Paris", p_city: "Montpellier", p_description: "Bonjour" });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await joinSupporterGroup(gid); await leaveSupporterGroup(gid); await setSupporterAttendance(gid, true);
    expect(mocks.rpc.mock.calls.slice(1)).toEqual([
      ["supporter_join_group", { p_group_id: gid }], ["supporter_leave_group", { p_group_id: gid }],
      ["supporter_set_attendance", { p_meetup_id: gid, p_attending: true }],
    ]);
  });
  it("never treats missing/false mutation acknowledgments as success", async () => {
    for (const data of [null, false, [], {}]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(joinSupporterGroup(gid)).rejects.toThrow("confirmée");
      await expect(postSupporterMessage(gid, "Bonjour")).rejects.toThrow("confirmée");
    }
  });
  it("distinguishes unavailable backend, forbidden membership and full meetup without leaking server errors", async () => {
    for (const [error, expected] of [
      [{ code: "PGRST202", message: "SQL private details" }, "pas encore disponible"],
      [{ code: "42501", message: "SQL private details" }, "autorisé"],
      [{ code: "P0001", message: "Ce rendez-vous est complet." }, "complet"],
      [{ code: "XX000", message: "SQL private details" }, "confirmée"],
    ] as const) {
      mocks.rpc.mockResolvedValue({ data: null, error });
      await expect(joinSupporterGroup(gid)).rejects.toThrow(expected);
    }
  });
  it("validates identifiers and bounded text before issuing mutations", async () => {
    expect(() => joinSupporterGroup(`${gid}?user_id=${uid}`)).toThrow();
    expect(() => postSupporterMessage(gid, " \n ")).toThrow();
    expect(() => postSupporterMessage(gid, "a".repeat(2001))).toThrow();
    expect(() => createSupporterGroup({ name: "ok", clubName: "Paris", city: "Nice", description: "" })).toThrow();
    expect(() => createSupporterGroup({ name: "Paris Sud", clubName: "Paris", city: "Nice", description: "a".repeat(1501) })).toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("validates future meetup capacity and serializes its date without a client creator ID", async () => {
    const input = { groupId: gid, title: "Regarder le match", kind: "watch_party" as const, startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Café du stade", description: "", capacity: 20 };
    for (const capacity of [0, -1, 1.5, 5001, NaN]) expect(() => createSupporterMeetup({ ...input, capacity })).toThrow();
    expect(() => createSupporterMeetup({ ...input, startsAt: "bad" })).toThrow();
    expect(() => createSupporterMeetup({ ...input, startsAt: "2000-01-01" })).toThrow();
    mocks.rpc.mockResolvedValue({ data: { id: gid }, error: null });
    await createSupporterMeetup(input);
    expect(mocks.rpc).toHaveBeenCalledWith("supporter_create_meetup", { p_group_id: gid, p_title: input.title, p_kind: "watch_party", p_starts_at: input.startsAt, p_location: input.location, p_description: "", p_capacity: 20 });
  });
});
describe("bounded discovery and member data", () => {
  it("uses club identity instead of a spoofed name and never joins while discovering", async () => {
    const q = query();
    await listSupporterGroups({ clubId: gid, club: "Another club" });
    expect(q.eq).toHaveBeenCalledWith("club_id", gid);
    expect(q.ilike).not.toHaveBeenCalled();
    await listGroupsForMyClubs([gid, gid], " Marseille ");
    expect(q.in).toHaveBeenCalledWith("club_id", [gid]);
    expect(q.ilike).toHaveBeenCalledWith("city", "Marseille");
    expect(q.limit).toHaveBeenCalledWith(12);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("puts the user's city first and deduplicates recommendations", async () => {
    const local = { ...group, city: "Marseille" }, elsewhere = { ...group, id: uid, city: "Paris" };
    const first = query([local]), second = query([elsewhere, local]);
    mocks.from.mockReset().mockReturnValueOnce(first).mockReturnValueOnce(second);
    expect(await listGroupsForMyClubs([gid], "Marseille")).toEqual([local, elsewhere]);
  });
  it("sends the selected club identifier to creation without a client owner identity", async () => {
    mocks.rpc.mockResolvedValue({ data: group, error: null });
    await createSupporterGroup({ name: "Mon groupe", clubName: "Paris", clubId: gid, city: "Marseille", description: "" });
    expect(mocks.rpc).toHaveBeenCalledWith("supporter_create_group", expect.objectContaining({ p_club_id: gid }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("created_by");
  });
  it("escapes wildcard filters, separates club and city and fetches only 20 rows", async () => {
    const q = query();
    await listSupporterGroups({ club: "Paris%_", city: " Nice ", offset: 20 });
    expect(q.ilike.mock.calls).toEqual([["club_name", "%Paris\\%\\_%"], ["city", "%Nice%"]]);
    expect(q.range).toHaveBeenCalledWith(20, 39);
    expect(q.order.mock.calls).toEqual([["created_at", { ascending: false }], ["id", { ascending: false }]]);
    await expect(listSupporterGroups({ offset: -1 })).rejects.toThrow("Page");
  });
  it("loads a scoped message page and only current user's future meetup registrations", async () => {
    const q = query();
    await listSupporterMessages(gid, 40);
    expect(q.eq).toHaveBeenCalledWith("group_id", gid);
    expect(q.range).toHaveBeenCalledWith(40, 59);
    expect(q.select.mock.calls[0][0]).not.toContain("email");
    await listMySupporterAttendances(gid, uid, [gid]);
    expect(q.eq).toHaveBeenCalledWith("user_id", uid);
    expect(q.eq).toHaveBeenCalledWith("meetup.group_id", gid);
    expect(q.in).toHaveBeenCalledWith("meetup_id", [gid]);
    expect(q.limit).toHaveBeenCalledWith(1);
  });
});
describe("supporter invitations", () => {
  it("keeps one HTTPS URL accepted by native deep links", () => {
    expect(supporterInviteUrl(gid)).toBe(`https://www.foot-nation.com/app/supporters/${gid}`);
    expect(incomingPath(supporterInviteUrl(gid))).toBe(`/supporters/${gid}`);
    expect(incomingPath(`footnation://supporters/${gid}`)).toBe(`/supporters/${gid}`);
    for (const value of ["../login", "https://evil.example", `${gid}#fragment`]) expect(() => supporterInviteUrl(value)).toThrow();
  });
  it("opens an encoded WhatsApp draft without sending or choosing a recipient", async () => {
    await whatsappSupporterInvite(group);
    const url = new URL(mocks.open.mock.calls[0][0]);
    expect(url.origin).toBe("https://wa.me");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.searchParams.get("text")).toContain(group.name);
    expect(url.searchParams.get("text")).toContain(supporterInviteUrl(gid));
    await shareSupporterInvite(group);
    expect(mocks.share).toHaveBeenCalledWith({ message: expect.stringContaining(supporterInviteUrl(gid)) });
  });
  it("does not claim a failed copy was completed", async () => {
    mocks.clipboard.mockResolvedValue(false);
    await expect(copySupporterInvite(group)).rejects.toThrow("Copie impossible");
  });
});
