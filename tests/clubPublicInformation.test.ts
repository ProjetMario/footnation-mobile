import { expect, it } from "vitest";
import {
  findClubEnrichment,
  clubShirtColors,
} from "../src/lib/clubPublicInformation";
it("keeps Drumettaz's real public information and all three installations", () => {
  const club = {
    fff_affiliation_number: "526437",
    name: "Ent S Drumettaz Mouxy",
  };
  const info = findClubEnrichment(club);
  expect(info?.data?.club?.fff_affiliation_number).toBe("526437");
  expect(info?.data?.facilities?.map((facility) => facility.name)).toEqual([
    "Siège social",
    "STADE DES FINS 1",
    "STADE DES FINS 2",
  ]);
  expect(clubShirtColors(club)).toEqual(["Blanc", "Rouge", "Bleu"]);
});
it("does not borrow another club's identity for an unknown name", () => {
  expect(
    findClubEnrichment({ name: "Club fictif sans correspondance 98912" }),
  ).toBeNull();
});
