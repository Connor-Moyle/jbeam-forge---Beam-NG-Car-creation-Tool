import { emptySound, type Sound, type SoundBlend } from '@shared/project/schema';
import { blendSlug } from '@shared/sound/blend';
import { call } from '@renderer/diagnostics/ipc';
import { projectStore } from '@renderer/app/stores/project';

/**
 * The Sound tab: the car's own sounds (horn, latches, cabin) and the mod's
 * own engine sound blends. Everything here ends up in the mod's files only;
 * the game's own sounds are never changed.
 */

const newId = () => `snd_${crypto.randomUUID().slice(0, 8)}`;

function editSound(label: string, apply: (s: Sound) => void, coalesce?: string): void {
  projectStore.getState().execute({
    label,
    coalesce,
    apply: (d) => {
      d.features.sound ??= emptySound();
      apply(d.features.sound);
    },
  });
}

export function setCabinFilter(value: number | null): void {
  editSound('Cabin muffling', (s) => void (s.cabinFilterCoef = value), 'sound:cabin');
}

export function setHorn(part: string | null): void {
  editSound('Horn', (s) => void (s.horn = part));
}

export function setLatch(kind: keyof Sound['latch'], set: string | null): void {
  editSound('Latch sounds', (s) => void (s.latch[kind] = set));
}

/** A blend of the mod's own: a copy of a game blend (pitched), or from the user's recordings. Returns its id. */
export function addBlend(name: string, base: string | null): string {
  const id = newId();
  const taken = new Set((projectStore.getState().doc?.features.sound?.blends ?? []).map((b) => b.name));
  let slug = blendSlug(name);
  for (let i = 2; taken.has(slug); i++) slug = `${blendSlug(name)}_${i}`;
  editSound('New engine sound', (s) => void s.blends.push({ id, name: slug, base, rpmScale: 1, samples: [] }));
  return id;
}

export function updateBlend(id: string, patch: Partial<Pick<SoundBlend, 'name' | 'rpmScale' | 'samples'>>): void {
  editSound(
    'Edit engine sound',
    (s) => {
      const b = s.blends.find((x) => x.id === id);
      if (!b) return;
      if (patch.name !== undefined) b.name = blendSlug(patch.name);
      if (patch.rpmScale !== undefined) b.rpmScale = patch.rpmScale;
      if (patch.samples !== undefined) b.samples = patch.samples;
    },
    `blend:${id}:${Object.keys(patch).join(',')}`,
  );
}

export function removeBlend(id: string): void {
  editSound('Remove engine sound', (s) => void (s.blends = s.blends.filter((b) => b.id !== id)));
}

/** Add the user's own recordings to a blend; the rpm each was recorded at is read from its name when it has one ("idle_0850.ogg", "3200rpm.wav"). */
export async function pickBlendSamples(id: string): Promise<number> {
  const paths = await call('dialog:pickAudioFiles');
  if (!paths.length) return 0;
  const blend = projectStore.getState().doc?.features.sound?.blends.find((b) => b.id === id);
  if (!blend) return 0;
  const have = new Set(blend.samples.map((s) => s.file));
  const added = paths
    .filter((p) => !have.has(p))
    .map((file) => {
      const m = /(\d{3,5})\s*(?:rpm)?(?=\D*$)/i.exec(file.replace(/\\/g, '/').split('/').pop() ?? '');
      return { file, rpm: m ? Number(m[1]) : 2000, load: 1 };
    });
  if (added.length) updateBlend(id, { samples: [...blend.samples, ...added] });
  return added.length;
}
