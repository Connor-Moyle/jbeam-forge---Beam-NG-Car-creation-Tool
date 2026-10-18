import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isJbeamObject, parseJbeam } from '@shared/jbeam/parse';
import { gameWheelInfo, type GameWheel } from '@shared/wheels/game';
import { withZip } from './zip';

/** The game's wheels: every wheel part in the install's vehicles/common zip, for the wheel picker. */

const cache = new Map<string, { sig: string; list: GameWheel[] }>();

export async function scanWheels(installDir: string): Promise<GameWheel[]> {
  const dir = join(installDir, 'content', 'vehicles');
  let zips: string[] = [];
  try {
    zips = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('common.zip')).map((f) => join(dir, f));
  } catch {
    return [];
  }
  const sig = (await Promise.all(zips.map(async (z) => `${z}:${(await stat(z)).mtimeMs}`))).join('|');
  const hit = cache.get(installDir);
  if (hit?.sig === sig) return hit.list;
  const out: GameWheel[] = [];
  for (const zip of zips) {
    try {
      await withZip(zip, async (z) => {
        for (const e of await z.entries()) {
          if (!/vehicles\/common\/wheels\/.*\.jbeam$/i.test(e.name)) continue;
          const { value } = parseJbeam(await z.readText(e.name, 4 * 1024 * 1024));
          if (!isJbeamObject(value)) continue;
          for (const [part, body] of Object.entries(value)) {
            const w = isJbeamObject(body) ? gameWheelInfo(part, body) : null;
            if (w) out.push(w);
          }
        }
      });
    } catch {
      // unreadable zip: skip
    }
  }
  const list = out.sort((a, b) => a.brand.localeCompare(b.brand) || a.style.localeCompare(b.style) || a.diameter - b.diameter || a.width - b.width || a.part.localeCompare(b.part));
  cache.set(installDir, { sig, list });
  return list;
}
