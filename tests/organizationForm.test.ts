import { expect, it } from "vitest";
import {
  organizationPayload,
  type OrganizationForm,
} from "../src/lib/organizationForm";
const form: OrganizationForm = {
  name: " FootNation ",
  type: "club",
  description: "",
  website: "",
  department: "",
  address: "",
  contact_email: "",
};
it("normalise les champs et ne fournit aucun statut vérifié", () => {
  const result = organizationPayload({
    ...form,
    website: "example.com",
    department: "2a",
    contact_email: " contact@example.com ",
  });
  expect(result).toEqual({
    name: "FootNation",
    type: "club",
    description: null,
    website: "https://example.com/",
    department: "2A",
    address: null,
    contact_email: "contact@example.com",
  });
  expect(result).not.toHaveProperty("verified");
  expect(result).not.toHaveProperty("created_by");
});
it("refuse nom vide, type inconnu, département et email invalides", () => {
  for (const patch of [
    { name: " " },
    { type: "admin" },
    { department: "999" },
    { contact_email: "invalide" },
  ])
    expect(() => organizationPayload({ ...form, ...patch })).toThrow();
});
it("refuse les URL actives ou contenant des identifiants", () => {
  for (const website of [
    "javascript:alert(1)",
    "https://user:pass@example.com",
  ])
    expect(() => organizationPayload({ ...form, website })).toThrow();
});
