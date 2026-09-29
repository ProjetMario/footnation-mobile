import { describe, expect, it } from "vitest";
import type { Profile } from "../src/lib/models";
import {
  isPlayerProfile,
  profileAboutSections,
  profileAge,
  profileMeasure,
  profileQualifications,
} from "../src/lib/profileAbout";
import {
  getBestExperience,
  normalizeExperiences,
} from "../src/lib/profileCareer";

const profile = (fields: Partial<Profile> = {}): Profile => ({
  id: "test-profile",
  full_name: "Alex Martin",
  username: "alex",
  avatar_url: null,
  account_type: "personal",
  ...fields,
});

describe("complete About profile", () => {
  it("recognizes player roles used by onboarding, including amateur, indoor and secondary roles", () => {
    for (const role of [
      "Joueur",
      "Joueur amateur",
      "Joueur pro",
      "Joueur loisir",
      "Joueur indoor (Five)",
      "Joueuse futsal",
    ])
      expect(isPlayerProfile(profile({ primary_role: role }))).toBe(true);
    expect(
      isPlayerProfile(
        profile({
          primary_role: "Éducateur",
          secondary_roles: ["Joueur amateur"],
        }),
      ),
    ).toBe(true);
    expect(isPlayerProfile(profile({ primary_role: "Supporter & fan" }))).toBe(
      false,
    );
    expect(
      isPlayerProfile(
        profile({ account_type: "club", primary_role: "Joueur amateur" }),
      ),
    ).toBe(false);
  });

  it("retains personal, sporting and formation information instead of gating it on one exact role", () => {
    const sections = profileAboutSections(
      profile({
        primary_role: "Joueur amateur",
        bio: "Mon football",
        city: "Chambéry",
        country: "France",
        department: "73",
        nationality: "Bosnienne",
        position: "Gardien",
        secondary_roles: ["Bénévole"],
        secondary_positions: ["Défenseur"],
        favorite_pro_club: "OL",
        favorite_amateur_club: "CSF",
        height: "185 cm",
        weight: "78",
        skills: ["Relance"],
        technical_skills: "Jeu au pied",
        characteristics: "Calme",
        education: [{ title: "STAPS", year: "2024" }],
        certifications: [{ title: "BMF", year: "2025" }],
        training_history: [{ title: "Centre de formation", year: "2020" }],
      }),
      true,
    );
    const values = sections.flatMap((section) =>
      section.fields.map((field) => field.value),
    );
    for (const value of [
      "Mon football",
      "Chambéry",
      "France",
      "Bosnienne",
      "Gardien",
      "Défenseur",
      "Bénévole",
      "OL",
      "CSF",
      "185 cm",
      "78 kg",
      "Relance",
      "Jeu au pied",
      "Calme",
      "STAPS 2024",
      "BMF 2025",
      "Centre de formation 2020",
    ])
      expect(values).toContain(value);
  });

  it("keeps a sparse profile honest, omits empty public fields and never surfaces unrelated private columns", () => {
    const sparse = {
      ...profile({ primary_role: "Joueur amateur", birthdate: "2000-09-28" }),
      email: "private@example.test",
      phone: "private",
      is_admin: true,
    };
    const publicSections = profileAboutSections(
      sparse,
      false,
      new Date(2026, 8, 27),
    );
    const publicFields = publicSections.flatMap((section) => section.fields);
    expect(publicFields.every((field) => field.value !== null)).toBe(true);
    expect(publicFields.find((field) => field.label === "Âge")?.value).toBe(
      "25 ans",
    );
    expect(
      publicFields.find((field) => field.label === "Date de naissance"),
    ).toBeUndefined();
    expect(JSON.stringify(publicSections)).not.toContain("private");
    const ownFields = profileAboutSections(sparse, true).flatMap(
      (section) => section.fields,
    );
    expect(
      ownFields.find((field) => field.label === "Poste principal")?.value,
    ).toBeNull();
    expect(
      ownFields.find((field) => field.label === "Date de naissance")?.value,
    ).toBe("28/09/2000");
  });

  it("handles dates, existing measurement units and both qualification formats", () => {
    expect(profileAge("2000-09-28", new Date(2026, 8, 28))).toBe(26);
    for (const date of ["2026-02-31", "not-a-date", "2030-01-01"])
      expect(profileAge(date, new Date(2026, 8, 27))).toBeNull();
    expect(profileMeasure("1,85 m", "cm")).toBe("1,85 m");
    expect(profileMeasure(185, "cm")).toBe("185 cm");
    expect(profileQualifications({ diploma: "BEF" })).toEqual(["BEF"]);
    expect(profileQualifications({ title: "BMF", year: "2025" })).toEqual([
      "BMF 2025",
    ]);
  });

  it("retains legacy web careers, excludes empty records and respects the designated highest level", () => {
    const entries = normalizeExperiences(
      profile({
        experience: JSON.stringify([
          {
            club_name: "Club A",
            role: "Gardien",
            competition: "National 2",
            start_year: 2020,
            end_year: 2022,
            is_highest_level: true,
          },
          {
            club: "Club B",
            level: "Régional 1",
            startYear: "2022",
            endYear: "Présent",
          },
          {},
        ]),
      }),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].club).toBe("Club B");
    expect(getBestExperience(entries)?.level).toBe("National 2");
    expect(normalizeExperiences(profile())).toEqual([]);
  });
});
