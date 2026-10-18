/**
 * Every drivable car in the install, read part by part and sorted into the kinds the generator
 * builds (body shell, doors, hood, boot, wings, bumpers, glass, trim, suspension arms, engine
 * blocks…): node weight, beams per node, beam length, spring, damping, deform, strength, nodes
 * per part. Medians over all cars, with the preset the generator uses beside each, so a drift
 * between the game's cars and our numbers shows up. Aggregates only: nothing from the game's
 * files is kept.
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/dev/study-all-cars.mts [install dir] [--json out.json]
 *   npx tsx --tsconfig tsconfig.node.json scripts/dev/study-all-cars.mts --mod <exported mod folder>   (ours, the same table)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yauzl from 'yauzl';
import { isJbeamObject, parseJbeam, type JbeamObject } from '../../src/shared/jbeam/parse';
import { readTable } from '../../src/shared/jbeam/tables';
import { BEAM_PRESET_VALUES } from '../../src/shared/proxy/presets';
import { projectedArea } from '../../src/shared/proxy/layout';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const modDir = args.includes('--mod') ? args[args.indexOf('--mod') + 1] : null;
const install = args.find((a) => !a.startsWith('--') && a !== jsonOut && a !== modDir) ?? (JSON.parse(readFileSync(join(process.env.APPDATA ?? '', 'jbeam-forge', 'settings.json'), 'utf8')) as { beamngInstallDir: string }).beamngInstallDir;
const dir = join(install, 'content', 'vehicles');
if (!modDir && !existsSync(dir)) throw new Error(`no vehicles at ${dir}`);

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.jbeam') ? [join(d, f)] : []));
}

function zipTexts(file: string): Promise<string[]> {
  return new Promise((res, rej) => {
    const out: string[] = [];
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return rej(err ?? new Error('not a zip'));
      zip.on('entry', (e: yauzl.Entry) => {
        if (!e.fileName.endsWith('.jbeam')) return zip.readEntry();
        zip.openReadStream(e, (err2, stream) => {
          if (err2 || !stream) return rej(err2 ?? new Error('unreadable entry'));
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            out.push(Buffer.concat(chunks).toString('utf8'));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => res(out));
      zip.readEntry();
    });
  });
}

/** The kind a game part is, from its name and slot type (first match wins). */
const KINDS: [string, RegExp][] = [
  ['body', /_(body|cab|frame)(_|$)/i],
  ['door', /_door_(fl|fr|rl|rr)$/i],
  ['hood', /_hood(_|$)/i],
  ['trunk', /_(trunk|tailgate|liftgate)(_|$)/i],
  ['fender', /_(fender|quarterpanel)(_|$)/i],
  ['roof', /_roof(_|$)/i],
  ['bumper', /_bumper_(f|r)(_|$)/i],
  ['side_skirt', /_sideskirt|_skirt/i],
  ['spoiler', /_spoiler|_wing(_|$)/i],
  ['mirror', /_mirror/i],
  ['glass', /_(windshield|glass|window)/i],
  ['light', /_(headlight|taillight|foglight|lights?)(_|$)/i],
  ['grille', /_grille/i],
  ['seat', /_seat/i],
  ['dash', /_dash/i],
  ['radiator', /_radiator/i],
  ['exhaust', /_exhaust/i],
  ['fuel_tank', /_fueltank/i],
  ['subframe', /_subframe/i],
  ['suspension', /_(suspension|strut|coilover|swaybar|steering|hub|lowerarm|upperarm|leafspring|axle|shock)/i],
  ['engine', /_engine(_|$)/i],
  ['transmission', /_(transmission|transaxle|transfer_case|differential)/i],
  ['intake', /_(intake|turbo|supercharger)/i],
];
/** Which of our presets each kind should match. */
const PRESET_OF: Record<string, keyof typeof BEAM_PRESET_VALUES | null> = {
  body: 'structure_stiff', subframe: 'structure_stiff', door: 'panel_metal', hood: 'panel_metal', trunk: 'panel_metal', fender: 'panel_metal', roof: 'panel_metal',
  bumper: 'panel_plastic', side_skirt: 'panel_plastic', spoiler: 'panel_plastic', mirror: 'trim_light', grille: 'trim_light', light: 'trim_light', exhaust: 'trim_light',
  glass: 'glass_brittle', seat: 'trim_light', dash: 'trim_light', radiator: 'mechanical_light', fuel_tank: 'mechanical_light', suspension: 'mechanical', engine: 'mechanical_block', transmission: 'mechanical_block', intake: 'mechanical_light',
};
const kindOf = (name: string, slot: string) => KINDS.find(([, re]) => re.test(name) || re.test(slot))?.[0] ?? null;

const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : v === 'FLT_MAX' ? Infinity : fallback);
const median = (a: number[]) => {
  const f = a.filter(Number.isFinite);
  if (!f.length) return NaN;
  const s = [...f].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};
const pct = (a: number[], p: number) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : NaN;
};

interface Sample { weight: number[]; perNode: number[]; length: number[]; spring: number[]; damp: number[]; deform: number[]; strength: number[]; nodesPerPart: number[]; trisPerNode: number[]; area: number[]; density: number[]; attachPerPart: number[]; attachPerNode: number[]; attachedShare: number[]; parts: number; cars: Set<string> }
const by = new Map<string, Sample>();
const sample = (k: string) => by.get(k) ?? by.set(k, { weight: [], perNode: [], length: [], spring: [], damp: [], deform: [], strength: [], nodesPerPart: [], trisPerNode: [], area: [], density: [], attachPerPart: [], attachPerNode: [], attachedShare: [], parts: 0, cars: new Set() }).get(k)!;

const zips = modDir ? [modDir] : readdirSync(dir).filter((f) => f.endsWith('.zip') && f !== 'common.zip');
let cars = 0;
for (const zip of zips) {
  const texts = modDir ? walk(modDir).map((f) => readFileSync(f, 'utf8')) : await zipTexts(join(dir, zip));
  const parts: Record<string, JbeamObject> = {};
  for (const t of texts) {
    try {
      const v = parseJbeam(t).value;
      if (isJbeamObject(v)) for (const [k, p] of Object.entries(v)) if (isJbeamObject(p)) parts[k] = p;
    } catch {
      // unreadable file: left out
    }
  }
  // A car has a body with a steering wheel somewhere; props and trailers are left out.
  const car = !!modDir || (Object.entries(parts).some(([n]) => /_(body|cab)(_|$)/.test(n)) && Object.keys(parts).some((n) => /steer/.test(n)));
  if (!car) continue;
  cars++;
  const nodes = new Map<string, { pos: [number, number, number]; weight: number; part: string }>();
  for (const [name, p] of Object.entries(parts)) {
    if (!Array.isArray(p.nodes)) continue;
    try {
      for (const r of readTable(p.nodes).records) {
        const pos = [Number(r.values.posX), Number(r.values.posY), Number(r.values.posZ)] as [number, number, number];
        if (typeof r.values.id === 'string' && pos.every(Number.isFinite) && !nodes.has(r.values.id)) nodes.set(r.values.id, { pos, weight: Number(r.options.nodeWeight ?? 25), part: name });
      }
    } catch {
      // not a table
    }
  }
  for (const [name, p] of Object.entries(parts)) {
    const kind = kindOf(name, typeof p.slotType === 'string' ? p.slotType : '');
    if (!kind) continue;
    const own = [...nodes.values()].filter((n) => n.part === name);
    if (!own.length) continue;
    let beams: { a: string; b: string; spring: number; damp: number; deform: number; strength: number }[] = [];
    if (Array.isArray(p.beams)) {
      try {
        beams = readTable(p.beams).records.filter((r) => String(r.options.beamType ?? '|NORMAL') === '|NORMAL').map((r) => ({ a: String(r.values['id1:']), b: String(r.values['id2:']), spring: num(r.options.beamSpring, 4_300_000), damp: num(r.options.beamDamp, 580), deform: num(r.options.beamDeform, 220_000), strength: num(r.options.beamStrength, 2_200_000) }));
      } catch {
        // not a table
      }
    }
    const s = sample(kind);
    s.parts++;
    s.cars.add(zip);
    s.nodesPerPart.push(own.length);
    s.weight.push(...own.map((n) => n.weight));
    const per = new Map<string, number>();
    // Attachments: the part's beams that reach a node of another part.
    let attach = 0;
    const attached = new Set<string>();
    for (const b of beams) {
      const A = nodes.get(b.a);
      const B = nodes.get(b.b);
      if (!A || !B) continue;
      if (A.part !== B.part && (A.part === name || B.part === name)) {
        attach++;
        attached.add(A.part === name ? b.a : b.b);
      }
      // Beams within the part only: attachments to the parent are another preset.
      if (A.part !== name || B.part !== name) continue;
      per.set(b.a, (per.get(b.a) ?? 0) + 1);
      per.set(b.b, (per.get(b.b) ?? 0) + 1);
      s.length.push(Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]));
      s.spring.push(b.spring);
      s.damp.push(b.damp);
      s.deform.push(b.deform);
      s.strength.push(b.strength);
    }
    for (const n of own) s.perNode.push(per.get([...nodes.entries()].find(([, v]) => v === n)![0]) ?? 0);
    const tris = Array.isArray(p.triangles) ? p.triangles.filter((r) => Array.isArray(r)).length - 1 : 0;
    s.trisPerNode.push(Math.max(0, tris) / own.length);
    const area = projectedArea(own.flatMap((n) => n.pos));
    if (area > 0.02) {
      s.area.push(area);
      s.density.push(own.length / area);
    }
    s.attachPerPart.push(attach);
    if (attached.size) {
      s.attachPerNode.push(attach / attached.size);
      s.attachedShare.push(attached.size / own.length);
    }
  }
}

const k = (x: number) => (!Number.isFinite(x) ? '∞' : x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(0)}k` : x.toFixed(0));
const lines = [`${cars} cars. Medians of each part kind over every car (nodes per part as p10–median–p90). Our preset in brackets where it differs by more than half or double.`, '', '| kind | parts | nodes/part | area m² | nodes/m² | kg/node | beams/node | attach/part | attach/node | attached | length m | spring | damp | deform | strength | tris/node |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
const out: Record<string, Record<string, number>> = {};
for (const [kind, s] of [...by.entries()].sort((a, b) => b[1].parts - a[1].parts)) {
  const preset = PRESET_OF[kind] ? BEAM_PRESET_VALUES[PRESET_OF[kind]!] : null;
  const cmp = (ours: number | null | undefined, theirs: number) => (ours == null || !Number.isFinite(theirs) ? '' : theirs > ours * 2 || theirs < ours / 2 ? ` (ours ${k(ours)})` : '');
  const m = { weight: median(s.weight), perNode: median(s.perNode), length: median(s.length), spring: median(s.spring), damp: median(s.damp), deform: median(s.deform), strength: median(s.strength), nodes: median(s.nodesPerPart), tris: median(s.trisPerNode), area: median(s.area), density: median(s.density), attachPerPart: median(s.attachPerPart), attachPerNode: median(s.attachPerNode), attachedShare: median(s.attachedShare) };
  out[kind] = { ...m, parts: s.parts, cars: s.cars.size, nodesP10: pct(s.nodesPerPart, 0.1), nodesP90: pct(s.nodesPerPart, 0.9), densityP25: pct(s.density, 0.25), densityP75: pct(s.density, 0.75) };
  lines.push(`| ${kind} | ${s.parts} | ${pct(s.nodesPerPart, 0.1)}–${m.nodes}–${pct(s.nodesPerPart, 0.9)} | ${m.area.toFixed(2)} | ${m.density.toFixed(0)} | ${m.weight.toFixed(2)}${cmp(preset?.nodeWeight, m.weight)} | ${m.perNode.toFixed(1)} | ${m.attachPerPart.toFixed(0)} | ${m.attachPerNode.toFixed(1)} | ${(m.attachedShare * 100).toFixed(0)}% | ${m.length.toFixed(2)} | ${k(m.spring)}${cmp(preset?.beamSpring, m.spring)} | ${k(m.damp)}${cmp(preset?.beamDamp, m.damp)} | ${k(m.deform)}${cmp(preset?.beamDeform, m.deform)} | ${k(m.strength)}${cmp(preset?.beamStrength ?? Infinity, m.strength)} | ${m.tris.toFixed(2)} |`);
}
console.log(lines.join('\n'));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2));
