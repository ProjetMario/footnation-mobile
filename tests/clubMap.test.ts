import { expect, it } from "vitest";
import {
  distanceKm,
  filterClubMap,
  validMapLocation,
  type ClubMapPoint,
} from "../src/lib/clubMap";
const club = (
  id: string,
  latitude: number,
  extra: Partial<ClubMapPoint> = {},
): ClubMapPoint => ({
  id,
  name: "Chambéry",
  latitude,
  longitude: 5.9,
  city: "Chambéry",
  department_code: "73",
  logo_url: null,
  type: "club",
  ...extra,
});
it("filters clubs by accent-insensitive text, department and type", () => {
  const rows = [
    club("a", 45.5),
    club("b", 45.6, { type: "five_center" }),
    club("c", 45.6, { department_code: "74" }),
  ];
  expect(
    filterClubMap(rows, "chambery", "73", "club").map((p) => p.id),
  ).toEqual(["a"]);
});
it("ranks all mapped clubs by distance and applies the selected radius", () => {
  const here = { latitude: 45.5, longitude: 5.9 };
  const rows = [club("far", 46), club("near", 45.51), club("same", 45.5)];
  expect(filterClubMap(rows, "", "", "all", here, 10).map((p) => p.id)).toEqual(
    ["same", "near"],
  );
  expect(distanceKm(here, here)).toBe(0);
  expect(
    distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
  ).toBeCloseTo(111.19, 1);
});
it("ignores invalid coordinates but keeps valid equatorial locations", () => {
  expect(validMapLocation({ latitude: 0, longitude: 0 })).toBe(true);
  expect(
    filterClubMap([club("invalid", NaN), club("invalid2", 91)], "", "", "all"),
  ).toEqual([]);
});
