import { describe, expect, it } from 'vitest';
import { trackChange, trackMatrix, trackMoves, type MeshBox } from '@shared/suspension/track';
import { transformPoint } from '@shared/mesh/meshEdit';

const box = (key: string, x0: number, x1: number): MeshBox => ({ key, min: [x0, -1.4, 0.2], max: [x1, -1.2, 0.4] });

// A front end whose own track is 1.5 m (hub faces 0.75 m from the centre line), Sunburst-like extents.
const SET: MeshBox[] = [box('subframe', -0.41, 0.41), box('swaybar', -0.62, 0.62), box('arm_R', -0.7, -0.34), box('hub_R', -0.75, -0.55), box('shaft_R', -0.65, -0.15), box('bracket_R', -0.3, -0.2), box('hub_L', 0.55, 0.75)];

describe('a fitted suspension at the axle’s track', () => {
  it('moves hubs out, stretches arms from their inner end and bars about the centre, leaves the subframe', () => {
    const moves = new Map(trackMoves(SET, { half: 0.75, d: 0.05, centre: 0 }).map((m) => [m.key, m]));
    expect([...moves.keys()].sort()).toEqual(['arm_R', 'hub_L', 'hub_R', 'shaft_R', 'swaybar']);
    expect(moves.get('hub_R')).toMatchObject({ translate: [-0.05, 0, 0], scale: [1, 1, 1] });
    expect(moves.get('hub_L')).toMatchObject({ translate: [0.05, 0, 0] });
    // The arm's inner pivot stays where it is, its outer end moves the same 5 cm as the hub.
    const arm = trackMatrix(moves.get('arm_R')!);
    expect(transformPoint(arm, [-0.34, -1.3, 0.3])[0]).toBeCloseTo(-0.34);
    expect(transformPoint(arm, [-0.7, -1.3, 0.3])[0]).toBeCloseTo(-0.75);
    const bar = trackMatrix(moves.get('swaybar')!);
    expect(transformPoint(bar, [0.62, -1.3, 0.3])[0]).toBeCloseTo(0.67);
    expect(transformPoint(bar, [0, -1.3, 0.3])[0]).toBeCloseTo(0);
  });

  it('works about the set’s own centre line when the set sits off the car’s middle', () => {
    const moves = trackMoves([box('hub_L', 0.65, 0.85)], { half: 0.75, d: 0.05, centre: 0.1 });
    expect(moves[0]).toMatchObject({ translate: [0.05, 0, 0] });
  });

  it('does nothing for no change', () => {
    expect(trackMoves(SET, { half: 0.75, d: 0, centre: 0 })).toEqual([]);
  });

  it('reads the change an axle asks of its fitted set', () => {
    const fitted = { setId: 's', name: 'n', vehicle: 'v', type: 't', sourceId: 'src', track: 1.5 };
    const doc = { axles: [{ id: 'a', name: 'Front', y: -1.3, track: 1.6, steered: true, tuning: {}, ownMeshes: [], fitted }], sources: [{ id: 'src', placement: { position: [0.1, 0, 0], rotation: [0, 0, 0], scale: 1 } }] } as never;
    expect(trackChange(doc, 'src')).toEqual({ half: 0.75, d: 0.05, centre: 0.1 });
    expect(trackChange(doc, 'other')).toBeNull();
    expect(trackChange({ ...(doc as object), axles: [{ ...(doc as { axles: unknown[] }).axles[0] as object, track: 1.5 }] } as never, 'src')).toBeNull();
  });
});
