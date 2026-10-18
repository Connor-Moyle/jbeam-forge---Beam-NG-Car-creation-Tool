import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Disc3 } from 'lucide-react';
import type { Axle } from '@shared/project/schema';
import { EMPTY_ARR } from '@shared/empty';
import { gameWheelLabel, setWheelSlot, type GameWheel } from '@shared/wheels/game';
import { useProjectStore } from '@renderer/app/stores/project';
import { call } from '@renderer/diagnostics/ipc';
import { Button } from '@renderer/ui/components/Button';
import { Input } from '@renderer/ui/components/Input';
import { ScrollArea } from '@renderer/ui/components/ScrollArea';
import { Select } from '@renderer/ui/components/Select';
import { Toggle } from '@renderer/ui/components/Toggle';
import { setSuspensionChoices, useSetData, useSuspensionUi } from './commands';
import styles from '@renderer/workshop/Workshop.module.css';

/**
 * Wheel picker: the game's wheels that fit an axle's hubs (same lug count),
 * by size, brand and name. The fitted set's wheel slot stays the game's, so
 * every wheel of that lug count is in the game's parts menu too; this picks
 * the one the mod comes with.
 */

const ANY = '__any__';
let wheels: Promise<GameWheel[]> | null = null;
const loadWheels = () => (wheels ??= call('beamng:wheels').catch(() => []));

export function WheelPicker({ axle }: { axle: Axle & { fitted: NonNullable<Axle['fitted']> } }) {
  const [all, setAll] = useState<GameWheel[] | null>(null);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [diameter, setDiameter] = useState<number | null>(null);
  const [both, setBoth] = useState(true);
  const data = useSetData((s) => s.data[axle.fitted.setId]);
  const axles = useProjectStore((s) => s.doc?.axles ?? EMPTY_ARR);
  const setData = useSetData((s) => s.data);
  useEffect(() => {
    let live = true;
    void loadWheels().then((got) => {
      if (!live) return;
      setAll(got);
      if (!got.length) wheels = null;
    });
    return () => {
      live = false;
    };
  }, []);
  const setIds = [axle.fitted.setId, ...(axle.alternates ?? []).map((s) => s.setId)].join('|');
  useEffect(() => void useSetData.getState().ensure(setIds.split('|')), [setIds]);
  const slot = data ? setWheelSlot(data.parts) : null;
  const fitting = useMemo(() => (all ?? []).filter((w) => w.slotType === slot?.slotType), [all, slot]);
  const brands = useMemo(() => [...new Set(fitting.map((w) => w.brand))].sort(), [fitting]);
  const diameters = useMemo(() => [...new Set(fitting.map((w) => w.diameter))].filter(Boolean).sort((a, b) => a - b), [fitting]);
  const q = search.trim().toLowerCase();
  const shown = fitting.filter((w) => (!brand || w.brand === brand) && (!diameter || w.diameter === diameter) && (!q || `${gameWheelLabel(w)} ${w.part}`.toLowerCase().includes(q)));
  const current = axle.fitted.choices?.[slot?.slotType ?? '']?.default ?? slot?.default ?? '';
  // The other axles' sets, where their hubs take the same lug count: the same wheel (same end) or the matching wheel of the other end goes on them too.
  const lugs = (st: string) => st.replace(/^wheel_[FR]_/, '');
  const others = axles
    .filter((a) => a.id !== axle.id && a.fitted)
    .map((a) => ({ axle: a, slot: setWheelSlot(setData[a.fitted!.setId]?.parts ?? {}) }))
    .filter((o): o is { axle: Axle; slot: NonNullable<typeof o.slot> } => !!o.slot && !!slot && lugs(o.slot.slotType) === lugs(slot.slotType));
  const sameLugs = others.length > 0;
  const counterpart = (w: GameWheel, slotType: string) => (slotType === w.slotType ? w : (all ?? []).find((o) => o.slotType === slotType && o.part === w.part.replace(/_([FR])$/, (_, e: string) => `_${e === 'F' ? 'R' : 'F'}`)));

  const fit = (w: GameWheel | null) => {
    const choose = (a: Axle, slotType: string, stock: string, part: string | null) => {
      // The axle's other suspensions take the same wheel where their hubs take the same lugs.
      for (const s of [a.fitted, ...(a.alternates ?? [])]) {
        if (!s) continue;
        const sl = s === a.fitted ? { slotType, default: stock } : setWheelSlot(useSetData.getState().data[s.setId]?.parts ?? {});
        if (!sl || sl.slotType !== slotType) continue;
        const next = { ...(s.choices ?? {}) };
        if (!part || part === sl.default) delete next[slotType];
        else next[slotType] = { default: part, offer: [] };
        setSuspensionChoices(a.id, next, s === a.fitted ? undefined : s.sourceId);
      }
    };
    if (!slot) return;
    choose(axle, slot.slotType, slot.default, w?.part ?? null);
    if (both)
      for (const o of others) {
        const match = w ? counterpart(w, o.slot.slotType) : null;
        if (!w || match) choose(o.axle, o.slot.slotType, o.slot.default, match?.part ?? null);
      }
  };

  return (
    <div className={styles.panel} data-testid="wheel-picker">
      <header className={styles.head}>
        <Button icon={ChevronLeft} size="sm" variant="ghost" onClick={() => useSuspensionUi.getState().wheels(null)}>
          Back
        </Button>
        <span className={styles.crumbs}>
          {axle.name} · Wheels{slot ? ` · ${slot.slotType.replace(/^wheel_[FR]_/, '')}${/^\d/.test(slot.slotType.replace(/^wheel_[FR]_/, '')) ? ' lugs' : ''}` : ''}
        </span>
      </header>
      {!data && <p className={styles.note}>Reading the suspension&rsquo;s jbeam…</p>}
      {data && !slot && <p className={styles.note}>This suspension brings no wheel hubs of the game&rsquo;s, so it takes no game wheels.</p>}
      {slot && all && !fitting.length && <p className={styles.note}>{all.length ? `None of the game's wheels fit ${slot.slotType}.` : 'Set the BeamNG.drive folder in Settings to list the game’s wheels.'}</p>}
      <ScrollArea className={styles.scroll}>
        {slot && fitting.length > 0 && (
          <div className={styles.card}>
            <p className={styles.note}>
              {fitting.length} wheels fit these hubs; all of them are in the game&rsquo;s parts menu. Pick the one the car comes with (the tyres follow the wheel&rsquo;s size).
            </p>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search wheels" aria-label="Search wheels" data-testid="wheel-search" />
            <div className={styles.chips}>
              <button type="button" className={diameter === null ? styles.chipOn : styles.chip} onClick={() => setDiameter(null)}>
                Any size
              </button>
              {diameters.map((d) => (
                <button key={d} type="button" className={diameter === d ? styles.chipOn : styles.chip} onClick={() => setDiameter(diameter === d ? null : d)} data-testid="wheel-size">
                  {d}&Prime; <span className={styles.count}>{fitting.filter((w) => w.diameter === d).length}</span>
                </button>
              ))}
            </div>
            <Select value={brand ?? ANY} onChange={(b: string) => setBrand(b === ANY ? null : b)} options={[{ value: ANY, label: `Any brand (${fitting.length})` }, ...brands.map((b) => ({ value: b, label: `${b} (${fitting.filter((w) => w.brand === b).length})` }))]} aria-label="Wheel brand" data-testid="wheel-brand" />
            {sameLugs && <Toggle checked={both} onChange={setBoth} label={`Matching wheels on the ${others.map((o) => o.axle.name.toLowerCase()).join(', ')} too`} />}
          </div>
        )}
        {slot && (
          <ul className={styles.sets}>
            <li className={styles.setCard} data-testid="wheel-stock">
              <Disc3 aria-hidden className={styles.icon} />
              <div className={styles.setText}>
                <strong>Stock: {(all ?? []).find((w) => w.part === slot.default) ? gameWheelLabel((all ?? []).find((w) => w.part === slot.default)!) : slot.default || '(none)'}</strong>
                <span className={styles.note}>What the suspension came with</span>
              </div>
              <Button size="sm" variant={current === slot.default ? 'primary' : undefined} disabled={current === slot.default} onClick={() => fit(null)}>
                {current === slot.default ? 'Fitted' : 'Fit'}
              </Button>
            </li>
            {shown.map((w) => (
              <li key={w.part} className={styles.setCard} data-testid="wheel-row">
                <Disc3 aria-hidden className={styles.icon} />
                <div className={styles.setText}>
                  <strong>{gameWheelLabel(w)}</strong>
                  <span className={styles.note}>
                    {w.part}
                    {w.value ? ` · $${w.value}` : ''}
                  </span>
                </div>
                <Button size="sm" variant={current === w.part ? 'primary' : undefined} disabled={current === w.part} onClick={() => fit(w)} data-testid="wheel-fit">
                  {current === w.part ? 'Fitted' : 'Fit'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
