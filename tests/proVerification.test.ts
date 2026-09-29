import { expect, it } from "vitest";
import { needsProVerificationRequest } from "../src/lib/proVerification";
const page = {
  page_type: "club_officiel",
  club_id: "club",
  verification_status: "draft",
};
it("allows a first request and a new request after refusal", () => {
  expect(needsProVerificationRequest(page)).toBe(true);
  expect(
    needsProVerificationRequest({ ...page, verification_status: "rejected" }),
  ).toBe(true);
});
it("does not resubmit pending or already certified pages", () => {
  expect(
    needsProVerificationRequest({
      ...page,
      verification_status: "pending_review",
    }),
  ).toBe(false);
  expect(
    needsProVerificationRequest({ ...page, verification_status: "approved" }),
  ).toBe(false);
});
it("requires a linked official club and a known status", () => {
  expect(() =>
    needsProVerificationRequest({ ...page, club_id: null }),
  ).toThrow();
  expect(() =>
    needsProVerificationRequest({ ...page, page_type: "entreprise" }),
  ).toThrow();
  expect(() =>
    needsProVerificationRequest({ ...page, verification_status: "unexpected" }),
  ).toThrow();
});
