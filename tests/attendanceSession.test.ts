import { expect, it } from "vitest";
import { attendanceSessionPayload } from "../src/lib/attendanceSession";
import { createProContent } from "../src/lib/proContentSave";
it("validates session type and date and retains optional empty values", () => {
  expect(
    attendanceSessionPayload(
      "training",
      "2026-09-08T18:00:00+02:00",
      " U18 ",
      " ",
    ),
  ).toEqual({
    session_type: "training",
    session_date: "2026-09-08T16:00:00.000Z",
    category: "U18",
    notes: null,
  });
  expect(() =>
    attendanceSessionPayload("invalid", "2026-09-08T18:00:00Z", "", ""),
  ).toThrow();
  expect(() =>
    attendanceSessionPayload("training", "2026-02-30T18:00:00Z", "", ""),
  ).toThrow();
  expect(() =>
    attendanceSessionPayload(
      "training",
      "2026-09-08T18:00:00Z",
      "",
      "é".repeat(3001),
    ),
  ).toThrow();
});
it("recovers session creation after a lost response and normalized timestamp", async () => {
  const row = {
    id: "stable",
    club_id: "club",
    ...attendanceSessionPayload(
      "match",
      "2026-09-08T18:00:00+02:00",
      "",
      "Notes",
    ),
  };
  let saved: Record<string, unknown> | null = null;
  let inserts = 0;
  const repository = {
    read: async () => saved,
    insert: async () => {
      saved = { ...row, session_date: "2026-09-08T16:00:00+00:00" };
      inserts++;
      throw new Error("Lost response");
    },
  };
  await expect(createProContent(repository, row)).rejects.toThrow(
    "Lost response",
  );
  await createProContent(repository, row);
  expect(inserts).toBe(1);
});
