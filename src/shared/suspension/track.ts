import { multiply, scaling, translation, type M, type V3 } from '../mesh/meshEdit';
import type { Axle } from '../project/schema';

/** What the track change is read from: the axles and where their sets' models sit. */
export interface TrackDoc {
  axles?: readonly Pick<Axle, 'track' | 'fitted' | 'alternates'>[];
  sources?: readonly { id: string; placement: { position: readonly number[] } }[];
}

/**
 * Widening (or narrowing) a fitted suspension to its axle's track the way a
 * modder does it, rather than scaling the whole set sideways: the hubs,
 * brakes and anything else out by the wheel slide outward; arms, links and
 * shafts stretch from their inner end so their pivots stay put; a bar across
 * the car stretches about the centre line; the subframe and other central
 * parts stay. The viewport bakes these moves into the meshes and the export
 * moves the jbeam nodes with them (suspension/transplant.ts).
 */

export interface MeshBox {
  key: string;
  min: V3;
  max: V3;
}

/** A move or a resize along the car's X about `pivot`. */
export interface TrackMove {
  key: string;
  pivot: V3;
  translate: V3;
  scale: V3;
}

/** What an axle asks of a set: half the set's own track, how far each side moves out (negative: in), and where its centre line is (x). */
export interface TrackChange {
  half: number;
  d: number;
  centre: number;
}

/** The track change an axle asks of the set that came in as `sourceId` (its fitted suspension or one of its alternates), or null for none. */
export function trackChange(doc: TrackDoc, sourceId: string): TrackChange | null {
  for (const a of doc.axles ?? []) {
    const s = [a.fitted, ...(a.alternates ?? [])].find((f) => f?.sourceId === sourceId);
    if (!s) continue;
    if (!s.track) return null;
    const d = Math.round(((a.track - s.track) / 2) * 1e6) / 1e6;
    if (Math.abs(d) < 1e-4) return null;
    return { half: s.track / 2, d, centre: doc.sources?.find((x) => x.id === sourceId)?.placement.position[0] ?? 0 };
  }
  return null;
}

const CROSS = 0.02;

/**
 * Per-side moves for the given meshes (boxes in car space). A node without a mesh goes through
 * the same rule as a box of no size.
 * shortcut: judged from each mesh's X extent only (where it starts and ends across the car), upgrade to
 * the jbeam's beam topology if a set files an arm as a hub or a bar as a subframe.
 */
export function trackMoves(meshes: readonly MeshBox[], { half, d, centre }: TrackChange): TrackMove[] {
  const out: TrackMove[] = [];
  if (Math.abs(d) < 1e-4 || half <= 0) return out;
  const none: V3 = [0, 0, 0];
  const one: V3 = [1, 1, 1];
  for (const m of meshes) {
    const [x0, x1] = [m.min[0] - centre, m.max[0] - centre];
    const [cy, cz] = [(m.min[1] + m.max[1]) / 2, (m.min[2] + m.max[2]) / 2];
    if (x0 < -CROSS && x1 > CROSS) {
      // Across the centre line: a sway bar or beam axle stretches, a subframe or rack stays.
      const reach = Math.min(-x0, x1);
      if (reach >= 0.6 * half) out.push({ key: m.key, pivot: [centre, cy, cz], translate: none, scale: [(reach + d) / reach, 1, 1] });
      continue;
    }
    const side = (x0 + x1) / 2 < 0 ? -1 : 1;
    const inner = Math.min(Math.abs(x0), Math.abs(x1));
    const outer = Math.max(Math.abs(x0), Math.abs(x1));
    if (outer < 0.6 * half) continue; // an inboard mount or bracket
    if (inner < 0.5 * half) out.push({ key: m.key, pivot: [centre + side * inner, cy, cz], translate: none, scale: [(outer - inner + d) / (outer - inner), 1, 1] });
    else out.push({ key: m.key, pivot: [centre + side * outer, cy, cz], translate: [side * d, 0, 0], scale: one });
  }
  return out;
}

/** The move as a matrix (car space). */
export function trackMatrix(m: TrackMove): M {
  const [px, py, pz] = m.pivot;
  return multiply(translation([px + m.translate[0], py + m.translate[1], pz + m.translate[2]]), multiply(scaling(m.scale), translation([-px, -py, -pz])));
}
