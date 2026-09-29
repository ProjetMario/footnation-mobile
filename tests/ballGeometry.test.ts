import { describe, expect, it } from "vitest";
import {
  BALL_FRAME_COUNT,
  clipBallPolygon,
  createBallGeometry,
  projectBallSeams,
  rotateBallPoint,
  type BallPoint,
} from "../src/lib/ballGeometry";

const geometry = createBallGeometry();
const unit = (point: BallPoint): BallPoint => {
  const length = Math.hypot(...point);
  return point.map((value) => value / length) as BallPoint;
};
describe("FootNation spherical football", () => {
  it("forms a closed football with 12 pentagons, 20 hexagons and 90 unique seams", () => {
    expect(geometry.faces.filter((face) => face.sides === 5)).toHaveLength(12);
    expect(geometry.faces.filter((face) => face.sides === 6)).toHaveLength(20);
    expect(geometry.seams).toHaveLength(90);
    const vertices = new Set(
      geometry.faces.flatMap((face) =>
        face.points.map((point) =>
          point.map((value) => value.toFixed(6)).join(","),
        ),
      ),
    );
    expect(vertices.size).toBe(60);
    for (const face of geometry.faces) {
      expect(face.points).toHaveLength(face.sides);
      for (const point of face.points)
        expect(Math.hypot(...point)).toBeCloseTo(1, 10);
    }
  });

  it("opens on an upright hexagon centered on the front hemisphere", () => {
    const center = unit(
      geometry.faces[0].points.reduce<BallPoint>(
        (sum, point) => [
          sum[0] + point[0],
          sum[1] + point[1],
          sum[2] + point[2],
        ],
        [0, 0, 0],
      ),
    );
    expect(center[0]).toBeCloseTo(0, 10);
    expect(center[1]).toBeCloseTo(0, 10);
    expect(center[2]).toBeCloseTo(1, 10);
  });

  it("rotates around the vertical axis while preserving latitude and spherical volume", () => {
    const point = unit([0, 0.35, 1]);
    const quarter = rotateBallPoint(point, 0, 1);
    const half = rotateBallPoint(point, -1, 0);
    expect(quarter[1]).toBe(point[1]);
    expect(quarter[0]).toBeCloseTo(point[2], 10);
    expect(quarter[2]).toBeCloseTo(0, 10);
    expect(half[2]).toBeLessThan(0);
    expect(Math.hypot(...quarter)).toBeCloseTo(1, 10);
    expect(Math.hypot(...half)).toBeCloseTo(1, 10);
  });

  it("hides rear panels and clips partial panels along a curved horizon", () => {
    const back = [
      [-0.2, -0.2, -1],
      [0.2, -0.2, -1],
      [0, 0.2, -1],
    ].map((point) => unit(point as BallPoint));
    expect(clipBallPolygon(back)).toEqual([]);
    const crossing = [
      [0.8, -0.35, 0.5],
      [0.8, 0.35, 0.5],
      [0.8, 0.35, -0.5],
      [0.8, -0.35, -0.5],
    ].map((point) => unit(point as BallPoint));
    const visible = clipBallPolygon(crossing);
    expect(visible.every((point) => point[2] >= 0)).toBe(true);
    const horizon = visible.filter((point) => point[2] === 0);
    expect(horizon.length).toBeGreaterThan(2);
    for (const point of horizon)
      expect(Math.hypot(point[0], point[1])).toBeCloseTo(1, 10);
  });

  it("returns seamlessly to the same image after one revolution", () => {
    expect(projectBallSeams(1, geometry.seams)).toEqual(
      projectBallSeams(0, geometry.seams),
    );
    expect(projectBallSeams(0.25, geometry.seams)).not.toEqual(
      projectBallSeams(0, geometry.seams),
    );
  });

  it("keeps every seam inside the spherical silhouette throughout a revolution", () => {
    for (let step = 0; step < BALL_FRAME_COUNT; step += 7) {
      const path = projectBallSeams(step / BALL_FRAME_COUNT, geometry.seams);
      expect(path.length).toBeGreaterThan(0);
      {
        expect(path).not.toMatch(/NaN|Infinity|undefined/);
        for (const match of path.matchAll(
          /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
        )) {
          const radius = Math.hypot(
            Number(match[1]) - 50,
            Number(match[2]) - 48,
          );
          // Paths are rounded to 0.01 SVG units, below 0.004 device-independent px.
          expect(radius).toBeLessThanOrEqual(46.008);
        }
      }
    }
  }, 30000);
});
