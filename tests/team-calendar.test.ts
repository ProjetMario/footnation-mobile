import { test } from "node:test";
import assert from "node:assert/strict";
import {
  memberTeamStatus,
  onboardingTeamPath,
  teamCalendarPath,
} from "../src/lib/memberTeamPresentation.ts";
import {
  uniqueCalendarEvents,
  type MemberCalendarEvent,
} from "../src/lib/memberCalendar.ts";

test("first login opens the approved primary team's calendar, never a pending team's", () => {
  const team = (id: string) => ({ id, club_id: `club-${id}` });
  assert.equal(onboardingTeamPath([]), "/member/invitations");
  assert.equal(
    onboardingTeamPath([
      { status: "pending", is_primary: true, team: team("pending") },
    ]),
    "/member/teams",
  );
  assert.equal(
    onboardingTeamPath([
      { status: "pending", is_primary: true, team: team("pending") },
      { status: "approved", team: team("a") },
      { status: "approved", is_primary: true, team: team("b") },
    ]),
    "/club/club-b/member?teamId=b",
  );
  assert.equal(
    onboardingTeamPath([{ status: "approved", team: null }]),
    "/member/teams",
  );
});

test("membership presentation does not claim that pending or rejected accounts have joined", () => {
  assert.match(memberTeamStatus("pending"), /attente/);
  assert.match(memberTeamStatus("rejected"), /non accepté/);
  assert.match(memberTeamStatus(null), /vérifier/);
  assert.equal(memberTeamStatus("approved"), "Membre de l’équipe");
  assert.equal(
    teamCalendarPath("a/b", "c?d"),
    "/club/a%2Fb/member?teamId=c%3Fd",
  );
});

test("calendar pagination preserves events beyond twelve and separates equal IDs from different tables", () => {
  const events = Array.from(
    { length: 65 },
    (_, i) =>
      ({
        id: String(i),
        kind: "match",
        sort_date: "2030-01-01T12:00:00Z",
        team_id: "a",
        team_name: "U13 A",
        category: "U13",
      }) as MemberCalendarEvent,
  );
  const training = { ...events[0], kind: "training" as const };
  const result = uniqueCalendarEvents([
    events.slice(0, 30),
    events.slice(29, 60),
    events.slice(60),
    [training],
  ]);
  assert.equal(result.length, 66);
  assert.equal(result[64].id, "64");
  assert.equal(result[65].kind, "training");
});
