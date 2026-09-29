import { expect, it } from "vitest";
import { withProReview } from "../src/lib/proReviewDetails";
it("does not fall back to public review text when private access is absent", () => {
  const page = withProReview({
    id: "page",
    name: "Public",
    review: null,
    request_message: "Legacy secret",
    verification_notes: "Legacy note",
  });
  expect(page.request_message).toBeNull();
  expect(page.verification_notes).toBeNull();
  expect(page.name).toBe("Public");
});
it("merges an authorized private row without changing page identity", () => {
  const page = withProReview({
    id: "page",
    review: { request_message: "My request", verification_notes: "Checked" },
  });
  expect(page.id).toBe("page");
  expect(page.request_message).toBe("My request");
  expect(page.verification_notes).toBe("Checked");
});
it("supports a relation returned as a singleton array or an empty array", () => {
  expect(
    withProReview({ review: [{ request_message: "Message" }] }).request_message,
  ).toBe("Message");
  expect(withProReview({ review: [] }).request_message).toBeNull();
});
