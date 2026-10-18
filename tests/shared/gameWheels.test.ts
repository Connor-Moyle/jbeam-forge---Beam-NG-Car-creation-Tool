import { describe, expect, it } from 'vitest';
import type { JbeamObject } from '../../src/shared/jbeam/parse';
import { applyChoices, slotRows } from '../../src/shared/suspension/options';
import { gameWheelInfo, gameWheelLabel, setWheelSlot } from '../../src/shared/wheels/game';

const bruckell: JbeamObject = {
  information: {
    name: { txt: 'ui.vehicleconfig.generic.wheelName', ctx: { size: '18x8', type: { txt: 'ui.vehicleconfig.information.type.BRAND Luxe Front Wheels', ctx: { brand1: 'ui.vehicleconfig.brand.Bruckell' } }, color: 'ui.vehicleconfig.information.color.Two-Tone' } },
    value: 850,
  },
  slotType: 'wheel_F_5',
  slots: [['type', 'default', 'description'], ['tire_F_18x8_alt', 'tire_F_235_55_18_alt_standard', 'Front Tires']],
};

describe('the game’s wheel parts', () => {
  it('reads size, brand, style and colour out of the translated name', () => {
    const w = gameWheelInfo('bruckell_wheel_02a_18x8_F', bruckell)!;
    expect(w).toMatchObject({ end: 'F', slotType: 'wheel_F_5', lugs: '5', diameter: 18, width: 8, brand: 'Bruckell', style: 'Luxe', color: 'Two-Tone', value: 850 });
    expect(gameWheelLabel(w)).toBe('18x8 Bruckell Luxe (Two-Tone)');
  });

  it('reads plain names and the size out of the part name', () => {
    const w = gameWheelInfo('steelwheel_01a_15x7_R', { information: { name: '15x7 Steel Rear Wheels' }, slotType: 'wheel_R_4' })!;
    expect(w).toMatchObject({ end: 'R', lugs: '4', diameter: 15, width: 7, brand: 'Generic', style: 'Steel' });
    expect(gameWheelInfo('offroad_wheel_17x8_F', { information: { name: { txt: 'x', ctx: { type: { txt: 'ui.vehicleconfig.information.type.BRAND BRAND Front Wheels', ctx: { brand1: 'ui.vehicleconfig.brand.Hirochi' } } } } }, slotType: 'wheel_F_centerlug' })).toMatchObject({ lugs: 'centerlug', diameter: 17, width: 8, brand: 'Hirochi', style: 'Standard' });
  });

  it('is null for a part that is no wheel', () => {
    expect(gameWheelInfo('tire_F_235_55_18', { slotType: 'tire_F_18x8' })).toBeNull();
  });

  it('finds a set’s wheel slot and switches its default without copying the wheel in', () => {
    const hub: JbeamObject = { slotType: 'car_hub_F', slots: [['type', 'default', 'description'], ['wheel_F_5', 'steelwheel_01a_15x7_F', 'Front Wheels']] };
    const data = { parts: { car_hub_F: hub }, anchors: {}, root: 'car_hub_F' };
    expect(setWheelSlot(data.parts)).toEqual({ slotType: 'wheel_F_5', default: 'steelwheel_01a_15x7_F' });
    const out = applyChoices(data, { slots: [], parts: { bruckell_wheel_02a_18x8_F: bruckell }, anchors: {} }, { wheel_F_5: { default: 'bruckell_wheel_02a_18x8_F', offer: [] } });
    expect(Object.keys(out.parts)).toEqual(['car_hub_F']);
    expect(slotRows(out.parts.car_hub_F)[0]!.def).toBe('bruckell_wheel_02a_18x8_F');
    // A choice the options don't know (made before the game was scanned) still switches the default.
    expect(slotRows(applyChoices(data, undefined, { wheel_F_5: { default: 'other_wheel_F', offer: [] } }).parts.car_hub_F)[0]!.def).toBe('other_wheel_F');
  });
});
