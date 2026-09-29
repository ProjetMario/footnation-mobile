import { expect, it } from "vitest";
import {
  clubInfoAction,
  profileInfoActions,
} from "../src/lib/profileInfoActions";
import type { Profile } from "../src/lib/models";
const profile: Profile = {
  id: "example",
  full_name: "Alex",
  avatar_url: null,
  username: "alex",
  account_type: "personal",
  skills: ["Relance", "Jeu aérien"],
};
it("opens known clubs and safely encodes a name when no linked club exists", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(clubInfoAction("AS Test", id)).toMatchObject({ href: `/club/${id}` });
  expect(clubInfoAction("AS Test & sport", "../settings")).toMatchObject({
    href: "/search?type=clubs&q=AS%20Test%20%26%20sport",
  });
});
it("gives owners editing actions without exposing them on other profiles", () => {
  expect(
    profileInfoActions(profile, "physical", "Taille", "180 cm", false),
  ).toEqual([]);
  expect(
    profileInfoActions(profile, "physical", "Taille", "180 cm", true),
  ).toContainEqual({
    label: "Modifier cette information",
    href: "/settings?section=content",
  });
  expect(
    profileInfoActions(profile, "identity", "Nom", null, true),
  ).toContainEqual({
    label: "Compléter cette information",
    href: "/settings?section=profile",
  });
});
it("preserves the date-of-birth correction flow", () => {
  expect(
    profileInfoActions(
      profile,
      "identity",
      "Date de naissance",
      "1 janvier 2000",
      true,
    ),
  ).toEqual([{ label: "Demander une correction", href: "/help" }]);
});
it("links each skill to an individual matching filter", () => {
  const actions = profileInfoActions(
    profile,
    "skills",
    "Compétences",
    "Relance, Jeu aérien",
    false,
  );
  expect(actions).toHaveLength(2);
  expect(actions[1]).toMatchObject({
    href: "/search?type=profiles&field=skills&q=Jeu%20a%C3%A9rien",
  });
});
it("does not turn unsupported protocols into links", () => {
  expect(
    profileInfoActions(
      profile,
      "organization",
      "Site internet",
      "javascript:alert(1)",
      false,
    ),
  ).toEqual([]);
});
