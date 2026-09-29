import { describe, it, expect } from "vitest";
import {
  reportReviewPayload,
  reportContentPath,
  reportUrgency,
  type ContentReport,
} from "../src/lib/reportReview";
const report: ContentReport = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reported_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  reporter_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  reason: "spam",
  details: null,
  status: "pending",
  admin_notes: null,
  created_at: "2026-09-23T00:00:00Z",
  reviewed_at: null,
  revision: 0,
  content_kind: "post",
  content_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
describe("report decisions", () => {
  it("pins revision and requires meaningful notes", () => {
    expect(
      reportReviewPayload(report, "review", "  À examiner  "),
    ).toMatchObject({ p_revision: 0, p_notes: "À examiner" });
    expect(() => reportReviewPayload(report, "dismiss", " ")).toThrow();
  });
  it("refuses closed decisions and unknown content", () => {
    expect(() =>
      reportReviewPayload({ ...report, status: "resolved" }, "review", "motif"),
    ).toThrow();
    expect(() =>
      reportReviewPayload(
        { ...report, content_id: null },
        "remove_content",
        "motif",
      ),
    ).toThrow();
  });
  it("never makes a route from untrusted text", () => {
    expect(
      reportContentPath({ ...report, content_id: "https://elsewhere.invalid" }),
    ).toBeNull();
    expect(reportContentPath({ ...report, content_kind: "post" })).toBe(
      "/posts/" + report.content_id,
    );
  });
  it("marks safety first and reports waiting over 24h", () => {
    expect(reportUrgency({ ...report, reason: "child_safety" }, 0)).toBe(
      "Prioritaire",
    );
    expect(reportUrgency(report, Date.parse("2026-09-24T01:00:00Z"))).toContain(
      "24 h",
    );
    expect(
      reportUrgency({ ...report, status: "dismissed" }, Date.now()),
    ).toBeNull();
  });
});
