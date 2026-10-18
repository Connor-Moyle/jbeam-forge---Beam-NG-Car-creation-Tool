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
function lamp(c: V3, r: number, depth: number, lens: string, facing: 'z' | '-z' = 'z', housing = 'lamp_housing'): Tri[] {
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
    housing,
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
    part(`taillight_${side}`, [...box([s * 0.4 - 0.07, DECK - 0.35, tail + 0.02], [s * 0.4 + 0.07, DECK - 0.22, tail + 0.05], 'taillamp'), ...box([s * 0.4 - 0.07, DECK - 0.22, tail + 0.02], [s * 0.4 + 0.07, DECK - 0.17, tail + 0.05], 'lamp')]);
    part(`mirror_${side}`, [...tube([[s * (HW - 0.02), DECK + 0.45, 0.48], [s * (HW + 0.18), DECK + 0.5, 0.46]], 0.012, 8, 'black'), ...box([s * (HW + 0.14) - 0.06, DECK + 0.42, 0.42], [s * (HW + 0.14) + 0.06, DECK + 0.6, 0.45], 'black')]);
    part(`tow_hook_${s > 0 ? 'F' : 'R'}`, lathe([[0.03, -0.02], [0.06, -0.02], [0.06, 0.02], [0.03, 0.02], [0.03, -0.02]], [s > 0 ? 0.35 : -0.35, FLOOR + 0.1, s > 0 ? nose + 0.04 : tail - 0.04], 'z', 12, 'red', false));
    part(`mudflap_R${side}`, slab([s * 0.95, TYRE_R + 0.1, AXLE_R - 0.5], [s * 0.6, TYRE_R + 0.1, AXLE_R - 0.5], [s * 0.6, 0.25, AXLE_R - 0.55], [s * 0.95, 0.25, AXLE_R - 0.55], 0.008, 'black'));
  }
  part('light_bar', [...box([-0.5, DECK + 0.78, 0.3], [0.5, DECK + 0.86, 0.38], 'lamp_housing'), ...[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].flatMap((x) => lamp([x, DECK + 0.82, 0.38], 0.035, 0.03, 'lamp'))]);

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
  part('gauges', [-0.1, 0.07, 0.24].flatMap((dx) => lamp([0.33 + dx, DECK + 0.14, 0.42], 0.035, 0.015, 'gauge', '-z', 'black')));
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
  part('light_bar', [...box([-0.3, FLOOR + 1.06, -0.5], [0.3, FLOOR + 1.12, -0.44], 'lamp_housing'), ...[-0.22, -0.08, 0.08, 0.22].flatMap((x) => lamp([x, FLOOR + 1.09, -0.44], 0.028, 0.025, 'lamp'))]);

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
  part('gauges', [-0.1, 0, 0.1].flatMap((x) => lamp([x, FLOOR + 0.5, 0.42], 0.03, 0.012, 'gauge', '-z', 'black')));
  part('steering_wheel', steeringWheel([0, FLOOR + 0.45, 0.2], 0.18, -35, 'wood'));
  part('shifter', [...tube([[-0.3, FLOOR + 0.3, 0.05], [-0.33, FLOOR + 0.5, 0.0]], 0.01, 8, 'alloy'), ...sphere([-0.33, FLOOR + 0.52, 0], 0.025, 8, 'black')]);
  part('mirror_L', [...tube([[0.3, FLOOR + 0.5, 0.5], [0.42, FLOOR + 0.6, 0.5]], 0.008, 8, 'black'), ...lamp([0.42, FLOOR + 0.6, 0.5], 0.04, 0.02, 'chrome', '-z', 'black')]);
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
    part(`taillight_${side}`, box([s * 0.2 - 0.04, FLOOR + 0.2, tailStart - 0.02], [s * 0.2 + 0.04, FLOOR + 0.26, tailStart + 0.02], 'taillamp'));
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

// ---------------------------------------------------------------- shared pieces for the road cars

/** A seat in two meshes the power-seat script can move: the cushion (slides) and the backrest (reclines). */
function seatParts(c: V3, w: number, mat: string): { cushion: Tri[]; backrest: Tri[] } {
  const [x, y, z] = c;
  const cushion = [...box([x - w / 2, y, z - 0.25], [x + w / 2, y + 0.12, z + 0.25], mat), ...box([x - w / 2 + 0.03, y - 0.1, z - 0.2], [x + w / 2 - 0.03, y, z + 0.2], 'black')];
  const back = rotateX(box([x - w / 2, y + 0.1, z - 0.26], [x + w / 2, y + 0.72, z - 0.19], mat), -14, [x, y + 0.1, z - 0.22]);
  const rest = rotateX(box([x - 0.14, y + 0.74, z - 0.27], [x + 0.14, y + 0.86, z - 0.2], mat), -14, [x, y + 0.1, z - 0.22]);
  return { cushion, backrest: [...back, ...rest] };
}

/** A gauge needle: a thin bar from the dial's centre, lying in the dial's plane (facing −z, the driver). */
const needle = (c: V3, len: number): Tri[] => box([c[0] - 0.003, c[1] - 0.004, c[2] - 0.004], [c[0] + 0.003, c[1] + len, c[2] + 0.004], 'red');
/** A pedal: a pad on an arm hanging from the bulkhead. */
const pedal = (c: V3): Tri[] => [...box([c[0] - 0.035, c[1] - 0.03, c[2] - 0.01], [c[0] + 0.035, c[1] + 0.03, c[2] + 0.01], 'black'), ...box([c[0] - 0.008, c[1], c[2] - 0.01], [c[0] + 0.008, c[1] + 0.22, c[2] + 0.06], 'alloy')];
/** A dash with four round dials (needles are separate meshes) on the driver's side. */
function dashAndDials(y: number, z: number, xDriver: number, w: number): { dashboard: Tri[]; gauges: Tri[]; needles: Record<'speedo_needle' | 'tacho_needle' | 'fuel_needle' | 'temp_needle', Tri[]> } {
  const dashboard = [...box([-w / 2, y, z], [w / 2, y + 0.22, z + 0.35], 'black'), ...rotateX(box([xDriver - 0.22, y + 0.22, z + 0.05], [xDriver + 0.22, y + 0.36, z + 0.2], 'black'), 10, [0, y + 0.22, z + 0.2])];
  const dials: [number, number][] = [
    [xDriver - 0.1, 0.045],
    [xDriver + 0.1, 0.045],
    [xDriver - 0.19, 0.025],
    [xDriver + 0.19, 0.025],
  ];
  const gauges = dials.flatMap(([x, r]) => lamp([x, y + 0.29, z + 0.08], r, 0.012, 'gauge', '-z', 'black'));
  const n = (i: number): Tri[] => needle([dials[i]![0], y + 0.29, z + 0.06], dials[i]![1] * 0.85);
  return { dashboard, gauges, needles: { speedo_needle: n(0), tacho_needle: n(1), fuel_needle: n(2), temp_needle: n(3) } };
}
/** A door: the outer skin (with a sill and a window frame) in one mesh. */
function doorSkin(x: number, side: 1 | -1, z0: number, z1: number, yBottom: number, yBelt: number, yTop: number, frame = true): Tri[] {
  const t = 0.02 * side;
  const out = slab([x, yBelt, z0], [x, yBelt, z1], [x, yBottom, z1], [x, yBottom, z0], t, 'paint');
  if (!frame) return out;
  const w = 0.03;
  const post = (z: number) => box([x - 0.02, yBelt, z - w / 2], [x + 0.02, yTop, z + w / 2], 'black');
  return [...out, ...post(z0 + 0.03), ...post(z1 - 0.03), ...box([x - 0.02, yTop - w, z0], [x + 0.02, yTop, z1], 'black')];
}
/** The glass of a door: between the posts, from the belt up, slightly inset. */
const doorGlass = (x: number, z0: number, z1: number, yBelt: number, yTop: number): Tri[] => slab([x, yTop - 0.03, z0 + 0.05], [x, yTop - 0.03, z1 - 0.05], [x, yBelt + 0.005, z1 - 0.05], [x, yBelt + 0.005, z0 + 0.05], 0.006, 'glass');
/** A wiper arm with its blade, lying on the glass at an angle. */
function wiper(c: V3, len: number, deg: number): Tri[] {
  const arm = [...box([-0.008, -0.008, 0], [0.008, 0.008, len], 'black'), ...box([-0.012, -0.004, len * 0.35], [0.012, 0.004, len], 'rubber')];
  return translate(rotateX(rotateY(arm, deg), -70), c);
}
/** A door mirror: an arm and a housing with its glass. */
const doorMirror = (x: number, side: 1 | -1, y: number, z: number, big = false): Tri[] => {
  const s = big ? 1.6 : 1;
  return [...tube([[x, y, z], [x + side * 0.12 * s, y + 0.02, z]], 0.012, 8, 'black'), ...box([x + side * 0.1 * s - (side > 0 ? 0 : 0.08 * s), y - 0.05 * s, z - 0.06 * s], [x + side * 0.1 * s + (side > 0 ? 0.08 * s : 0), y + 0.08 * s, z + 0.02 * s], 'black'), ...slab([x + side * 0.1 * s - (side > 0 ? 0 : 0.075 * s), y + 0.075 * s, z - 0.058 * s], [x + side * 0.1 * s + (side > 0 ? 0.075 * s : 0), y + 0.075 * s, z - 0.058 * s], [x + side * 0.1 * s + (side > 0 ? 0.075 * s : 0), y - 0.045 * s, z - 0.058 * s], [x + side * 0.1 * s - (side > 0 ? 0 : 0.075 * s), y - 0.045 * s, z - 0.058 * s], -0.003, 'chrome')];
};
/** The four (or more) wheels and tyres of a car, by corner name. */
function wheelsAt(P: Part[], corners: readonly (readonly [string, number, number])[], rTyre: number, rRim: number, width: number, spokes: number, rimMat: string): void {
  for (const [corner, x, z] of corners) {
    const w = wheelAndTyre([x, rTyre, z], rTyre, rRim, width, spokes, rimMat);
    P.push({ name: `tire_${corner}`, tris: w.tire }, { name: `wheel_${corner}`, tris: w.wheel });
  }
}
/** Lights common to a road car: indicators front and rear, reverse lights, a plate light. */
function roadLights(P: Part[], xF: number, yF: number, zF: number, xR: number, yR: number, zR: number): void {
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    P.push({ name: `indicator_F${side}`, tris: box([s * xF - 0.06, yF - 0.03, zF - 0.03], [s * xF + 0.06, yF + 0.03, zF], 'amber') });
    P.push({ name: `indicator_R${side}`, tris: box([s * xR - 0.06, yR - 0.03, zR], [s * xR + 0.06, yR + 0.03, zR + 0.03], 'amber') });
    P.push({ name: `reverse_light_${side}`, tris: box([s * xR - 0.06, yR - 0.1, zR], [s * xR + 0.06, yR - 0.04, zR + 0.03], 'lamp') });
  }
  P.push({ name: 'plate_light_R', tris: box([-0.05, yR + 0.08, zR], [0.05, yR + 0.1, zR + 0.03], 'lamp') });
}

// ---------------------------------------------------------------- the 8x8 hauler

function hauler(): Part[] {
  const AXLES = [3.2, 1.75, -2.3, -3.65]; // twin steer, tandem drive
  const TRACK = 1.0;
  const TYRE_R = 0.46;
  const RIM_R = 0.21;
  const TYRE_W = 0.3;
  const RAIL_Y0 = 0.62;
  const RAIL_Y1 = 0.86;
  const CAB_Z0 = 2.2; // cab back wall
  const CAB_Z1 = 4.45; // cab front
  const CAB_W = 2.45;
  const FLOOR = 1.05; // cab floor
  const ROOF = 3.25;
  const BELT = 1.95;
  const HW = CAB_W / 2;
  const P: Part[] = [];
  const part = (name: string, tris: Tri[], smooth = 0) => P.push({ name, tris, smooth });

  // Ladder frame: two rails the length of the truck, crossmembers, a bogie plate at the rear.
  const rails = both([...box([0.44, RAIL_Y0, -4.6], [0.54, RAIL_Y1, 3.9], 'black'), ...box([0.3, RAIL_Y0 + 0.02, -4.6], [0.44, RAIL_Y0 + 0.06, 3.9], 'black')]);
  const cross = [-4.4, -3.0, -1.6, -0.2, 1.2, 2.5, 3.6].flatMap((z) => box([-0.44, RAIL_Y0 + 0.04, z - 0.05], [0.44, RAIL_Y1 - 0.04, z + 0.05], 'black'));
  part('frame', [...rails, ...cross, ...box([-0.6, RAIL_Y1, -4.2], [0.6, RAIL_Y1 + 0.04, -1.7], 'black')]);

  // Cab-over cab: a rounded box with a raked windscreen, lofted from rings across the width.
  const cabRing = (z: number, w: number, y0: number, y1: number) => oval(0, (y0 + y1) / 2, z, w, y1 - y0, 20, 0.86);
  const cab = loft(
    [cabRing(CAB_Z0, CAB_W - 0.1, FLOOR + 0.05, ROOF - 0.05), cabRing(CAB_Z0 + 0.15, CAB_W, FLOOR, ROOF), cabRing(CAB_Z1 - 0.6, CAB_W, FLOOR, ROOF + 0.02), cabRing(CAB_Z1 - 0.25, CAB_W - 0.04, FLOOR, ROOF - 0.25), cabRing(CAB_Z1, CAB_W - 0.25, FLOOR + 0.1, BELT + 0.2)],
    'paint',
    { closed: true, capStart: true, capEnd: true },
  );
  part('cab', [...cab, ...box([-HW + 0.1, FLOOR - 0.02, CAB_Z0 + 0.1], [HW - 0.1, FLOOR + 0.03, CAB_Z1 - 0.3], 'black')], 1);
  // Roof: a flat panel over the cab (the aero one carries a deflector hump to the trailer's height).
  part('roof', box([-HW + 0.15, ROOF - 0.02, CAB_Z0 + 0.1], [HW - 0.15, ROOF + 0.06, CAB_Z1 - 0.5], 'paint'));
  part('roof_aero', [...box([-HW + 0.15, ROOF - 0.02, CAB_Z0 + 0.1], [HW - 0.15, ROOF + 0.06, CAB_Z1 - 0.5], 'paint'), ...loft([oval(0, ROOF + 0.05, CAB_Z1 - 0.6, CAB_W - 0.5, 0.1, 12, 0.9), oval(0, ROOF + 0.35, CAB_Z0 + 0.2, CAB_W - 0.3, 0.7, 12, 0.9)], 'paint', { closed: true, capStart: true, capEnd: true })], 1);
  // Windscreen: the whole front above the belt; wipers on it.
  part('windshield', slab([HW - 0.3, ROOF - 0.3, CAB_Z1 - 0.2], [-HW + 0.3, ROOF - 0.3, CAB_Z1 - 0.2], [-HW + 0.3, BELT + 0.1, CAB_Z1 + 0.01], [HW - 0.3, BELT + 0.1, CAB_Z1 + 0.01], 0.008, 'glass'));
  part('wiper_L', wiper([0.55, BELT + 0.15, CAB_Z1 + 0.02], 0.7, 30));
  part('wiper_R', wiper([-0.35, BELT + 0.15, CAB_Z1 + 0.02], 0.7, 30));
  part('rear_window', slab([-0.5, ROOF - 0.5, CAB_Z0 - 0.005], [0.5, ROOF - 0.5, CAB_Z0 - 0.005], [0.5, BELT + 0.3, CAB_Z0 - 0.005], [-0.5, BELT + 0.3, CAB_Z0 - 0.005], 0.006, 'glass'));
  // Doors with their glass, steps under them, mirrors on long arms.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const x = s * (HW - 0.01);
    part(`door_F${side}`, doorSkin(x, s, CAB_Z0 + 0.4, CAB_Z1 - 0.7, FLOOR + 0.05, BELT, ROOF - 0.35));
    part(`door_glass_F${side}`, doorGlass(x, CAB_Z0 + 0.4, CAB_Z1 - 0.7, BELT, ROOF - 0.35));
    part(`mirror_${side}`, [...tube([[x, ROOF - 0.5, CAB_Z1 - 0.5], [x + s * 0.45, ROOF - 0.45, CAB_Z1 - 0.55], [x + s * 0.45, BELT - 0.1, CAB_Z1 - 0.55]], 0.015, 8, 'black'), ...box([x + s * 0.4 - (s > 0 ? 0 : 0.1), BELT - 0.05, CAB_Z1 - 0.62], [x + s * 0.4 + (s > 0 ? 0.1 : 0), ROOF - 0.5, CAB_Z1 - 0.55], 'black'), ...slab([x + s * 0.4 - (s > 0 ? 0 : 0.09), ROOF - 0.52, CAB_Z1 - 0.625], [x + s * 0.4 + (s > 0 ? 0.09 : 0), ROOF - 0.52, CAB_Z1 - 0.625], [x + s * 0.4 + (s > 0 ? 0.09 : 0), BELT - 0.03, CAB_Z1 - 0.625], [x + s * 0.4 - (s > 0 ? 0 : 0.09), BELT - 0.03, CAB_Z1 - 0.625], -0.003, 'chrome')]);
    part(`side_skirt_${side}`, [...box([x - s * 0.02, FLOOR - 0.35, CAB_Z0 + 0.5], [x + s * 0.12, FLOOR - 0.3, CAB_Z1 - 0.8], 'alloy'), ...box([x - s * 0.02, FLOOR - 0.7, CAB_Z0 + 0.6], [x + s * 0.12, FLOOR - 0.65, CAB_Z1 - 0.9], 'alloy'), ...both(box([0.02 + (s > 0 ? x - s * 0.02 : 0), 0, 0], [0, 0, 0], 'alloy')).slice(0, 0), ...[CAB_Z0 + 0.6, CAB_Z1 - 0.9].flatMap((z) => box([x + s * 0.04, FLOOR - 0.7, z - 0.02], [x + s * 0.08, FLOOR - 0.3, z + 0.02], 'alloy'))]);
    part(`side_skirt_${side}_aero`, slab([x + s * 0.02, RAIL_Y0 - 0.1, -4.2], [x + s * 0.02, RAIL_Y0 - 0.1, CAB_Z0 + 0.3], [x + s * 0.02, FLOOR + 0.1, CAB_Z0 + 0.3], [x + s * 0.02, FLOOR + 0.1, -4.2], 0.02 * s, 'paint'));
    // Fenders over the two steer axles, quarter panels over the drive bogie.
    part(`fender_${side}`, AXLES.slice(0, 2).flatMap((z) => arch(z, TYRE_R + 0.05, TYRE_R + 0.1, TYRE_R + 0.2, s > 0 ? TRACK - 0.25 : -TRACK - 0.2, s > 0 ? TRACK + 0.2 : -TRACK + 0.25, 'black', 0, 180)), 0);
    part(`quarter_panel_${side}`, AXLES.slice(2).flatMap((z) => arch(z, TYRE_R + 0.05, TYRE_R + 0.1, TYRE_R + 0.2, s > 0 ? TRACK - 0.25 : -TRACK - 0.2, s > 0 ? TRACK + 0.2 : -TRACK + 0.25, 'black', 0, 180)), 0);
    part(`mudflap_R${side}`, slab([s * (TRACK + 0.2), TYRE_R + 0.1, AXLES[3]! - 0.5], [s * (TRACK - 0.25), TYRE_R + 0.1, AXLES[3]! - 0.5], [s * (TRACK - 0.25), 0.2, AXLES[3]! - 0.55], [s * (TRACK + 0.2), 0.2, AXLES[3]! - 0.55], 0.01, 'black'));
    // Saddle fuel tanks on the rails between the axles: 400 L a side, with a filler and straps.
    part(`fuel_tank_${side}`, [...cylinder([s * 0.95, RAIL_Y0 - 0.05, -1.4], [s * 0.95, RAIL_Y0 - 0.05, 1.3], 0.34, 18, 'alloy'), ...[-1.0, 0.1, 1.0].flatMap((z) => cylinder([s * 0.95, RAIL_Y0 - 0.05, z], [s * 0.95, RAIL_Y0 - 0.05, z + 0.05], 0.355, 18, 'black')), ...cylinder([s * 0.95, RAIL_Y0 + 0.28, -0.2], [s * 0.95, RAIL_Y0 + 0.36, -0.2], 0.05, 12, 'chrome')]);
    part(`headlight_F${side}`, lamp([s * 0.8, FLOOR + 0.45, CAB_Z1 - 0.1], 0.1, 0.06, 'lamp'));
    part(`foglight_F${side}`, lamp([s * 0.6, RAIL_Y1 + 0.05, CAB_Z1 + 0.02], 0.05, 0.05, 'lamp'));
    part(`taillight_R${side}`, [...box([s * 0.95 - 0.08, RAIL_Y1 - 0.02, -4.66], [s * 0.95 + 0.08, RAIL_Y1 + 0.12, -4.62], 'taillamp')]);
    part(`exhaust_${side === 'L' ? 'L' : 'R'}`, [...tube([[s * 0.7, RAIL_Y0, CAB_Z0 - 0.3], [s * 1.0, RAIL_Y0 + 0.4, CAB_Z0 - 0.3], [s * 1.0, ROOF + 0.3, CAB_Z0 - 0.3]], 0.06, 12, 'chrome'), ...cylinder([s * 1.0, ROOF - 0.4, CAB_Z0 - 0.3], [s * 1.0, ROOF + 0.35, CAB_Z0 - 0.3], 0.075, 12, 'chrome')]);
    part(`tow_hook_${s > 0 ? 'F' : 'R'}`, lathe([[0.04, -0.03], [0.08, -0.03], [0.08, 0.03], [0.04, 0.03], [0.04, -0.03]], [s > 0 ? 0.5 : -0.5, RAIL_Y0 + 0.12, s > 0 ? CAB_Z1 + 0.2 : -4.75], 'z', 12, 'red', false));
  }
  roadLights(P, 0.95, FLOOR + 0.3, CAB_Z1, 0.75, RAIL_Y1 + 0.05, -4.66);
  // Grille (louvred, with the make's badge), radiator and the engine tunnel under the cab.
  part('grille', [...slab([-0.75, BELT - 0.05, CAB_Z1 + 0.005], [0.75, BELT - 0.05, CAB_Z1 + 0.005], [0.75, FLOOR + 0.6, CAB_Z1 + 0.005], [-0.75, FLOOR + 0.6, CAB_Z1 + 0.005], 0.01, 'black'), ...[0, 1, 2, 3].flatMap((i) => box([-0.72, FLOOR + 0.66 + i * 0.3, CAB_Z1], [0.72, FLOOR + 0.72 + i * 0.3, CAB_Z1 + 0.03], 'chrome'))]);
  part('grille_heavy', [...slab([-0.75, BELT - 0.05, CAB_Z1 + 0.005], [0.75, BELT - 0.05, CAB_Z1 + 0.005], [0.75, FLOOR + 0.6, CAB_Z1 + 0.005], [-0.75, FLOOR + 0.6, CAB_Z1 + 0.005], 0.01, 'black'), ...tube([[0.7, FLOOR + 0.62, CAB_Z1 + 0.04], [0.7, BELT - 0.07, CAB_Z1 + 0.04], [-0.7, BELT - 0.07, CAB_Z1 + 0.04], [-0.7, FLOOR + 0.62, CAB_Z1 + 0.04]], 0.025, 8, 'black'), ...[-0.4, 0, 0.4].flatMap((x) => tube([[x, FLOOR + 0.62, CAB_Z1 + 0.04], [x, BELT - 0.07, CAB_Z1 + 0.04]], 0.02, 8, 'black'))]);
  part('radiator', box([-0.6, RAIL_Y1, CAB_Z1 - 0.5], [0.6, FLOOR + 0.9, CAB_Z1 - 0.4], 'black'));
  part('engine_cover', [...box([-0.55, FLOOR, CAB_Z0 + 0.2], [0.55, FLOOR + 0.45, CAB_Z1 - 0.6], 'black'), ...box([-0.5, RAIL_Y1, CAB_Z0 - 0.3], [0.5, FLOOR - 0.02, CAB_Z1 - 0.6], 'alloy')]);
  part('snorkel', [...tube([[HW - 0.3, BELT, CAB_Z0 + 0.05], [HW - 0.3, ROOF + 0.3, CAB_Z0 + 0.05]], 0.07, 12, 'black'), ...box([HW - 0.45, ROOF + 0.25, CAB_Z0 - 0.05], [HW - 0.15, ROOF + 0.45, CAB_Z0 + 0.25], 'black')]);
  part('antenna', tube([[-HW + 0.2, ROOF, CAB_Z0 + 0.3], [-HW + 0.25, ROOF + 1.2, CAB_Z0 + 0.2]], 0.008, 6, 'black'));

  // Bumpers: steel channel (standard), heavy with a winch drum and push bars, off-road bull bar, aero chin.
  const nose = CAB_Z1 + 0.08;
  const channel = (depth: number) => box([-HW + 0.05, RAIL_Y0 - 0.1, nose - depth], [HW - 0.05, RAIL_Y1 + 0.2, nose], 'black');
  part('bumper_F', [...channel(0.2), ...box([-0.3, RAIL_Y0 - 0.25, nose - 0.2], [0.3, RAIL_Y0 - 0.1, nose], 'black')]);
  part('bumper_F_heavy', [...channel(0.3), ...cylinder([-0.28, RAIL_Y1 + 0.05, nose - 0.3], [0.28, RAIL_Y1 + 0.05, nose - 0.3], 0.09, 12, 'alloy'), ...box([-0.36, RAIL_Y0 - 0.05, nose - 0.4], [-0.28, RAIL_Y1 + 0.15, nose - 0.2], 'black'), ...box([0.28, RAIL_Y0 - 0.05, nose - 0.4], [0.36, RAIL_Y1 + 0.15, nose - 0.2], 'black'), ...both(tube([[0.9, RAIL_Y1 + 0.2, nose], [0.9, FLOOR + 0.6, nose + 0.1], [0.5, FLOOR + 0.6, nose + 0.1], [0.5, RAIL_Y1 + 0.2, nose]], 0.03, 10, 'black'))]);
  part('bumper_F_offroad', [...channel(0.2), ...tube([[HW - 0.2, RAIL_Y1 + 0.1, nose + 0.05], [HW - 0.2, BELT + 0.2, nose + 0.25], [-HW + 0.2, BELT + 0.2, nose + 0.25], [-HW + 0.2, RAIL_Y1 + 0.1, nose + 0.05]], 0.04, 10, 'alloy'), ...tube([[0.8, FLOOR + 0.5, nose + 0.2], [-0.8, FLOOR + 0.5, nose + 0.2]], 0.03, 10, 'alloy'), ...tube([[0.8, FLOOR + 1.1, nose + 0.24], [-0.8, FLOOR + 1.1, nose + 0.24]], 0.03, 10, 'alloy')]);
  part('bumper_F_aero', [...loft([oval(0, (RAIL_Y0 + FLOOR) / 2 - 0.1, nose - 0.3, CAB_W - 0.1, FLOOR - RAIL_Y0 + 0.4, 16, 0.85), oval(0, (RAIL_Y0 + FLOOR) / 2 - 0.05, nose + 0.05, CAB_W - 0.3, FLOOR - RAIL_Y0 + 0.2, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true })], 1);
  part('bumper_R', box([-HW + 0.15, RAIL_Y0 - 0.1, -4.75], [HW - 0.15, RAIL_Y1 + 0.1, -4.6], 'black'));
  part('bumper_R_heavy', [...box([-HW + 0.15, RAIL_Y0 - 0.3, -4.8], [HW - 0.15, RAIL_Y1 + 0.15, -4.6], 'black'), ...both(box([0.6, RAIL_Y0 - 0.5, -4.8], [0.7, RAIL_Y0 - 0.3, -4.5], 'black'))]);
  part('skidplate_F', slab([-0.6, RAIL_Y0 - 0.12, nose - 0.2], [0.6, RAIL_Y0 - 0.12, nose - 0.2], [0.6, RAIL_Y0 - 0.12, CAB_Z0], [-0.6, RAIL_Y0 - 0.12, CAB_Z0], 0.01, 'alloy'));

  // Behind the cab: the sleeper (a box the cab's size, Long Haul), the fifth wheel on the bogie (Tow), a ballast box, a roof rack with a box and the light bar (Expedition), a spare wheel.
  part('bed', [...loft([cabRing(CAB_Z0 - 1.3, CAB_W - 0.1, FLOOR + 0.05, ROOF - 0.05), cabRing(CAB_Z0 - 1.2, CAB_W, FLOOR, ROOF), cabRing(CAB_Z0 - 0.05, CAB_W, FLOOR, ROOF), cabRing(CAB_Z0, CAB_W - 0.1, FLOOR + 0.05, ROOF - 0.05)], 'paint', { closed: true, capStart: true, capEnd: true }), ...both(slab([HW + 0.001, ROOF - 0.5, CAB_Z0 - 1.0], [HW + 0.001, ROOF - 0.5, CAB_Z0 - 0.3], [HW + 0.001, BELT + 0.3, CAB_Z0 - 0.3], [HW + 0.001, BELT + 0.3, CAB_Z0 - 1.0], -0.006, 'glass'))], 1);
  part('tow_hitch_plate', [...box([-0.5, RAIL_Y1 + 0.04, -3.5], [0.5, RAIL_Y1 + 0.2, -2.5], 'black'), ...lathe([[0.001, 0], [0.5, 0], [0.5, 0.05], [0.12, 0.05], [0.12, 0.001]], [0, RAIL_Y1 + 0.2, -3.0], 'y', 20, 'alloy', false), ...box([-0.14, RAIL_Y1 + 0.2, -3.4], [0.14, RAIL_Y1 + 0.24, -3.0], 'black')]);
  part('bed_heavy', [...box([-0.95, RAIL_Y1 + 0.04, -4.3], [0.95, RAIL_Y1 + 0.7, -1.8], 'paint'), ...[-4.1, -3.3, -2.5].flatMap((z) => box([-0.97, RAIL_Y1 + 0.1, z - 0.03], [0.97, RAIL_Y1 + 0.65, z + 0.03], 'black'))]);
  part('roof_rack_box', [...both(box([HW - 0.3, ROOF + 0.06, CAB_Z0 + 0.15], [HW - 0.25, ROOF + 0.2, CAB_Z1 - 0.55], 'black')), ...[CAB_Z0 + 0.2, CAB_Z1 - 0.6].flatMap((z) => box([-HW + 0.25, ROOF + 0.12, z - 0.02], [HW - 0.25, ROOF + 0.16, z + 0.02], 'black')), ...roundedBox([0, ROOF + 0.38, CAB_Z0 + 0.9], [1.0, 0.36, 1.2], 0.8, 'black')]);
  part('light_bar', [...box([-0.8, ROOF + 0.18, CAB_Z1 - 0.62], [0.8, ROOF + 0.28, CAB_Z1 - 0.52], 'lamp_housing'), ...[-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].flatMap((x) => lamp([x, ROOF + 0.23, CAB_Z1 - 0.52], 0.045, 0.03, 'lamp'))]);
  const spare = wheelAndTyre([0, 0, 0], TYRE_R, RIM_R, TYRE_W, 8, 'black');
  part('spare_wheel', translate(rotateY([...spare.tire, ...spare.wheel], 90), [-0.3, RAIL_Y1 + TYRE_R + 0.05, CAB_Z0 - 0.8]));
  part('battery_box', box([-0.95, RAIL_Y0 - 0.1, 1.6], [-0.55, RAIL_Y1 + 0.1, 2.1], 'black'));
  part('fuel_tank_belly', box([-0.4, RAIL_Y0 - 0.45, -1.4], [0.4, RAIL_Y0 - 0.05, 1.2], 'alloy'));

  // Cab interior: two air seats, a wraparound dash with four dials, pedals, the big wheel, a stalk shifter, a handbrake.
  for (const s of [1, -1] as const) {
    const c = s > 0 ? 'FL' : 'FR';
    const seat = seatParts([s * 0.72, FLOOR + 0.45, CAB_Z0 + 0.85], 0.55, 'cloth');
    part(`seat_${c}_cushion`, [...seat.cushion, ...box([s * 0.72 - 0.2, FLOOR + 0.02, CAB_Z0 + 0.7], [s * 0.72 + 0.2, FLOOR + 0.35, CAB_Z0 + 1.0], 'black')]);
    part(`seat_${c}_backrest`, seat.backrest);
  }
  const dash = dashAndDials(FLOOR + 0.75, CAB_Z1 - 0.95, 0.72, CAB_W - 0.4);
  part('dashboard', dash.dashboard);
  part('gauges', dash.gauges);
  for (const [n, tris] of Object.entries(dash.needles)) part(n, tris);
  part('steering_wheel', steeringWheel([0.72, FLOOR + 0.95, CAB_Z1 - 1.0], 0.23, -55));
  part('throttle_pedal', pedal([0.55, FLOOR + 0.1, CAB_Z1 - 0.75]));
  part('brake_pedal', pedal([0.72, FLOOR + 0.12, CAB_Z1 - 0.75]));
  part('clutch_pedal', pedal([0.9, FLOOR + 0.12, CAB_Z1 - 0.75]));
  part('handbrake', [...tube([[0.3, FLOOR + 0.1, CAB_Z0 + 0.9], [0.3, FLOOR + 0.38, CAB_Z0 + 1.0]], 0.012, 8, 'alloy'), ...box([0.27, FLOOR + 0.36, CAB_Z0 + 0.95], [0.33, FLOOR + 0.42, CAB_Z0 + 1.1], 'black')]);
  part('shifter', [...tube([[0.35, FLOOR + 0.05, CAB_Z1 - 0.9], [0.4, FLOOR + 0.55, CAB_Z1 - 0.95]], 0.012, 8, 'alloy'), ...sphere([0.4, FLOOR + 0.57, CAB_Z1 - 0.95], 0.035, 8, 'black')]);
  part('radio', [...box([-0.25, FLOOR + 0.9, CAB_Z1 - 0.95], [0.25, FLOOR + 1.05, CAB_Z1 - 0.9], 'black'), ...slab([-0.22, FLOOR + 1.03, CAB_Z1 - 0.955], [0.22, FLOOR + 1.03, CAB_Z1 - 0.955], [0.22, FLOOR + 0.92, CAB_Z1 - 0.955], [-0.22, FLOOR + 0.92, CAB_Z1 - 0.955], -0.003, 'glass')]);
  part('center_console', box([-0.3, FLOOR, CAB_Z0 + 0.5], [0.3, FLOOR + 0.5, CAB_Z1 - 0.9], 'black'));

  // Eight wheels: the steer pair at the front, the inner pairs (placed from the axle positions, not these), the rear pair.
  wheelsAt(P, [['FL', TRACK, AXLES[0]!], ['FR', -TRACK, AXLES[0]!], ['ML', TRACK, AXLES[1]!], ['MR', -TRACK, AXLES[1]!], ['ML2', TRACK, AXLES[2]!], ['MR2', -TRACK, AXLES[2]!], ['RL', TRACK, AXLES[3]!], ['RR', -TRACK, AXLES[3]!]], TYRE_R, RIM_R, TYRE_W, 10, 'alloy');
  return P;
}

// ---------------------------------------------------------------- the estate (a 1990s family wagon)

function estate(): Part[] {
  const AXLE_F = 1.4;
  const AXLE_R = -1.3;
  const TRACK = 0.75;
  const TYRE_R = 0.31;
  const RIM_R = 0.21;
  const SILL = 0.32;
  const BELT = 0.95;
  const ROOF = 1.48;
  const HW = 0.88;
  const P: Part[] = [];
  const part = (name: string, tris: Tri[], smooth = 0) => P.push({ name, tris, smooth });

  // Lower body: a loft of rounded sections, the bonnet line falling to the nose, a slight kick-up at the tail.
  const lower: [number, number, number, number][] = [
    // z, width, bottom, top
    [-2.35, 1.5, SILL + 0.1, BELT - 0.08],
    [-2.1, 1.7, SILL, BELT],
    [-1.3, 1.76, SILL - 0.02, BELT + 0.02],
    [0, 1.76, SILL - 0.02, BELT + 0.02],
    [1.1, 1.74, SILL, BELT],
    [1.7, 1.66, SILL + 0.02, BELT - 0.12],
    [2.3, 1.5, SILL + 0.1, BELT - 0.28],
  ];
  part('body', [...loft(lower.map(([z, w, b, t]) => oval(0, (b + t) / 2, z, w, t - b, 20, 0.8)), 'paint', { closed: true, capStart: true, capEnd: true }), ...box([-0.7, SILL + 0.02, -1.9], [0.7, SILL + 0.06, 1.2], 'black')], 1);
  // Greenhouse: pillars and the roof as one loft above the belt (wagon: the roof runs to the tail).
  const upper = [-2.2, -1.9, -1.0, 0.2, 0.9, 1.25].map((z, i) => {
    const w = i === 0 ? 1.42 : i === 5 ? 1.3 : 1.56;
    const top = i === 0 ? ROOF - 0.08 : i === 5 ? ROOF - 0.12 : ROOF;
    return [[w / 2, BELT, z], [w / 2 - 0.1, top, z + (i === 5 ? -0.35 : 0)], [-w / 2 + 0.1, top, z + (i === 5 ? -0.35 : 0)], [-w / 2, BELT, z]] as V3[];
  });
  part('roof', [...loft(upper, 'paint', { closed: false }), ...box([-0.7, ROOF - 0.02, -1.6], [0.7, ROOF + 0.015, 0.7], 'paint')], 1);
  part('sunroof', [...box([-0.4, ROOF + 0.005, -0.5], [0.4, ROOF + 0.025, 0.4], 'black')]);
  part('sunroof_glass', box([-0.37, ROOF + 0.015, -0.47], [0.37, ROOF + 0.03, 0.37], 'glass'));
  part('windshield', slab([HW - 0.1, ROOF - 0.03, 0.9], [-HW + 0.1, ROOF - 0.03, 0.9], [-HW + 0.06, BELT - 0.1, 1.5], [HW - 0.06, BELT - 0.1, 1.5], 0.006, 'glass'));
  part('wiper_L', wiper([0.2, BELT - 0.05, 1.5], 0.5, 25));
  part('wiper_R', wiper([-0.45, BELT - 0.05, 1.5], 0.5, 25));
  part('hood', slab([-0.72, BELT - 0.1, 1.5], [0.72, BELT - 0.1, 1.5], [0.66, BELT - 0.3, 2.3], [-0.66, BELT - 0.3, 2.3], 0.02, 'paint'));
  part('hood_sport', [...slab([-0.72, BELT - 0.1, 1.5], [0.72, BELT - 0.1, 1.5], [0.66, BELT - 0.3, 2.3], [-0.66, BELT - 0.3, 2.3], 0.02, 'paint'), ...rotateX(box([-0.2, BELT - 0.22, 1.6], [0.2, BELT - 0.08, 1.95], 'paint'), 8, [0, BELT - 0.2, 1.6])], 1);
  part('tailgate', [...slab([-0.7, ROOF - 0.12, -2.25], [0.7, ROOF - 0.12, -2.25], [0.7, BELT - 0.02, -2.36], [-0.7, BELT - 0.02, -2.36], 0.02, 'paint'), ...slab([-0.72, BELT - 0.02, -2.36], [0.72, BELT - 0.02, -2.36], [0.72, SILL + 0.3, -2.36], [-0.72, SILL + 0.3, -2.36], 0.02, 'paint')]);
  part('tailgate_glass', slab([-0.66, ROOF - 0.15, -2.27], [0.66, ROOF - 0.15, -2.27], [0.66, BELT + 0.02, -2.375], [-0.66, BELT + 0.02, -2.375], -0.006, 'glass'));
  part('brake_light', box([-0.2, ROOF - 0.12, -2.2], [0.2, ROOF - 0.08, -2.17], 'taillamp'));
  part('grille', [...slab([-0.5, BELT - 0.3, 2.355], [0.5, BELT - 0.3, 2.355], [0.5, BELT - 0.52, 2.355], [-0.5, BELT - 0.52, 2.355], 0.01, 'black'), ...[-0.3, -0.1, 0.1, 0.3].flatMap((x) => box([x - 0.01, BELT - 0.51, 2.35], [x + 0.01, BELT - 0.31, 2.37], 'chrome'))]);
  part('grille_sport', [...slab([-0.5, BELT - 0.3, 2.355], [0.5, BELT - 0.3, 2.355], [0.5, BELT - 0.52, 2.355], [-0.5, BELT - 0.52, 2.355], 0.01, 'black'), ...box([-0.5, BELT - 0.33, 2.35], [0.5, BELT - 0.3, 2.37], 'carbon')]);
  part('radiator', box([-0.4, SILL + 0.2, 2.1], [0.4, BELT - 0.35, 2.17], 'black'));
  part('fuel_door', slab([-HW - 0.004, BELT - 0.12, -1.85], [-HW - 0.004, BELT - 0.12, -1.65], [-HW - 0.004, BELT - 0.32, -1.65], [-HW - 0.004, BELT - 0.32, -1.85], -0.01, 'paint'));
  part('fuel_tank', roundedBox([0, SILL + 0.1, -1.0], [0.9, 0.2, 0.6], 0.7, 'black'));
  part('exhaust', [...tube([[0.3, SILL, 1.0], [0.4, SILL - 0.02, -0.5], [0.55, SILL - 0.02, -2.0]], 0.025, 10, 'chrome'), ...roundedBox([0.45, SILL + 0.02, -1.6], [0.2, 0.14, 0.5], 0.6, 'alloy'), ...cylinder([0.55, SILL - 0.02, -2.0], [0.55, SILL - 0.02, -2.42], 0.03, 12, 'chrome')]);
  part('exhaust_sport', both([...tube([[0.3, SILL, 1.0], [0.4, SILL - 0.02, -0.5], [0.55, SILL - 0.02, -2.0]], 0.03, 10, 'chrome'), ...cylinder([0.55, SILL - 0.02, -2.0], [0.55, SILL - 0.02, -2.45], 0.04, 12, 'chrome')]));

  // Bumpers: body-coloured (standard), deep sport with a lip, chunky rally one with a skid.
  part('bumper_F', loft([oval(0, SILL + 0.22, 2.2, 1.66, 0.3, 16, 0.85), oval(0, SILL + 0.24, 2.42, 1.5, 0.26, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true }), 1);
  part('bumper_F_sport', [...loft([oval(0, SILL + 0.2, 2.2, 1.7, 0.36, 16, 0.85), oval(0, SILL + 0.18, 2.45, 1.56, 0.32, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true }), ...box([-0.8, SILL - 0.02, 2.2], [0.8, SILL + 0.01, 2.5], 'carbon')], 1);
  part('bumper_F_offroad', [...loft([oval(0, SILL + 0.25, 2.2, 1.66, 0.34, 16, 0.85), oval(0, SILL + 0.3, 2.42, 1.5, 0.3, 16, 0.8)], 'black', { closed: true, capStart: true, capEnd: true }), ...slab([-0.6, SILL + 0.08, 2.5], [0.6, SILL + 0.08, 2.5], [0.6, SILL + 0.08, 1.4], [-0.6, SILL + 0.08, 1.4], 0.01, 'alloy')], 1);
  part('bumper_R', loft([oval(0, SILL + 0.22, -2.2, 1.66, 0.3, 16, 0.85), oval(0, SILL + 0.24, -2.42, 1.5, 0.26, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true }), 1);
  part('bumper_R_sport', [...loft([oval(0, SILL + 0.2, -2.2, 1.7, 0.36, 16, 0.85), oval(0, SILL + 0.18, -2.45, 1.56, 0.32, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true }), ...[-0.3, 0, 0.3].flatMap((x) => box([x - 0.01, SILL - 0.04, -2.4], [x + 0.01, SILL + 0.04, -1.9], 'carbon'))], 1);
  part('skidplate_F', slab([-0.55, SILL - 0.03, 2.1], [0.55, SILL - 0.03, 2.1], [0.55, SILL - 0.03, 1.0], [-0.55, SILL - 0.03, 1.0], 0.01, 'alloy'));
  part('splitter', box([-0.85, SILL - 0.04, 2.0], [0.85, SILL - 0.02, 2.55], 'carbon'));
  part('wing_sport', [...rotateX(box([-0.7, ROOF - 0.05, -2.45], [0.7, ROOF - 0.02, -2.15], 'carbon'), -10, [0, ROOF, -2.15]), ...both(box([0.66, ROOF - 0.12, -2.3], [0.69, ROOF - 0.02, -2.15], 'carbon'))]);
  part('roof_rack', [...both([...box([0.55, ROOF + 0.02, -1.5], [0.6, ROOF + 0.1, 0.6], 'black'), ...[-1.3, 0.4].flatMap((z) => box([0.55, ROOF + 0.09, z - 0.015], [0.6, ROOF + 0.12, z + 0.015], 'black'))]), ...[-1.3, 0.4].flatMap((z) => cylinder([-0.6, ROOF + 0.12, z], [0.6, ROOF + 0.12, z], 0.015, 8, 'black'))]);
  part('light_bar', [...box([-0.5, BELT - 0.2, 2.42], [0.5, BELT - 0.12, 2.5], 'lamp_housing'), ...[-0.4, -0.2, 0, 0.2, 0.4].flatMap((x) => lamp([x, BELT - 0.16, 2.5], 0.035, 0.03, 'lamp'))]);
  part('police_lights', [...box([-0.55, ROOF + 0.02, -0.6], [0.55, ROOF + 0.1, -0.4], 'lamp_housing'), ...box([-0.5, ROOF + 0.1, -0.58], [-0.05, ROOF + 0.18, -0.42], 'blue'), ...box([0.05, ROOF + 0.1, -0.58], [0.5, ROOF + 0.18, -0.42], 'taillamp')]);
  part('light_bar_taxi', [...box([-0.3, ROOF + 0.02, -0.4], [0.3, ROOF + 0.06, -0.2], 'lamp_housing'), ...box([-0.28, ROOF + 0.06, -0.38], [0.28, ROOF + 0.2, -0.22], 'amber')]);
  part('antenna', tube([[-0.4, ROOF - 0.1, -1.3], [-0.45, ROOF + 0.6, -1.4]], 0.005, 6, 'black'));

  // Doors (four), their glass, the quarter glass behind the rear doors, fenders, quarter panels, skirts, flaps.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const x = s * (HW - 0.005);
    part(`door_F${side}`, doorSkin(x, s, -0.1, 1.05, SILL + 0.06, BELT, ROOF - 0.08));
    part(`door_glass_F${side}`, doorGlass(x - s * 0.01, -0.1, 1.05, BELT, ROOF - 0.08));
    part(`door_R${side}`, doorSkin(x, s, -1.1, -0.15, SILL + 0.06, BELT, ROOF - 0.08));
    part(`door_glass_R${side}`, doorGlass(x - s * 0.01, -1.1, -0.15, BELT, ROOF - 0.08));
    part(`quarter_glass_${side}`, slab([x - s * 0.02, ROOF - 0.12, -1.18], [x - s * 0.02, ROOF - 0.12, -2.0], [x - s * 0.02, BELT + 0.02, -2.1], [x - s * 0.02, BELT + 0.02, -1.18], 0.006 * s, 'glass'));
    part(`fender_${side}`, arch(AXLE_F, TYRE_R, TYRE_R + 0.08, TYRE_R + 0.16, s > 0 ? HW - 0.14 : -HW - 0.01, s > 0 ? HW + 0.01 : -HW + 0.14, 'paint', 0, 180), 1);
    part(`quarter_panel_${side}`, arch(AXLE_R, TYRE_R, TYRE_R + 0.08, TYRE_R + 0.16, s > 0 ? HW - 0.14 : -HW - 0.01, s > 0 ? HW + 0.01 : -HW + 0.14, 'paint', 0, 180), 1);
    part(`side_skirt_${side}`, box([x - s * 0.04, SILL - 0.03, -1.0], [x + s * 0.03, SILL + 0.08, 1.0], 'black'));
    part(`side_skirt_${side}_sport`, box([x - s * 0.02, SILL - 0.05, -1.05], [x + s * 0.06, SILL + 0.1, 1.05], 'carbon'));
    part(`mirror_${side}`, doorMirror(x, s, BELT + 0.12, 0.95));
    part(`headlight_F${side}`, [...box([s * 0.5 - 0.22, BELT - 0.45, 2.3], [s * 0.5 + 0.22, BELT - 0.32, 2.34], 'lamp')]);
    part(`foglight_F${side}`, lamp([s * 0.55, SILL + 0.22, 2.4], 0.04, 0.04, 'lamp'));
    part(`taillight_R${side}`, box([s * 0.6 - 0.14, BELT - 0.3, -2.37], [s * 0.6 + 0.14, BELT - 0.08, -2.34], 'taillamp'));
    part(`mudflap_F${side}`, slab([s * (TRACK + 0.1), TYRE_R + 0.05, AXLE_F - 0.4], [s * (TRACK - 0.12), TYRE_R + 0.05, AXLE_F - 0.4], [s * (TRACK - 0.12), 0.12, AXLE_F - 0.44], [s * (TRACK + 0.1), 0.12, AXLE_F - 0.44], 0.006, 'black'));
    part(`mudflap_R${side}`, slab([s * (TRACK + 0.1), TYRE_R + 0.05, AXLE_R - 0.4], [s * (TRACK - 0.12), TYRE_R + 0.05, AXLE_R - 0.4], [s * (TRACK - 0.12), 0.12, AXLE_R - 0.44], [s * (TRACK + 0.1), 0.12, AXLE_R - 0.44], 0.006, 'black'));
    part(`tow_hook_${s > 0 ? 'F' : 'R'}`, lathe([[0.02, -0.01], [0.04, -0.01], [0.04, 0.01], [0.02, 0.01], [0.02, -0.01]], [s * 0.4, SILL + 0.1, s > 0 ? 2.46 : -2.46], 'z', 10, 'red', false));
  }
  roadLights(P, 0.74, BELT - 0.4, 2.3, 0.6, BELT - 0.3, -2.37);

  // Interior: two seats in parts the power-seat script moves, a rear bench, the dash with its dials, pedals, wheel, lever, handbrake, head unit.
  for (const s of [1, -1] as const) {
    const c = s > 0 ? 'FL' : 'FR';
    const seat = seatParts([s * 0.38, SILL + 0.2, 0.0], 0.5, 'cloth');
    part(`seat_${c}_cushion`, seat.cushion);
    part(`seat_${c}_backrest`, seat.backrest);
  }
  part('seat_RL', box([0.05, SILL + 0.2, -1.4], [0.8, SILL + 0.32, -0.9], 'cloth').concat(rotateX(box([0.05, SILL + 0.3, -1.45], [0.8, SILL + 0.85, -1.38], 'cloth'), -12, [0, SILL + 0.3, -1.4])));
  part('seat_RR', mirrorX(P[P.length - 1]!.tris));
  part('seat_RM', box([-0.05, SILL + 0.2, -1.4], [0.05, SILL + 0.32, -0.9], 'cloth').concat(rotateX(box([-0.05, SILL + 0.3, -1.45], [0.05, SILL + 0.85, -1.38], 'cloth'), -12, [0, SILL + 0.3, -1.4])));
  const dash = dashAndDials(BELT - 0.25, 0.75, 0.38, 1.5);
  part('dashboard', dash.dashboard);
  part('gauges', dash.gauges);
  for (const [n, tris] of Object.entries(dash.needles)) part(n, tris);
  part('steering_wheel', steeringWheel([0.38, BELT - 0.02, 0.6], 0.19, -30));
  part('steering_column', cylinder([0.38, BELT - 0.07, 0.62], [0.38, BELT - 0.2, 0.9], 0.03, 10, 'black'));
  part('throttle_pedal', pedal([0.25, SILL + 0.12, 0.95]));
  part('brake_pedal', pedal([0.38, SILL + 0.14, 0.95]));
  part('clutch_pedal', pedal([0.52, SILL + 0.14, 0.95]));
  part('handbrake', [...tube([[0.08, SILL + 0.2, -0.1], [0.08, SILL + 0.38, 0.05]], 0.01, 8, 'alloy'), ...box([0.05, SILL + 0.36, 0.02], [0.11, SILL + 0.41, 0.12], 'black')]);
  part('shifter', [...tube([[0.0, SILL + 0.22, 0.3], [0.0, SILL + 0.45, 0.28]], 0.01, 8, 'alloy'), ...sphere([0.0, SILL + 0.47, 0.28], 0.025, 8, 'black')]);
  part('center_console', box([-0.14, SILL + 0.08, -0.3], [0.14, SILL + 0.3, 0.75], 'black'));
  part('radio', [...box([-0.16, BELT - 0.18, 0.7], [0.16, BELT - 0.06, 0.76], 'black'), ...slab([-0.14, BELT - 0.07, 0.695], [0.14, BELT - 0.07, 0.695], [0.14, BELT - 0.17, 0.695], [-0.14, BELT - 0.17, 0.695], -0.003, 'glass')]);
  part('carpet', box([-0.75, SILL + 0.06, -1.9], [0.75, SILL + 0.07, 1.0], 'cloth'));
  part('headliner', box([-0.7, ROOF - 0.05, -1.9], [0.7, ROOF - 0.04, 0.8], 'cloth'));
  wheelsAt(P, [['FL', TRACK, AXLE_F], ['FR', -TRACK, AXLE_F], ['RL', TRACK, AXLE_R], ['RR', -TRACK, AXLE_R]], TYRE_R, RIM_R, 0.2, 7, 'alloy');
  return P;
}

// ---------------------------------------------------------------- the camper (a 1980s van conversion)

function camper(): Part[] {
  const AXLE_F = 1.5;
  const AXLE_R = -1.5;
  const TRACK = 0.82;
  const TYRE_R = 0.36;
  const RIM_R = 0.2;
  const SILL = 0.42;
  const BELT = 1.25;
  const ROOF = 2.25;
  const HW = 0.95;
  const P: Part[] = [];
  const part = (name: string, tris: Tri[], smooth = 0) => P.push({ name, tris, smooth });

  // Body: a one-box shell with a short nose, lofted from rounded sections; the floor under it.
  const ring = (z: number, w: number, b: number, t: number) => oval(0, (b + t) / 2, z, w, t - b, 20, 0.84);
  part('body', [...loft([ring(-2.6, 1.72, SILL + 0.08, ROOF - 0.1), ring(-2.45, 1.9, SILL, ROOF), ring(0.6, 1.9, SILL - 0.02, ROOF), ring(1.5, 1.88, SILL, ROOF - 0.05), ring(2.0, 1.8, SILL + 0.02, ROOF - 0.55), ring(2.35, 1.72, SILL + 0.06, BELT + 0.05), ring(2.6, 1.55, SILL + 0.15, BELT - 0.25)], 'paint', { closed: true, capStart: true, capEnd: true }), ...box([-0.85, SILL + 0.02, -2.4], [0.85, SILL + 0.06, 1.2], 'black')], 1);
  part('roof', box([-HW + 0.2, ROOF - 0.02, -2.3], [HW - 0.2, ROOF + 0.015, 1.6], 'paint'));
  // The pop-top: a hinged lid (sunroof) over the sleeping deck, its glass vent on it; the roof rack with a box; the awning rail.
  part('sunroof', [...box([-0.75, ROOF + 0.015, -2.0], [0.75, ROOF + 0.12, 0.5], 'paint'), ...box([-0.78, ROOF + 0.12, -2.0], [0.78, ROOF + 0.14, 0.5], 'canvas')], 1);
  part('sunroof_glass', box([-0.3, ROOF + 0.14, -1.2], [0.3, ROOF + 0.155, -0.4], 'glass'));
  part('roof_rack', [...both([...box([HW - 0.3, ROOF + 0.02, 0.6], [HW - 0.25, ROOF + 0.14, 1.5], 'black')]), ...[0.7, 1.4].flatMap((z) => cylinder([-HW + 0.3, ROOF + 0.14, z], [HW - 0.3, ROOF + 0.14, z], 0.015, 8, 'black'))]);
  part('roof_rack_box', [...both([...box([HW - 0.3, ROOF + 0.02, 0.6], [HW - 0.25, ROOF + 0.14, 1.5], 'black')]), ...roundedBox([0, ROOF + 0.3, 1.05], [1.1, 0.3, 0.9], 0.8, 'black')]);
  part('windshield', slab([HW - 0.1, ROOF - 0.55, 2.0], [-HW + 0.1, ROOF - 0.55, 2.0], [-HW + 0.1, BELT + 0.05, 2.33], [HW - 0.1, BELT + 0.05, 2.33], 0.006, 'glass'));
  part('wiper_L', wiper([0.25, BELT + 0.1, 2.33], 0.55, 20));
  part('wiper_R', wiper([-0.5, BELT + 0.1, 2.33], 0.55, 20));
  part('hood', slab([-0.7, BELT - 0.2, 2.35], [0.7, BELT - 0.2, 2.35], [0.62, BELT - 0.28, 2.6], [-0.62, BELT - 0.28, 2.6], 0.02, 'paint'));
  part('grille', [...slab([-0.55, BELT - 0.3, 2.62], [0.55, BELT - 0.3, 2.62], [0.55, BELT - 0.6, 2.6], [-0.55, BELT - 0.6, 2.6], 0.01, 'black'), ...[0, 1, 2].flatMap((i) => box([-0.52, BELT - 0.58 + i * 0.1, 2.6], [0.52, BELT - 0.55 + i * 0.1, 2.63], 'chrome'))]);
  part('radiator', box([-0.4, SILL + 0.3, 2.35], [0.4, BELT - 0.35, 2.42], 'black'));
  part('tailgate', [...slab([-0.78, ROOF - 0.12, -2.5], [0.78, ROOF - 0.12, -2.5], [0.78, SILL + 0.25, -2.62], [-0.78, SILL + 0.25, -2.62], 0.02, 'paint'), ...box([-0.1, SILL + 0.7, -2.64], [0.1, SILL + 0.75, -2.61], 'chrome')]);
  part('tailgate_glass', slab([-0.7, ROOF - 0.18, -2.52], [0.7, ROOF - 0.18, -2.52], [0.7, BELT + 0.1, -2.6], [-0.7, BELT + 0.1, -2.6], -0.006, 'glass'));
  const spare = wheelAndTyre([0, 0, 0], TYRE_R, RIM_R, 0.22, 8, 'black');
  part('spare_wheel', [...translate(rotateY([...spare.tire, ...spare.wheel], 90), [0.3, SILL + 0.75, -2.78]), ...tube([[0.3, SILL + 0.25, -2.62], [0.3, SILL + 0.25, -2.78], [0.3, SILL + 1.2, -2.78], [0.3, SILL + 1.2, -2.62]], 0.02, 8, 'black')]);
  part('fuel_door', slab([-HW - 0.004, BELT - 0.05, -2.0], [-HW - 0.004, BELT - 0.05, -1.8], [-HW - 0.004, BELT - 0.25, -1.8], [-HW - 0.004, BELT - 0.25, -2.0], -0.01, 'paint'));
  part('fuel_tank', roundedBox([-0.35, SILL + 0.05, -1.0], [0.9, 0.25, 0.8], 0.7, 'black'));
  part('exhaust', [...tube([[0.3, SILL, 1.2], [0.45, SILL - 0.02, -0.3], [0.6, SILL - 0.02, -2.3]], 0.025, 10, 'chrome'), ...roundedBox([0.5, SILL + 0.02, -1.9], [0.2, 0.16, 0.5], 0.6, 'alloy')]);
  part('exhaust_race', both([...tube([[0.3, SILL, 1.2], [0.5, SILL - 0.02, -0.3], [0.7, SILL - 0.02, -2.4]], 0.035, 10, 'chrome'), ...cylinder([0.7, SILL - 0.02, -2.4], [0.7, SILL - 0.02, -2.7], 0.045, 12, 'chrome')]));
  part('snorkel', [...tube([[HW - 0.1, BELT - 0.2, 2.0], [HW + 0.05, BELT, 1.9], [HW + 0.05, ROOF - 0.3, 1.7]], 0.04, 10, 'black'), ...rotateX(box([HW - 0.03, ROOF - 0.32, 1.6], [HW + 0.13, ROOF - 0.15, 1.85], 'black'), 15, [HW, ROOF - 0.3, 1.7])]);
  part('antenna', tube([[-HW + 0.1, BELT + 0.2, 2.3], [-HW + 0.05, BELT + 1.0, 2.2]], 0.005, 6, 'black'));

  // Bumpers: chrome blades (standard), heavy steel with a bull bar, race chin and splitter; a roof spoiler for racing.
  part('bumper_F', [...box([-HW + 0.1, SILL + 0.12, 2.6], [HW - 0.1, SILL + 0.3, 2.7], 'chrome'), ...box([-0.5, SILL - 0.05, 2.55], [0.5, SILL + 0.12, 2.65], 'black')]);
  part('bumper_F_heavy', [...box([-HW + 0.05, SILL + 0.05, 2.6], [HW - 0.05, SILL + 0.35, 2.75], 'black'), ...tube([[0.7, SILL + 0.35, 2.75], [0.7, BELT + 0.1, 2.8], [-0.7, BELT + 0.1, 2.8], [-0.7, SILL + 0.35, 2.75]], 0.035, 10, 'alloy'), ...tube([[0.5, SILL + 0.8, 2.78], [-0.5, SILL + 0.8, 2.78]], 0.03, 10, 'alloy')]);
  part('bumper_F_race', [...loft([oval(0, SILL + 0.2, 2.5, 1.8, 0.4, 16, 0.85), oval(0, SILL + 0.16, 2.75, 1.65, 0.34, 16, 0.8)], 'paint', { closed: true, capStart: true, capEnd: true }), ...box([-0.9, SILL - 0.05, 2.4], [0.9, SILL - 0.02, 2.85], 'carbon')], 1);
  part('bumper_R', [...box([-HW + 0.1, SILL + 0.12, -2.72], [HW - 0.1, SILL + 0.3, -2.62], 'chrome')]);
  part('bumper_R_heavy', [...box([-HW + 0.05, SILL + 0.02, -2.8], [HW - 0.05, SILL + 0.35, -2.62], 'black'), ...both(box([0.6, SILL - 0.1, -2.78], [0.7, SILL + 0.1, -2.5], 'black'))]);
  part('splitter', box([-0.95, SILL - 0.06, 2.4], [0.95, SILL - 0.03, 2.9], 'carbon'));
  part('wing_race', [...rotateX(box([-0.8, ROOF + 0.02, -2.6], [0.8, ROOF + 0.05, -2.25], 'carbon'), -12, [0, ROOF + 0.02, -2.25]), ...both(box([0.76, ROOF - 0.1, -2.45], [0.79, ROOF + 0.02, -2.25], 'carbon'))]);
  part('skidplate_F', slab([-0.6, SILL - 0.04, 2.5], [0.6, SILL - 0.04, 2.5], [0.6, SILL - 0.04, 1.2], [-0.6, SILL - 0.04, 1.2], 0.01, 'alloy'));
  part('light_bar', [...box([-0.7, ROOF + 0.14, 1.45], [0.7, ROOF + 0.24, 1.55], 'lamp_housing'), ...[-0.55, -0.33, -0.11, 0.11, 0.33, 0.55].flatMap((x) => lamp([x, ROOF + 0.19, 1.55], 0.04, 0.03, 'lamp'))]);

  // Sides: front doors with glass, the sliding door on the left with its window, the side windows (quarter glass; the cargo version leaves them out), steps, mirrors, lights.
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    const x = s * (HW - 0.005);
    part(`door_F${side}`, doorSkin(x, s, 0.95, 1.95, SILL + 0.1, BELT, ROOF - 0.5));
    part(`door_glass_F${side}`, doorGlass(x - s * 0.01, 0.95, 1.95, BELT, ROOF - 0.5));
    part(`quarter_glass_${side}`, [...slab([x - s * 0.02, ROOF - 0.5, s > 0 ? -0.5 : 0.85], [x - s * 0.02, ROOF - 0.5, -1.3], [x - s * 0.02, BELT + 0.02, -1.3], [x - s * 0.02, BELT + 0.02, s > 0 ? -0.5 : 0.85], 0.006 * s, 'glass'), ...slab([x - s * 0.02, ROOF - 0.5, -1.4], [x - s * 0.02, ROOF - 0.5, -2.35], [x - s * 0.02, BELT + 0.02, -2.35], [x - s * 0.02, BELT + 0.02, -1.4], 0.006 * s, 'glass')]);
    part(`fender_${side}`, arch(AXLE_F, TYRE_R, TYRE_R + 0.08, TYRE_R + 0.15, s > 0 ? HW - 0.14 : -HW - 0.01, s > 0 ? HW + 0.01 : -HW + 0.14, 'black', 0, 180), 0);
    part(`quarter_panel_${side}`, arch(AXLE_R, TYRE_R, TYRE_R + 0.08, TYRE_R + 0.15, s > 0 ? HW - 0.14 : -HW - 0.01, s > 0 ? HW + 0.01 : -HW + 0.14, 'black', 0, 180), 0);
    part(`side_skirt_${side}`, box([x - s * 0.04, SILL - 0.06, -1.0], [x + s * 0.08, SILL + 0.0, 0.9], 'black'));
    part(`side_skirt_${side}_heavy`, [...tube([[x + s * 0.02, SILL - 0.04, -1.1], [x + s * 0.02, SILL - 0.04, 1.0]], 0.035, 10, 'black'), ...tube([[x + s * 0.16, SILL + 0.02, -1.0], [x + s * 0.16, SILL + 0.02, 0.9]], 0.035, 10, 'black'), ...[-0.9, 0, 0.8].flatMap((z) => tube([[x + s * 0.02, SILL - 0.04, z], [x + s * 0.16, SILL + 0.02, z]], 0.025, 8, 'black'))]);
    part(`side_skirt_${side}_race`, box([x - s * 0.02, SILL - 0.08, -1.1], [x + s * 0.06, SILL + 0.1, 1.0], 'carbon'));
    part(`mirror_${side}`, doorMirror(x, s, BELT + 0.3, 1.9, true));
    part(`headlight_F${side}`, lamp([s * 0.62, BELT - 0.42, 2.58], 0.09, 0.05, 'lamp'));
    part(`taillight_R${side}`, box([s * 0.7 - 0.08, BELT - 0.2, -2.64], [s * 0.7 + 0.08, BELT + 0.1, -2.6], 'taillamp'));
    part(`mudflap_R${side}`, slab([s * (TRACK + 0.12), TYRE_R + 0.05, AXLE_R - 0.45], [s * (TRACK - 0.14), TYRE_R + 0.05, AXLE_R - 0.45], [s * (TRACK - 0.14), 0.12, AXLE_R - 0.5], [s * (TRACK + 0.12), 0.12, AXLE_R - 0.5], 0.006, 'black'));
    part(`tow_hook_${s > 0 ? 'F' : 'R'}`, lathe([[0.025, -0.012], [0.05, -0.012], [0.05, 0.012], [0.025, 0.012], [0.025, -0.012]], [s * 0.45, SILL + 0.1, s > 0 ? 2.74 : -2.75], 'z', 10, 'red', false));
  }
  part('sliding_door_L', [...doorSkin(HW - 0.005, 1, -0.45, 0.9, SILL + 0.1, BELT, ROOF - 0.5), ...doorGlass(HW - 0.03, -0.45, 0.9, BELT, ROOF - 0.5), ...box([HW - 0.04, SILL + 0.6, -0.3], [HW + 0.03, SILL + 0.65, -0.1], 'chrome')]);
  roadLights(P, 0.82, BELT - 0.25, 2.58, 0.72, BELT - 0.35, -2.64);

  // Interior: two swivel seats, a bench and a third row, the bed over the back, a kitchen cabinet, the dash, pedals, wheel, lever, head unit.
  for (const s of [1, -1] as const) {
    const c = s > 0 ? 'FL' : 'FR';
    const seat = seatParts([s * 0.5, SILL + 0.35, 1.3], 0.52, 'cloth');
    part(`seat_${c}_cushion`, [...seat.cushion, ...cylinder([s * 0.5, SILL + 0.06, 1.3], [s * 0.5, SILL + 0.25, 1.3], 0.12, 10, 'black')]);
    part(`seat_${c}_backrest`, seat.backrest);
  }
  const bench = (z: number, x0: number, x1: number) => [...box([x0, SILL + 0.35, z - 0.25], [x1, SILL + 0.47, z + 0.25], 'cloth'), ...rotateX(box([x0, SILL + 0.45, z - 0.3], [x1, SILL + 1.0, z - 0.23], 'cloth'), -10, [0, SILL + 0.45, z - 0.25])];
  part('seat_RL', bench(0.0, 0.1, 0.8));
  part('seat_RR', bench(0.0, -0.8, -0.1));
  part('seat_RL2', bench(-0.9, 0.1, 0.8));
  part('seat_RR2', bench(-0.9, -0.8, -0.1));
  part('bed', [...box([-0.8, SILL + 0.75, -2.35], [0.8, SILL + 0.95, -1.05], 'cloth'), ...box([-0.8, SILL + 0.1, -2.35], [0.8, SILL + 0.75, -1.1], 'wood')]);
  part('interior_trim_kitchen', [...box([-0.85, SILL + 0.1, -1.0], [-0.5, SILL + 0.95, 0.8], 'wood'), ...box([-0.84, SILL + 0.95, -0.95], [-0.5, SILL + 0.98, 0.75], 'alloy'), ...cylinder([-0.67, SILL + 0.98, 0.3], [-0.67, SILL + 1.12, 0.3], 0.02, 8, 'chrome')]);
  const dash = dashAndDials(BELT - 0.4, 1.95, 0.5, 1.7);
  part('dashboard', dash.dashboard);
  part('gauges', dash.gauges);
  for (const [n, tris] of Object.entries(dash.needles)) part(n, tris);
  part('steering_wheel', steeringWheel([0.5, BELT - 0.05, 1.75], 0.2, -45));
  part('throttle_pedal', pedal([0.36, SILL + 0.15, 2.15]));
  part('brake_pedal', pedal([0.5, SILL + 0.17, 2.15]));
  part('clutch_pedal', pedal([0.64, SILL + 0.17, 2.15]));
  part('handbrake', [...tube([[0.2, SILL + 0.3, 1.1], [0.2, SILL + 0.5, 1.2]], 0.01, 8, 'alloy'), ...box([0.17, SILL + 0.48, 1.17], [0.23, SILL + 0.53, 1.28], 'black')]);
  part('shifter', [...tube([[0.1, BELT - 0.45, 1.9], [0.2, BELT - 0.25, 1.75]], 0.01, 8, 'alloy'), ...sphere([0.2, BELT - 0.23, 1.74], 0.025, 8, 'black')]);
  part('radio', [...box([-0.18, BELT - 0.3, 1.92], [0.18, BELT - 0.16, 1.98], 'black'), ...slab([-0.16, BELT - 0.17, 1.915], [0.16, BELT - 0.17, 1.915], [0.16, BELT - 0.29, 1.915], [-0.16, BELT - 0.29, 1.915], -0.003, 'glass')]);
  part('carpet', box([-0.85, SILL + 0.06, -2.4], [0.85, SILL + 0.07, 2.0], 'cloth'));
  wheelsAt(P, [['FL', TRACK, AXLE_F], ['FR', -TRACK, AXLE_F], ['RL', TRACK, AXLE_R], ['RR', -TRACK, AXLE_R]], TYRE_R, RIM_R, 0.22, 8, 'alloy');
  return P;
}

// ---------------------------------------------------------------- write

const MATERIALS =(paint: [number, number, number], paint2: [number, number, number]): Record<string, [number, number, number, number, number?]> => ({
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
  amber: [0.9, 0.5, 0.05, 300],
  lamp_housing: [0.05, 0.05, 0.055, 40],
  taillamp: [0.55, 0.03, 0.03, 250],
  blue: [0.05, 0.15, 0.8, 300],
});

const CARS: { folder: string; file: string; title: string; build: () => Part[]; paint: [number, number, number]; paint2: [number, number, number] }[] = [
  { folder: 'crawler', file: 'forge_crawler', title: 'Forge Crawler: a rock-crawling buggy with a removable top', build: crawler, paint: [0.8, 0.35, 0.05], paint2: [0.1, 0.1, 0.1] },
  { folder: 'gp60', file: 'forge_gp60', title: 'Forge GP60: an early-1960s style Grand Prix car', build: grandPrix, paint: [0.05, 0.3, 0.12], paint2: [0.85, 0.75, 0.2] },
  { folder: 'hauler', file: 'forge_hauler', title: 'Forge Hauler 8x8: a twin-steer heavy haulage truck with a sleeper and 1200 L of fuel', build: hauler, paint: [0.1, 0.25, 0.55], paint2: [0.9, 0.9, 0.9] },
  { folder: 'estate', file: 'forge_estate', title: 'Forge Estate: a 1990s family wagon', build: estate, paint: [0.55, 0.08, 0.1], paint2: [0.2, 0.2, 0.22] },
  { folder: 'camper', file: 'forge_camper', title: 'Forge Camper: a 1980s van conversion with a pop-top', build: camper, paint: [0.85, 0.8, 0.6], paint2: [0.35, 0.5, 0.45] },
];

const only = process.argv[3]?.split(',');
for (const car of CARS.filter((c) => !only || only.includes(c.folder))) {
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
