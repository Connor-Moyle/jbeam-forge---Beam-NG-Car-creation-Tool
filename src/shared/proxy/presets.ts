import type { BEAM_PRESETS, TaxonomyEntry } from '../taxonomy/schema';
import type { ProxyMode } from './build';

/**
 * Beam presets, attachment styles and per-kind proxy defaults. Values are
 * the medians of each part kind over the game's 38 cars (BeamNG 0.39,
 * docs/structure-study.md) — re-measure with scripts/dev/study-all-cars.mts before changing.
 */

export type BeamPresetId = (typeof BEAM_PRESETS)[number];

export interface BeamValues {
  beamSpring: number;
  beamDamp: number;
  beamDeform: number;
  /** null = FLT_MAX (unbreakable), as official engine blocks use. */
  beamStrength: number | null;
}

export interface BeamPreset extends BeamValues {
  label: string;
  /** Typical official node weight for this kind of part (kg) — informational. */
  nodeWeight: number;
  nodeMaterial: '|NM_METAL' | '|NM_PLASTIC' | '|NM_GLASS' | '|NM_RUBBER';
  /** Braces are softer than skin edges. */
  braceSpringFactor: number;
}

export const BEAM_PRESET_VALUES: Record<BeamPresetId, BeamPreset> = {
  structure_stiff: { label: 'Stiff structure', beamSpring: 2_500_000, beamDamp: 125, beamDeform: 11_000, beamStrength: 150_000, nodeWeight: 3, nodeMaterial: '|NM_METAL', braceSpringFactor: 0.6 },
  panel_metal: { label: 'Metal panel', beamSpring: 700_000, beamDamp: 60, beamDeform: 7_000, beamStrength: 65_000, nodeWeight: 0.9, nodeMaterial: '|NM_METAL', braceSpringFactor: 0.5 },
  // Stiffness stays at the old values where the game's would be higher: our generated nodes are
  // lighter than the game's (a thin skirt's weigh 0.15 kg, a steering wheel's 0.5 kg), and at the
  // game's 400k–1.5M those parts blew up at spawn in the 2000 Hz check. Deform and strength are the game's.
  panel_plastic: { label: 'Plastic panel', beamSpring: 200_000, beamDamp: 60, beamDeform: 8_000, beamStrength: 55_000, nodeWeight: 0.6, nodeMaterial: '|NM_PLASTIC', braceSpringFactor: 0.5 },
  // Bumpers are nearly as stiff as doors in the game (800k) on nodes of about 1 kg; a little under that here.
  panel_bumper: { label: 'Bumper', beamSpring: 600_000, beamDamp: 80, beamDeform: 15_000, beamStrength: 59_000, nodeWeight: 1.1, nodeMaterial: '|NM_PLASTIC', braceSpringFactor: 0.5 },
  trim_light: { label: 'Light trim', beamSpring: 600_000, beamDamp: 50, beamDeform: 8_000, beamStrength: 55_000, nodeWeight: 0.6, nodeMaterial: '|NM_PLASTIC', braceSpringFactor: 0.5 },
  glass_brittle: { label: 'Glass', beamSpring: 250_000, beamDamp: 50, beamDeform: 4_000, beamStrength: 6_000, nodeWeight: 1.2, nodeMaterial: '|NM_GLASS', braceSpringFactor: 0.5 },
  mechanical: { label: 'Mechanical', beamSpring: 5_000_000, beamDamp: 140, beamDeform: 60_000, beamStrength: 350_000, nodeWeight: 4.5, nodeMaterial: '|NM_METAL', braceSpringFactor: 0.7 },
  mechanical_light: { label: 'Light mechanical', beamSpring: 300_000, beamDamp: 70, beamDeform: 15_000, beamStrength: 40_000, nodeWeight: 1, nodeMaterial: '|NM_METAL', braceSpringFactor: 0.6 },
  mechanical_block: { label: 'Mechanical block', beamSpring: 6_000_000, beamDamp: 400, beamDeform: 175_000, beamStrength: null, nodeWeight: 15, nodeMaterial: '|NM_METAL', braceSpringFactor: 0.8 },
  tyre_rubber: { label: 'Tyre rubber', beamSpring: 50_000, beamDamp: 10, beamDeform: 20_000, beamStrength: null, nodeWeight: 0.5, nodeMaterial: '|NM_RUBBER', braceSpringFactor: 0.5 },
};

export const ATTACHMENT_STYLES = ['bolted', 'clipped', 'rivets', 'welded'] as const;
export type AttachmentStyle = (typeof ATTACHMENT_STYLES)[number];

export const ATTACHMENT_VALUES: Record<AttachmentStyle, BeamValues & { label: string; links: number; breakGroup: boolean }> = {
  bolted: { label: 'Bolted', links: 3, beamSpring: 400_000, beamDamp: 40, beamDeform: 12_000, beamStrength: 65_000, breakGroup: true },
  clipped: { label: 'Clipped', links: 2, beamSpring: 150_000, beamDamp: 20, beamDeform: 4_000, beamStrength: 8_000, breakGroup: true },
  rivets: { label: 'Rivets', links: 3, beamSpring: 600_000, beamDamp: 50, beamDeform: 15_000, beamStrength: 40_000, breakGroup: true },
  welded: { label: 'Welded', links: 4, beamSpring: 1_000_000, beamDamp: 60, beamDeform: 20_000, beamStrength: 150_000, breakGroup: false },
};

export const BRACING_DENSITIES = ['none', 'light', 'standard', 'heavy'] as const;
export type BracingDensity = (typeof BRACING_DENSITIES)[number];

/**
 * How a part gets its jbeam structure:
 *   own        — a generated proxy (its own nodes/beams)
 *   rides      — no nodes: its mesh binds to the parent part's nodes (official badges, lights, gauges… — 106 of
 *                the Sunburst's meshed parts work this way)
 *   suspension — built by the suspension system from its geometry (Phase 10): arms, hubs, struts, steering, brakes
 */
export const STRUCTURE_ROLES = ['own', 'rides', 'suspension'] as const;
export type StructureRole = (typeof STRUCTURE_ROLES)[number];

export interface KindDefaults {
  role: StructureRole;
  mode: ProxyMode;
  /** Vertex budget range (SPEC §4.4); the Detail slider moves within it. */
  budget: [number, number];
  bracing: BracingDensity;
  attachment: AttachmentStyle;
}

const RIDERS = new Set(['badge', 'sunstrip', 'gauges', 'radio', 'plate_light', 'brake_light', 'indicator', 'underglow', 'license_plate', 'door_handle', 'window_switch', 'interior_mirror', 'seatbelt', 'headliner', 'carpet', 'parcel_shelf', 'trunk_trim', 'interior_trim', 'trim', 'pedals', 'police_lights', 'wiper', 'rear_wiper', 'antenna', 'engine_cover']);
const SUSPENSION_SUBCATEGORIES = new Set(['Suspension', 'Steering', 'Wheels', 'Brakes']);
const SUSPENSION_IDS = new Set(['halfshaft', 'driveshaft', 'axle', 'steering_column']);
/** Parts fitted from the game (a suspension, engine or gearbox): the game's own nodes and beams go into the mod, so nothing is generated for them. */
export const GAME_SET_IDS: ReadonlySet<string> = new Set(['suspension_set', 'engine_set', 'gearbox_set']);

const CYLINDERS = new Set(['driveshaft', 'halfshaft', 'axle', 'lower_arm', 'upper_arm', 'trailing_arm', 'link', 'sway_bar', 'tie_rod', 'steering_column', 'strut', 'coilover', 'spring', 'antenna']);
const HULLS = new Set(['hub', 'knuckle', 'brake_disc', 'brake_caliper', 'brake_drum', 'radiator', 'intercooler', 'oil_cooler', 'fuel_tank', 'nitrous', 'battery', 'washer_tank', 'intake', 'turbo', 'supercharger', 'engine_mount', 'steering_rack', 'muffler', 'wheel', 'spare_wheel', 'shifter', 'pedals', 'handbrake', 'steering_wheel', 'seat', 'rear_seat', 'tow_hitch', 'tow_hook']);

/**
 * Node budgets of the panels the game's cars all build alike, measured over all 38 of them
 * (docs/structure-study.md): a door has 15 or 16 nodes, a hood 13 (up to 27), a boot lid 10 (up
 * to 20), a wing 10 (up to 20), a roof 10 (up to 22). The middle of each range is that count.
 */
const PANEL_BUDGETS: Record<string, [number, number]> = { door: [10, 20], hood: [12, 26], trunk: [10, 20], tailgate: [10, 20], fender: [8, 18], quarter_panel: [8, 18], roof: [10, 22] };

/** Proxy mode, budget, bracing and attachment defaults for a part kind (user-overridable per part). */
export function kindDefaults(entry: TaxonomyEntry): KindDefaults {
  const attachment: AttachmentStyle = entry.beamPreset === 'glass_brittle' ? 'clipped' : entry.subcategory === 'Structure' || entry.category === 'Mechanical' ? 'bolted' : entry.beamPreset === 'panel_plastic' || entry.beamPreset === 'panel_bumper' || entry.beamPreset === 'trim_light' ? 'clipped' : 'bolted';
  const base = { bracing: 'standard' as BracingDensity, attachment, role: 'own' as StructureRole };
  if (entry.beamPreset === 'tyre_rubber' || SUSPENSION_SUBCATEGORIES.has(entry.subcategory) || SUSPENSION_IDS.has(entry.id) || GAME_SET_IDS.has(entry.id)) return { ...base, role: 'suspension', mode: 'cylinder', budget: [4, 8] };
  if (RIDERS.has(entry.id)) return { ...base, role: 'rides', mode: 'decimate', budget: [4, 8], bracing: 'none' };
  // The shell follows its surface: a hull would bridge the wheel arches, with collision faces through the tyres.
  if (entry.id === 'body' || entry.id === 'frame' || entry.id === 'cab') return { ...base, mode: 'surface', budget: [100, 180], bracing: 'heavy' };
  // Everything else is wrapped in its convex hull: closed, well braced, and closest to correct.
  if (entry.beamPreset === 'glass_brittle') return { ...base, mode: 'hull', budget: [4, 8], bracing: 'light' };
  // Official blocks: few heavy nodes (transaxle ≤ 4 nodes at 30 kg, engine ~15 kg nodes).
  if (entry.beamPreset === 'mechanical_block') return { ...base, mode: 'hull', budget: [8, 16], bracing: 'heavy' };
  if (CYLINDERS.has(entry.id)) return { ...base, mode: 'cylinder', budget: [8, 12] };
  if (HULLS.has(entry.id)) return { ...base, mode: 'hull', budget: [6, 14] };
  if (entry.subcategory === 'Bumpers') return { ...base, mode: 'hull', budget: [14, 30] };
  if (entry.subcategory === 'Rollcage') return { ...base, mode: 'surface', budget: [24, 60] };
  if (entry.beamPreset === 'trim_light') return { ...base, mode: 'hull', budget: [5, 11], bracing: 'light' };
  if (PANEL_BUDGETS[entry.id]) return { ...base, mode: 'hull', budget: PANEL_BUDGETS[entry.id]! };
  if (entry.beamPreset === 'panel_metal' || entry.beamPreset === 'panel_plastic' || entry.beamPreset === 'panel_bumper') return { ...base, mode: 'hull', budget: [8, 20] };
  if (entry.beamPreset === 'structure_stiff') return { ...base, mode: 'hull', budget: [10, 26] };
  return { ...base, mode: 'hull', budget: [8, 16] };
}

/** Detail 0..1 → vertex target within the budget. */
export function targetVertices(budget: readonly [number, number], detail: number): number {
  const d = Math.min(1, Math.max(0, detail));
  return Math.round(budget[0] + (budget[1] - budget[0]) * d);
}
