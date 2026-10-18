import type { Vec3 } from './schema';

/** Geometry for hinges: rotation about the hinge line, and automatic placement guesses. */

type Pt = readonly [number, number, number];

const sub = (a: Pt, b: Pt): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Pt, b: Pt): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Pt, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Pt, b: Pt): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Rotate `p` about the line a→b by `deg` degrees (right-hand rule, Rodrigues). */
export function rotateAbout(p: Pt, a: Pt, b: Pt, deg: number): Vec3 {
  const axis = sub(b, a);
  const len = Math.hypot(...axis) || 1;
  const k = scale(axis, 1 / len);
  const v = sub(p, a);
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const rotated = add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
  return add(a, rotated);
}

/** Distance from `p` to the line through a and b. */
export function distToLine(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const len = Math.hypot(...ab) || 1;
  return Math.hypot(...cross(sub(p, a), ab)) / len;
}

/**
 * BeamNG |BOUNDED long bound for a limiter from `moving` (on the part) to
 * `fixed` (on the body): how much longer than closed it may get, as a ratio,
 * so the part stops at the opening angle.
 */
export function limiterBound(moving: Pt, fixed: Pt, axis: readonly [Pt, Pt], signedAngle: number): number {
  const closed = dist(moving, fixed);
  const open = dist(rotateAbout(moving, axis[0], axis[1], signedAngle), fixed);
  return closed > 1e-6 ? Math.max(0.01, open / closed - 1) : 0.01;
}

export interface HingeGuess {
  axis: [Vec3, Vec3];
  direction: 1 | -1;
  latch: Vec3 | null;
  handles: { pos: Vec3; inside: boolean }[];
}

function centroid(ps: readonly Pt[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of ps) for (let i = 0; i < 3; i++) c[i]! += p[i]!;
  return ps.length ? scale(c, 1 / ps.length) : c;
}

const argBy = (ps: readonly Pt[], f: (p: Pt) => number): Vec3 => [...ps.reduce((best, p) => (f(p) < f(best) ? p : best))] as Vec3;

/**
 * Where a part's hinge, latch and handles probably are, from its generated
 * nodes (BeamNG space: +X left, −Y front, +Z up). Side doors and fuel doors
 * hinge on their front edge, below the window line; hoods at the rear edge;
 * trunk lids at the front edge; tailgates at the top. The swing direction is
 * whichever moves the part away from the body.
 */
export function guessHinge(kind: string, part: readonly Pt[], body: readonly Pt[]): HingeGuess {
  const { lo, hi, size } = box(part);
  const mid = centroid(part);
  const band = (axis: 0 | 1 | 2, end: 'lo' | 'hi', frac = 0.12) => part.filter((p) => (end === 'lo' ? p[axis] <= lo[axis] + size[axis] * frac : p[axis] >= hi[axis] - size[axis] * frac));
  const side = mid[0] >= 0 ? 1 : -1; // +X is the car's left

  let axis: [Vec3, Vec3];
  let latch: Vec3 | null;
  const handles: { pos: Vec3; inside: boolean }[] = [];
  if (kind === 'hood') {
    const rear = band(1, 'hi');
    axis = [argBy(rear, (p) => p[0]), argBy(rear, (p) => -p[0])];
    latch = argBy(band(1, 'lo'), (p) => Math.abs(p[0]));
  } else if (kind === 'trunk') {
    const front = band(1, 'lo');
    axis = [argBy(front, (p) => p[0]), argBy(front, (p) => -p[0])];
    latch = argBy(band(1, 'hi'), (p) => Math.abs(p[0]) + p[2]);
    handles.push({ pos: latch, inside: false });
  } else if (kind === 'tailgate') {
    const top = band(2, 'hi');
    axis = [argBy(top, (p) => p[0]), argBy(top, (p) => -p[0])];
    latch = argBy(band(2, 'lo'), (p) => Math.abs(p[0]));
    handles.push({ pos: latch, inside: false });
  } else {
    // Doors (and fuel doors): the front edge, below the window line.
    const belt = lo[2] + size[2] * 0.6;
    const front = band(1, 'lo', 0.15).filter((p) => p[2] <= belt);
    const edge = front.length >= 2 ? front : band(1, 'lo', 0.15);
    axis = [argBy(edge, (p) => p[2]), argBy(edge, (p) => -p[2])];
    // A coarse door (a hull has nodes only at its corners) may have nothing up the front edge below the belt:
    // the two hinge points must still be well apart up the door, never across its thickness.
    if (Math.abs(axis[0][2] - axis[1][2]) < size[2] * 0.25) {
      const all = band(1, 'lo', 0.15);
      axis = [argBy(all, (p) => p[2]), argBy(all, (p) => -p[2])];
    }
    const rear = band(1, 'hi', 0.15);
    const latchZ = lo[2] + size[2] * 0.45;
    latch = rear.length ? argBy(rear, (p) => Math.abs(p[2] - latchZ)) : null;
    if (latch) {
      const handleZ = lo[2] + size[2] * 0.55;
      const at: Vec3 = [latch[0], latch[1] - Math.min(0.1, size[1] * 0.1), handleZ];
      handles.push({ pos: [at[0] + side * 0.02, at[1], at[2]], inside: false }, { pos: [at[0] - side * 0.08, at[1] - 0.05, at[2]], inside: true });
    }
  }

  return { axis, direction: swingAway(mid, axis, body), latch, handles };
}

/** Swing away from the body: test both ways with a small angle. */
function swingAway(mid: Pt, axis: readonly [Pt, Pt], body: readonly Pt[]): 1 | -1 {
  const b = centroid(body.length ? body : [[0, 0, 0]]);
  const away = (sign: 1 | -1) => dist(rotateAbout(mid, axis[0], axis[1], 20 * sign), b);
  return away(1) >= away(-1) ? 1 : -1;
}

/** An edge of a part's box, in BeamNG space (+X left, −Y front, +Z up). */
export type HingeEdge = 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';
export const HINGE_EDGES: readonly HingeEdge[] = ['front', 'rear', 'left', 'right', 'top', 'bottom'];
const EDGE_SIDE: Record<HingeEdge, { axis: 0 | 1 | 2; end: 'lo' | 'hi' }> = { front: { axis: 1, end: 'lo' }, rear: { axis: 1, end: 'hi' }, left: { axis: 0, end: 'hi' }, right: { axis: 0, end: 'lo' }, top: { axis: 2, end: 'hi' }, bottom: { axis: 2, end: 'lo' } };
const EDGE_BAND = 0.15;

function box(part: readonly Pt[]) {
  const lo: Vec3 = [Math.min(...part.map((p) => p[0])), Math.min(...part.map((p) => p[1])), Math.min(...part.map((p) => p[2]))];
  const hi: Vec3 = [Math.max(...part.map((p) => p[0])), Math.max(...part.map((p) => p[1])), Math.max(...part.map((p) => p[2]))];
  return { lo, hi, size: sub(hi, lo) };
}

function onEdge(p: Pt, edge: HingeEdge, b: ReturnType<typeof box>): boolean {
  const { axis, end } = EDGE_SIDE[edge];
  if (b.size[axis] < 1e-6) return false; // a flat part has no edge across its thickness
  return end === 'lo' ? p[axis] <= b.lo[axis] + b.size[axis] * EDGE_BAND : p[axis] >= b.hi[axis] - b.size[axis] * EDGE_BAND;
}

/** The edge of the part's box both hinge points sit on, or null (a line set by hand). */
export function hingeEdge(axis: readonly [Pt, Pt], part: readonly Pt[]): HingeEdge | null {
  if (!part.length) return null;
  const b = box(part);
  return HINGE_EDGES.find((e) => onEdge(axis[0], e, b) && onEdge(axis[1], e, b)) ?? null;
}

/**
 * The hinge moved to an edge of the part (a bonnet that opens from the front,
 * a gull-wing door): the line runs the length of that edge, the latch sits on
 * the opposite edge, the swing goes away from the body.
 */
export function edgeHinge(edge: HingeEdge, part: readonly Pt[], body: readonly Pt[]): Pick<HingeGuess, 'axis' | 'direction' | 'latch'> {
  const b = box(part);
  const { axis: a, end } = EDGE_SIDE[edge];
  const onBand = part.filter((p) => onEdge(p, edge, b));
  // The line runs along the edge's longer dimension (up a door, across a bonnet).
  const others = ([0, 1, 2] as const).filter((i) => i !== a);
  const along = b.size[others[0]!] >= b.size[others[1]!] ? others[0]! : others[1]!;
  const axis: [Vec3, Vec3] = [argBy(onBand, (p) => p[along]), argBy(onBand, (p) => -p[along])];
  const opposite: HingeEdge = HINGE_EDGES.find((e) => EDGE_SIDE[e].axis === a && EDGE_SIDE[e].end !== end)!;
  const far = part.filter((p) => onEdge(p, opposite, b));
  const mid = centroid(part);
  const latch = far.length ? argBy(far, (p) => Math.abs(p[along] - mid[along])) : null;
  return { axis, direction: swingAway(mid, axis, body), latch };
}
