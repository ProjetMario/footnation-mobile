import { expect, it } from "vitest";
import { careerGoalProgress } from "../src/lib/careerGoalProgress";
import { careerRoles, emptyGoal, validateGoal } from "../src/lib/careerGoals";

it("counts only fields relevant to each role", () => {
  for (const role of Object.keys(careerRoles)) {
    const { fields } = careerGoalProgress(role, emptyGoal);
    expect(fields.map((field) => field.key)).not.toContain("salary");
    expect(fields.map((field) => field.key)).not.toContain("description");
    expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
  }
  for (const role of ["Entraîneur", "Éducateur", "Joueur amateur"])
    expect(
      careerGoalProgress(role, emptyGoal).fields.map((field) => field.key),
    ).toContain("level");
  for (const role of [
    "Passionné(e)",
    "Agent",
    "Entreprise / Marque",
    "Institution",
  ])
    expect(careerGoalProgress(role, emptyGoal).total).toBe(4);
  expect(
    careerGoalProgress("Club", emptyGoal).fields.map((field) => field.key),
  ).not.toContain("position");
});

it("links missing information to the relevant step without requiring optional fields", () => {
  const values = { ...emptyGoal, objective: "Rejoindre une communauté" };
  const progress = careerGoalProgress("Passionné(e)", values);
  expect(progress.completed).toBe(1);
  expect(progress.missing.every((field) => field.step === 1)).toBe(true);
  expect(validateGoal("Passionné(e)", values)).toBeNull();
  expect(
    careerGoalProgress("Passionné(e)", {
      ...values,
      zone: "Lyon",
      mobility: "Dans ma région",
      availability: "Dès maintenant",
    }).missing,
  ).toEqual([]);
});

it("asks for a distance only when remote mobility is selected", () => {
  expect(
    careerGoalProgress("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      mobility: "À distance",
    }).missing.map((field) => field.key),
  ).toContain("mobilityRadiusKm");
  expect(
    careerGoalProgress("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      mobility: "À distance",
      mobilityRadiusKm: "50",
    }).missing.map((field) => field.key),
  ).not.toContain("mobilityRadiusKm");
  expect(
    careerGoalProgress("Agent", {
      ...emptyGoal,
      objective: "Rejoindre une agence",
      mobility: "Dans ma région",
    }).fields.map((field) => field.key),
  ).not.toContain("mobilityRadiusKm");
});
