import { beforeEach, describe, expect, it } from 'vitest';
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { createEmptyProject } from '../../src/shared/project/io';
import { projectStore } from '../../src/renderer/app/stores/project';
import { useSceneStore } from '../../src/renderer/app/stores/scene';
import { mirrorSetMoves, movedSetMeshes, resetSetMoves, updateAxle } from '../../src/renderer/suspension/commands';
import type { ImportedMesh } from '../../src/renderer/import/normalize';

const mesh = (key: string, sourceId: string): ImportedMesh => ({ key, sourceId, name: key.slice(sourceId.length + 1), geometry: new BoxGeometry(1, 1, 1), material: new MeshBasicMaterial(), triangles: 12 });
const source = (id: string) => ({ id, path: `${id}.dae`, absolutePath: `C:/${id}.dae`, format: 'dae' as const, import: { scale: 1, upAxis: '+z' as const, forwardAxis: '-y' as const }, textureDirs: [], placement: { position: [0, -1.3, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1 }, addedAt: '2026-01-01T00:00:00.000Z' });
const edit = (position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => ({ position, rotation, scale: [1, 1, 1] as [number, number, number], uv: { scale: [1, 1] as [number, number], offset: [0, 0] as [number, number], rotation: 0 } });

beforeEach(() => {
  const doc = createEmptyProject({ name: 'Test', slug: 'test' }, '0.1.0', new Date('2026-01-01T00:00:00Z'));
  doc.sources.push(source('sus'));
  doc.axles.push({ id: 'front', name: 'Front', y: -1.3, track: 1.5, steered: true, tuning: {}, ownMeshes: [], fitted: { setId: 'set', name: 'Strut', vehicle: 'Sunburst', type: 'MacPherson', sourceId: 'sus', track: 1.5 } });
  doc.meshEdits['sus:arm_FL'] = edit([0.02, 0, -0.01], [5, 10, 15]);
  doc.meshEdits['sus:subframe'] = edit([0, 0, 0.03]);
  projectStore.getState().load(doc, 'C:/test.jbforge');
  useSceneStore.getState().clear();
  const meshes = ['sus:arm_FL', 'sus:arm_FR', 'sus:subframe'].map((k) => mesh(k, 'sus'));
  useSceneStore.getState().setSource({ sourceId: 'sus', status: 'ready', fingerprint: 'x', fileName: 'sus.dae', raw: meshes, meshes, splitsKey: '[]', textures: null, error: null, stats: null });
});

describe('moving a fitted suspension’s own meshes', () => {
  it('lists the moved ones', () => {
    expect(movedSetMeshes(projectStore.getState().doc!, 'sus').sort()).toEqual(['sus:arm_FL', 'sus:subframe']);
  });

  it('mirrors a side’s moves onto the other side, sideways and the turns about the other axes the other way', () => {
    expect(mirrorSetMoves('sus', [])).toBe(1);
    const e = projectStore.getState().doc!.meshEdits['sus:arm_FR']!;
    expect(e.position).toEqual([-0.02, 0, -0.01]);
    expect(e.rotation).toEqual([5, -10, -15]);
    // Both sides moved now: nothing more to mirror unless one is picked.
    expect(mirrorSetMoves('sus', [])).toBe(0);
    expect(mirrorSetMoves('sus', ['sus:arm_FR'])).toBe(1);
  });

  it('resets every move of the set', () => {
    resetSetMoves('sus');
    expect(movedSetMeshes(projectStore.getState().doc!, 'sus')).toEqual([]);
  });

  it('moves the set along the car with its axle', () => {
    updateAxle('front', { y: -1.25 });
    const doc = projectStore.getState().doc!;
    expect(doc.axles[0]!.y).toBe(-1.25);
    expect(doc.sources[0]!.placement.position).toEqual([0, -1.25, 0]);
  });
});
