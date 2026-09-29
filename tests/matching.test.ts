import { describe, expect, it } from "vitest";
import { calculateDistance } from "../src/lib/matchingAlgorithm";
describe("matching geographic distance", () => {
  it("accepts zero latitude and longitude as real coordinates", () => {
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(111.195, 2);
  });
  it("returns zero for identical coordinates", () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
  });
  it("does not fabricate a distance when a coordinate is absent", () => {
    expect(calculateDistance(null, 0, 12, 45)).toBeNull();
    expect(calculateDistance(12, NaN, 12, 45)).toBeNull();
  });
  it("is symmetric across hemispheres", () => {
    expect(calculateDistance(48.8, 2.3, -33.9, 18.4)).toBeCloseTo(
      calculateDistance(-33.9, 18.4, 48.8, 2.3)!,
      8,
    );
  });
});
