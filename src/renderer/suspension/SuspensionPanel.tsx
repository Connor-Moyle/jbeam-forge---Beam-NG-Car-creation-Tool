import { RideCheck } from './RideCheck';
import { startPlacing } from '@renderer/scene/placeFitted';
import { useEffect, useMemo } from 'react';
import { Disc3, Move, Plus, Trash2, Wrench } from 'lucide-react';
import type { Axle } from '@shared/project/schema';
import { EMPTY_ARR } from '@shared/empty';
import { useProjectStore } from '@renderer/app/stores/project';
import { useSceneStore } from '@renderer/app/stores/scene';
import { Button } from '@renderer/ui/components/Button';
import { EmptyState } from '@renderer/ui/components/EmptyState';
import { Field } from '@renderer/ui/components/Field';
import { Input } from '@renderer/ui/components/Input';
import { NumberInput } from '@renderer/ui/components/NumberInput';
import { ScrollArea } from '@renderer/ui/components/ScrollArea';
import { Toggle } from '@renderer/ui/components/Toggle';
import { SetPicker, TuningView } from '@renderer/workshop/WorkshopUi';
import { addAxle, addSuspensionOption, axleKind, fitSuspension, removeAxle, removeSuspension, removeSuspensionOption, setSpringScale, setSuspensionChoices, setTuning, setUpAxles, springScaleWanted, updateAxle, showGameMeshes, showOwnMeshes, useSuspensionCatalogue, useSuspensionUi } from './commands';
import { SPRING_SCALE } from '@shared/suspension/load';
import { DrivelineView } from './DrivelineView';
import { TravelCheck } from './TravelCheck';
import { WheelPicker } from './WheelPicker';
import styles from '@renderer/workshop/Workshop.module.css';

/** Suspension workshop: the car's axles, and a complete suspension from the game on each. */
export function SuspensionPanel() {
  const axles = useProjectStore((s) => s.doc?.axles ?? EMPTY_ARR);
  const sets = useSuspensionCatalogue((s) => s.sets);
  const load = useSuspensionCatalogue((s) => s.load);
  const picking = useSuspensionUi((s) => s.axleId);
  const pickingOption = useSuspensionUi((s) => s.optionAxleId);
  const tuning = useSuspensionUi((s) => s.tuneId);
  const driving = useSuspensionUi((s) => s.driveId);
  const wheeling = useSuspensionUi((s) => s.wheelId);
  useEffect(() => {
    void load();
    const off = window.forge.on('library:changed', () => void load(true));
    return off;
  }, [load]);

  const axle = axles.find((a) => a.id === picking || a.id === pickingOption);
  const suitable = useMemo(() => {
    if (!axle || !sets) return [];
    const kind = axleKind(axles, axle);
    return sets.filter((s) => s.axle === kind || s.axle === 'any');
  }, [axle, axles, sets]);
  // Shown even before the catalogue has answered: with nothing on screen the button looked dead.
  if (axle) {
    const asOption = axle.id === pickingOption;
    return (
      <SetPicker
        title={asOption ? `${axle.name} · another suspension` : axle.name}
        sets={suitable}
        testId="suspension-picker"
        onBack={() => useSuspensionUi.getState().pick(null)}
        onFit={async (s) => {
          await (asOption ? addSuspensionOption(axle.id, s) : fitSuspension(axle.id, s));
          useSuspensionUi.getState().pick(null);
        }}
      />
    );
  }
  const driven = axles.find((a) => a.id === driving);
  if (driven?.fitted) return <DrivelineView axle={{ ...driven, fitted: driven.fitted }} />;
  const wheeled = axles.find((a) => a.id === wheeling);
  if (wheeled?.fitted) return <WheelPicker axle={{ ...wheeled, fitted: wheeled.fitted }} />;
  const tuned = axles.find((a) => a.id === tuning);
  if (tuned?.fitted) {
    return <TuningView title={`${tuned.name} · ${tuned.fitted.vehicle} ${tuned.fitted.name}`} setId={tuned.fitted.setId} tuning={tuned.tuning} onChange={(name, v) => setTuning(tuned.id, name, v)} onBack={() => useSuspensionUi.getState().tune(null)} choices={tuned.fitted.choices} onChoices={(c) => setSuspensionChoices(tuned.id, c)} />;
  }
  if (!axles.length) {
    return <EmptyState icon={Wrench} message="Suspension works axle by axle. Set up the car's axles first: front and rear go where its wheels are, and you can add more." action={{ label: 'Set up axles', icon: Plus, onClick: setUpAxles }} />;
  }
  return (
    <div className={styles.panel} data-testid="suspension-panel">
      <ScrollArea className={styles.scroll}>
        {axles.map((a) => (
          <AxleCard key={a.id} axle={a} />
        ))}
        <Button icon={Plus} size="sm" onClick={addAxle} data-testid="axle-add">
          Add axle
        </Button>
        {sets && sets.length === 0 && <p className={styles.note}>No suspensions yet: they come from your BeamNG.drive install. Set its folder in Settings.</p>}
        <RideCheck />
      </ScrollArea>
    </div>
  );
}

function AxleCard({ axle }: { axle: Axle }) {
  const selection = useSceneStore((s) => s.selection);
  const own = axle.ownMeshes.length;
  const scale = axle.edits?.fields[SPRING_SCALE];
  // The car's weight over the donor's: the scale that would make the springs carry it as they carried their own car.
  const wanted = useProjectStore((s) => (s.doc && axle.fitted && scale === undefined ? springScaleWanted(s.doc, axle) : null));
  return (
    <section className={styles.card} data-testid="axle-card">
      <header className={styles.axleHead}>
        <Input value={axle.name} onChange={(e) => updateAxle(axle.id, { name: e.target.value.slice(0, 40) || axle.name })} aria-label="Axle name" title="Its name in the parts menu (Front steer, Second steer, Rear drive…)" />
        <Button icon={Trash2} size="sm" variant="ghost" onClick={() => removeAxle(axle.id)} aria-label={`Remove ${axle.name}`} />
      </header>
      <div className={styles.axleFields}>
        <Field label="Position" hint="Along the car (− is forward)">
          <NumberInput aria-label="Axle position" value={axle.y} onChange={(y) => updateAxle(axle.id, { y })} step={0.01} precision={3} unit="m" />
        </Field>
        <Field label="Track" hint="Wheel centre to centre">
          <NumberInput aria-label="Track width" value={axle.track} onChange={(track) => updateAxle(axle.id, { track })} step={0.01} min={0.3} max={4} precision={3} unit="m" />
        </Field>
        <Toggle checked={axle.steered} onChange={(steered) => updateAxle(axle.id, { steered })} label="Steers" />
        {axle.steered && (
          <Field label="Steering range" hint="Its suspension's steering travel, scaled: a twin-steer truck's second axle turns less">
            <NumberInput aria-label="Steering range" value={Math.round((axle.steer ?? 1) * 100)} onChange={(v) => updateAxle(axle.id, { steer: v === 100 ? undefined : v / 100 })} step={5} min={0} max={300} precision={0} unit="%" />
          </Field>
        )}
      </div>
      {axle.fitted ? (
        <>
          <div className={styles.fitted}>
            <div>
              <div className={styles.cardTitle}>{axle.fitted.vehicle}</div>
              <div className={styles.note}>
                {axle.fitted.name} · {axle.fitted.type}
                {own ? ` · showing your ${own} mesh${own === 1 ? '' : 'es'}` : ''}
              </div>
            </div>
            <div className={styles.row}>
              <Button size="sm" variant="primary" onClick={() => useSuspensionUi.getState().tune(axle.id)} data-testid="axle-tune">
                Tune
              </Button>
              <Button size="sm" onClick={() => useSuspensionUi.getState().drive(axle.id)} data-testid="axle-driveline">
                Brakes &amp; diff
              </Button>
              <Button size="sm" icon={Disc3} onClick={() => useSuspensionUi.getState().wheels(axle.id)} data-testid="axle-wheels">
                Wheels
              </Button>
              <Button size="sm" icon={Move} onClick={() => startPlacing(axle.fitted!.sourceId, 'suspension')} title="Pick it up with the arrows: its physics moves with it" data-testid="axle-move">
                Move
              </Button>
              <Button size="sm" onClick={() => useSuspensionUi.getState().pick(axle.id)}>
                Change
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeSuspension(axle.id)}>
                Remove
              </Button>
            </div>
          </div>
          <div className={styles.row}>
            {own ? (
              <Button size="sm" variant="ghost" onClick={() => showGameMeshes(axle.id)}>
                Use the game&rsquo;s meshes
              </Button>
            ) : (
              <Button size="sm" onClick={() => showOwnMeshes(axle.id, selection)} title={selection.length ? undefined : 'Select your suspension meshes in the viewport first'} data-testid="axle-own-meshes">
                Use my selected meshes
              </Button>
            )}
          </div>
          {wanted !== null && (
            <div className={styles.row}>
              <p className={styles.note}>
                Made for a car {wanted > 1 ? `${Math.round((wanted - 1) * 100)}% lighter` : `${Math.round((1 / wanted - 1) * 100)}% heavier`} than this one: it would sit {wanted > 1 ? 'low, on its bump stops' : 'high and ride hard'}.
              </p>
              <Button size="sm" onClick={() => setSpringScale(axle.id, wanted)} data-testid="axle-match-springs">
                Springs ×{wanted} for this car
              </Button>
            </div>
          )}
          {scale !== undefined && (
            <div className={styles.row}>
              <p className={styles.note}>Springs and dampers ×{scale} for this car&rsquo;s weight: it sits as the game&rsquo;s car did.</p>
              <Button size="sm" variant="ghost" onClick={() => setSpringScale(axle.id, null)}>
                As the game made them
              </Button>
            </div>
          )}
          <TravelCheck axle={{ ...axle, fitted: axle.fitted }} />
          {!own && <p className={styles.note}>Made your own suspension? Select its meshes and use them: this set&rsquo;s jbeam does the physics, your meshes are what you see.</p>}
          <div className={styles.card} data-testid="axle-options">
            <strong className={styles.cardTitle}>Other suspensions for this axle</strong>
            <p className={styles.note}>Offered in the same slot: each configuration (and the player, in the parts menu) picks one. The fitted one above is the default.</p>
            {(axle.alternates ?? []).map((s) => (
              <div key={s.sourceId} className={styles.fitted}>
                <div className={styles.note}>
                  {s.vehicle} {s.name} · {s.type}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeSuspensionOption(axle.id, s.sourceId)} aria-label={`Remove ${s.vehicle} ${s.name}`}>
                  Remove
                </Button>
              </div>
            ))}
            <Button size="sm" icon={Plus} onClick={() => useSuspensionUi.getState().pickOption(axle.id)} data-testid="axle-add-option">
              Add another suspension
            </Button>
          </div>
        </>
      ) : (
        <Button icon={Wrench} variant="primary" size="sm" onClick={() => useSuspensionUi.getState().pick(axle.id)} data-testid="axle-choose">
          Choose suspension
        </Button>
      )}
    </section>
  );
}
