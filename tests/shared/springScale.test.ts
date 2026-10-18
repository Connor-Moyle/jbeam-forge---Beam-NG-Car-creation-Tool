import { describe, expect, it } from 'vitest';
import { scaleSprings, SPRING_SCALE, springScaleFor } from '../../src/shared/suspension/load';
import { applyDrivelineEdits } from '../../src/shared/powertrain/driveline';
import { emptyEdits } from '../../src/shared/project/schema';
import type { JbeamObject } from '../../src/shared/jbeam/parse';

const parts: Record<string, JbeamObject> = {
  car_strut_F: {
    beams: [
      ['id1:', 'id2:'],
      { beamPrecompression: 1, beamType: '|NORMAL' },
      { beamSpring: 5001000, beamDamp: 250 }, // the strut's tube: structure, not a spring
      ['fh1r', 'fs2r'],
      { beamSpring: 26000, beamDamp: 0 },
      ['fh1r', 'fs1r', { beamPrecompression: 1.2 }],
      { beamSpring: 0, beamDamp: 4000 },
      ['fh1r', 'fs1r', { name: 'shock_FR', beamDampFast: 1600, beamDampRebound: 6900, beamDampReboundFast: 2300, beamDampVelocitySplit: 0.2 }],
    ],
  },
  car_hub_F: { beams: [['id1:', 'id2:'], { beamSpring: 40000, beamDamp: 100 }, ['fh1r', 'fh2r']] },
};

describe('springs scaled to the car’s weight', () => {
  it('wants a scale only when the weights are far apart', () => {
    expect(springScaleFor(1400, 1000)).toBe(1.4);
    expect(springScaleFor(4440, 2190)).toBe(2.03);
    expect(springScaleFor(1100, 1000)).toBeNull();
    expect(springScaleFor(500, 1000)).toBe(0.5);
    expect(springScaleFor(null, 1000)).toBeNull();
  });

  it('scales the spring and damper parts’ rates and damping, not their structure nor other parts', () => {
    const out = scaleSprings(parts, 2);
    const beams = out.car_strut_F!.beams as unknown[];
    expect(beams[2]).toEqual({ beamSpring: 5001000, beamDamp: 250 }); // the tube: structure, left alone
    expect(beams[4]).toEqual({ beamSpring: 52000, beamDamp: 0 });
    expect(beams[6]).toEqual({ beamSpring: 0, beamDamp: 8000 });
    expect((beams[7] as unknown[])[2]).toEqual({ name: 'shock_FR', beamDampFast: 3200, beamDampRebound: 13800, beamDampReboundFast: 4600, beamDampVelocitySplit: 0.2 });
    expect(out.car_hub_F).toBe(parts.car_hub_F);
    expect(scaleSprings(parts, 1).car_strut_F).toBe(parts.car_strut_F);
  });

  it('is applied through the axle’s edits', () => {
    const edits = emptyEdits();
    edits.fields[SPRING_SCALE] = 1.5;
    const out = applyDrivelineEdits(parts, edits);
    expect((out.car_strut_F!.beams as unknown[])[4]).toEqual({ beamSpring: 39000, beamDamp: 0 });
  });
});
