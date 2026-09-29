export type BallPoint = [number, number, number];
export type BallFace = { points: BallPoint[]; sides: 5 | 6 };
export type BallGeometry = { faces: BallFace[]; seams: BallPoint[][] };
export const BALL_FRAME_COUNT = 420;

function dot(a: BallPoint, b: BallPoint) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: BallPoint, b: BallPoint): BallPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function unit(a: BallPoint): BallPoint {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
}
function center(points: BallPoint[]): BallPoint {
  return unit(
    points.reduce<BallPoint>(
      (sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]],
      [0, 0, 0],
    ),
  );
}
function basis(normal: BallPoint) {
  const up: BallPoint = Math.abs(normal[1]) > 0.97 ? [0, 0, -1] : [0, 1, 0];
  const right = unit(cross(up, normal));
  return { right, up: cross(normal, right) };
}
function sphereEdge(a: BallPoint, b: BallPoint, steps = 5) {
  const result: BallPoint[] = [];
  for (let step = 0; step < steps; step++) {
    const t = step / steps;
    result.push(
      unit([
        a[0] * (1 - t) + b[0] * t,
        a[1] * (1 - t) + b[1] * t,
        a[2] * (1 - t) + b[2] * t,
      ]),
    );
  }
  return result;
}
/** A truncated icosahedron: the same 12 pentagons / 20 hexagons as a football. */
export function createBallGeometry(): BallGeometry {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices: BallPoint[] = [];
  for (const a of [-1, 1])
    for (const b of [-phi, phi]) {
      vertices.push(unit([a, b, 0]), unit([0, a, b]), unit([b, 0, a]));
    }
  const adjacent = (a: number, b: number) =>
    a !== b && dot(vertices[a], vertices[b]) > 0.4;
  const cut = (a: number, b: number): BallPoint =>
    unit(
      vertices[a].map(
        (value, index) => 2 * value + vertices[b][index],
      ) as BallPoint,
    );
  const faces: BallFace[] = [];
  for (let a = 0; a < 12; a++)
    for (let b = a + 1; b < 12; b++)
      for (let c = b + 1; c < 12; c++) {
        if (!adjacent(a, b) || !adjacent(b, c) || !adjacent(c, a)) continue;
        let triangle = [a, b, c];
        if (dot(cross(vertices[a], vertices[b]), vertices[c]) < 0)
          triangle = [a, c, b];
        const [i, j, k] = triangle;
        faces.push({
          sides: 6,
          points: [
            cut(i, j),
            cut(j, i),
            cut(j, k),
            cut(k, j),
            cut(k, i),
            cut(i, k),
          ],
        });
      }
  for (let a = 0; a < 12; a++) {
    const axes = basis(vertices[a]);
    const points = vertices.flatMap((_, b) =>
      adjacent(a, b) ? [cut(a, b)] : [],
    );
    points.sort(
      (p, q) =>
        Math.atan2(dot(p, axes.up), dot(p, axes.right)) -
        Math.atan2(dot(q, axes.up), dot(q, axes.right)),
    );
    faces.push({ sides: 5, points });
  }
  // Keep a hexagon centered on the front hemisphere at the start of a turn.
  const front = center(faces[0].points);
  const camera = basis(front);
  for (const face of faces)
    face.points = face.points.map((p) => [
      dot(p, camera.right),
      dot(p, camera.up),
      dot(p, front),
    ]);

  const seamMap = new Map<string, BallPoint[]>();
  for (const face of faces) {
    for (let edge = 0; edge < face.points.length; edge++) {
      const a = face.points[edge];
      const b = face.points[(edge + 1) % face.points.length];
      const key = [a, b]
        .map((p) => p.map((value) => value.toFixed(5)).join(","))
        .sort()
        .join("/");
      if (!seamMap.has(key)) seamMap.set(key, [...sphereEdge(a, b, 6), b]);
    }
  }
  return { faces, seams: [...seamMap.values()] };
}

export function rotateBallPoint(
  point: BallPoint,
  cosine: number,
  sine: number,
): BallPoint {
  "worklet";
  return [
    point[0] * cosine + point[2] * sine,
    point[1],
    -point[0] * sine + point[2] * cosine,
  ];
}
function horizon(a: BallPoint, b: BallPoint): BallPoint {
  "worklet";
  const t = a[2] / (a[2] - b[2]);
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  const radius = Math.sqrt(x * x + y * y);
  return [x / radius, y / radius, 0];
}

/** Clip the back hemisphere, joining the cut along the circular horizon. */
export function clipBallPolygon(points: BallPoint[]): BallPoint[] {
  "worklet";
  const visible: BallPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[i];
    if (a[2] >= 0 !== b[2] >= 0) visible.push(horizon(a, b));
    if (b[2] >= 0) visible.push(b);
  }
  if (visible.length < 3) return [];
  const curved: BallPoint[] = [];
  for (let i = 0; i < visible.length; i++) {
    const a = visible[(i + visible.length - 1) % visible.length];
    const b = visible[i];
    if (a[2] === 0 && b[2] === 0) {
      const start = Math.atan2(a[1], a[0]);
      let arc = Math.atan2(b[1], b[0]) - start;
      if (arc > Math.PI) arc -= 2 * Math.PI;
      if (arc < -Math.PI) arc += 2 * Math.PI;
      const steps = Math.ceil(Math.abs(arc) / 0.07);
      for (let step = 1; step < steps; step++) {
        const angle = start + (arc * step) / steps;
        curved.push([Math.cos(angle), Math.sin(angle), 0]);
      }
    }
    curved.push(b);
  }
  return curved;
}
function screenPoint(point: BallPoint) {
  "worklet";
  return `${Math.round((50 + point[0] * 46) * 100) / 100},${Math.round((48 - point[1] * 46) * 100) / 100}`;
}

/** Project only the football stitching; the flag texture rotates with this angle. */
export function projectBallSeams(turn: number, edges: BallPoint[][]): string {
  "worklet";
  const angle = (((turn % 1) + 1) % 1) * 2 * Math.PI;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  let seams = "";
  for (const edge of edges) {
    let a = rotateBallPoint(edge[0], cosine, sine);
    for (let i = 1; i < edge.length; i++) {
      const b = rotateBallPoint(edge[i], cosine, sine);
      if (a[2] >= 0 && b[2] >= 0)
        seams += `M${screenPoint(a)}L${screenPoint(b)}`;
      else if (a[2] >= 0 !== b[2] >= 0)
        seams +=
          a[2] >= 0
            ? `M${screenPoint(a)}L${screenPoint(horizon(a, b))}`
            : `M${screenPoint(horizon(a, b))}L${screenPoint(b)}`;
      a = b;
    }
  }
  return seams;
}
