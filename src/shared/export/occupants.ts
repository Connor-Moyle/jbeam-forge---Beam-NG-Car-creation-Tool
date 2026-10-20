import type { WritableValue } from '../jbeam/serialize';

/**
 * The game's physical occupants (BeamNG.drive 0.40): a seat carries a
 * `seat_occupant` slot whose default, the game's `occupant_generic`, puts a
 * 89 kg body on the seat, hung from six of the seat's nodes, with the
 * driver's camera and the seat's entry trigger. Shaped after the stock
 * cars' seats (the ETK 800, Pessima and 200BX interiors).
 */

type SeatNode = { id: string; pos: readonly number[] };
export type Hand = 'LHD' | 'RHD';

const ROWS = ['F', 'R', 'T', 'U'];

/** FL/FR/RL/RR… for each seat from where it sits (BeamNG +X is left), unique across the car. */
export function seatIds(seats: readonly { id: string; nodes: readonly SeatNode[] }[]): Map<string, string> {
  const centred = seats
    .filter((s) => s.nodes.length)
    .map((s) => ({ id: s.id, x: s.nodes.reduce((a, n) => a + n.pos[0]!, 0) / s.nodes.length, y: s.nodes.reduce((a, n) => a + n.pos[1]!, 0) / s.nodes.length }))
    .sort((a, b) => a.y - b.y);
  const ids = new Map<string, string>();
  const taken = new Set<string>();
  let row = 0;
  centred.forEach((s, i) => {
    if (i > 0 && s.y - centred[i - 1]!.y > 0.5) row++;
    const base = `${ROWS[Math.min(row, ROWS.length - 1)]}${s.x > 0.15 ? 'L' : s.x < -0.15 ? 'R' : 'C'}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
    taken.add(id);
    ids.set(s.id, id);
  });
  return ids;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const leftmost = (ns: readonly SeatNode[]) => ns.reduce((a, n) => (n.pos[0]! > a.pos[0]! ? n : a));
const rightmost = (ns: readonly SeatNode[]) => ns.reduce((a, n) => (n.pos[0]! < a.pos[0]! ? n : a));
const mean = (ns: readonly SeatNode[], i: number) => ns.reduce((a, n) => a + n.pos[i]!, 0) / ns.length;

/**
 * The slot row for a seat's occupant. The cushion is the seat's lower half of nodes, the
 * backrest its upper; the body sits 0.3 m behind the cushion's front edge, just above it,
 * reclined 15° like the stock seats.
 */
export function seatOccupantSlot(seatId: string, label: string, nodes: readonly SeatNode[], opts: { driver: Hand | null; mesh?: string }): WritableValue[] {
  const zMin = Math.min(...nodes.map((n) => n.pos[2]!));
  const zMax = Math.max(...nodes.map((n) => n.pos[2]!));
  const zMid = (zMin + zMax) / 2;
  let cushion = nodes.filter((n) => n.pos[2]! < zMid);
  let top = nodes.filter((n) => n.pos[2]! >= zMid);
  if (cushion.length < 2 || top.length < 2) cushion = top = [...nodes];
  const yMid = (Math.min(...cushion.map((n) => n.pos[1]!)) + Math.max(...cushion.map((n) => n.pos[1]!))) / 2;
  const front = cushion.filter((n) => n.pos[1]! < yMid);
  const rear = cushion.filter((n) => n.pos[1]! >= yMid);
  const f = front.length ? front : cushion;
  const b = rear.length ? rear : cushion;
  const picks = { FL: leftmost(f), FR: rightmost(f), RL: leftmost(b), RR: rightmost(b), TL: leftmost(top), TR: rightmost(top) };
  const frontY = Math.min(...f.map((n) => n.pos[1]!));
  const backY = Math.max(...cushion.map((n) => n.pos[1]!));
  const variables: Record<string, string | number> = {
    $seatID: seatId,
    ...(opts.driver ? { $isDriver: opts.driver } : {}),
    ...(opts.mesh ? { $TriggerHighlightMesh: opts.mesh } : {}),
    $occupant_camPitch: 15,
    $occupantDragCoef: 1,
    ...Object.fromEntries(Object.entries(picks).map(([k, n]) => [`$occupant_attachnode${k}`, n.id])),
  };
  return [
    `seat_occupant_${seatId}`,
    ['seat_occupant'],
    [],
    'occupant_generic',
    `${label} occupant`,
    {
      coreSlot: true,
      // The hip sits just above the cushion's front lip, and never below a quarter of the seat's height
      // (the hull's front nodes can all be on the seat's base, under the cushion).
      nodeMove: { x: r3(mean([picks.FL, picks.FR, picks.RL, picks.RR], 0)), y: r3(Math.min(frontY + 0.3, backY)), z: r3(Math.max(Math.max(...f.map((n) => n.pos[2]!)) + 0.03, zMin + 0.25 * (zMax - zMin))) },
      nodeRotate1: { x: -15, y: 0, z: 0 },
      variables,
    },
  ];
}
