import { describe, expect, it } from 'vitest';
import { principalDirections, projectedArea } from '../../src/shared/proxy/layout';
import { targetVertices } from '../../src/shared/proxy/presets';

describe('a part’s outline area', () => {
  it('is the area of a flat panel whichever way it faces', () => {
    // A 1 × 0.5 m door skin, standing up along the car (y, z), with a little curvature in x.
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 5; j++) pts.push(0.7 + 0.02 * Math.sin(i), i / 10, j / 10);
    expect(projectedArea(pts)).toBeCloseTo(0.5, 2);
    const [longest] = principalDirections(pts);
    expect(Math.abs(longest[1])).toBeGreaterThan(0.99);
  });

  it('is zero for a line or a point', () => {
    expect(projectedArea([0, 0, 0, 1, 0, 0, 2, 0, 0])).toBe(0);
    expect(projectedArea([0, 0, 0])).toBe(0);
  });

  it('sets the node count from the area and the game’s density, within the budget', () => {
    // A door at 0.85 m² and 16 nodes/m²: 14 nodes at the middle of the slider, as the game's doors.
    expect(targetVertices([10, 20], 0.5, 0.85, 16)).toBe(14);
    expect(targetVertices([10, 20], 1, 0.85, 16)).toBe(19);
    expect(targetVertices([10, 20], 0, 0.85, 16)).toBe(10);
    // A huge panel is still capped by the budget; no density falls back to the slider alone.
    expect(targetVertices([10, 20], 0.5, 5, 16)).toBe(20);
    expect(targetVertices([10, 20], 0.5)).toBe(15);
  });
});
