import { describe, expect, it } from 'vitest';
import { blendFileText, blendRef, latchEvents, pitchSamples, resolveBlendTexts } from '../../src/shared/sound/blend';
import { applyPowertrainEdits, GEAR_WHINE } from '../../src/shared/powertrain/edits';
import { buildFeatureParts, type FeatureContext } from '../../src/shared/export/features';
import { emptySound, type Features } from '../../src/shared/project/schema';

const ctx: FeatureContext = { slug: 'car', author: 'me', groupOf: () => 'car_body', nodes: [], hasPart: (id) => id === 'body', bodyPartId: 'body', hasEngine: false };
const none: Features = { plates: { front: null, rear: null }, hitch: null, nitrous: null, skins: [] };

describe('the mod’s own sounds', () => {
  it('writes a blend in the game’s shape, one layer per load, rpm rising, pitched', () => {
    const samples = pitchSamples([{ path: 'a.ogg', rpm: 2000, load: 1 }, { path: 'b.ogg', rpm: 1000, load: 1 }, { path: 'c.ogg', rpm: 1500, load: 0 }], 1.1);
    const text = blendFileText(samples);
    const parsed = JSON.parse(text) as { header: { version: number }; eventName: string; samples: unknown[][] };
    expect(parsed.header.version).toBe(1);
    expect(parsed.samples).toEqual([[['c.ogg', 1650, 0]], [['b.ogg', 1100, 1], ['a.ogg', 2200, 1]]]);
    // One load only: one layer of [path, rpm], as the game's own files are.
    expect((JSON.parse(blendFileText([{ path: 'a.ogg', rpm: 900, load: 1 }])) as { samples: unknown[][] }).samples).toEqual([[['a.ogg', 900]]]);
  });

  it('points an engine at the mod’s blend by its exported name, and at the game’s when the blend is gone', () => {
    const blends = [{ id: 'b1', name: 'rev_i4', base: 'I4', rpmScale: 1.2, samples: [] }];
    expect(resolveBlendTexts({ 'eng/soundConfig/sampleName': blendRef('b1'), 'eng/soundConfigExhaust/sampleName': 'V8' }, 'mymod', blends)).toEqual({ 'eng/soundConfig/sampleName': 'mymod_rev_i4', 'eng/soundConfigExhaust/sampleName': 'V8' });
    expect(resolveBlendTexts({ 'eng/soundConfig/sampleName': blendRef('gone') }, 'mymod', blends)).toEqual({});
  });

  it('scales a gearbox’s whine', () => {
    const parts = { box: { gearbox: { gearRatios: [-3, 0, 3, 2], gearWhineCoefsInput: [0.6, 0, 0.12, 0.12], gearWhineCoefsOutput: [0, 0, 0.24, 0.24] } } };
    const out = applyPowertrainEdits(parts, 'box', { fields: { [GEAR_WHINE]: 0.5 }, torque: null, gearRatios: null });
    expect((out.box!.gearbox as { gearWhineCoefsInput: number[]; gearWhineCoefsOutput: number[] }).gearWhineCoefsInput).toEqual([0.3, 0, 0.06, 0.06]);
    expect((out.box!.gearbox as { gearWhineCoefsOutput: number[] }).gearWhineCoefsOutput).toEqual([0, 0, 0.12, 0.12]);
    // The game's own when untouched.
    expect(applyPowertrainEdits(parts, 'box', { fields: {}, torque: null, gearRatios: null }).box).toBe(parts.box);
  });

  it('gives the body a horn slot (the stock horn, or the chosen one) and its cabin muffling', () => {
    const stock = buildFeatureParts(none, ctx);
    expect(stock.partSlots.get('body')).toContainEqual(['soundscape_horn', ['soundscape_horn'], [], 'soundscape_horn_1', 'Horn']);
    expect(stock.bodySections).toEqual({});
    const mine = buildFeatureParts({ ...none, sound: { ...emptySound(), horn: 'soundscape_horn_12', cabinFilterCoef: 0.3 } }, ctx);
    expect(mine.partSlots.get('body')).toContainEqual(['soundscape_horn', ['soundscape_horn'], [], 'soundscape_horn_12', 'Horn']);
    expect(mine.bodySections).toEqual({ sounds: { cabinFilterCoef: 0.3 } });
  });

  it('names the latch recordings of each kind of part', () => {
    expect(latchEvents('door', null)).toEqual({ attach: 'event:>Vehicle>Latches>Door>modern_06_close', detach: 'event:>Vehicle>Latches>Door>modern_06_open' });
    expect(latchEvents('hood', 'vintage_03').attach).toBe('event:>Vehicle>Latches>Hood>vintage_03_close');
    expect(latchEvents('trunk', undefined).detach).toBe('event:>Vehicle>Latches>Trunk>modern_05_open');
  });
});
