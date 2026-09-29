import { departmentOptions, roleOptions } from "./networkOptions";
import { levelOptions } from "./profileOptions";
import { FRENCH_DEPARTMENTS } from "../data/french-departments";
import {
  FOOTBALL_POSITIONS,
  type MatchFilters,
  type MatchableItem,
} from "../types/matching";
import { filterEntities } from "./matchingAlgorithm";

export const matchingPositionOptions = FOOTBALL_POSITIONS.map((value) => ({
  value,
  label: value,
}));
export const matchingLevelOptions = levelOptions.map((value) => ({
  value,
  label: value,
}));
export type MatchingFilterField =
  "entityType" | "role" | "level" | "position" | "department";

/** Canonical selected values are also safe operands for the backend queries. */
export function normalizeMatchingFilters(input: MatchFilters): MatchFilters {
  const result: MatchFilters = {};
  if (input.entityType === "club" || input.entityType === "profile")
    result.entityType = input.entityType;
  if (
    result.entityType !== "club" &&
    roleOptions.some((option) => option.value === input.role)
  )
    result.role = input.role;
  if (levelOptions.includes(input.level || "")) result.level = input.level;
  if (matchingPositionOptions.some((option) => option.value === input.position))
    result.position = input.position;
  if (departmentOptions.some((option) => option.value === input.department))
    result.department = input.department;
  return result;
}

export type MatchingFilterState = {
  draft: MatchFilters;
  applied: MatchFilters;
};
export type MatchingFilterAction =
  | { type: "edit"; field: MatchingFilterField; value: string }
  | { type: "apply" }
  | { type: "reset" };

export function matchingFiltersReducer(
  state: MatchingFilterState,
  action: MatchingFilterAction,
): MatchingFilterState {
  if (action.type === "reset") return { draft: {}, applied: {} };
  if (action.type === "apply")
    return { draft: state.draft, applied: { ...state.draft } };
  return {
    ...state,
    draft: normalizeMatchingFilters({
      ...state.draft,
      [action.field]: action.value,
    }),
  };
}

export function matchingDepartment(
  value: string | undefined,
): { code: string; profileValues: string[] } | null {
  if (!value) return null;
  const department = FRENCH_DEPARTMENTS.find(
    (item) => `${item.code} - ${item.name}` === value,
  );
  return department
    ? {
        code: department.code,
        // Older profiles may contain a plain department name or code.
        profileValues: [value, department.name, department.code],
      }
    : null;
}

/** Department is filtered before pagination against each table's own column. */
export function filterMatchingCandidates(
  entities: MatchableItem[],
  filters: MatchFilters,
): MatchableItem[] {
  const selected = normalizeMatchingFilters(filters);
  return filterEntities(entities, { ...selected, department: undefined });
}

export function matchingRecruitingPositions(
  value: unknown,
): { position: string; level: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.position !== "string")
      return [];
    return [
      {
        ...item,
        position: item.position,
        level: typeof item.level === "string" ? item.level : "",
      },
    ];
  });
}
