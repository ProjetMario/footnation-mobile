import type { ClubSearchType } from "./clubSearch";
export type MapLocation = { latitude: number; longitude: number };
export type ClubMapPoint = MapLocation & {
  id: string;
  name: string;
  short_name?: string | null;
  city: string | null;
  department_code: string;
  logo_url: string | null;
  type: "club" | "five_center";
};
export function validMapLocation(value: MapLocation) {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}
export function distanceKm(a: MapLocation, b: MapLocation) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function filterClubMap(
  points: ClubMapPoint[],
  search: string,
  department: string,
  type: ClubSearchType,
  location: MapLocation | null = null,
  radius = Infinity,
) {
  const term = normalize(search);
  return points
    .filter(
      (p) =>
        validMapLocation(p) &&
        (!department || p.department_code === department) &&
        (type === "all" || p.type === type) &&
        (!term ||
          normalize(
            [p.name, p.short_name, p.city].filter(Boolean).join(" "),
          ).includes(term)) &&
        (!location || distanceKm(location, p) <= radius),
    )
    .sort((a, b) =>
      location
        ? distanceKm(location, a) - distanceKm(location, b) ||
          a.id.localeCompare(b.id)
        : a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id),
    );
}
