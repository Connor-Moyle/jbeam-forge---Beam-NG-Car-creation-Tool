import { isJbeamObject, type JbeamObject } from '../jbeam/parse';
import { firstSlotType } from '../jbeam/slots';
import { slotRows } from '../suspension/options';

/**
 * The game's own wheels (vehicles/common/wheels): every car can take them,
 * so a mod needn't carry them. A wheel part's name is a translation key
 * with the size, style and brand as context; this reads it into fields a
 * picker can filter on.
 */

export interface GameWheel {
  /** The part name (bruckell_wheel_01a_17x8_F). */
  part: string;
  end: 'F' | 'R';
  /** The slot it fits (wheel_F_5). */
  slotType: string;
  /** From the slot: 3, 4, 5, 6, 8 or "centerlug". */
  lugs: string;
  /** Rim diameter and width in inches (0 when the name doesn't say). */
  diameter: number;
  width: number;
  brand: string;
  /** "Luxe", "Off-Road Steel"… */
  style: string;
  /** Colour or finish when named ("Two-Tone"). */
  color: string;
  /** Price in the game. */
  value: number;
}

const BRAND = /^ui\.vehicleconfig\.brand\.(.+)$/;
const TYPE = /^ui\.vehicleconfig\.information\.(?:type|name)\.(.+?)(?:\s+(?:Front|Rear)\s+Wheels?)?$/;

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** A wheel part's fields, or null when the part isn't a wheel (no wheel_F_… / wheel_R_… slot type). */
export function gameWheelInfo(part: string, body: JbeamObject): GameWheel | null {
  const slotType = firstSlotType(body);
  const m = /^wheel_([FR])_([a-z0-9]+)/i.exec(slotType);
  if (!m) return null;
  const info = isJbeamObject(body.information) ? body.information : {};
  const name = info.name;
  let size = '';
  let style = '';
  let brand = '';
  let color = '';
  if (isJbeamObject(name)) {
    const ctx = isJbeamObject(name.ctx) ? name.ctx : {};
    size = text(ctx.size);
    color = text(ctx.color).replace(/^ui\.vehicleconfig\.information\.color\./, '');
    const type = ctx.type;
    if (isJbeamObject(type)) {
      const tctx = isJbeamObject(type.ctx) ? type.ctx : {};
      brand = BRAND.exec(text(tctx.brand1))?.[1] ?? '';
      style = TYPE.exec(text(type.txt))?.[1] ?? text(type.txt);
    } else if (typeof type === 'string') style = TYPE.exec(type)?.[1] ?? type;
    // "BRAND Luxe" → "Luxe"; "BRAND BRAND" (the brand's own, unnamed) → Standard.
    style = style.replace(/\bBRAND\b/g, '').replace(/\s+/g, ' ').trim() || 'Standard';
  } else if (typeof name === 'string') {
    // Plain names: "15x7 Steel Wheels", "Hirochi 17x8 Sport Front Wheels".
    const s = name.replace(/\s+(Front|Rear)\s+Wheels?$/i, '').replace(/\s+Wheels?$/i, '');
    size = /\b(\d{2})x(\d{1,2}(?:\.\d)?)\b/.exec(s)?.[0] ?? '';
    style = s.replace(size, '').replace(/\s+/g, ' ').trim();
  }
  if (!size) size = /_(\d{2}x\d{1,2}(?:\.\d)?)(?:_|$)/.exec(part)?.[1] ?? '';
  const [d, w] = size.split('x').map(Number);
  return {
    part,
    end: m[1]!.toUpperCase() as 'F' | 'R',
    slotType,
    lugs: m[2]!.toLowerCase(),
    diameter: Number.isFinite(d) ? d! : 0,
    width: Number.isFinite(w) ? w! : 0,
    brand: brand || 'Generic',
    style: style || 'Wheel',
    color,
    value: typeof info.value === 'number' ? info.value : 0,
  };
}

/** What a wheel is called in a list: "17x8 Bruckell Luxe (Two-Tone)". */
export function gameWheelLabel(w: GameWheel): string {
  const size = w.diameter ? `${w.diameter}x${w.width}` : '';
  return [size, w.brand === 'Generic' ? '' : w.brand, w.style, w.color ? `(${w.color})` : ''].filter(Boolean).join(' ');
}

/** The wheel slot a set's parts declare (its hub's wheel_F_5…), with the game's default for it. */
export function setWheelSlot(parts: Readonly<Record<string, JbeamObject>>): { slotType: string; default: string } | null {
  for (const body of Object.values(parts)) for (const r of slotRows(body)) if (/^wheel_[FR]_/i.test(r.key)) return { slotType: r.key, default: r.def };
  return null;
}
