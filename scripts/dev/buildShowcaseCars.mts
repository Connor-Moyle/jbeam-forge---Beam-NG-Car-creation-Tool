/**
 * Two cars made in code to put the app through its paces: a rock-crawling
 * buggy with a removable top and an early-1960s style Grand Prix car. Each is
 * written as an OBJ with a named object per part (bumper_F_offroad,
 * rollcage, seat_FL_race…) so the app sorts it into parts on import, with
 * variant parts for the versions a configuration can pick (off-road, drift,
 * trophy truck, race).
 *
 *   npx tsx scripts/dev/buildShowcaseCars.mts [out folder]   (default artifacts/showcase)
 *
 * Model space: +Y up, +Z the front of the car, +X its left; metres, ground at y = 0.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoUv, both, box, cylinder, lathe, loft, loop, mirrorX, mtlText, oval, polygon, prism, quad, rotateX, rotateY, rotateZ, slab, sphere, translate, tube, weld, writeObj, type Mesh, type Tri, type V2, type V3 } from './meshKit.mts';

const OUT = process.argv[2] ?? join(import.meta.dirname, '..', '..', 'artifacts', 'showcase');

// ---------------------------------------------------------------- shared pieces

/** A tyre (lathe about the axle) and a rim with spokes, centred on the wheel centre; the axle runs along x. */
function wheelAndTyre(c: V3, rTyre: number, rRim: number, width: number, spokes = 5, rimMat = 'alloy'): { tire: Tri[]; wheel: Tri[] } {
  const w = width / 2;
  // Tyre: a rounded shoulder on both faces.
  const tyreProfile: V2[] = [
    [rRim, -w],
    [rTyre * 0.86, -w],
    [rTyre * 0.97, -w * 0.8],
    [rTyre, -w * 0.4],
    [rTyre, w * 0.4],
    [rTyre * 0.97, w * 0.8],
    [rTyre * 0.86, w],
    [rRim, w],
  ];
  const tire = lathe(tyreProfile, c, 'x', 28, 'rubber', false);
  // Tread blocks round the tyre.
  const blocks = Math.round(rTyre * 60);
  for (let i = 0; i < blocks; i++) {
    const block = box([c[0] - w * 0.75, c[1] + rTyre - 0.004, c[2] - (Math.PI * rTyre) / blocks / 2 + 0.006], [c[0] + w * 0.75, c[1] + rTyre + 0.012, c[2] + (Math.PI * rTyre) / blocks / 2 - 0.006], 'rubber');
    tire.push(...rotateX(block, (i / blocks) * 360, c));
  }
  // Rim: a barrel inside the tyre, a dish on the outer face with the centre set in, spokes across it.
  const out = c[0] > 0 ? 1 : -1; // +x is the outside of a left-hand wheel
  const dish: V2[] = [
    [rRim, -w * 0.95],
    [rRim, w * 0.95],
    [rRim * 0.92, w * 0.95],
    [rRim * 0.92, w * 0.5],
    [rRim * 0.4, w * 0.6],
    [rRim * 0.4, w * 0.68],
    [0.001, w * 0.68],
  ];
  const rim = lathe(
    dish.map(([r, t]): V2 => [r, t * out]),
    c,
    'x',
    24,
    rimMat,
    false,
  );
  const spokesTris: Tri[] = [];
  const sx = c[0] + w * 0.56 * out;
  for (let i = 0; i < spokes; i++) {
    const spoke = box([sx - 0.012, c[1] - 0.02, c[2] - 0.0], [sx + 0.012, c[1] + 0.02, c[2] + rRim * 0.9], rimMat);
    spokesTris.push(...rotateX(spoke, (i / spokes) * 360, c));
  }
  spokesTris.push(...cylinder([c[0] + w * 0.68 * out, c[1], c[2]], [c[0] + w * 0.78 * out, c[1], c[2]], rRim * 0.18, 12, 'black'));
  return { tire, wheel: [...rim, ...spokesTris] };
}

/** A round lamp: a short can with a lens on the front face (the +z or the given direction). */
function lamp(c: V3, r: number, depth: number, lens: string, facing: 'z' | '-z' = 'z'): Tri[] {
  const can = lathe(
    [
      [0.001, 0],
      [r, 0],
      [r, depth],
      [r * 0.92, depth],
      [0.001, depth],
    ],
    c,
    'z',
    18,
    'black',
  );
  const glass = lathe(
    [
      [0.001, depth + 0.005],
      [r * 0.9, depth + 0.005],
    ],
    c,
    'z',
    18,
    lens,
  );
  const all = [...can, ...glass];
  return facing === 'z' ? all : rotateY(all, 180, c);
}

/** A bucket seat: base, back and bolsters, racing ones with head wings. */
function bucketSeat(c: V3, race: boolean): Tri[] {
  const w = race ? 0.46 : 0.5;
  const [x, y, z] = c;
  const mat = race ? 'carbon' : 'cloth';
  const base = box([x - w / 2, y, z - 0.25], [x + w / 2, y + 0.12, z + 0.25], mat);
  const back = rotateX(box([x - w / 2, y, z - 0.03], [x + w / 2, y + 0.62, z + 0.03], mat), -15, [x, y, z]);
  const back2 = translate(back, [0, 0.1, -0.22]);
  const bolsterL = box([x + w / 2 - 0.07, y + 0.12, z - 0.22], [x + w / 2, y + 0.24, z + 0.22], mat);
  const wings = race ? both(rotateX(box([x + w / 2 - 0.12, y + 0.55, z - 0.3], [x + w / 2, y + 0.78, z - 0.2], mat), -15, [x, y, z])) : [];
  return [...base, ...back2, ...bolsterL, ...mirrorX(bolsterL), ...wings];
}

/** A steering wheel: a rim torus with three spokes, tilted back. */
function steeringWheel(c: V3, r: number, tilt: number, rimMat = 'black'): Tri[] {
  const ring = lathe(
    [
      [r - 0.017, 0],
      [r, -0.012],
      [r + 0.017, 0],
      [r, 0.012],
      [r - 0.017, 0],
    ],
    [0, 0, 0],
    'z',
    24,
    rimMat,
    false,
  );
  const spokes: Tri[] = [];
  for (const deg of [0, 120, 240]) spokes.push(...rotateZ(box([-0.012, -r * 0.9, -0.006], [0.012, 0, 0.006], 'alloy'), deg));
  spokes.push(...cylinder([0, 0, 0.02], [0, 0, -0.03], 0.03, 12, 'black'));
  return translate(rotateX([...ring, ...spokes], tilt), c);
}

/** A rounded box: a loft of rounded-rectangle rings (cap ends). */
function roundedBox(c: V3, size: V3, square: number, mat: string, n = 16): Tri[] {
  const [sx, sy, sz] = size;
  const rings = [-0.5, -0.45, 0.45, 0.5].map((t, i) => oval(c[0], c[1], c[2] + t * sz, sx * (i === 0 || i === 3 ? 0.9 : 1), sy * (i === 0 || i === 3 ? 0.9 : 1), n, square));
  return loft(rings, mat, { closed: true, capStart: true, capEnd: true });
}

/** A wheel arch: an annular sector in the y-z plane (over the wheel) pulled along x from x0 to x1. */
function arch(cz: number, cy: number, rIn: number, rOut: number, x0: number, x1: number, mat: string, fromDeg = -10, toDeg = 190): Tri[] {
  const pts: V3[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    pts.push([0, cy + Math.sin(a) * rOut, cz + Math.cos(a) * rOut]);
  }
  for (let i = n; i >= 0; i--) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    pts.push([0, cy + Math.sin(a) * rIn, cz + Math.cos(a) * rIn]);
  }
  // Extrude along x: the profile is in (z, y); build with prism along z after a rotation.
  const profile2 = pts.map((p): V2 => [p[2], p[1]]);
  return rotateY(prism(profile2, x0, x1, mat), -90).map((t) => ({ ...t, p: t.p.map((p): V3 => [p[0], p[1], p[2]]) }));
}

interface Part {
  name: string;
  tris: Tri[];
  /** Loop subdivision steps (rounds a hull); 0 for hard-edged pieces. */
  smooth?: number;
}

function finish(parts: Part[]): { name: string; mesh: Mesh }[] {
  return parts.map(({ name, tris, smooth = 0 }) => {
    let mesh = weld(autoUv(tris, 0.5));
    for (let i = 0; i < smooth; i++) mesh = loop(mesh, 38);
    return { name, mesh };
  });
}

// ---------------------------------------------------------------- the crawler buggy

function crawler(): Part[] {
  const AXLE_F = 1.35;
  const AXLE_R = -1.35;
  const TRACK = 0.84; // wheel centre from the middle
  const TYRE_R = 0.47; // 37"
  const RIM_R = 0.215; // 17"
  const TYRE_W = 0.33;
  const FLOOR = 0.56;
  const DECK = 1.06; // the tub's top edge
  const P: Part[] = [];
  const part = (name: string, tris: Tri[], smooth = 0) => P.push({ name, tris, smooth });

  // Tub: rounded-rectangle sections along the car, narrowing at both ends, stepping down over the engine bay.
  const tubRings: V3[][] = [];
  const stations: [number, number, number, number][] = [
    // z, width, bottom, top
    [-1.95, 0.9, FLOOR + 0.08, DECK - 0.12],
    [-1.7, 1.15, FLOOR, DECK],
    [-1.2, 1.3, FLOOR, DECK],
    [-0.4, 1.34, FLOOR, DECK],
    [0.55, 1.32, FLOOR, DECK + 0.02],
    [0.8, 1.2, FLOOR + 0.04, DECK],
    [1.4, 1.05, FLOOR + 0.1, DECK - 0.04],
    [1.9, 0.85, FLOOR + 0.2, DECK - 0.18],
  ];
  for (const [z, w, bottom, top] of stations) tubRings.push(oval(0, (bottom + top) / 2, z, w, top - bottom, 20, 0.82));
  part('body', [...loft(tubRings, 'paint', { closed: true, capStart: true, capEnd: true }), ...box([-0.6, FLOOR + 0.02, -1.0], [0.6, FLOOR + 0.06, 0.5], 'black')], 1);

  // Bonnet: a sloped lid over the engine bay, with a vented race version.
  const hood = (vent: boolean) => {
    const z0 = 0.78;
    const z1 = 1.88;
    const y0 = DECK + 0.03;
    const y1 = DECK - 0.17;
    const tris = slab([-0.55, y0, z0], [0.55, y0, z0], [0.45, y1, z1], [-0.45, y1, z1], 0.02, 'paint');
    return vent ? [...tris, ...rotateX(box([-0.18, y0 - 0.01, z0 + 0.2], [0.18, y0 + 0.07, z0 + 0.55], 'carbon'), 8, [0, y0, z0 + 0.2])] : tris;
  };
  part('hood', hood(false));
  part('hood_race', hood(true));

  // Grille and radiator in the nose.
  part('grille', [...slab([-0.42, DECK - 0.2, 1.91], [0.42, DECK - 0.2, 1.91], [0.42, FLOOR + 0.25, 1.91], [-0.42, FLOOR + 0.25, 1.91], 0.015, 'black'), ...[-0.3, -0.15, 0, 0.15, 0.3].flatMap((x) => box([x - 0.012, FLOOR + 0.26, 1.9], [x + 0.012, DECK - 0.21, 1.93], 'alloy'))]);
  part('radiator', box([-0.4, FLOOR + 0.26, 1.72], [0.4, DECK - 0.22, 1.8], 'black'));

  // Front arches (fenders) and rear arches (quarter panels), flares over all four.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const [x0, x1] = s > 0 ? [0.62, 0.72] : [-0.72, -0.62];
    part(`fender_${side}`, arch(AXLE_F, TYRE_R + 0.02, TYRE_R + 0.12, TYRE_R + 0.2, x0, x1, 'paint'), 1);
    part(`quarter_panel_${side}`, arch(AXLE_R, TYRE_R + 0.02, TYRE_R + 0.12, TYRE_R + 0.2, x0, x1, 'paint'), 1);
  }
  const flares = (wide: number) =>
    [1, -1].flatMap((s) => [AXLE_F, AXLE_R].flatMap((z) => arch(z, TYRE_R + 0.02, TYRE_R + 0.2, TYRE_R + 0.26 + wide * 0.4, s > 0 ? 0.7 : -0.78 - wide, s > 0 ? 0.78 + wide : -0.7, 'black', 0, 180)));
  part('fender_flare', flares(0));
  part('fender_flare_wide', flares(0.1));

  // Roll cage: A hoop, main hoop, roof bars, rear stays, door bars, dash bar, harness bar.
  const R = 0.022;
  const HW = 0.58; // half width of the cage
  const cage: Tri[] = [
    ...tube([[HW, DECK, 0.55], [HW, DECK + 0.62, 0.42], [HW - 0.08, DECK + 0.7, 0.35], [-HW + 0.08, DECK + 0.7, 0.35], [-HW, DECK + 0.62, 0.42], [-HW, DECK, 0.55]], R, 10, 'cage'),
    ...tube([[HW + 0.02, DECK, -0.35], [HW + 0.02, DECK + 0.72, -0.4], [HW - 0.1, DECK + 0.8, -0.42], [-HW + 0.1, DECK + 0.8, -0.42], [-HW - 0.02, DECK + 0.72, -0.4], [-HW - 0.02, DECK, -0.35]], R, 10, 'cage'),
    ...both(tube([[HW - 0.08, DECK + 0.7, 0.35], [HW - 0.1, DECK + 0.8, -0.42]], R, 10, 'cage')),
    ...both(tube([[HW - 0.1, DECK + 0.8, -0.42], [HW - 0.3, DECK + 0.02, -1.55]], R, 10, 'cage')),
    ...both(tube([[HW, DECK + 0.3, 0.5], [HW + 0.02, DECK + 0.1, -0.35]], R * 0.9, 10, 'cage')),
    ...tube([[HW, DECK + 0.4, 0.5], [-HW, DECK + 0.4, 0.5]], R * 0.9, 10, 'cage'),
    ...tube([[HW + 0.02, DECK + 0.45, -0.4], [-HW - 0.02, DECK + 0.45, -0.4]], R * 0.9, 10, 'cage'),
    ...tube([[HW - 0.3, DECK + 0.02, -1.55], [-HW + 0.3, DECK + 0.02, -1.55]], R * 0.9, 10, 'cage'),
  ];
  part('rollcage', cage);
  // Exocage: bars outside the tub, over the arches, with a bumper hoop at each end (the trophy-truck look).
  part(
    'exocage',
    both([
      ...tube([[0.75, FLOOR + 0.1, 1.95], [0.85, DECK + 0.1, 1.5], [0.85, DECK + 0.1, 0.9], [0.9, DECK + 0.2, -0.3], [0.86, DECK + 0.1, -1.0], [0.8, DECK, -1.95]], R, 10, 'cage'),
      ...tube([[0.85, DECK + 0.1, 0.9], [HW, DECK + 0.62, 0.42]], R * 0.9, 10, 'cage'),
      ...tube([[0.9, DECK + 0.2, -0.3], [HW + 0.02, DECK + 0.72, -0.4]], R * 0.9, 10, 'cage'),
      ...tube([[0.85, DECK + 0.1, 1.5], [0.85, FLOOR + 0.05, 1.5]], R * 0.9, 10, 'cage'),
    ]),
  );

  // Tops: a soft canvas top (the car is a convertible: a configuration leaves it off) and a carbon hard top.
  const topRings = [0.42, 0.2, -0.1, -0.42].map((z, i) => {
    const w = HW * 2 - 0.1;
    return [
      [w / 2, DECK + 0.7 + (i === 0 ? 0 : 0.1), z],
      [w / 4, DECK + 0.76 + (i === 0 ? 0 : 0.1), z],
      [-w / 4, DECK + 0.76 + (i === 0 ? 0 : 0.1), z],
      [-w / 2, DECK + 0.7 + (i === 0 ? 0 : 0.1), z],
    ] as V3[];
  });
  part('roof', [...loft(topRings, 'canvas', { closed: false }), ...loft(topRings.map((r) => r.map((p): V3 => [p[0], p[1] - 0.015, p[2]])).reverse(), 'canvas', { closed: false })], 1);
  part('roof_carbon', loft(topRings.map((r, i) => r.map((p): V3 => [p[0] * 1.04, p[1] + (i === 1 || i === 2 ? 0.05 : 0.02), p[2]])), 'carbon', { closed: false }), 1);

  // Windscreen: glass in a tube frame between the A-pillars; a cut-down race screen.
  const screen = (height: number, name: string) => {
    const z0 = 0.55;
    const y0 = DECK + 0.05;
    const glass = slab([HW - 0.06, y0, z0 - 0.02], [-HW + 0.06, y0, z0 - 0.02], [-HW + 0.1, y0 + height, z0 - 0.02 - height * 0.25], [HW - 0.1, y0 + height, z0 - 0.02 - height * 0.25], 0.006, 'glass');
    const frame = tube([[HW - 0.06, y0, z0 - 0.02], [HW - 0.1, y0 + height, z0 - 0.02 - height * 0.25], [-HW + 0.1, y0 + height, z0 - 0.02 - height * 0.25], [-HW + 0.06, y0, z0 - 0.02]], 0.012, 8, 'black');
    part(name, [...glass, ...frame]);
  };
  screen(0.55, 'windshield');
  screen(0.16, 'windshield_cut');

  // Bumpers: tube bumpers front and rear, with off-road (stinger, winch plate), race (low, with a lip) and drift (slim) versions.
  const nose = 1.98;
  const tail = -2.0;
  const tubeBumper = (z: number, dir: 1 | -1, rise: number) =>
    tube([[0.62, FLOOR + 0.15, z - 0.2 * dir], [0.55, FLOOR + 0.15, z], [-0.55, FLOOR + 0.15, z], [-0.62, FLOOR + 0.15, z - 0.2 * dir]], 0.03, 10, 'black').concat(rise ? tube([[0.3, FLOOR + 0.15, z], [0.3, FLOOR + 0.15 + rise, z - 0.05 * dir], [-0.3, FLOOR + 0.15 + rise, z - 0.05 * dir], [-0.3, FLOOR + 0.15, z]], 0.025, 10, 'black') : []);
  part('bumper_F', [...tubeBumper(nose, 1, 0.12), ...box([-0.5, FLOOR + 0.05, nose - 0.16], [0.5, FLOOR + 0.1, nose], 'black')]);
  part('bumper_F_offroad', [
    ...tubeBumper(nose + 0.05, 1, 0),
    ...tube([[0.25, FLOOR + 0.15, nose + 0.05], [0.12, DECK + 0.05, nose + 0.35], [0, DECK + 0.2, nose + 0.1], [-0.12, DECK + 0.05, nose + 0.35], [-0.25, FLOOR + 0.15, nose + 0.05]], 0.028, 10, 'black'),
    ...box([-0.3, FLOOR + 0.02, nose - 0.2], [0.3, FLOOR + 0.3, nose - 0.02], 'alloy'),
    ...cylinder([-0.2, FLOOR + 0.16, nose - 0.11], [0.2, FLOOR + 0.16, nose - 0.11], 0.06, 12, 'black'),
  ]);
  part('bumper_F_race', [...box([-0.6, FLOOR, nose - 0.25], [0.6, FLOOR + 0.22, nose + 0.02], 'paint'), ...box([-0.68, FLOOR - 0.02, nose - 0.3], [0.68, FLOOR + 0.01, nose + 0.12], 'carbon')]);
  part('bumper_F_drift', tube([[0.58, FLOOR + 0.2, nose - 0.15], [0.4, FLOOR + 0.2, nose], [-0.4, FLOOR + 0.2, nose], [-0.58, FLOOR + 0.2, nose - 0.15]], 0.022, 10, 'alloy'));
  part('bumper_R', [...tubeBumper(tail, -1, 0), ...box([-0.5, FLOOR + 0.05, tail], [0.5, FLOOR + 0.1, tail + 0.16], 'black')]);
  part('bumper_R_offroad', [...tubeBumper(tail - 0.05, -1, 0.1), ...both(tube([[0.5, FLOOR + 0.15, tail - 0.05], [0.5, FLOOR - 0.05, tail + 0.3]], 0.025, 10, 'black'))]);
  part('bumper_R_race', [...box([-0.6, FLOOR, tail - 0.02], [0.6, FLOOR + 0.22, tail + 0.25], 'paint'), ...[-0.4, -0.15, 0.15, 0.4].flatMap((x) => box([x - 0.01, FLOOR - 0.08, tail - 0.02], [x + 0.01, FLOOR + 0.02, tail + 0.3], 'carbon'))]);
  part('bull_bar_F', [...tube([[0.45, FLOOR + 0.2, nose + 0.12], [0.45, DECK - 0.02, nose + 0.18], [-0.45, DECK - 0.02, nose + 0.18], [-0.45, FLOOR + 0.2, nose + 0.12]], 0.03, 10, 'alloy'), ...tube([[0.3, FLOOR + 0.5, nose + 0.16], [-0.3, FLOOR + 0.5, nose + 0.16]], 0.025, 10, 'alloy')]);
  part('skidplate_F', slab([-0.5, FLOOR - 0.02, nose - 0.3], [0.5, FLOOR - 0.02, nose - 0.3], [0.5, FLOOR - 0.02, 0.9], [-0.5, FLOOR - 0.02, 0.9], 0.01, 'alloy'));
  part('skidplate_R', slab([-0.5, FLOOR - 0.02, -0.9], [0.5, FLOOR - 0.02, -0.9], [0.5, FLOOR - 0.02, tail + 0.3], [-0.5, FLOOR - 0.02, tail + 0.3], 0.01, 'alloy'));
  part('splitter', box([-0.75, FLOOR - 0.03, nose - 0.5], [0.75, FLOOR - 0.01, nose + 0.2], 'carbon'));
  part('diffuser', [...rotateX(box([-0.6, FLOOR - 0.04, tail - 0.05], [0.6, FLOOR - 0.01, tail + 0.6], 'carbon'), -8, [0, FLOOR, tail + 0.6]), ...[-0.4, 0, 0.4].flatMap((x) => rotateX(box([x - 0.008, FLOOR - 0.04, tail - 0.05], [x + 0.008, FLOOR + 0.08, tail + 0.6], 'carbon'), -8, [0, FLOOR, tail + 0.6]))]);

  // Rock sliders along the sills (side skirts), and tube sliders with a kick-out for off-road.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const x = s * 0.7;
    part(`side_skirt_${side}`, box([x - 0.05, FLOOR - 0.02, -0.75], [x + 0.05, FLOOR + 0.08, 0.75], 'black'));
    part(`side_skirt_${side}_offroad`, [...tube([[x, FLOOR, -0.8], [x, FLOOR, 0.8]], 0.03, 10, 'black'), ...tube([[x + s * 0.12, FLOOR + 0.05, -0.7], [x + s * 0.12, FLOOR + 0.05, 0.7]], 0.03, 10, 'black'), ...[-0.6, 0, 0.6].flatMap((z) => tube([[x, FLOOR, z], [x + s * 0.12, FLOOR + 0.05, z]], 0.02, 8, 'black'))]);
  }

  // Lights: round headlamps in the nose, a light bar on the cage, tail lamps and fog lamps.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    part(`headlight_${side}`, lamp([s * 0.36, DECK - 0.28, nose - 0.12], 0.085, 0.06, 'lamp'));
    part(`foglight_${side}`, lamp([s * 0.45, FLOOR + 0.3, nose - 0.08], 0.045, 0.05, 'lamp'));
    part(`taillight_${side}`, [...box([s * 0.4 - 0.07, DECK - 0.35, tail + 0.02], [s * 0.4 + 0.07, DECK - 0.22, tail + 0.05], 'red'), ...box([s * 0.4 - 0.07, DECK - 0.22, tail + 0.02], [s * 0.4 + 0.07, DECK - 0.17, tail + 0.05], 'lamp')]);
    part(`mirror_${side}`, [...tube([[s * (HW - 0.02), DECK + 0.45, 0.48], [s * (HW + 0.18), DECK + 0.5, 0.46]], 0.012, 8, 'black'), ...box([s * (HW + 0.14) - 0.06, DECK + 0.42, 0.42], [s * (HW + 0.14) + 0.06, DECK + 0.6, 0.45], 'black')]);
    part(`tow_hook_${s > 0 ? 'F' : 'R'}`, lathe([[0.03, -0.02], [0.06, -0.02], [0.06, 0.02], [0.03, 0.02], [0.03, -0.02]], [s > 0 ? 0.35 : -0.35, FLOOR + 0.1, s > 0 ? nose + 0.04 : tail - 0.04], 'z', 12, 'red', false));
    part(`mudflap_R${side}`, slab([s * 0.95, TYRE_R + 0.1, AXLE_R - 0.5], [s * 0.6, TYRE_R + 0.1, AXLE_R - 0.5], [s * 0.6, 0.25, AXLE_R - 0.55], [s * 0.95, 0.25, AXLE_R - 0.55], 0.008, 'black'));
  }
  part('light_bar', [...box([-0.5, DECK + 0.78, 0.3], [0.5, DECK + 0.86, 0.38], 'black'), ...[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].flatMap((x) => lamp([x, DECK + 0.82, 0.38], 0.035, 0.03, 'lamp'))]);

  // Doors: half doors hinged at the front; tube doors for racing.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const x = s * (0.66 + 0.01);
    part(`door_F${side}`, slab([x, DECK + 0.02, 0.48], [x, DECK + 0.02, -0.32], [x, FLOOR + 0.3, -0.32], [x, FLOOR + 0.3, 0.48], 0.02 * (s > 0 ? 1 : -1), 'paint'));
    part(`door_F${side}_race`, [...tube([[x, DECK, 0.46], [x, DECK + 0.02, -0.3], [x, FLOOR + 0.35, -0.3], [x, FLOOR + 0.35, 0.46], [x, DECK, 0.46]], 0.018, 8, 'cage'), ...tube([[x, DECK, 0.46], [x, FLOOR + 0.35, -0.3]], 0.015, 8, 'cage')]);
  }
  part('tailgate', slab([-0.52, DECK - 0.02, tail + 0.03], [0.52, DECK - 0.02, tail + 0.03], [0.5, FLOOR + 0.3, tail + 0.08], [-0.5, FLOOR + 0.3, tail + 0.08], 0.02, 'paint'));

  // Interior: seats, dashboard with gauges, steering wheel, shifter, harness bar pads.
  for (const s of [1, -1] as const) {
    const c = s > 0 ? 'FL' : 'FR';
    part(`seat_${c}`, bucketSeat([s * 0.33, FLOOR + 0.12, -0.15], false));
    part(`seat_${c}_race`, bucketSeat([s * 0.33, FLOOR + 0.12, -0.15], true));
  }
  part('dashboard', [...box([-0.55, DECK - 0.1, 0.35], [0.55, DECK + 0.08, 0.6], 'black'), ...rotateX(box([0.12, DECK + 0.08, 0.4], [0.55, DECK + 0.2, 0.55], 'black'), 10, [0, DECK + 0.08, 0.55])]);
  part('gauges', [-0.1, 0.07, 0.24].flatMap((dx) => lamp([0.33 + dx, DECK + 0.14, 0.42], 0.035, 0.015, 'gauge', '-z')));
  part('steering_wheel', steeringWheel([0.33, DECK + 0.12, 0.2], 0.17, -25));
  part('shifter', [...tube([[0.02, FLOOR + 0.2, 0.1], [0.05, FLOOR + 0.55, 0.05]], 0.012, 8, 'alloy'), ...sphere([0.05, FLOOR + 0.57, 0.05], 0.03, 8, 'black')]);

  // Rear: fuel cell, spare wheel on a carrier, exhaust, snorkel, antenna, wings.
  part('fuel_tank', [...roundedBox([0, FLOOR + 0.25, -1.3], [0.8, 0.36, 0.45], 0.7, 'alloy'), ...cylinder([0.2, FLOOR + 0.44, -1.3], [0.2, FLOOR + 0.5, -1.3], 0.05, 12, 'black')]);
  part('spare_wheel_carrier', [...tube([[0.45, DECK - 0.05, tail + 0.02], [0.45, DECK + 0.55, tail - 0.08], [-0.45, DECK + 0.55, tail - 0.08], [-0.45, DECK - 0.05, tail + 0.02]], 0.025, 10, 'black'), ...box([-0.1, DECK + 0.1, tail - 0.2], [0.1, DECK + 0.5, tail - 0.1], 'black')]);
  const spare = wheelAndTyre([0, 0, 0], TYRE_R * 0.95, RIM_R, TYRE_W * 0.9);
  part('spare_wheel', translate(rotateY([...spare.tire, ...spare.wheel], 90), [0, DECK + 0.28, tail - 0.3]));
  const exhaust = (big: boolean) => [
    ...tube([[0.3, FLOOR + 0.05, 0.9], [0.55, FLOOR + 0.05, 0.3], [0.62, FLOOR + 0.1, -0.2], [0.75, FLOOR + 0.12, -0.5]], big ? 0.035 : 0.025, 10, 'chrome'),
    ...cylinder([0.75, FLOOR + 0.12, -0.5], [0.95, FLOOR + 0.12, -0.75], big ? 0.06 : 0.04, 12, 'chrome'),
    ...(big ? [] : roundedBox([0.58, FLOOR + 0.08, 0.0], [0.18, 0.14, 0.45], 0.6, 'alloy')),
  ];
  part('exhaust', exhaust(false));
  part('exhaust_race', exhaust(true));
  part('snorkel', [...tube([[-HW - 0.03, DECK - 0.1, 0.75], [-HW - 0.03, DECK + 0.55, 0.45], [-HW - 0.03, DECK + 0.78, 0.4]], 0.035, 10, 'black'), ...rotateX(box([-HW - 0.1, DECK + 0.75, 0.3], [-HW + 0.04, DECK + 0.9, 0.5], 'black'), 20, [-HW, DECK + 0.75, 0.4])]);
  part('antenna', tube([[-0.5, DECK - 0.02, -1.6], [-0.55, DECK + 0.9, -1.75]], 0.006, 6, 'black'));
  const wing = (span: number, height: number, chord: number) => [
    ...both(box([0.32, DECK + height - 0.3, tail + 0.25], [0.35, DECK + height, tail + 0.45], 'carbon')),
    ...rotateX(box([-span / 2, DECK + height, tail + 0.2], [span / 2, DECK + height + 0.03, tail + 0.2 + chord], 'carbon'), -12, [0, DECK + height, tail + 0.2 + chord]),
    ...both(box([span / 2 - 0.01, DECK + height - 0.06, tail + 0.15], [span / 2 + 0.01, DECK + height + 0.12, tail + 0.25 + chord], 'carbon')),
  ];
  part('wing', wing(1.1, 0.35, 0.25));
  part('wing_race', wing(1.4, 0.6, 0.35));

  // Wheels and tyres: 37" on 17" beadlocks.
  for (const [corner, x, z] of [
    ['FL', TRACK, AXLE_F],
    ['FR', -TRACK, AXLE_F],
    ['RL', TRACK, AXLE_R],
    ['RR', -TRACK, AXLE_R],
  ] as const) {
    const w = wheelAndTyre([x, TYRE_R, z], TYRE_R, RIM_R, TYRE_W, 8);
    part(`tire_${corner}`, w.tire);
    part(`wheel_${corner}`, w.wheel);
  }
  return P;
}

// ---------------------------------------------------------------- the Grand Prix car

function grandPrix(): Part[] {
  const AXLE_F = 1.15;
  const AXLE_R = -1.15;
  const TRACK_F = 0.63;
  const TRACK_R = 0.62;
  const TYRE_RF = 0.3;
  const TYRE_RR = 0.33;
  const RIM_R = 0.19; // 15"
  const FLOOR = 0.1;
  const P: Part[] = [];
  const part = (name: string, tris: Tri[], smooth = 0) => P.push({ name, tris, smooth });

  /** A body ring: a rounded section, flatter underneath; at the cockpit stations the top is dished into the seat well. */
  const ring = (z: number, w: number, h: number, well = 0): V3[] =>
    oval(0, FLOOR + h * 0.45, z, w, h, 24, 0.2, 0.8).map((p): V3 => {
      const sill = FLOOR + h * 0.6;
      if (!well || p[1] < sill || Math.abs(p[0]) > 0.24) return p;
      const t = 1 - Math.abs(p[0]) / 0.24; // 1 at the middle
      return [p[0], sill + (p[1] - sill) * 0.2 - well * t, p[2]];
    });
  const stations: [number, number, number, number][] = [
    // z, width, height, seat well depth
    [-1.2, 0.5, 0.36, 0],
    [-0.95, 0.66, 0.5, 0],
    [-0.7, 0.76, 0.58, 0],
    [-0.5, 0.8, 0.62, 0.05],
    [-0.3, 0.82, 0.64, 0.16],
    [-0.05, 0.84, 0.64, 0.18],
    [0.2, 0.84, 0.62, 0.14],
    [0.42, 0.8, 0.6, 0.04],
    [0.65, 0.76, 0.56, 0],
    [0.95, 0.68, 0.5, 0],
    [1.3, 0.56, 0.42, 0],
  ];
  const bodyRings = stations.map(([z, w, h, well]) => ring(z, w, h, well));
  part('body', loft(bodyRings, 'paint', { closed: true, capStart: true, capEnd: true }), 1);
  // Cockpit surround: a padded ring at the sill.
  part('interior_trim', tube([[0.26, FLOOR + 0.42, 0.42], [0.26, FLOOR + 0.42, -0.4], [-0.26, FLOOR + 0.42, -0.4], [-0.26, FLOOR + 0.42, 0.42], [0.26, FLOOR + 0.42, 0.42]], 0.02, 8, 'cloth'));

  // Nose cones (bumper_F), lofted on from the body's front ring: classic rounded with a radiator mouth, race shark nose
  // with winglets, off-road blunt nose with a bash bar, drift nose with a chin.
  const frontRing = bodyRings[bodyRings.length - 1]!;
  const noseZ = 1.3;
  const nose = (len: number, blunt: number) => {
    const rings = [frontRing];
    for (const [t, s] of [
      [0.3, 0.86],
      [0.6, 0.66],
      [0.85, 0.4 + 0.2 * blunt],
      [1, 0.1 + 0.5 * blunt],
    ] as const)
      rings.push(ring(noseZ + len * t, 0.56 * s, 0.42 * s * (1 - 0.1 * t), 0).map((p): V3 => [p[0], p[1] - 0.05 * t, p[2]]));
    const tip = noseZ + len;
    return [...loft(rings, 'paint', { closed: true, capEnd: true }), ...polygon(ring(tip + 0.003, 0.56 * (0.1 + 0.5 * blunt) * 0.8, 0.42 * (0.1 + 0.5 * blunt) * 0.7, 0).map((p): V3 => [p[0], p[1] - 0.05, p[2]]), 'black')];
  };
  part('bumper_F', nose(0.65, 0.3), 1);
  part('bumper_F_race', [...nose(0.8, 0.05), ...both(rotateX(box([0.28, FLOOR + 0.1, noseZ + 0.35], [0.74, FLOOR + 0.125, noseZ + 0.6], 'carbon'), 5, [0, FLOOR + 0.1, noseZ + 0.6]))], 1);
  part('bumper_F_offroad', [...nose(0.45, 1), ...tube([[0.3, FLOOR + 0.1, noseZ + 0.3], [0.3, FLOOR + 0.1, noseZ + 0.62], [-0.3, FLOOR + 0.1, noseZ + 0.62], [-0.3, FLOOR + 0.1, noseZ + 0.3]], 0.025, 10, 'black'), ...tube([[0.2, FLOOR + 0.1, noseZ + 0.62], [0.2, FLOOR + 0.4, noseZ + 0.55], [-0.2, FLOOR + 0.4, noseZ + 0.55], [-0.2, FLOOR + 0.1, noseZ + 0.62]], 0.02, 10, 'black')], 1);
  part('bumper_F_drift', [...nose(0.5, 0.5), ...box([-0.34, FLOOR - 0.02, noseZ + 0.1], [0.34, FLOOR + 0.02, noseZ + 0.62], 'carbon')], 1);
  // Tails (bumper_R) from the body's rear ring: rounded, Kamm (cut-off) race tail, blunt with a tube bar.
  const rearRing = bodyRings[0]!;
  const tailZ = -1.2;
  const tail = (len: number, blunt: number) => {
    const rings: V3[][] = [];
    for (const [t, s] of [
      [1, 0.12 + 0.6 * blunt],
      [0.8, 0.5 + 0.3 * blunt],
      [0.4, 0.8],
    ] as const)
      rings.push(ring(tailZ - len * t, 0.5 * s, 0.36 * s, 0));
    rings.push(rearRing);
    return loft(rings, 'paint', { closed: true, capStart: true });
  };
  const noseStart = noseZ + 0.3;
  const tailStart = tailZ - 0.1;
  part('bumper_R', tail(0.4, 0.3), 1);
  part('bumper_R_race', [...tail(0.2, 1), ...box([-0.25, FLOOR + 0.04, tailZ - 0.25], [0.25, FLOOR + 0.3, tailZ - 0.21], 'carbon')], 1);
  part('bumper_R_offroad', [...tail(0.3, 0.6), ...tube([[0.3, FLOOR + 0.12, tailZ], [0.3, FLOOR + 0.12, tailZ - 0.4], [-0.3, FLOOR + 0.12, tailZ - 0.4], [-0.3, FLOOR + 0.12, tailZ]], 0.025, 10, 'black')], 1);

  // Engine cover: a lid over the engine bay (left off to show the engine), with a bulge; intake trumpets through it.
  // A hump over the engine running into the driver's headrest fairing, sitting on the deck.
  part(
    'engine_cover',
    loft(
      [
        [-1.05, 0.26, 0.04],
        [-0.95, 0.4, 0.16],
        [-0.8, 0.46, 0.24],
        [-0.62, 0.44, 0.28],
        [-0.48, 0.34, 0.32],
        [-0.4, 0.24, 0.3],
        [-0.36, 0.14, 0.12],
      ].map(([z, w, h]) => oval(0, FLOOR + 0.5, z!, w!, h! * 2, 16, 0.3).filter((p) => p[1] >= FLOOR + 0.5 - 0.001).map((p): V3 => [p[0], Math.max(p[1], FLOOR + 0.5), p[2]])),
      'paint',
      { closed: false, capStart: true, capEnd: true },
    ),
    1,
  );
  part('intake', [0.12, 0.04, -0.04, -0.12].flatMap((x) => lathe([[0.02, 0], [0.02, 0.08], [0.045, 0.14], [0.05, 0.145]], [x, FLOOR + 0.52, -0.72], 'y', 12, 'alloy', false)));
  part('intake_race', [...roundedBox([0, FLOOR + 0.62, -0.72], [0.36, 0.14, 0.3], 0.5, 'carbon'), ...rotateX(lathe([[0.001, 0], [0.09, 0], [0.1, 0.25], [0.11, 0.26]], [0, FLOOR + 0.62, -0.57], 'z', 14, 'carbon', false), 0)]);

  // Roll hoop behind the driver, and a full cage for the off-road versions.
  part('rollbar', [...tube([[0.26, FLOOR + 0.4, -0.42], [0.26, FLOOR + 0.92, -0.45], [0.18, FLOOR + 1.0, -0.46], [-0.18, FLOOR + 1.0, -0.46], [-0.26, FLOOR + 0.92, -0.45], [-0.26, FLOOR + 0.4, -0.42]], 0.02, 10, 'cage'), ...both(tube([[0.22, FLOOR + 0.95, -0.45], [0.2, FLOOR + 0.5, -0.9]], 0.016, 8, 'cage'))]);
  part('rollcage', [
    ...tube([[0.34, FLOOR + 0.4, 0.45], [0.34, FLOOR + 0.95, 0.3], [-0.34, FLOOR + 0.95, 0.3], [-0.34, FLOOR + 0.4, 0.45]], 0.02, 10, 'cage'),
    ...tube([[0.34, FLOOR + 0.4, -0.42], [0.34, FLOOR + 1.0, -0.46], [-0.34, FLOOR + 1.0, -0.46], [-0.34, FLOOR + 0.4, -0.42]], 0.02, 10, 'cage'),
    ...both(tube([[0.34, FLOOR + 0.95, 0.3], [0.34, FLOOR + 1.0, -0.46], [0.28, FLOOR + 0.5, -1.05]], 0.018, 10, 'cage')),
    ...tube([[0.34, FLOOR + 0.95, 0.3], [-0.34, FLOOR + 0.95, 0.3]], 0.018, 10, 'cage'),
  ]);
  part('light_bar', [...box([-0.3, FLOOR + 1.06, -0.5], [0.3, FLOOR + 1.12, -0.44], 'black'), ...[-0.22, -0.08, 0.08, 0.22].flatMap((x) => lamp([x, FLOOR + 1.09, -0.44], 0.028, 0.025, 'lamp'))]);

  // Windscreen: a wrap-round perspex screen on the cowl; a tiny deflector for racing.
  const screen = (h: number, name: string) => {
    const rings = [0, 1].map((k) => [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map((x): V3 => [x, FLOOR + 0.52 + k * h, 0.55 - Math.abs(x) * 0.5 - k * h * 0.5]));
    part(name, [...loft(rings, 'glass', { closed: false }), ...loft(rings.map((r) => r.map((p): V3 => [p[0], p[1], p[2] - 0.005])).reverse(), 'glass', { closed: false })]);
  };
  screen(0.2, 'windshield');
  screen(0.07, 'windshield_cut');

  // Driver's office: a reclined seat, a wood-rimmed wheel, a small dash with three dials, a gear lever to the right.
  part('seat_FL', translate(rotateX(bucketSeat([0, 0, 0], false), 20), [0, FLOOR + 0.12, -0.1]));
  part('seat_FL_race', translate(rotateX(bucketSeat([0, 0, 0], true), 20), [0, FLOOR + 0.12, -0.1]));
  part('dashboard', rotateX(box([-0.28, FLOOR + 0.42, 0.42], [0.28, FLOOR + 0.56, 0.52], 'black'), 15, [0, FLOOR + 0.42, 0.52]));
  part('gauges', [-0.1, 0, 0.1].flatMap((x) => lamp([x, FLOOR + 0.5, 0.42], 0.03, 0.012, 'gauge', '-z')));
  part('steering_wheel', steeringWheel([0, FLOOR + 0.45, 0.2], 0.18, -35, 'wood'));
  part('shifter', [...tube([[-0.3, FLOOR + 0.3, 0.05], [-0.33, FLOOR + 0.5, 0.0]], 0.01, 8, 'alloy'), ...sphere([-0.33, FLOOR + 0.52, 0], 0.025, 8, 'black')]);
  part('mirror_L', [...tube([[0.3, FLOOR + 0.5, 0.5], [0.42, FLOOR + 0.6, 0.5]], 0.008, 8, 'black'), ...lamp([0.42, FLOOR + 0.6, 0.5], 0.04, 0.02, 'chrome', '-z')]);
  part('mirror_R', mirrorX(P[P.length - 1]!.tris));

  // Fuel: pannier tanks either side of the cockpit (one part), with filler caps.
  part('fuel_tank', [...both(roundedBox([0.36, FLOOR + 0.3, 0.1], [0.14, 0.3, 0.7], 0.8, 'alloy')), ...both(cylinder([0.36, FLOOR + 0.44, 0.0], [0.36, FLOOR + 0.49, 0.0], 0.04, 12, 'chrome'))]);

  // Exhausts: megaphones out the back on both sides; race bundles (4 into 1) each side.
  part('exhaust', both([...tube([[0.2, FLOOR + 0.25, -0.9], [0.24, FLOOR + 0.22, -1.2], [0.24, FLOOR + 0.22, -1.6]], 0.025, 10, 'chrome'), ...lathe([[0.025, 0], [0.05, 0.25], [0.052, 0.26]], [0.24, FLOOR + 0.22, -1.6], 'z', 12, 'chrome', false).map((t) => ({ ...t, p: t.p.map((p): V3 => [p[0], p[1], -1.6 - (p[2] + 1.6)]) }))]));
  part('exhaust_race', both([...[0.14, 0.2, 0.26, 0.32].flatMap((x) => tube([[x, FLOOR + 0.35, -0.75], [x, FLOOR + 0.25, -1.0], [0.23, FLOOR + 0.2, -1.25]], 0.018, 8, 'chrome')), ...tube([[0.23, FLOOR + 0.2, -1.25], [0.23, FLOOR + 0.2, -1.7]], 0.035, 10, 'chrome')]));

  // Wings and aero: a low rear wing on struts, a tall race wing, a nose wing (splitter) and a rear diffuser; side pods.
  const rearWing = (height: number, span: number, chord: number) => [
    ...both(tube([[0.28, FLOOR + 0.45, -0.95], [0.3, FLOOR + height, -1.05]], 0.015, 8, 'alloy')),
    ...rotateX(box([-span / 2, FLOOR + height, -1.15], [span / 2, FLOOR + height + 0.025, -1.15 + chord], 'carbon'), -15, [0, FLOOR + height, -1.15 + chord]),
    ...both(box([span / 2 - 0.01, FLOOR + height - 0.05, -1.18], [span / 2 + 0.01, FLOOR + height + 0.1, -1.1 + chord], 'carbon')),
  ];
  part('wing', rearWing(0.7, 1.1, 0.22));
  part('wing_race', rearWing(1.15, 1.3, 0.3));
  part('splitter', [...both(box([0.2, FLOOR + 0.1, noseStart + 0.1], [0.72, FLOOR + 0.125, noseStart + 0.35], 'carbon')), ...both(box([0.71, FLOOR + 0.06, noseStart + 0.05], [0.73, FLOOR + 0.2, noseStart + 0.4], 'carbon'))]);
  part('diffuser', [...rotateX(box([-0.35, FLOOR - 0.02, -1.55], [0.35, FLOOR, -1.0], 'carbon'), -10, [0, FLOOR, -1.0]), ...[-0.25, 0, 0.25].flatMap((x) => rotateX(box([x - 0.006, FLOOR - 0.02, -1.55], [x + 0.006, FLOOR + 0.1, -1.0], 'carbon'), -10, [0, FLOOR, -1.0]))]);
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    part(`side_skirt_${side}`, box([s * 0.44 - 0.03, FLOOR + 0.05, -0.6], [s * 0.44 + 0.03, FLOOR + 0.12, 0.6], 'black'));
    part(`side_skirt_${side}_race`, roundedBox([s * 0.6, FLOOR + 0.22, -0.3], [0.34, 0.3, 1.0], 0.7, 'paint'), 1);
    // Cycle wings over the wheels for the dirt versions; mud flaps behind the rears.
    const archX = s > 0 ? [TRACK_F - 0.09, TRACK_F + 0.09] : [-TRACK_F - 0.09, -TRACK_F + 0.09];
    part(`fender_${side}`, arch(AXLE_F, TYRE_RF, TYRE_RF + 0.035, TYRE_RF + 0.06, archX[0]!, archX[1]!, 'paint', 30, 150), 1);
    const archXR = s > 0 ? [TRACK_R - 0.12, TRACK_R + 0.12] : [-TRACK_R - 0.12, -TRACK_R + 0.12];
    part(`quarter_panel_${side}`, arch(AXLE_R, TYRE_RR, TYRE_RR + 0.035, TYRE_RR + 0.06, archXR[0]!, archXR[1]!, 'paint', 30, 150), 1);
    part(`mudflap_R${side}`, slab([s * (TRACK_R + 0.12), TYRE_RR + 0.05, AXLE_R - 0.38], [s * (TRACK_R - 0.12), TYRE_RR + 0.05, AXLE_R - 0.38], [s * (TRACK_R - 0.12), 0.12, AXLE_R - 0.42], [s * (TRACK_R + 0.12), 0.12, AXLE_R - 0.42], 0.006, 'black'));
    part(`headlight_${side}`, lamp([s * 0.22, FLOOR + 0.32, noseStart + 0.15], 0.07, 0.05, 'lamp'));
    part(`taillight_${side}`, box([s * 0.2 - 0.04, FLOOR + 0.2, tailStart - 0.02], [s * 0.2 + 0.04, FLOOR + 0.26, tailStart + 0.02], 'red'));
  }
  part('skidplate_F', slab([-0.3, FLOOR - 0.015, noseStart + 0.4], [0.3, FLOOR - 0.015, noseStart + 0.4], [0.3, FLOOR - 0.015, 0.4], [-0.3, FLOOR - 0.015, 0.4], 0.008, 'alloy'));
  part('skidplate_R', slab([-0.3, FLOOR - 0.015, -0.4], [0.3, FLOOR - 0.015, -0.4], [0.3, FLOOR - 0.015, -1.5], [-0.3, FLOOR - 0.015, -1.5], 0.008, 'alloy'));
  part('radiator', box([-0.17, FLOOR + 0.08, noseStart + 0.1], [0.17, FLOOR + 0.3, noseStart + 0.16], 'black'));
  part('grille', lathe([[0.1, 0], [0.16, 0], [0.16, 0.02], [0.1, 0.02], [0.1, 0]], [0, FLOOR + 0.19, noseStart + 0.58], 'z', 16, 'chrome', false));
  part('tow_hook_F', lathe([[0.02, -0.01], [0.04, -0.01], [0.04, 0.01], [0.02, 0.01], [0.02, -0.01]], [0, FLOOR + 0.1, noseStart + 0.62], 'z', 10, 'red', false));
  part('tow_hook_R', lathe([[0.02, -0.01], [0.04, -0.01], [0.04, 0.01], [0.02, 0.01], [0.02, -0.01]], [0, FLOOR + 0.1, tailStart - 0.3], 'z', 10, 'red', false));
  part('antenna', tube([[-0.2, FLOOR + 0.5, -0.5], [-0.25, FLOOR + 1.1, -0.6]], 0.004, 6, 'black'));
  part('snorkel', [...tube([[0.35, FLOOR + 0.5, -0.6], [0.4, FLOOR + 0.95, -0.7]], 0.03, 10, 'black'), ...rotateX(box([0.33, FLOOR + 0.93, -0.78], [0.47, FLOOR + 1.05, -0.62], 'black'), 15, [0.4, FLOOR + 0.93, -0.7])]);
  part('mudflap_FL', slab([TRACK_F + 0.09, TYRE_RF + 0.05, AXLE_F - 0.32], [TRACK_F - 0.09, TYRE_RF + 0.05, AXLE_F - 0.32], [TRACK_F - 0.09, 0.12, AXLE_F - 0.36], [TRACK_F + 0.09, 0.12, AXLE_F - 0.36], 0.006, 'black'));
  part('mudflap_FR', mirrorX(P[P.length - 1]!.tris));

  // Wheels: tall and narrow at the front, wider at the back, wire-look spokes.
  for (const [corner, x, z, r, w] of [
    ['FL', TRACK_F, AXLE_F, TYRE_RF, 0.15],
    ['FR', -TRACK_F, AXLE_F, TYRE_RF, 0.15],
    ['RL', TRACK_R, AXLE_R, TYRE_RR, 0.21],
    ['RR', -TRACK_R, AXLE_R, TYRE_RR, 0.21],
  ] as const) {
    const wt = wheelAndTyre([x, r, z], r, RIM_R, w, 12, 'chrome');
    part(`tire_${corner}`, wt.tire);
    part(`wheel_${corner}`, wt.wheel);
  }
  return P;
}

// ---------------------------------------------------------------- write

const MATERIALS = (paint: [number, number, number], paint2: [number, number, number]): Record<string, [number, number, number, number, number?]> => ({
  paint: [...paint, 300],
  paint2: [...paint2, 300],
  black: [0.04, 0.04, 0.045, 30],
  cage: [0.12, 0.12, 0.13, 120],
  alloy: [0.6, 0.6, 0.58, 150],
  chrome: [0.5, 0.51, 0.53, 600],
  rubber: [0.03, 0.03, 0.03, 10],
  glass: [0.06, 0.08, 0.09, 400, 0.4],
  lamp: [0.9, 0.92, 0.95, 500],
  red: [0.6, 0.03, 0.03, 200],
  gauge: [0.9, 0.88, 0.8, 100],
  cloth: [0.16, 0.14, 0.12, 8],
  carbon: [0.09, 0.09, 0.1, 200],
  canvas: [0.2, 0.19, 0.16, 6],
  wood: [0.45, 0.28, 0.14, 120],
});

const CARS: { folder: string; file: string; title: string; build: () => Part[]; paint: [number, number, number]; paint2: [number, number, number] }[] = [
  { folder: 'crawler', file: 'forge_crawler', title: 'Forge Crawler: a rock-crawling buggy with a removable top', build: crawler, paint: [0.8, 0.35, 0.05], paint2: [0.1, 0.1, 0.1] },
  { folder: 'gp60', file: 'forge_gp60', title: 'Forge GP60: an early-1960s style Grand Prix car', build: grandPrix, paint: [0.05, 0.3, 0.12], paint2: [0.85, 0.75, 0.2] },
];

for (const car of CARS) {
  const dir = join(OUT, car.folder);
  mkdirSync(dir, { recursive: true });
  const parts = finish(car.build());
  const triangles = writeObj(join(dir, `${car.file}.obj`), parts, `${car.file}.mtl`, [car.title, 'Made by scripts/dev/buildShowcaseCars.mts (JBeam Forge)']);
  writeFileSync(join(dir, `${car.file}.mtl`), mtlText(MATERIALS(car.paint, car.paint2)));
  console.log(`${car.file}: ${parts.length} parts, ${triangles.toLocaleString()} triangles → ${dir}`);
}

// Unused helpers kept for hand edits of the cars.
void quad;
void polygon;
