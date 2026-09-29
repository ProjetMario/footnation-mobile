import { expect, it } from "vitest";
import { membershipOperation } from "../src/lib/groupMembership";
it("does not repeat a successful join or leave after a lost response", () => {
  expect(membershipOperation("join", "member", false, "public")).toBe("none");
  expect(membershipOperation("leave", null, false, "public")).toBe("none");
});
it("prevents leaving after a concurrent promotion", () => {
  expect(() =>
    membershipOperation("leave", "admin", false, "public"),
  ).toThrow();
  expect(() =>
    membershipOperation("leave", "member", true, "public"),
  ).toThrow();
});
it("checks the current privacy while allowing a private-group member to leave", () => {
  expect(() => membershipOperation("join", null, false, "private")).toThrow();
  expect(membershipOperation("leave", "member", false, "private")).toBe(
    "leave",
  );
  expect(membershipOperation("join", null, false, "public")).toBe("join");
});
