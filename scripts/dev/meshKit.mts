/**
 * A small mesh kit for building car models in code (the practice car's
 * engine bay, the showcase cars): triangles with planar texture coordinates,
 * a few primitives (boxes, lathes, lofts, tubes), welding into shared
 * points, crease-aware Loop subdivision for rounding, and an OBJ writer that
 * names every part as an object so the app sorts them on import.
 *
 * Model space is the OBJ's: Y up, +Z the front of the car, +X its left.
 */
import { writeFileSync } from 'node:fs';

export type V3 = [number, number, number];
export type V2 = [number, number];
export interface Tri {
  p: V3[];
  uv: V2[];
  mat: string;
}
export interface Mesh {
  pos: V3[];
  faces: { v: number[]; uv: V2[]; mat: string }[];
}

// ---------------------------------------------------------------- vectors

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const normal = (t: { p: V3[] }) => norm(cross(sub(t.p[1]!, t.p[0]!), sub(t.p[2]!, t.p[0]!)));

// ---------------------------------------------------------------- primitives (texture coordinates filled in by autoUv)

const NO_UV: V2[] = [
  [0, 0],
  [0, 0],
  [0, 0],
];
export const tri = (a: V3, b: V3, c: V3, mat: string): Tri => ({ p: [a, b, c], uv: NO_UV.map((u) => [...u] as V2), mat });
/** Two triangles; a, b, c, d go round the quad counter-clockwise seen from the side that shows. */
export const quad = (a: V3, b: V3, c: V3, d: V3, mat: string): Tri[] => [tri(a, b, c, mat), tri(a, c, d, mat)];
/** A fan over a convex polygon. */
export const polygon = (pts: V3[], mat: string): Tri[] => pts.slice(1, -1).map((_, i) => tri(pts[0]!, pts[i + 1]!, pts[i + 2]!, mat));

export function box(min: V3, max: V3, mat: string): Tri[] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const P = (x: number, y: number, z: number): V3 => [x, y, z];
  return [
    ...quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), mat), // front (+z)
    ...quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), mat), // back
    ...quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), mat), // left (−x)
    ...quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), mat), // right (+x)
    ...quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), mat), // top
    ...quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), mat), // bottom
  ];
}

/**
 * Skin between successive rings of points (each ring the same count). Rings
 * are joined last-to-first when `closed`; the first and last rings can be
 * capped with a fan. Ring points go counter-clockwise seen from the ring's
 * outside-facing direction of travel (from ring i to i+1 is "forward").
 */
export function loft(rings: V3[][], mat: string, opts: { closed?: boolean; capStart?: boolean; capEnd?: boolean } = {}): Tri[] {
  const closed = opts.closed ?? true;
  const out: Tri[] = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i]!;
    const b = rings[i + 1]!;
    const n = a.length;
    for (let j = 0; j < (closed ? n : n - 1); j++) {
      const k = (j + 1) % n;
      out.push(...quad(a[j]!, a[k]!, b[k]!, b[j]!, mat));
    }
  }
  if (opts.capStart) out.push(...polygon([...rings[0]!].reverse(), mat));
  if (opts.capEnd) out.push(...polygon(rings[rings.length - 1]!, mat));
  return out;
}

/** A ring of n points in the plane z = const: an ellipse w × h (full sizes), squarer as `square` → 1. */
export function oval(cx: number, cy: number, z: number, w: number, h: number, n: number, square = 0, yScaleBottom = 1): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Superellipse: exponent from 2 (ellipse) toward 0 (box).
    const e = 2 - 1.6 * square;
    const x = Math.sign(c) * Math.abs(c) ** (2 / e) * (w / 2);
    const y = Math.sign(s) * Math.abs(s) ** (2 / e) * (h / 2) * (s < 0 ? yScaleBottom : 1);
    out.push([cx + x, cy + y, z]);
  }
  return out;
}

/** A surface of revolution: profile points [radius, distance along axis] turned about an axis through `origin`. */
export function lathe(profile: V2[], origin: V3, axis: 'x' | 'y' | 'z', segments: number, mat: string, closed = true): Tri[] {
  const rings = profile.map(([r, t]) => {
    const ring: V3[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const u = Math.cos(a) * r;
      const v = Math.sin(a) * r;
      ring.push(axis === 'z' ? [origin[0] + u, origin[1] + v, origin[2] + t] : axis === 'x' ? [origin[0] + t, origin[1] + v, origin[2] + u] : [origin[0] + u, origin[1] + t, origin[2] + v]);
    }
    return ring;
  });
  return loft(rings, mat, { closed: true, capStart: closed && profile[0]![0] > 0, capEnd: closed && profile[profile.length - 1]![0] > 0 });
}

export function cylinder(a: V3, b: V3, r: number, segs: number, mat: string, caps = true): Tri[] {
  const d = norm(sub(b, a));
  const helper: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, helper));
  const v = cross(d, u);
  const ring = (c: V3) => Array.from({ length: segs }, (_, i): V3 => add(c, add(mul(u, Math.cos((i / segs) * Math.PI * 2) * r), mul(v, Math.sin((i / segs) * Math.PI * 2) * r))));
  return loft([ring(a), ring(b)], mat, { closed: true, capStart: caps, capEnd: caps });
}

/** Round bar along a polyline (a roll cage): one cylinder per leg, a ball at each joint. */
export function tube(path: V3[], r: number, segs: number, mat: string): Tri[] {
  const out: Tri[] = [];
  for (let i = 0; i + 1 < path.length; i++) out.push(...cylinder(path[i]!, path[i + 1]!, r, segs, mat, false));
  for (let i = 0; i < path.length; i++) out.push(...sphere(path[i]!, r, Math.max(6, segs / 2), mat));
  return out;
}

export function sphere(c: V3, r: number, segs: number, mat: string): Tri[] {
  const profile: V2[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    profile.push([Math.sin(a) * r, -Math.cos(a) * r]);
  }
  return lathe(profile, c, 'y', segs * 2, mat, false);
}

/** A 2D outline (x, y) pulled from z0 to z1 (bumper bars, plates). Points go counter-clockwise seen from +z. */
export function prism(profile: V2[], z0: number, z1: number, mat: string): Tri[] {
  const front = profile.map(([x, y]): V3 => [x, y, z1]);
  const back = profile.map(([x, y]): V3 => [x, y, z0]);
  const out = loft([back, front], mat, { closed: true });
  out.push(...polygon(front, mat), ...polygon([...back].reverse(), mat));
  return out;
}

/** A flat panel with thickness along its normal direction: the four corners (counter-clockwise from the shown side), pushed back by `t`. */
export function slab(a: V3, b: V3, c: V3, d: V3, t: number, mat: string): Tri[] {
  const n = norm(cross(sub(b, a), sub(d, a)));
  const back = [a, b, c, d].map((p) => sub(p, mul(n, t)));
  return [...quad(a, b, c, d, mat), ...quad(back[3]!, back[2]!, back[1]!, back[0]!, mat), ...loft([[a, b, c, d], back as V3[]], mat, { closed: true })];
}

// ---------------------------------------------------------------- transforms

export const mapPoints = (tris: Tri[], f: (p: V3) => V3): Tri[] => tris.map((t) => ({ ...t, p: t.p.map(f) }));
export const translate = (tris: Tri[], d: V3) => mapPoints(tris, (p) => add(p, d));
export const scaleAbout = (tris: Tri[], s: V3, about: V3 = [0, 0, 0]) => mapPoints(tris, (p) => [about[0] + (p[0] - about[0]) * s[0], about[1] + (p[1] - about[1]) * s[1], about[2] + (p[2] - about[2]) * s[2]]);
export function rotateY(tris: Tri[], deg: number, about: V3 = [0, 0, 0]): Tri[] {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return mapPoints(tris, (p) => [about[0] + (p[0] - about[0]) * c + (p[2] - about[2]) * s, p[1], about[2] - (p[0] - about[0]) * s + (p[2] - about[2]) * c]);
}
export function rotateX(tris: Tri[], deg: number, about: V3 = [0, 0, 0]): Tri[] {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return mapPoints(tris, (p) => [p[0], about[1] + (p[1] - about[1]) * c - (p[2] - about[2]) * s, about[2] + (p[1] - about[1]) * s + (p[2] - about[2]) * c]);
}
export function rotateZ(tris: Tri[], deg: number, about: V3 = [0, 0, 0]): Tri[] {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return mapPoints(tris, (p) => [about[0] + (p[0] - about[0]) * c - (p[1] - about[1]) * s, about[1] + (p[0] - about[0]) * s + (p[1] - about[1]) * c, p[2]]);
}
/** The mirror image across the car's centre line (x → −x), facing the same way out. */
export const mirrorX = (tris: Tri[]): Tri[] => tris.map((t) => ({ ...t, p: [t.p[0]!, t.p[2]!, t.p[1]!].map((p): V3 => [-p[0], p[1], p[2]]), uv: [t.uv[0]!, t.uv[2]!, t.uv[1]!] }));
/** Both sides: the piece and its mirror image. */
export const both = (tris: Tri[]): Tri[] => [...tris, ...mirrorX(tris)];

/** Planar texture coordinates from each triangle's main direction (box projection), `scale` metres per tile. */
export function autoUv(tris: Tri[], scale = 1): Tri[] {
  return tris.map((t) => {
    const n = normal(t).map(Math.abs);
    const axis = n[0]! >= n[1]! && n[0]! >= n[2]! ? 0 : n[1]! >= n[2]! ? 1 : 2;
    const [ua, va] = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1];
    return { ...t, uv: t.p.map((p): V2 => [p[ua]! / scale, p[va]! / scale]) };
  });
}

// ---------------------------------------------------------------- welding and smoothing

export function weld(tris: Tri[], tolerance = 1e-5): Mesh {
  const ids = new Map<string, number>();
  const pos: V3[] = [];
  const faces: Mesh['faces'] = [];
  const q = 1 / tolerance;
  for (const t of tris) {
    const v = t.p.map((p) => {
      const k = p.map((c) => Math.round(c * q)).join(',');
      let id = ids.get(k);
      if (id === undefined) {
        id = pos.length;
        ids.set(k, id);
        pos.push([...p]);
      }
      return id;
    });
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    faces.push({ v, uv: t.uv.map((u) => [...u] as V2), mat: t.mat });
  }
  return { pos, faces };
}

/** One step of Loop subdivision; edges sharper than `creaseDeg`, on the border or between materials stay sharp. */
export function loop(m: Mesh, creaseDeg: number): Mesh {
  const ek = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edges = new Map<string, { a: number; b: number; faces: number[]; opp: number[] }>();
  m.faces.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = f.v[k]!;
      const b = f.v[(k + 1) % 3]!;
      const key = ek(a, b);
      let e = edges.get(key);
      if (!e) edges.set(key, (e = { a, b, faces: [], opp: [] }));
      e.faces.push(fi);
      e.opp.push(f.v[(k + 2) % 3]!);
    }
  });
  const fn = m.faces.map((f) => norm(cross(sub(m.pos[f.v[1]!]!, m.pos[f.v[0]!]!), sub(m.pos[f.v[2]!]!, m.pos[f.v[0]!]!))));
  const cosC = Math.cos((creaseDeg * Math.PI) / 180);
  const crease = (e: { faces: number[] }) => e.faces.length !== 2 || dot(fn[e.faces[0]!]!, fn[e.faces[1]!]!) < cosC || m.faces[e.faces[0]!]!.mat !== m.faces[e.faces[1]!]!.mat;
  const edgePoint = new Map<string, number>();
  const pos: V3[] = [];
  const nbr = new Map<number, Set<number>>();
  const creaseNbr = new Map<number, number[]>();
  for (const e of edges.values()) {
    for (const [p, q] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as const) {
      (nbr.get(p) ?? nbr.set(p, new Set()).get(p)!).add(q);
      if (crease(e)) (creaseNbr.get(p) ?? creaseNbr.set(p, []).get(p)!).push(q);
    }
  }
  m.pos.forEach((v, i) => {
    const cn = creaseNbr.get(i) ?? [];
    const ns = [...(nbr.get(i) ?? [])];
    if (cn.length > 2 || ns.length < 3) {
      pos.push([...v]);
      return;
    }
    if (cn.length === 2) {
      const [c1, c2] = [m.pos[cn[0]!]!, m.pos[cn[1]!]!];
      pos.push([0.75 * v[0] + 0.125 * (c1[0] + c2[0]), 0.75 * v[1] + 0.125 * (c1[1] + c2[1]), 0.75 * v[2] + 0.125 * (c1[2] + c2[2])]);
      return;
    }
    const n = ns.length;
    const beta = n === 3 ? 3 / 16 : 3 / (8 * n);
    const s: V3 = [0, 0, 0];
    for (const q of ns) for (let k = 0; k < 3; k++) s[k] += m.pos[q]![k]!;
    pos.push([(1 - n * beta) * v[0] + beta * s[0], (1 - n * beta) * v[1] + beta * s[1], (1 - n * beta) * v[2] + beta * s[2]]);
  });
  for (const [key, e] of edges) {
    const a = m.pos[e.a]!;
    const b = m.pos[e.b]!;
    let p: V3;
    if (crease(e)) p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    else {
      const c = m.pos[e.opp[0]!]!;
      const d = m.pos[e.opp[1]!]!;
      p = [0.375 * (a[0] + b[0]) + 0.125 * (c[0] + d[0]), 0.375 * (a[1] + b[1]) + 0.125 * (c[1] + d[1]), 0.375 * (a[2] + b[2]) + 0.125 * (c[2] + d[2])];
    }
    edgePoint.set(key, pos.length);
    pos.push(p);
  }
  const faces: Mesh['faces'] = [];
  const mid = (p: V2, q: V2): V2 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  for (const f of m.faces) {
    const [a, b, c] = f.v as [number, number, number];
    const [ta, tb, tc] = f.uv as [V2, V2, V2];
    const ab = edgePoint.get(ek(a, b))!;
    const bc = edgePoint.get(ek(b, c))!;
    const ca = edgePoint.get(ek(c, a))!;
    const tab = mid(ta, tb);
    const tbc = mid(tb, tc);
    const tca = mid(tc, ta);
    faces.push({ v: [a, ab, ca], uv: [ta, tab, tca], mat: f.mat }, { v: [ab, b, bc], uv: [tab, tb, tbc], mat: f.mat }, { v: [ca, bc, c], uv: [tca, tbc, tc], mat: f.mat }, { v: [ab, bc, ca], uv: [tab, tbc, tca], mat: f.mat });
  }
  return { pos, faces };
}

export function smoothNormals(m: Mesh, creaseDeg = 40): V3[][] {
  const fnrm = m.faces.map((f) => norm(cross(sub(m.pos[f.v[1]!]!, m.pos[f.v[0]!]!), sub(m.pos[f.v[2]!]!, m.pos[f.v[0]!]!))));
  const around = new Map<number, number[]>();
  m.faces.forEach((f, i) => f.v.forEach((v) => (around.get(v) ?? around.set(v, []).get(v)!).push(i)));
  const cosC = Math.cos((creaseDeg * Math.PI) / 180);
  return m.faces.map((f, i) =>
    f.v.map((v) => {
      const s: V3 = [0, 0, 0];
      for (const j of around.get(v) ?? [i]) {
        if (dot(fnrm[i]!, fnrm[j]!) < cosC || m.faces[j]!.mat !== f.mat) continue;
        for (let k = 0; k < 3; k++) s[k] += fnrm[j]![k]!;
      }
      return norm(s);
    }),
  );
}

// ---------------------------------------------------------------- OBJ

/** Write the parts as one OBJ, an object per part. Returns the triangle count. */
export function writeObj(file: string, parts: readonly { name: string; mesh: Mesh }[], mtllib: string, header: readonly string[]): number {
  const lines = [...header.map((h) => `# ${h}`), `mtllib ${mtllib}`];
  let vb = 1;
  let tb = 1;
  let nb = 1;
  let triangles = 0;
  for (const { name, mesh } of parts) {
    lines.push(`o ${name}`);
    const nrm = smoothNormals(mesh);
    for (const p of mesh.pos) lines.push(`v ${p.map((c) => c.toFixed(4)).join(' ')}`);
    const uvIndex = new Map<string, number>();
    const nIndex = new Map<string, number>();
    const vt: string[] = [];
    const vn: string[] = [];
    const fl: string[] = [];
    let mat = '';
    mesh.faces.forEach((f, i) => {
      if (f.mat !== mat) fl.push(`usemtl ${(mat = f.mat)}`);
      const c = f.v.map((v, k) => {
        const uk = `${f.uv[k]![0].toFixed(4)} ${f.uv[k]![1].toFixed(4)}`;
        let ui = uvIndex.get(uk);
        if (ui === undefined) {
          ui = tb + uvIndex.size;
          uvIndex.set(uk, ui);
          vt.push(`vt ${uk}`);
        }
        const n = nrm[i]![k]!;
        const nk = n.map((x) => x.toFixed(3)).join(' ');
        let ni = nIndex.get(nk);
        if (ni === undefined) {
          ni = nb + nIndex.size;
          nIndex.set(nk, ni);
          vn.push(`vn ${nk}`);
        }
        return `${vb + v}/${ui}/${ni}`;
      });
      fl.push(`f ${c.join(' ')}`);
    });
    triangles += mesh.faces.length;
    lines.push(...vt, ...vn, ...fl);
    vb += mesh.pos.length;
    tb += uvIndex.size;
    nb += nIndex.size;
  }
  writeFileSync(file, `${lines.join('\n')}\n`);
  return triangles;
}

/** A .mtl from simple colours: name → [r, g, b, shininess, opacity?]. */
export function mtlText(materials: Readonly<Record<string, [number, number, number, number, number?]>>): string {
  return Object.entries(materials)
    .map(([name, [r, g, b, ns, d]]) => `newmtl ${name}\nKd ${r} ${g} ${b}\nKs ${(ns / 1000).toFixed(2)} ${(ns / 1000).toFixed(2)} ${(ns / 1000).toFixed(2)}\nNs ${ns}${d !== undefined ? `\nd ${d}` : ''}\n`)
    .join('\n');
}
