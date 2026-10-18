import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Plus, Trash2, Volume2 } from 'lucide-react';
import type { JbeamObject } from '@shared/jbeam/parse';
import { emptySound, type SoundBlend } from '@shared/project/schema';
import { EMPTY_ARR } from '@shared/empty';
import { cylindersOf, editableFields, GEAR_WHINE, soundConfigs } from '@shared/powertrain/edits';
import { blendIdOf, blendRef, LATCH_SETS, type LatchKind } from '@shared/sound/blend';
import { useProjectStore } from '@renderer/app/stores/project';
import { useUiStore } from '@renderer/app/stores/ui';
import { call } from '@renderer/diagnostics/ipc';
import { Button } from '@renderer/ui/components/Button';
import { Callout } from '@renderer/ui/components/Callout';
import { EmptyState } from '@renderer/ui/components/EmptyState';
import { Field, FieldGroup } from '@renderer/ui/components/Field';
import { IconButton } from '@renderer/ui/components/IconButton';
import { Input } from '@renderer/ui/components/Input';
import { NumberInput } from '@renderer/ui/components/NumberInput';
import { ScrollArea } from '@renderer/ui/components/ScrollArea';
import { Select } from '@renderer/ui/components/Select';
import { Slider } from '@renderer/ui/components/Slider';
import { Toggle } from '@renderer/ui/components/Toggle';
import { FieldList, useFitted } from '@renderer/powertrain/Builder';
import { setPowertrainField, setPowertrainText } from '@renderer/powertrain/commands';
import { RevPreview } from '@renderer/powertrain/revPreview';
import { addBlend, pickBlendSamples, removeBlend, setCabinFilter, setHorn, setLatch, updateBlend } from './commands';
import styles from '@renderer/powertrain/Builder.module.css';

/**
 * The Sound tab: the engine's voice (which recordings it plays, the mod's own
 * blends), its mix (volumes, muffling, EQ, backfires, turbo whine), the gear
 * whine, and the car's horn, latches and cabin. Everything is written into the
 * mod's own files: the game's sounds are read, never changed.
 */

const STOCK = '-';
/** The game's cabin muffling when a body says nothing. */
const CABIN_DEFAULT = 0.12;
const SOUND_SECTIONS = new Set(['soundConfig', 'soundConfigExhaust']);
const SOUND_NAME = /sound|gain|volume|whine|hiss|bov|muffl|afterfire|shelf|^eq/i;

let games: Promise<{ name: string }[]> | null = null;
let horns: Promise<{ part: string; label: string }[]> | null = null;

export function SoundPanel() {
  const doc = useProjectStore((s) => s.doc);
  if (!doc) return null;
  return (
    <div className={styles.panel} data-testid="sound-panel">
      <ScrollArea className={styles.scroll}>
        <Callout tone="info">Everything here is written into the mod&rsquo;s own files. The game&rsquo;s sounds are read, never changed.</Callout>
        <EngineVoice />
        <OwnBlends />
        <EngineMix />
        <GearWhine />
        <CarSounds />
      </ScrollArea>
    </div>
  );
}

function useGameSounds() {
  const [list, setList] = useState<{ name: string }[]>([]);
  useEffect(() => {
    games ??= call('beamng:engineSounds').catch(() => []);
    void games.then((got) => {
      if (!got.length) games = null;
      setList(got);
    });
  }, []);
  return list;
}

/** Which recordings the engine plays through its intake and exhaust: the game's, or one of the mod's own. */
function EngineVoice() {
  const { fitted, parts } = useFitted('engine');
  const blends = useProjectStore((s) => s.doc?.features.sound?.blends ?? EMPTY_ARR);
  const sounds = useGameSounds();
  const configs = useMemo(() => (parts ? soundConfigs(parts) : []), [parts]);
  const [playing, setPlaying] = useState<null | 'loading' | 'samples' | 'synth'>(null);
  const [rpm, setRpm] = useState(2000);
  const preview = useRef<RevPreview | null>(null);
  useEffect(() => () => preview.current?.stop(), []);
  // A pitched copy relabels its recordings by the pitch, so at any revs the game plays what was
  // recorded at revs ÷ pitch: the preview does the same with the recordings it was copied from.
  const [pitch, setPitch] = useState(1);
  useEffect(() => preview.current?.set(rpm / pitch, 0.6), [rpm, pitch]);
  if (!fitted || !parts) return <EmptyState icon={Volume2} message="Fit an engine in the Engine & gearbox tab: its voice and mix are set here." />;
  if (!configs.length) return null;
  const options = [...sounds.map((s) => ({ value: s.name, label: s.name })), ...blends.map((b) => ({ value: blendRef(b.id), label: `Mine: ${b.name}` }))];
  const current = (key: string, game: string) => fitted.edits.texts?.[key] ?? game;
  /** The game blend the preview can play for a choice (a mod blend plays the recordings it was copied from). */
  const previewable = (text: string) => {
    const id = blendIdOf(text);
    const blend = id ? blends.find((b) => b.id === id) : undefined;
    setPitch(blend?.rpmScale ?? 1);
    return id ? (blend?.base ?? null) : text;
  };
  const play = async (text: string) => {
    if (playing) {
      preview.current?.stop();
      setPlaying(null);
      return;
    }
    setPlaying('loading');
    preview.current ??= new RevPreview();
    const base = previewable(text);
    preview.current.set(rpm, 0.6);
    setPlaying(await preview.current.start(base, cylindersOf(`${fitted.name} ${fitted.type}`) ?? 6));
  };
  return (
    <FieldGroup title="Engine voice">
      {configs.map((c) => {
        const text = current(c.key, c.sampleName);
        const listed = options.some((o) => o.value === text);
        return (
          <Field key={c.key} label={c.section === 'soundConfigExhaust' ? 'Exhaust' : 'Intake'} hint={text !== c.sampleName ? `The game's: ${c.sampleName}` : undefined}>
            <div className={styles.row}>
              <Select value={text} onChange={(v: string) => setPowertrainText('engine', c.key, v === c.sampleName ? null : v)} options={listed ? options : [{ value: text, label: text }, ...options]} aria-label={`${c.section} recordings`} />
              <Button size="sm" variant={playing ? 'ghost' : 'primary'} onClick={() => void play(text)} disabled={playing === 'loading'} data-testid={`sound-play-${c.section}`}>
                {playing === 'loading' ? 'Loading…' : playing ? 'Stop' : 'Play'}
              </Button>
            </div>
          </Field>
        );
      })}
      {playing && playing !== 'loading' && (
        <Field label="Revs" hint={playing === 'synth' ? 'Synthesized: this sound has no recordings the app can play' : 'The game’s recordings, as the game blends them'}>
          <Slider value={rpm} onChange={setRpm} min={600} max={8000} step={10} format={(v) => `${Math.round(v)} rpm`} aria-label="Preview rpm" />
        </Field>
      )}
      {!sounds.length && <p className={styles.note}>Set the BeamNG.drive folder in Settings to list the game&rsquo;s engine sounds.</p>}
    </FieldGroup>
  );
}

/** The mod's own engine sounds: a game blend moved in pitch, or the user's recordings. */
function OwnBlends() {
  const blends = useProjectStore((s) => s.doc?.features.sound?.blends ?? EMPTY_ARR);
  const { fitted, parts } = useFitted('engine');
  const sounds = useGameSounds();
  const [base, setBase] = useState<string>();
  const [busy, setBusy] = useState(false);
  const configs = useMemo(() => (parts ? soundConfigs(parts) : []), [parts]);
  const first = fitted && configs[0] ? (fitted.edits.texts?.[configs[0].key] ?? configs[0].sampleName) : null;
  const pickBase = base ?? (first && !blendIdOf(first) ? first : sounds[0]?.name);
  const copy = async () => {
    if (!pickBase) return;
    setBusy(true);
    const samples = await call('beamng:soundSamples', { name: pickBase }).catch(() => []);
    setBusy(false);
    if (!samples.length) {
      useUiStore.getState().pushStatus(`${pickBase} is synthesized in the game's audio bank, so a pitched copy can't be made. Change its volumes and EQ in the mix below, or make a sound from your own recordings.`, 'warning', 10000);
      return;
    }
    addBlend(`${pickBase}_pitched`, pickBase);
  };
  return (
    <FieldGroup title="My engine sounds">
      <p className={styles.note}>A sound of the mod&rsquo;s own: a game sound moved up or down in pitch, or your own recordings at the revs they were made. Pick it as the intake or exhaust above.</p>
      <div className={styles.row}>
        <Select value={pickBase} onChange={setBase} options={sounds.map((s) => ({ value: s.name, label: s.name }))} placeholder="A game sound…" aria-label="Game sound to copy" />
        <Button size="sm" icon={Plus} onClick={() => void copy()} disabled={!pickBase || busy} data-testid="blend-copy">
          Pitched copy
        </Button>
        <Button size="sm" icon={FolderOpen} onClick={() => void pickBlendSamples(addBlend('my_engine', null))} data-testid="blend-own">
          From my recordings
        </Button>
      </div>
      {blends.map((b) => (
        <BlendCard key={b.id} blend={b} />
      ))}
    </FieldGroup>
  );
}

function BlendCard({ blend }: { blend: SoundBlend }) {
  return (
    <section className={styles.group} data-testid="blend-card">
      <div className={styles.row}>
        <Input value={blend.name} onChange={(e) => updateBlend(blend.id, { name: e.target.value })} mono aria-label="Sound name" />
        <IconButton icon={Trash2} size="sm" label="Remove this sound" onClick={() => removeBlend(blend.id)} />
      </div>
      <p className={styles.muted}>{blend.base ? `Copy of ${blend.base}` : 'Your recordings'}</p>
      <Field label="Pitch" hint="Each recording is marked as this many times the revs it was made at, so the game plays it slower: above 1 the engine sounds bigger and lazier, below 1 smaller and revvier">
        <Slider value={blend.rpmScale} onChange={(v) => updateBlend(blend.id, { rpmScale: Math.round(v * 100) / 100 })} min={0.5} max={2} step={0.01} format={(v) => `× ${v.toFixed(2)}`} aria-label="Pitch" />
      </Field>
      {!blend.base && (
        <>
          {blend.samples.map((s, i) => (
            <div key={s.file} className={styles.row}>
              <span className={styles.muted} title={s.file}>
                {s.file.replace(/\\/g, '/').split('/').pop()}
              </span>
              <NumberInput value={s.rpm} min={100} max={20000} step={50} precision={0} unit="rpm" onChange={(rpm) => updateBlend(blend.id, { samples: blend.samples.map((x, j) => (j === i ? { ...x, rpm } : x)) })} aria-label="Recorded at" />
              <Toggle checked={s.load >= 0.5} onChange={(on) => updateBlend(blend.id, { samples: blend.samples.map((x, j) => (j === i ? { ...x, load: on ? 1 : 0 } : x)) })} label="On throttle" />
              <IconButton icon={Trash2} size="sm" label="Remove this recording" onClick={() => updateBlend(blend.id, { samples: blend.samples.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <div className={styles.row}>
            <Button size="sm" icon={FolderOpen} onClick={() => void pickBlendSamples(blend.id)}>
              Add recordings
            </Button>
            <span className={styles.muted}>ogg, wav or flac, each a steady note; the revs are read from a number in the file name (idle_0850.ogg)</span>
          </div>
          {!blend.samples.length && <p className={styles.note}>No recordings yet: this sound is left out of the export until it has some.</p>}
        </>
      )}
    </section>
  );
}

/** Volumes, muffling, EQ, backfires and the turbo's whine: the engine's own numbers. */
function EngineMix() {
  const { fitted, parts } = useFitted('engine');
  const fields = useMemo(() => (parts ? editableFields(parts).filter((f) => SOUND_SECTIONS.has(f.section) || SOUND_NAME.test(f.name)) : []), [parts]);
  if (!fitted || !fields.length) return null;
  return <FieldList kind="engine" fields={fields} edits={fitted.edits.fields} title={`Engine mix (${fields.length})`} />;
}

function GearWhine() {
  const { fitted, parts } = useFitted('gearbox');
  const has = useMemo(() => !!parts && Object.values(parts).some((p: JbeamObject) => Object.values(p).some((sec) => sec && typeof sec === 'object' && !Array.isArray(sec) && 'gearWhineCoefsInput' in sec)), [parts]);
  if (!fitted || !has) return null;
  const value = fitted.edits.fields[GEAR_WHINE] ?? 1;
  return (
    <FieldGroup title="Gear whine">
      <Field label="Loudness" hint="The gearbox's whine under power and on the overrun, as a multiple of the game's (0 is silent)">
        <Slider value={value} onChange={(v) => setPowertrainField('gearbox', GEAR_WHINE, Math.abs(v - 1) < 0.005 ? null : Math.round(v * 100) / 100)} min={0} max={2} step={0.01} format={(v) => `× ${v.toFixed(2)}`} aria-label="Gear whine" />
      </Field>
    </FieldGroup>
  );
}

const LATCH_LABEL: Record<LatchKind, string> = { door: 'Doors', hood: 'Hood', trunk: 'Boot and tailgate' };

/** The horn, the latches and how much the cabin muffles the outside. */
function CarSounds() {
  const sound = useProjectStore((s) => s.doc?.features.sound) ?? emptySound();
  const [list, setList] = useState<{ part: string; label: string }[]>([]);
  useEffect(() => {
    horns ??= call('beamng:horns').catch(() => []);
    void horns.then((got) => {
      if (!got.length) horns = null;
      setList(got);
    });
  }, []);
  const cabin = sound.cabinFilterCoef;
  return (
    <FieldGroup title="Car">
      <Field label="Horn" hint={list.length ? 'From the game’s cars; the player can change it in the parts menu too' : 'Set the BeamNG.drive folder in Settings to list the game’s horns'}>
        <Select value={sound.horn ?? STOCK} onChange={(v: string) => setHorn(v === STOCK ? null : v)} options={[{ value: STOCK, label: 'Stock (Horn 01, 2013 ETK)' }, ...list.map((h) => ({ value: h.part, label: h.label }))]} aria-label="Horn" />
      </Field>
      {(Object.keys(LATCH_SETS) as LatchKind[]).map((kind) => (
        <Field key={kind} label={`${LATCH_LABEL[kind]} latch`} hint="The recordings the game plays when it opens and shuts">
          <Select value={sound.latch[kind] ?? STOCK} onChange={(v: string) => setLatch(kind, v === STOCK ? null : v)} options={[{ value: STOCK, label: `Stock (${LATCH_SETS[kind][0]})` }, ...LATCH_SETS[kind].map((s) => ({ value: s, label: s.replace('_', ' ') }))]} aria-label={`${LATCH_LABEL[kind]} latch sounds`} />
        </Field>
      ))}
      <Field label="Cabin muffling" hint="How much the outside is muffled from the driver's seat: 0 is an open car, 1 a sealed one">
        <div className={styles.row}>
          <Toggle checked={cabin !== null} onChange={(on) => setCabinFilter(on ? CABIN_DEFAULT : null)} label="Set" />
          <Slider value={cabin ?? CABIN_DEFAULT} onChange={(v) => setCabinFilter(Math.round(v * 100) / 100)} min={0} max={1} step={0.01} disabled={cabin === null} format={(v) => v.toFixed(2)} aria-label="Cabin muffling" />
        </div>
      </Field>
    </FieldGroup>
  );
}
