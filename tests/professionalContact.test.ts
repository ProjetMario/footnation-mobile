import { expect, it } from "vitest";
import {
  professionalContactUrl,
  publicTalentUrl,
  publicClubUrl,
} from "../src/lib/professionalContact";
it("prépare les numéros nationaux et internationaux sans codes de commande", () => {
  expect(professionalContactUrl("phone", "06 12 34 56 78")).toBe(
    "tel:0612345678",
  );
  expect(professionalContactUrl("phone", "+33 (0)6 12 34 56 78")).toBe(
    "tel:+33612345678",
  );
  expect(professionalContactUrl("phone", "0033 (0)6 12 34 56 78")).toBe(
    "tel:+33612345678",
  );
  for (const phone of [
    "*123#",
    "+33;123",
    "12",
    "tel:0612345678",
    "06\n12345678",
    "++33123456789",
  ])
    expect(() => professionalContactUrl("phone", phone)).toThrow();
});
it("encode les emails et refuse les paramètres supplémentaires", () => {
  expect(professionalContactUrl("email", "contact+club@example.com")).toBe(
    "mailto:contact%2Bclub%40example.com",
  );
  for (const email of [
    "a@example.com?bcc=x@example.com",
    "a@example.com\r\nBcc:x@example.com",
    "adresse invalide",
  ])
    expect(() => professionalContactUrl("email", email)).toThrow();
});
it("limite l’adresse à une recherche cartographique encodée", () => {
  expect(
    professionalContactUrl("address", "12 rue de l’Église, Lyon & alentours"),
  ).toBe(
    "https://www.google.com/maps/search/?api=1&query=12%20rue%20de%20l%E2%80%99%C3%89glise%2C%20Lyon%20%26%20alentours",
  );
  expect(() => professionalContactUrl("address", " ")).toThrow();
});
it("partage le slug public ou l’identifiant, sans paramètre injecté", () => {
  expect(publicTalentUrl({ id: "uuid", slug: "joueur" })).toBe(
    "https://www.foot-nation.com/talent/joueur",
  );
  expect(publicTalentUrl({ id: "uuid", slug: " " })).toBe(
    "https://www.foot-nation.com/talent/uuid",
  );
  expect(publicTalentUrl({ id: "uuid", slug: "nom?next=/admin" })).toBe(
    "https://www.foot-nation.com/talent/nom%3Fnext%3D%2Fadmin",
  );
});

it("partage une fiche club avec son slug ou son identifiant", () => {
  expect(publicClubUrl({ id: "uuid", slug: "club-lyon" })).toBe(
    "https://www.foot-nation.com/club/club-lyon",
  );
  expect(publicClubUrl({ id: "uuid", slug: " " })).toBe(
    "https://www.foot-nation.com/club/uuid",
  );
  expect(publicClubUrl({ id: "uuid", slug: "club?tab=/admin" })).toBe(
    "https://www.foot-nation.com/club/club%3Ftab%3D%2Fadmin",
  );
});
