import { expect, it } from "vitest";
import {
  FRENCH_DEPARTMENTS,
  extractDeptCodeFromUrl,
  getDepartmentByCode,
  departmentUrl,
} from "../src/data/french-departments";
import { notificationPath } from "../src/lib/notificationPath";
it("retrouve chaque département à partir de son lien canonique", () => {
  expect(new Set(FRENCH_DEPARTMENTS.map((d) => d.code)).size).toBe(
    FRENCH_DEPARTMENTS.length,
  );
  for (const d of FRENCH_DEPARTMENTS)
    expect(getDepartmentByCode(extractDeptCodeFromUrl(departmentUrl(d))!)).toBe(
      d,
    );
});
it("gère Corse, outre-mer, zéros initiaux et codes inconnus", () => {
  expect(extractDeptCodeFromUrl("corse-du-sud-2a")).toBe("2A");
  expect(getDepartmentByCode("971")?.name).toBe("Guadeloupe");
  expect(getDepartmentByCode(extractDeptCodeFromUrl("ain-01")!)?.name).toBe(
    "Ain",
  );
  expect(extractDeptCodeFromUrl("ain-1")).toBeNull();
  expect(getDepartmentByCode("999")).toBeUndefined();
});
it("normalise les anciens liens sans perdre paramètres ni fragment", () => {
  expect(
    notificationPath(
      "https://www.foot-nation.com/clubs-departement-nord-59?from=club#list",
    ),
  ).toBe("/clubs-departement/nord-59?from=club#list");
  expect(notificationPath("/clubs-departement/nord-59")).toBe(
    "/clubs-departement/nord-59",
  );
  expect(
    notificationPath("https://example.com/clubs-departement-nord-59"),
  ).toBeNull();
});
