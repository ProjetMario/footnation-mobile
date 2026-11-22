import { careerRoles, goalFields, type GoalValues } from "./careerGoals";

export type GoalStep = 0 | 1 | 2;
export type GoalProgressField = {
  key: keyof GoalValues;
  label: string;
  step: GoalStep;
};

// Only useful discovery fields count. Salary, benefits and free text are optional extras.
export function careerGoalProgress(role: string, values: GoalValues) {
  const def = careerRoles[role];
  const fields: GoalProgressField[] = [
    { key: "objective", label: "Votre objectif", step: 0 },
  ];
  if (def?.sport) {
    if (!def.genericLevels)
      fields.push({ key: "environment", label: "Le cadre recherché", step: 0 });
    fields.push({ key: "level", label: "Le niveau souhaité", step: 0 });
  }
  if (def && goalFields(role).positions.length)
    fields.push({
      key: "position",
      label: def.player ? "Votre poste" : "Votre fonction",
      step: 0,
    });
  if (def && goalFields(role).categories.length)
    fields.push({ key: "category", label: "La catégorie", step: 0 });
  fields.push(
    { key: "zone", label: "Votre zone de recherche", step: 1 },
    { key: "mobility", label: "Votre mobilité", step: 1 },
    { key: "availability", label: "Votre disponibilité", step: 1 },
  );
  if (values.mobility === "À distance")
    fields.push({
      key: "mobilityRadiusKm",
      label: "Le kilométrage accepté",
      step: 1,
    });
  const missing = fields.filter(({ key }) => !values[key].trim());
  return {
    fields,
    missing,
    completed: fields.length - missing.length,
    total: fields.length,
  };
}
