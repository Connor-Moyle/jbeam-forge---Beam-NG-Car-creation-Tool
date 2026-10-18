/**
 * How big a part is, from its points alone: the area of its outline seen flat on. The points are
 * projected onto the plane of their two longest directions (a door seen from the side, a hood
 * from above, a bumper from the front) and the area is that of their convex outline. The same
 * measure for the game's parts (their nodes) and ours (a proxy's vertices), so node counts can
 * be compared as nodes per square metre.
 */

type V3 = [number, number, number];

/** The three principal directions of a point cloud, longest first (unit vectors). */
export function principalDirections(positions: ArrayLike<number>): [V3, V3, V3] {
  const n = positions.length / 3;
  const mean = [0, 0, 0];
  for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) mean[k]! += positions[v * 3 + k]!;
  for (let k = 0; k < 3; k++) mean[k]! /= n || 1;
  // Covariance, then its eigenvectors by Jacobi rotation (3×3: a few sweeps are plenty).
  const c = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let v = 0; v < n; v++) {
    const d = [positions[v * 3]! - mean[0]!, positions[v * 3 + 1]! - mean[1]!, positions[v * 3 + 2]! - mean[2]!];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i]![j]! += d[i]! * d[j]!;
  }
  const e = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += c[p]![q]! ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(c[p]![q]!) < 1e-15) continue;
        const theta = (c[q]![q]! - c[p]![p]!) / (2 * c[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cs = 1 / Math.sqrt(t * t + 1);
        const sn = t * cs;
        for (let k = 0; k < 3; k++) {
          const ckp = c[k]![p]!;
          const ckq = c[k]![q]!;
          c[k]![p] = cs * ckp - sn * ckq;
          c[k]![q] = sn * ckp + cs * ckq;
        }
        for (let k = 0; k < 3; k++) {
          const cpk = c[p]![k]!;
          const cqk = c[q]![k]!;
          c[p]![k] = cs * cpk - sn * cqk;
          c[q]![k] = sn * cpk + cs * cqk;
        }
        for (let k = 0; k < 3; k++) {
          const ekp = e[k]![p]!;
          const ekq = e[k]![q]!;
          e[k]![p] = cs * ekp - sn * ekq;
          e[k]![q] = sn * ekp + cs * ekq;
        }
      }
  }
  const order = [0, 1, 2].sort((a, b) => c[b]![b]! - c[a]![a]!);
  return order.map((i) => [e[0]![i]!, e[1]![i]!, e[2]![i]!] as V3) as [V3, V3, V3];
}

/** Area of the convex outline of 2D points (monotone chain). */
function hullArea(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...s].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

/** The part's outline area, m², seen flat on along its thinnest direction. */
export function projectedArea(positions: ArrayLike<number>): number {
  const n = positions.length / 3;
  if (n < 3) return 0;
  const [u, v] = principalDirections(positions);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3]!;
    const y = positions[i * 3 + 1]!;
    const z = positions[i * 3 + 2]!;
    pts.push([x * u[0] + y * u[1] + z * u[2], x * v[0] + y * v[1] + z * v[2]]);
  }
  return hullArea(pts);
}
