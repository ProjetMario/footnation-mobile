import landRings from "../../assets/brand/earth/land.json";
import {
  clipBallPolygon,
  rotateBallPoint,
  type BallPoint,
} from "./ballGeometry";

// Start above Europe/Africa. Real coastlines remain upright while rotating east.
export const EARTH_LAND: BallPoint[][] = landRings.map((ring) =>
  ring.map(([longitude, latitude]) => {
    const lon = ((longitude - 12) * Math.PI) / 180;
    const lat = (latitude * Math.PI) / 180;
    return [
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.cos(lon),
    ];
  }),
);

/** Orthographic projection with an 18° northern viewpoint and hidden back face. */
export function projectEarthLand(turn: number, rings: BallPoint[][]): string {
  "worklet";
  const angle = (((turn % 1) + 1) % 1) * 2 * Math.PI;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const tilt = Math.PI / 10;
  let path = "";
  for (const ring of rings) {
    const visible = clipBallPolygon(
      ring.map((point) => {
        const [x, y, z] = rotateBallPoint(point, cosine, sine);
        return [
          x,
          y * Math.cos(tilt) - z * Math.sin(tilt),
          y * Math.sin(tilt) + z * Math.cos(tilt),
        ] as BallPoint;
      }),
    );
    if (visible.length < 3) continue;
    path += `M${visible.map((point) => `${Math.round((50 + 46 * point[0]) * 100) / 100},${Math.round((48 - 46 * point[1]) * 100) / 100}`).join("L")}Z`;
  }
  return path;
}
