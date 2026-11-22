import { expect, it } from "vitest";
import {
  careerRoles,
  selectObjective,
  profileCareerRoles,
  goalLevels,
  goalFields,
  goalPreview,
  emptyGoal,
  legacyGoal,
  validateGoal,
} from "../src/lib/careerGoals";
import { roleOptions } from "../src/lib/networkOptions";
it("covers every signup role and all organization types", () => {
  for (const r of roleOptions)
    expect(careerRoles[r.value]?.objectives.length).toBeGreaterThan(0);
  expect(profileCareerRoles({ account_type: "club" })).toEqual(["Club"]);
  expect(profileCareerRoles({ account_type: "business" })).toEqual([
    "Entreprise / Marque",
  ]);
  expect(profileCareerRoles({ account_type: "institution" })).toEqual([
    "Institution",
  ]);
});
it("keeps distinct goals for each declared role without duplicates", () => {
  expect(
    profileCareerRoles({
      primary_role: "Joueur amateur",
      secondary_roles: ["Entraîneur", "Joueur amateur"],
    }),
  ).toEqual(["Joueur amateur", "Entraîneur"]);
});
it("offers relevant levels and functions rather than player positions to everyone", () => {
  expect(goalLevels("Entraîneur", "Professionnel")).toContain("Ligue 1");
  expect(goalLevels("Éducateur", "Amateur")).not.toContain("Ligue 1");
  expect(goalLevels("Joueur futsal", "")).toEqual([
    "Local",
    "Régional",
    "National",
    "International",
  ]);
  expect(goalFields("Agent").positions).toEqual([]);
  expect(goalFields("Entraîneur").positions).toContain("Adjoint");
});
it("does not publish old preferences or leak irrelevant legacy fields", () => {
  const goal = legacyGoal(
    {
      target_position: "Attaquant",
      target_level: "Ligue 1",
      desired_salary: 2000,
    },
    "Parent",
  );
  expect(goal.objective).toBe("");
  expect(goal.position).toBe("");
  expect(goal.salary).toBe("");
  expect(
    goalPreview("Parent", { ...goal, objective: "Trouver un stage" })
      .description,
  ).not.toContain("2000");
});
it("requires an objective and rejects invalid salary", () => {
  expect(validateGoal("Agent", emptyGoal)).toBeTruthy();
  expect(
    validateGoal("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      salary: "-10",
    }),
  ).toBeTruthy();
  expect(
    validateGoal("Agent", { ...emptyGoal, objective: "Rejoindre une agence" }),
  ).toBeNull();
});

it("switches levels when choosing a professional objective", () => {
  const next = selectObjective(
    { ...emptyGoal, environment: "Amateur", level: "Régional 1" },
    "Devenir professionnel",
  );
  expect(next.environment).toBe("Professionnel");
  expect(next.level).toBe("");
});

it("shows the selected city and department in the public request preview", () => {
  const preview = goalPreview("Joueur amateur", {
    ...emptyGoal,
    objective: "Trouver des essais",
    zone: "Lyon",
    zoneCity: "Lyon",
    zoneDepartment: "69 - Rhône",
  });
  expect(preview.description).toContain("Zone recherchée : Lyon · 69 - Rhône");
});

it("shows remote mobility with the selected distance in the public request preview", () => {
  const preview = goalPreview("Agent", {
    ...emptyGoal,
    objective: "Rejoindre une agence",
    mobility: "À distance",
    mobilityRadiusKm: "75",
  });
  expect(preview.description).toContain("Mobilité : À distance · 75 km");
  expect(
    validateGoal("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      mobilityRadiusKm: "75",
    }),
  ).toBeNull();
  expect(
    validateGoal("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      mobilityRadiusKm: "75km",
    }),
  ).toBeTruthy();
});
