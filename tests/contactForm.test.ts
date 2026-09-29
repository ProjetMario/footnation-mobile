import { expect, it } from "vitest";
import { contactFormPayload } from "../src/lib/contactForm";

const form = {
  firstName: " Marie ",
  lastName: " Dupont ",
  email: " marie@example.com ",
  message: " Bonjour, j’ai une question. ",
};

it("provides every field required by the existing contact endpoint", () => {
  const payload = contactFormPayload(form);
  expect(payload).toEqual({
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie@example.com",
    profileType: "autre",
    message: "Bonjour, j’ai une question.",
  });
  // An empty lastName used to reject every ordinary contact request with HTTP 400.
  expect(
    ["firstName", "lastName", "email", "profileType", "message"].every((key) =>
      Boolean(payload[key as keyof typeof payload]),
    ),
  ).toBe(true);
});

it.each([
  { firstName: " " },
  { lastName: "" },
  { email: "not-an-email" },
  { message: " " },
  { message: "a".repeat(5001) },
])("rejects incomplete contact data before any request: %j", (patch) => {
  expect(() => contactFormPayload({ ...form, ...patch })).toThrow();
});
