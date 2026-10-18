import type { Placement } from './project/schema';

/**
 * A placement as shown: a fitted suspension is also stretched sideways about its own centre line
 * (the axle's track over the set's), the way the export moves its nodes.
 */
export type ShownPlacement = Placement & { lateral?: number };

/**
 * A placement as a 4×4 matrix (column-major, three.js order): sideways stretch, scale, then
 * rotate about X, Y, Z (degrees), then move. BeamNG space throughout.
 */
export function placementMatrix(p: ShownPlacement): number[] {
  const [rx, ry, rz] = p.rotation.map((d) => (d * Math.PI) / 180) as [number, number, number];
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  // R = Rz · Ry · Rx
  const r = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  const s = p.scale;
  const l = s * (p.lateral ?? 1);
  const [tx, ty, tz] = p.position;
  return [r[0]![0]! * l, r[1]![0]! * l, r[2]![0]! * l, 0, r[0]![1]! * s, r[1]![1]! * s, r[2]![1]! * s, 0, r[0]![2]! * s, r[1]![2]! * s, r[2]![2]! * s, 0, tx, ty, tz, 1];
}

export function samePlacement(a: ShownPlacement, b: ShownPlacement): boolean {
  return a.scale === b.scale && (a.lateral ?? 1) === (b.lateral ?? 1) && a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i]);
}
