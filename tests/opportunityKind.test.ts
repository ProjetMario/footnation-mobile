import { expect, it } from "vitest";
import {
  opportunityKindFilter,
  opportunityListingKind,
} from "../src/lib/opportunityKind";

it("treats a club recruiting players or staff as an offer, including legacy aliases", () => {
  for (const type of [
    "recherche_joueur",
    "player",
    "recherche_staff",
    "coach_staff",
  ])
    expect(opportunityListingKind(type)).toBe("offer");
});
it("keeps an author's explicit request distinct from the position type", () => {
  expect(opportunityListingKind("recherche_joueur", "request")).toBe("request");
  expect(opportunityListingKind("emploi_cdi", "request")).toBe("request");
  expect(opportunityListingKind("recherche_club")).toBe("request");
});
it("unknown legacy types are not silently classified as requests", () => {
  expect(opportunityListingKind("new_unknown_type")).toBe("offer");
});
it("produces a database filter for each tab rather than filtering loaded pages", () => {
  expect(opportunityKindFilter("")).toBeNull();
  expect(opportunityKindFilter("offres")).toBe("offer");
  expect(opportunityKindFilter("demandes")).toBe("request");
});
