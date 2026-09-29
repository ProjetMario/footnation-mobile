import { expect, it } from "vitest";
import { EARTH_LAND, projectEarthLand } from "../src/lib/earthGeometry";

it("renders a complete rotation of the Earth with finite coastlines inside the sphere", () => {
  expect(EARTH_LAND.length).toBeGreaterThan(50);
  for (const ring of EARTH_LAND)
    for (const point of ring) expect(Math.hypot(...point)).toBeCloseTo(1, 10);
  const fronts = new Set<string>();
  for (let turn = 0; turn < 1; turn += 1 / 24) {
    const path = projectEarthLand(turn, EARTH_LAND);
    expect(path.length).toBeGreaterThan(100);
    expect(path).not.toMatch(/NaN|Infinity|undefined/);
    fronts.add(path);
    for (const match of path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g))
      expect(
        Math.hypot(Number(match[1]) - 50, Number(match[2]) - 48),
      ).toBeLessThanOrEqual(46.008);
  }
  expect(fronts.size).toBeGreaterThan(20);
  for (const turn of [1, 2, 3])
    expect(projectEarthLand(turn, EARTH_LAND)).toBe(
      projectEarthLand(0, EARTH_LAND),
    );
});
