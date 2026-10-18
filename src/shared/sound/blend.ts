import type { SoundBlend } from '../project/schema';

/**
 * The mod's own engine sounds. The game plays an engine through a sound blend
 * (art/sound/blends/<name>.sfxBlend2D.json): the older ones list recorded
 * samples by rpm, the newer ones name a synthesized band in the game's audio
 * bank. A blend made here is written into the mod under the mod's own name,
 * so the game's files are never touched: a copy of a game blend with its
 * samples moved in rpm (a pitch change), or the user's own recordings.
 */

/** A sampleName that points at one of the mod's blends until export: "@blend:<id>". */
export const BLEND_MARK = '@blend:';

export const blendRef = (id: string) => `${BLEND_MARK}${id}`;
export const blendIdOf = (text: string | undefined) => (text?.startsWith(BLEND_MARK) ? text.slice(BLEND_MARK.length) : null);

/** The blend's name in the mod (its file is art/sound/blends/<this>.sfxBlend2D.json). */
export const blendExportName = (slug: string, blend: Pick<SoundBlend, 'name'>) => `${slug}_${blend.name}`;

/** Where a recording of the user's lands in the mod. */
export const blendSamplePath = (slug: string, file: string) => `art/sound/${slug}/${file.replace(/\\/g, '/').split('/').pop()!.toLowerCase().replace(/[^a-z0-9._-]+/g, '_')}`;

export const AUDIO_EXTENSIONS = ['.ogg', '.wav', '.flac'] as const;

export interface BlendSample {
  path: string;
  rpm: number;
  /** 0 = off load, 1 = on load. */
  load: number;
}

/** Every set of rpm values of the base's samples moved by the blend's pitch (1 = as recorded). */
export function pitchSamples(samples: readonly BlendSample[], rpmScale: number): BlendSample[] {
  const k = rpmScale > 0 ? rpmScale : 1;
  return samples.map((s) => ({ ...s, rpm: Math.round(s.rpm * k) }));
}

/**
 * The blend file's text, in the game's own shape: one layer of [path, rpm] rows per load (off
 * load first), rpm rising. With only one load everything is one layer, as the game's files have it.
 */
export function blendFileText(samples: readonly BlendSample[]): string {
  const loads = [...new Set(samples.map((s) => s.load))].sort((a, b) => a - b);
  const layers = loads.map((load) =>
    samples
      .filter((s) => s.load === load)
      .sort((a, b) => a.rpm - b.rpm)
      .map((s) => (loads.length > 1 ? [s.path, s.rpm, load] : [s.path, s.rpm])),
  );
  return `${JSON.stringify({ header: { version: 1 }, eventName: 'event:>Engine>default', samples: layers }, null, 2)}\n`;
}

/** The sampleName texts of a set's edits with the mod's blends written as their exported names. */
export function resolveBlendTexts(texts: Readonly<Record<string, string>> | undefined, slug: string, blends: readonly SoundBlend[]): Record<string, string> | undefined {
  if (!texts) return texts;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(texts)) {
    const id = blendIdOf(v);
    const blend = id ? blends.find((b) => b.id === id) : null;
    // A blend that's gone leaves the game's own sound in place.
    if (id && !blend) continue;
    out[k] = blend ? blendExportName(slug, blend) : v;
  }
  return out;
}

/** A blend's name as the game needs it: letters, digits and underscores. */
export const blendSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'sound';

/**
 * The game's latch sound sets, by the part they're recorded for (from every car in the install,
 * most used first). The first of each is what a car gets when nothing is chosen.
 */
export const LATCH_SETS = {
  door: ['modern_06', 'modern_03', 'modern_08', 'modern_11', '90s_04', '90s_01', '90s_03', '90s_05', '90s_06', '80s_03', '80s_05', 'vintage_03', 'vintage_06', 'vintage_07', 'vintage_08', 'buggy'],
  hood: ['modern_01', '90s_03', 'modern_05', 'modern_02', 'modern_07', 'modern_04', 'vintage_05', 'vintage_03', 'vintage_06', 'vintage_04', 'vintage_02', '90s_01', '80s_02', '80s_03', '80s_01'],
  trunk: ['modern_05', '90s_02', 'modern_04', 'modern_02', 'modern_03', '90s_03'],
} as const;

export type LatchKind = keyof typeof LATCH_SETS;

/** Which latch recordings a hinged part uses. */
export function latchKindOf(taxonomyId: string): LatchKind {
  return taxonomyId === 'hood' ? 'hood' : taxonomyId === 'trunk' || taxonomyId === 'tailgate' ? 'trunk' : 'door';
}

/** The game's attach / detach events for a latch set. */
export function latchEvents(kind: LatchKind, set: string | null | undefined): { attach: string; detach: string } {
  const folder = kind === 'door' ? 'Door' : kind === 'hood' ? 'Hood' : 'Trunk';
  const s = set || LATCH_SETS[kind][0];
  return { attach: `event:>Vehicle>Latches>${folder}>${s}_close`, detach: `event:>Vehicle>Latches>${folder}>${s}_open` };
}

/** The game's horn when the mod doesn't choose one (the 2013 ETK's, which every stock car's body also defaults to). */
export const DEFAULT_HORN = 'soundscape_horn_1';
