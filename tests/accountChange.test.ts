import { expect, it } from "vitest";
import { accountChangePayload } from "../src/lib/accountChange";
it("trims valid email addresses and rejects malformed ones", () => {
  expect(
    accountChangePayload("email", "  member@example.com ", "", ""),
  ).toEqual({ email: "member@example.com" });
  for (const email of ["", "a@", "a b@example.com"])
    expect(() => accountChangePayload("email", email, "", "")).toThrow();
});
it("uses the signup password rules and exact confirmation", () => {
  for (const password of [
    "short1A",
    "abcdefgh",
    "ABCDEFG1",
    "abcdefgh1",
    "Abcdefgh",
  ])
    expect(() =>
      accountChangePayload("password", "", password, password),
    ).toThrow();
  expect(() =>
    accountChangePayload("password", "", "ValidPass1", "different"),
  ).toThrow();
  expect(
    accountChangePayload(
      "password",
      "unused@example.com",
      "ValidPass1",
      "ValidPass1",
    ),
  ).toEqual({ password: "ValidPass1" });
});
