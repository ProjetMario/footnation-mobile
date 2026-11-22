import { expect, it } from "vitest";
import {
  careerCountryOptions,
  careerDepartmentOptions,
  careerRegionOptions,
  inferCareerZoneKind,
  selectCareerArea,
} from "../src/lib/careerZones";
import { emptyGoal, goalPreview } from "../src/lib/careerGoals";

it("offers all 249 ISO countries and territories without duplicate codes", () => {
  expect(careerCountryOptions).toHaveLength(249);
  expect(new Set(careerCountryOptions.map((c) => c.code)).size).toBe(249);
  for (const code of [
    "FR",
    "RU",
    "PS",
    "GB",
    "US",
    "BR",
    "JP",
    "ZA",
    "AU",
    "NC",
  ])
    expect(careerCountryOptions.some((c) => c.code === code)).toBe(true);
});
it("includes metropolitan and overseas departments and regions", () => {
  expect(careerDepartmentOptions).toHaveLength(101);
  expect(careerRegionOptions).toHaveLength(18);
  expect(careerDepartmentOptions.some((c) => c.value === "73 - Savoie")).toBe(
    true,
  );
  expect(careerDepartmentOptions.some((c) => c.value.startsWith("976"))).toBe(
    true,
  );
});
it("restores saved area types and clears stale city data on a broader selection", () => {
  for (const [kind, zone] of [
    ["department", "73 - Savoie"],
    ["region", "Auvergne-Rhône-Alpes"],
    ["country", "Sénégal"],
  ]) {
    const next = {
      ...emptyGoal,
      zoneCity: "Lyon",
      zoneDepartment: "69 - Rhône",
      ...selectCareerArea(zone),
    };
    expect(inferCareerZoneKind(next)).toBe(kind);
    const preview = goalPreview("Joueur amateur", next);
    expect(preview.description).toContain(zone);
    expect(preview.description).not.toContain("Lyon");
    expect(preview.description).not.toContain("Rhône\n");
  }
  expect(inferCareerZoneKind({ zone: "Paris", zoneCity: "Paris" })).toBe(
    "city",
  );
});
