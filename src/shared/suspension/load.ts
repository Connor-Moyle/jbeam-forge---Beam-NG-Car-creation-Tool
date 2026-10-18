import { isJbeamObject, type JbeamObject } from '../jbeam/parse';

/**
 * A suspension's springs are sized for the car it came from. Under a car much heavier it sits low,
 * rests on its bump stops and rubs the arches; under one much lighter it sits high and rides hard.
 * In testing the Covet's suspension (a 1,000 kg car) under a 1,400 kg body sat on the ground and
 * broke an arm and a wing at spawn.
 */
export const OVERLOADED = 1.25;
export const UNDERLOADED = 0.6;

export interface LoadCheck {
  /** This car's weight over the weight of the car the suspension came from. */
  ratio: number;
  state: 'over' | 'under' | 'fine';
}

export function suspensionLoad(carKg: number | null | undefined, donorKg: number | null | undefined): LoadCheck | null {
  if (!carKg || !donorKg || carKg <= 0 || donorKg <= 0) return null;
  const ratio = carKg / donorKg;
  return { ratio, state: ratio >= OVERLOADED ? 'over' : ratio <= UNDERLOADED ? 'under' : 'fine' };
}

/**
 * A set edit key (axle.edits.fields): every spring and damper of the set scaled by this, so the
 * suspension carries this car the way it carried its own. Springs ×k keep the static ride height
 * (deflection = weight / rate); dampers ×k keep the damping ratio (c / 2√(k·m) with k and m both ×k).
 */
export const SPRING_SCALE = '$springScale';

/** The scale that matches a set to this car, 2 decimals, or null when the weights suit each other (or aren't known). */
export function springScaleFor(carKg: number | null | undefined, donorKg: number | null | undefined): number | null {
  const check = suspensionLoad(carKg, donorKg);
  return check && check.state !== 'fine' ? Math.round(check.ratio * 100) / 100 : null;
}

/** The set's spring and damper parts: struts, coilovers, springs (leaf, coil, air), shocks. */
export const SPRING_PART = /strut|coilover|coil|spring|shock|damper|airbag|leaf/i;
/** Springs and bump stops sit below this rate (N/m); the parts' structural beams above it. */
const STRUCTURAL_SPRING = 1e6;
const DAMPING_KEYS = ['beamDamp', 'beamDampRebound', 'beamDampFast', 'beamDampReboundFast'] as const;

/**
 * Every spring rate and damping in the set's spring and damper parts scaled by k (a copy; parts
 * not touched are shared). Rates at or above the structural range stay: a strut's tube is not a
 * spring.
 */
export function scaleSprings(parts: Readonly<Record<string, JbeamObject>>, k: number): Record<string, JbeamObject> {
  if (!(k > 0) || k === 1) return { ...parts };
  const r = (n: number) => Math.round(n * k * 100) / 100;
  const scaleOptions = (o: JbeamObject): JbeamObject => {
    let out = o;
    if (typeof o.beamSpring === 'number' && o.beamSpring >= STRUCTURAL_SPRING) return o;
    if (typeof o.beamSpring === 'number' && o.beamSpring > 0) out = { ...out, beamSpring: r(o.beamSpring) };
    for (const key of DAMPING_KEYS) if (typeof o[key] === 'number' && (o[key]) > 0) out = { ...out, [key]: r(o[key]) };
    return out;
  };
  const out: Record<string, JbeamObject> = { ...parts };
  for (const [name, body] of Object.entries(parts)) {
    if (!SPRING_PART.test(name) || !Array.isArray(body.beams)) continue;
    out[name] = { ...body, beams: body.beams.map((row, i) => (i === 0 ? row : isJbeamObject(row) ? scaleOptions(row) : Array.isArray(row) ? row.map((c) => (isJbeamObject(c) ? scaleOptions(c) : c)) : row)) };
  }
  return out;
}

/** What to tell the modder, or null when the weights suit each other (or aren't known). */
export function suspensionLoadWarning(set: { name: string; vehicleName: string; vehicleWeight?: number }, axle: string, carKg: number | null | undefined): string | null {
  const check = suspensionLoad(carKg, set.vehicleWeight);
  if (!check || check.state === 'fine') return null;
  const kg = (n: number) => `${Math.round(n / 10) * 10} kg`;
  const from = `${set.name} on the ${axle} axle was made for the ${set.vehicleName}, about ${kg(set.vehicleWeight!)}. This car is about ${kg(carKg!)}`;
  if (check.state === 'over')
    return `${from}, ${Math.round((check.ratio - 1) * 100)}% more: it will sit low and can rest on its bump stops or rub the arches. Choose stiffer or taller springs in the suspension's options and tuning, fit a suspension from a heavier car, or lighten the car.`;
  return `${from}, ${Math.round((1 - check.ratio) * 100)}% less: it will sit high and ride hard. Choose softer springs in the suspension's options and tuning, or fit a suspension from a lighter car.`;
}
