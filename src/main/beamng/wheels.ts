import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isJbeamObject, parseJbeam, type JbeamObject } from '@shared/jbeam/parse';
import { slotRows } from '@shared/suspension/options';
import { gameWheelInfo, type GameWheel } from '@shared/wheels/game';
import { withZip } from './zip';

/** The game's wheels and tyres: every part in the install's vehicles/common zip, for the wheel picker and for axles that carry their own copies. */

const cache = new Map<string, { sig: string; parts: Map<string, JbeamObject>; list: GameWheel[] }>();

async function commonParts(installDir: string): Promise<{ parts: Map<string, JbeamObject>; list: GameWheel[] }> {
  const dir = join(installDir, 'content', 'vehicles');
  let zips: string[] = [];
  try {
    zips = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('common.zip')).map((f) => join(dir, f));
  } catch {
    return { parts: new Map(), list: [] };
  }
  const sig = (await Promise.all(zips.map(async (z) => `${z}:${(await stat(z)).mtimeMs}`))).join('|');
  const hit = cache.get(installDir);
  if (hit?.sig === sig) return hit;
  const parts = new Map<string, JbeamObject>();
  const list: GameWheel[] = [];
  for (const zip of zips) {
    try {
      await withZip(zip, async (z) => {
        for (const e of await z.entries()) {
          const wheel = /vehicles\/common\/wheels\/.*\.jbeam$/i.test(e.name);
          if (!wheel && !/vehicles\/common\/tires\/.*\.jbeam$/i.test(e.name)) continue;
          const { value } = parseJbeam(await z.readText(e.name, 4 * 1024 * 1024));
          if (!isJbeamObject(value)) continue;
          for (const [part, body] of Object.entries(value)) {
            if (!isJbeamObject(body)) continue;
            parts.set(part, body);
            const w = wheel ? gameWheelInfo(part, body) : null;
            if (w) list.push(w);
          }
        }
      });
    } catch {
      // unreadable zip: skip
    }
  }
  list.sort((a, b) => a.brand.localeCompare(b.brand) || a.style.localeCompare(b.style) || a.diameter - b.diameter || a.width - b.width || a.part.localeCompare(b.part));
  const entry = { sig, parts, list };
  cache.set(installDir, entry);
  return entry;
}

export async function scanWheels(installDir: string): Promise<GameWheel[]> {
  return (await commonParts(installDir)).list;
}

/** The named wheel parts and the tyres (and anything else) their slots fit by default, by part name; names the common zip doesn't have are left out. */
export async function wheelPartClosure(installDir: string, names: readonly string[]): Promise<Record<string, JbeamObject>> {
  const { parts } = await commonParts(installDir);
  const out: Record<string, JbeamObject> = {};
  const queue = [...names];
  while (queue.length && Object.keys(out).length < 64) {
    const name = queue.shift()!;
    const body = parts.get(name);
    if (!body || out[name]) continue;
    out[name] = body;
    for (const r of slotRows(body)) if (r.def) queue.push(r.def);
  }
  return out;
}
