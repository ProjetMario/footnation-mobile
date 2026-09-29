import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  attendanceSummary,
  loadClubAttendanceSummary,
} from "../src/lib/clubAttendanceSummary";

beforeEach(() => client.from.mockReset());
function page(data: unknown[], error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const fn of [q.select, q.eq, q.order]) fn.mockReturnValue(q);
  client.from.mockReturnValueOnce(q);
  return q;
}
const record = (
  id: string,
  playerId: string,
  status: string,
  sessionId = "session-a",
) => ({
  id,
  player_id: playerId,
  session_id: sessionId,
  status,
  player: { name: "Alex Martin" },
});

it("keeps two players with the same name separate and counts simultaneous sessions by ID", () => {
  const summary = attendanceSummary(
    [
      { id: "a", name: "Alex Martin" },
      { id: "b", name: "Alex Martin" },
    ],
    [record("1", "a", "present"), record("2", "b", "absent", "session-b")],
  );
  expect(summary.rows).toHaveLength(2);
  expect(summary.eventCount).toBe(2);
  expect(summary.rows[0]).toMatchObject({ id: "a", present: 1, absent: 0 });
  expect(summary.rows[1]).toMatchObject({ id: "b", present: 0, absent: 1 });
});

it("retains former players' pointages, all statuses and deduplicates overlapping pages", () => {
  const first = record("1", "former", "present");
  const result = attendanceSummary(
    [{ id: "new", name: "Sans pointage" }],
    [
      first,
      first,
      record("2", "former", "late"),
      record("3", "former", "excused"),
      record("4", "former", "injured"),
      record("5", "former", "unknown"),
    ],
  );
  expect(result.rows.find((row) => row.id === "new")?.recordings).toBe(0);
  expect(result.rows.find((row) => row.id === "former")).toMatchObject({
    recordings: 5,
    present: 1,
    late: 1,
    excused: 1,
    injured: 1,
    other: 1,
  });
});

it("loads every player and record beyond the previous limits with club and session scoping", async () => {
  const firstPlayers = page(
    Array.from({ length: 500 }, (_, i) => ({
      id: `p${i}`,
      name: `Joueur ${i}`,
    })),
  );
  const lastPlayers = page([{ id: "p500", name: "Dernier joueur" }]);
  const firstRecords = page(
    Array.from({ length: 500 }, (_, i) => record(`r${i}`, `p${i}`, "present")),
  );
  const lastRecords = page([record("r500", "p500", "late")]);
  const authorize = vi.fn().mockResolvedValue(undefined);
  const result = await loadClubAttendanceSummary(
    "club-a",
    "session-a",
    authorize,
  );
  expect(result.rows).toHaveLength(501);
  expect(result.rows.reduce((total, row) => total + row.recordings, 0)).toBe(
    501,
  );
  expect(authorize).toHaveBeenCalledTimes(4);
  for (const q of [firstPlayers, lastPlayers]) {
    expect(q.eq).toHaveBeenCalledWith("club_id", "club-a");
    expect(q.eq).toHaveBeenCalledWith("is_active", true);
  }
  for (const q of [firstRecords, lastRecords]) {
    expect(q.eq).toHaveBeenCalledWith("session.club_id", "club-a");
    expect(q.eq).toHaveBeenCalledWith("session_id", "session-a");
  }
  expect(lastPlayers.range).toHaveBeenCalledWith(500, 999);
  expect(lastRecords.range).toHaveBeenCalledWith(500, 999);
});

it("shows an empty complete summary without adding a session filter", async () => {
  page([]);
  const records = page([]);
  await expect(
    loadClubAttendanceSummary("club", null, async () => {}),
  ).resolves.toEqual({ rows: [], eventCount: 0 });
  expect(records.eq).toHaveBeenCalledTimes(1);
});

it("never returns partial totals when access is revoked during pagination", async () => {
  page(
    Array.from({ length: 500 }, (_, i) => ({ id: String(i), name: "Joueur" })),
  );
  const authorize = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Accès retiré"));
  await expect(
    loadClubAttendanceSummary("club", null, authorize),
  ).rejects.toThrow("Accès retiré");
  expect(client.from).toHaveBeenCalledTimes(1);
});

it("propagates record-loading failures instead of presenting zero absences", async () => {
  page([{ id: "a", name: "Alex" }]);
  page([], new Error("Indisponible"));
  await expect(
    loadClubAttendanceSummary("club", null, async () => {}),
  ).rejects.toThrow("Indisponible");
});
