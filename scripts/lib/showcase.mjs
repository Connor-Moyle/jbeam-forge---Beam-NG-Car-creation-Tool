/**
 * The showcase cars (scripts/dev/buildShowcaseCars.mts) built through the app the way a user builds
 * them, for the run-desktop harness's showcase-build scenario: import and sort, masses, Generate,
 * axles (as many as the car has) with the game's suspensions and their options, wheels, engines and
 * fuel, the horn, every moving part (hinges, animated needles and pedals, scripted wipers, windows,
 * mirrors, seats, sunroof, head unit and every other script template), triggers, cameras, plates,
 * hitch, nitrous, a paint design, paints, a tuning variable, configurations, then save, export,
 * lint and the 2000 Hz check per configuration.
 *
 * A pick is [slot label pattern, option label pattern | 'empty'].
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Scripts that animate meshes: template name → param label → mesh name pattern (the car's meshes). */
const MOVING = {
  'Windscreen wipers': { 'Wiper arms': /^wiper_/ },
  'Folding mirrors': { 'Mirror housings': /^mirror_[LR]$/ },
  'Power windows': { 'Window glass': /^door_glass_/ },
  'Power seats': { 'Seat (slides)': /^seat_F[LR]_cushion$/, 'Backrest (reclines)': /^seat_F[LR]_backrest$/ },
};

export const SHOWCASE_CARS = {
  forge_crawler: {
    name: 'Forge Crawler',
    axles: ['hopper/hopper_suspension_F_crawler', 'hopper/hopper_suspension_R_crawler'],
    // Other suspensions each version picks from: the Hopper's road live axles, the D-Series desert truck's.
    axleOptions: [
      ['hopper/hopper_suspension_F', 'pickup/pickup_desert_suspension_SFA'],
      ['hopper/hopper_suspension_R', 'pickup/pickup_desert_suspension_R'],
    ],
    track: 1.68,
    wheels: 'Off-Road',
    engine: 'hopper/hopper_engine_v8_4.5',
    gearbox: 'hopper/hopper_transmission_5M',
    engineOptions: ['bx/bx_engine_v8_5.5', 'hopper/hopper_engine_v8_6.9', 'hopper/hopper_engine_i4'],
    hinges: true,
    features: ['hitch', 'nitrous'],
    horn: /Horn 0[4-9]/,
    configs: [
      { name: 'Rock Crawler', type: 'Factory', picks: [[/^Front bumper$/, /Offroad/], [/^Rear bumper$/, /Offroad/], [/^Roof$/, 'empty'], [/side skirt$/, /Offroad/], [/^Fender flare$/, /Wide/], [/^Rear wing$/, 'empty'], [/^Splitter$/, 'empty'], [/^Diffuser$/, 'empty'], [/^Exocage$/, 'empty'], [/^Engine$/, /4\.5L V8/], [/axle suspension$/, /Crawler/]] },
      { name: 'Drift', type: 'Custom', picks: [[/^Front bumper$/, /Drift/], [/^Rear bumper$/, /Race/], [/^Roof$/, /Carbon/], [/^Rear wing$/, /Race/], [/^Exhaust$/, /Race/], [/seat$/, /Race/], [/door$/, /Race/], [/^Exocage$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Light bar$/, 'empty'], [/^Spare wheel/, 'empty'], [/^Bull bar/, 'empty'], [/skid plate$/, 'empty'], [/mud ?flap/i, 'empty'], [/^Splitter$/, 'empty'], [/^Engine$/, /5\.5L V8/], [/axle suspension$/, /Hopper Live Axle/]] },
      { name: 'Trophy Truck', type: 'Race', picks: [[/^Front bumper$/, /Offroad/], [/^Rear bumper$/, /Offroad/], [/^Hood$/, /Race/], [/^Roof$/, 'empty'], [/^Windshield$/, /Cut/], [/^Fender flare$/, /Wide/], [/side skirt$/, /Offroad/], [/^Exhaust$/, /Race/], [/seat$/, /Race/], [/door$/, /Race/], [/^Rear wing$/, 'empty'], [/^Splitter$/, 'empty'], [/^Diffuser$/, 'empty'], [/^Spare wheel/, 'empty'], [/^Engine$/, /6\.9L V8/], [/axle suspension$/, /D-Series/]] },
      { name: 'Race', type: 'Race', picks: [[/^Front bumper$/, /Race/], [/^Rear bumper$/, /Race/], [/^Hood$/, /Race/], [/^Roof$/, /Carbon/], [/^Windshield$/, /Cut/], [/^Rear wing$/, /Race/], [/^Exhaust$/, /Race/], [/seat$/, /Race/], [/door$/, /Race/], [/^Exocage$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Light bar$/, 'empty'], [/^Spare wheel/, 'empty'], [/^Bull bar/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /2\.5L I4/], [/axle suspension$/, /Hopper Live Axle/]] },
    ],
  },
  forge_gp60: {
    name: 'Forge GP60',
    axles: ['bolide/bolide_race_suspension_F', 'bolide/bolide_race_suspension_R'],
    // The Bolide's road suspension, and the Autobello's off-road trailing links (a car as narrow as this one) for the dirt versions.
    axleOptions: [
      ['bolide/bolide_suspension_F', 'autobello/autobello_suspension_F_offroad'],
      ['bolide/bolide_suspension_R', 'autobello/autobello_suspension_R_offroad'],
    ],
    track: 1.26,
    wheels: '15x',
    engine: 'bolide/bolide_engine_3.2_v8',
    gearbox: 'bolide/bolide_transaxle_5M_race',
    engineOptions: ['bolide/bolide_engine_3.9_v8', 'bolide/bolide_engine_v6_3.3', 'sunburst2/sunburst2_engine_2_5'],
    hinges: false,
    features: ['nitrous'],
    horn: /Horn 0[2-9]/,
    configs: [
      { name: 'Grand Prix', type: 'Factory', picks: [[/^Rear wing$/, 'empty'], [/^Splitter$/, 'empty'], [/^Diffuser$/, 'empty'], [/^Roll cage$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/mud ?flap/i, 'empty'], [/skid plate$/, 'empty'], [/^Headlight/i, 'empty'], [/^Engine$/, /3\.2L V8/], [/axle suspension$/, /Bolide Independent/]] },
      { name: 'Race', type: 'Race', picks: [[/^Front bumper$/, /Race/], [/^Rear bumper$/, /Race/], [/^Rear wing$/, /Race/], [/side skirt$/, /Race/], [/^Intake$/, /Race/], [/^Exhaust$/, /Race/], [/seat$/, /Race/], [/^Windshield$/, /Cut/], [/^Engine cover$/, 'empty'], [/^Roll cage$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/mud ?flap/i, 'empty'], [/fender$/, 'empty'], [/quarter panel$/, 'empty'], [/^Headlight/i, 'empty'], [/^Engine$/, /3\.9L V8/], [/axle suspension$/, /Bolide Race/]] },
      { name: 'Rally', type: 'Custom', picks: [[/^Front bumper$/, /Offroad/], [/^Rear bumper$/, /Offroad/], [/^Rear wing$/, 'empty'], [/^Splitter$/, 'empty'], [/^Diffuser$/, 'empty'], [/^Roll cage$/, 'empty'], [/^Light bar$/, 'empty'], [/^Engine$/, /2\.5L F4/], [/axle suspension$/, /Autobello/]] },
      { name: 'Drift', type: 'Custom', picks: [[/^Front bumper$/, /Drift/], [/^Rear bumper$/, /Race/], [/^Exhaust$/, /Race/], [/^Splitter$/, 'empty'], [/^Roll cage$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/mud ?flap/i, 'empty'], [/skid plate$/, 'empty'], [/fender$/, 'empty'], [/quarter panel$/, 'empty'], [/^Headlight/i, 'empty'], [/^Engine$/, /3\.3L V6/], [/axle suspension$/, /Bolide Independent/]] },
      { name: 'Trophy', type: 'Race', picks: [[/^Front bumper$/, /Offroad/], [/^Rear bumper$/, /Offroad/], [/^Intake$/, /Race/], [/^Exhaust$/, /Race/], [/seat$/, /Race/], [/^Rear wing$/, 'empty'], [/^Splitter$/, 'empty'], [/^Diffuser$/, 'empty'], [/^Roll bar$/, 'empty'], [/^Engine$/, /3\.9L V8/], [/axle suspension$/, /Autobello/]] },
    ],
  },
  forge_hauler: {
    name: 'Forge Hauler 8x8',
    // Four axles: two steered (the second turns 60% as far), a tandem of the same drive axle behind.
    axles: ['midtruck/midtruck_suspension_F', 'midtruck/midtruck_suspension_F', 'midtruck/midtruck_suspension_R_4w', 'midtruck/midtruck_suspension_R_4w'],
    axleNames: ['Front steer', 'Second steer', 'Front drive', 'Rear drive'],
    axlesAt: [-3.2, -1.75, 2.3, 3.65],
    steered: [true, true, false, false],
    steer: [1, 0.6, 1, 1],
    axleOptions: [['pickup/pickup_desert_suspension_SFA'], [], ['pickup/pickup_desert_suspension_R'], ['pickup/pickup_desert_suspension_R']],
    track: 1.42,
    wheels: null,
    engine: 'us_semi/us_semi_engine_I6',
    gearbox: 'us_semi/us_semi_transmission_5A',
    engineOptions: ['us_semi/us_semi_engine_V8', 'midtruck/midtruck_engine_diesel_i6', 'pickup/pickup_engine_v8_6.0_diesel'],
    fuelL: 1200,
    masses: [[/^Chassis frame$/, 900], [/^Cab$/, 450], [/^Truck bed$/, 200], [/fuel tank/i, 60], [/^Roof$/, 40]],
    hinges: true,
    moving: MOVING,
    headUnit: /^radio$/,
    props: true,
    triggers: true,
    cameras: ['Driver (left-hand drive)', 'Passenger'],
    features: ['plateFront', 'plateRear', 'hitch'],
    skins: ['Fleet white'],
    paints: true,
    tuning: [[/^Chassis frame$/, 'mass']],
    horn: /Horn 0[5-9]/,
    configs: [
      { name: 'Long Haul', type: 'Factory', picks: [[/^Front bumper$/, /Aero/], [/^Roof$/, /Aero/], [/side skirt$/, /Aero/], [/^Tow hitch$/, 'empty'], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Spare wheel$/, 'empty'], [/^Engine$/, /900CUI I6/], [/suspension$/, /MD-Series|Swing Axle/]] },
      { name: 'Heavy Tow', type: 'Custom', picks: [[/^Front bumper$/, /Heavy/], [/^Rear bumper$/, /Heavy/], [/^Grille$/, /Heavy/], [/^Truck bed$/, /Heavy/], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Spare wheel$/, 'empty'], [/^Engine$/, /1100CUI V8/], [/suspension$/, /MD-Series|Swing Axle/]] },
      { name: 'Expedition', type: 'Custom', picks: [[/^Front bumper$/, /Offroad/], [/^Rear bumper$/, /Heavy/], [/^Truck bed$/, 'empty'], [/^Tow hitch$/, 'empty'], [/^Engine$/, /2\.8L/], [/suspension$/, /D-Series|Desert/]] },
    ],
  },
  forge_estate: {
    name: 'Forge Estate',
    axles: ['etk800/etk800_suspension_F', 'etk800/etk800_suspension_R'],
    // The Vivace's rally rear is left out: its trailing-arm node runs away in the plain 2000 Hz check (the game's own solver takes it).
    axleOptions: [
      ['etk800/etk800_suspension_F_wide', 'vivace/vivace_suspension_F_rally'],
      ['etk800/etk800_suspension_R_wide'],
    ],
    track: 1.5,
    wheels: '16x',
    engine: 'etk800/etk_engine_i6_3.0',
    gearbox: 'etk800/etk_transmission_6M',
    engineOptions: ['etk800/etk_engine_i4_2.0_diesel', 'etk800/etk_engine_v8_4.4_petrol', 'etk800/etk_engine_i6_3.0_diesel'],
    fuelL: 70,
    hinges: true,
    moving: { ...MOVING, Sunroof: { 'Sunroof glass': /^sunroof_glass$/ } },
    headUnit: /^radio$/,
    props: true,
    triggers: true,
    cameras: ['Driver (left-hand drive)', 'Passenger', 'Hood'],
    features: ['plateFront', 'plateRear', 'hitch', 'nitrous'],
    skins: ['Rally stripes'],
    paints: true,
    tuning: [[/^Body shell$/, 'mass']],
    horn: /Horn 0[2-9]/,
    configs: [
      { name: 'Base', type: 'Factory', picks: [[/^Sunroof/, 'empty'], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Police lights$/, 'empty'], [/^Splitter$/, 'empty'], [/skid plate$/, 'empty'], [/^Rear wing$/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /2\.0L.*Diesel/i], [/axle suspension$/, /ETK/]] },
      { name: 'Sport', type: 'Custom', picks: [[/^Front bumper$/, /Sport/], [/^Rear bumper$/, /Sport/], [/^Hood$/, /Sport/], [/^Grille$/, /Sport/], [/^Rear wing$/, /Sport/], [/side skirt$/, /Sport/], [/^Exhaust$/, /Sport/], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Police lights$/, 'empty'], [/skid plate$/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /4\.4L V8/], [/axle suspension$/, /Wide/]] },
      { name: 'Rally', type: 'Race', picks: [[/^Front bumper$/, /Offroad/], [/^Light bar$/, /^Light bar$/], [/^Police lights$/, 'empty'], [/^Splitter$/, 'empty'], [/^Rear wing$/, 'empty'], [/^Sunroof/, 'empty'], [/^Engine$/, /3\.0L I6$|3\.0L I6 Engine$/], [/^Front axle suspension$/, /Vivace/], [/^Rear axle suspension$/, /Wide/]] },
      { name: 'Police', type: 'Custom', picks: [[/^Light bar$/, 'empty'], [/^Roof rack$/, 'empty'], [/^Splitter$/, 'empty'], [/skid plate$/, 'empty'], [/^Rear wing$/, 'empty'], [/^Sunroof/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /3\.0L I6$|3\.0L I6 Engine$/], [/axle suspension$/, /Wide/]] },
      { name: 'Taxi', type: 'Custom', picks: [[/^Light bar$/, /Taxi/], [/^Police lights$/, 'empty'], [/^Roof rack$/, 'empty'], [/^Splitter$/, 'empty'], [/skid plate$/, 'empty'], [/^Rear wing$/, 'empty'], [/^Sunroof/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /3\.0L.*Diesel/i], [/axle suspension$/, /ETK/]] },
    ],
  },
  forge_camper: {
    name: 'Forge Camper',
    axles: ['van/van_beamaxle_F', 'van/van_axle_R'],
    axleOptions: [[], ['van/van_axle_R_4link', 'van/van_axle_R_heavy']],
    track: 1.64,
    wheels: '16x',
    engine: 'van/van_engine_v8_4.5',
    gearbox: 'van/van_transmission_4A',
    engineOptions: ['van/van_engine_i6_4.1', 'van/van_engine_v8_6.0_diesel', 'van/van_engine_v8_6.9'],
    fuelL: 110,
    hinges: true,
    moving: { ...MOVING, Sunroof: { 'Sunroof glass': /^sunroof_glass$/ } },
    headUnit: /^radio$/,
    props: true,
    triggers: true,
    cameras: ['Driver (left-hand drive)', 'Passenger'],
    features: ['plateFront', 'plateRear', 'hitch', 'nitrous'],
    skins: ['Surf stripes'],
    paints: true,
    tuning: [[/^Body shell$/, 'mass']],
    horn: /Horn 0[3-9]/,
    configs: [
      { name: 'Camper', type: 'Factory', picks: [[/^Roof rack$/, /^Roof rack$/], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Splitter$/, 'empty'], [/^Rear wing$/, 'empty'], [/skid plate$/, 'empty'], [/^Engine$/, /4\.5L V8/], [/axle suspension$/, /^(?!.*(4-Link|Heavy)).*$/]] },
      { name: 'Cargo', type: 'Custom', picks: [[/quarter glass$/, 'empty'], [/^Bed$/, 'empty'], [/^Interior trim/, 'empty'], [/^Sunroof/, 'empty'], [/seat$/, 'empty'], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Splitter$/, 'empty'], [/^Rear wing$/, 'empty'], [/skid plate$/, 'empty'], [/^Spare wheel$/, 'empty'], [/^Engine$/, /4\.1L I6/], [/axle suspension$/, /4-Link/]] },
      { name: 'Shuttle', type: 'Custom', picks: [[/^Bed$/, 'empty'], [/^Interior trim/, 'empty'], [/^Sunroof/, 'empty'], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/^Splitter$/, 'empty'], [/^Rear wing$/, 'empty'], [/skid plate$/, 'empty'], [/^Engine$/, /6\.0L Diesel/], [/axle suspension$/, /Heavy/]] },
      { name: 'Heavy Duty', type: 'Custom', picks: [[/^Front bumper$/, /Heavy/], [/^Rear bumper$/, /Heavy/], [/side skirt$/, /Heavy/], [/^Roof rack$/, /Box/], [/^Splitter$/, 'empty'], [/^Rear wing$/, 'empty'], [/^Engine$/, /6\.0L Diesel/], [/axle suspension$/, /Heavy/]] },
      { name: 'Race', type: 'Race', picks: [[/^Front bumper$/, /Race/], [/side skirt$/, /Race/], [/^Exhaust$/, /Race/], [/^Bed$/, 'empty'], [/^Interior trim/, 'empty'], [/^Sunroof/, 'empty'], [/^Roof rack$/, 'empty'], [/^Light bar$/, 'empty'], [/^Snorkel$/, 'empty'], [/skid plate$/, 'empty'], [/^Spare wheel$/, 'empty'], [/mud ?flap/i, 'empty'], [/^Engine$/, /6\.9L V8/], [/axle suspension$/, /4-Link/]] },
    ],
  },
};

/** The variant words the showcase models use for the versions a configuration can pick (mesh name suffixes). */
export const VARIANT_KINDS = ['offroad', 'race', 'drift', 'wide', 'carbon', 'cut', 'heavy', 'aero', 'sport', 'taxi'];

export async function showcaseBuild({ page, base, plan, model, hook, shot, assert, waitSaved, invoke, outDir, fakeUserDir, realInstall, ROOT }) {
  const meshKeys = async (re) => Object.keys(await hook(page, 'meshMaterials')).filter((k) => re.test(k.slice(k.indexOf(':') + 1)));
  const pressEnter = async (loc, value) => {
    await loc.fill(String(value));
    await loc.press('Enter');
  };
  const closeDialogs = async () => {
    for (let i = 0; i < 3 && (await page.locator('[role=dialog]').count()); i++) await page.keyboard.press('Escape');
  };

  await page.waitForSelector('[data-testid=app-ready]');
  if (await page.locator('[data-view=editor]').count()) {
    await hook(page, 'runCommand', 'close');
    if (await page.getByTestId('unsaved-discard').isVisible({ timeout: 1500 }).catch(() => false)) await page.getByTestId('unsaved-discard').click();
  }
  await page.waitForSelector('[data-view=home][data-testid=app-ready]');
  await invoke('settings:update', { beamngInstallDir: realInstall, offerLessons: false });
  for (let i = 0; i < 3000; i++) {
    const lib = await invoke('library:status');
    if (!lib.scanning && (await invoke('suspension:catalogue')).length) break;
    await page.waitForTimeout(100);
  }
  // Import and sort.
  await page.getByTestId('home-new').click();
  await page.getByTestId('newmod-name').fill(plan.name);
  await hook(page, 'queueDialog', [model]);
  await page.getByTestId('newmod-create').click();
  await page.getByTestId('import-dialog').waitFor({ timeout: 60_000 });
  await page.getByTestId('import-confirm').click();
  await page.getByTestId('classify-summary').waitFor({ timeout: 120_000 });
  for (let i = 0; i < 600 && !(await hook(page, 'sceneStats')).sources.every((x) => x.status === 'ready'); i++) await page.waitForTimeout(100);
  await page.getByTestId('classify-apply').click();
  await hook(page, 'setMeta', { slug: base });
  const partsState = await hook(page, 'partsState');
  const unassigned = (await hook(page, 'sceneStats')).meshes - partsState.assigned;
  assert(unassigned === 0, `every mesh sorted into a part (${unassigned} left over)`);
  // The weight of the parts that carry the car (a truck's frame and cab), set in the Inspector before the structure is made.
  // A part picked in the Scene tree the way a user finds it: typed into its search, then clicked.
  const pickPart = async (re) => {
    const p = partsState.parts.find((x) => !x.variantOf && re.test(x.displayName));
    assert(p, `a part named like ${re}`);
    await page.getByTestId('scene-filter').fill(p.displayName);
    await page.locator(`[data-part-id="${p.id}"]`).first().getByText(p.displayName, { exact: true }).click();
    await page.getByTestId('scene-filter').fill('');
    return p;
  };
  for (const [re, kg] of plan.masses ?? []) {
    await pickPart(re);
    await page.getByLabel('Target mass').waitFor();
    await pressEnter(page.getByLabel('Target mass'), kg);
  }
  // Structure.
  await page.getByTestId('toolbar-generate').click();
  for (let i = 0; i < 3000 && !((await hook(page, 'projectDoc')).nodes.length > 50); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(1500);
  await shot(page, 'showcase-generated');
  // Axles from the car's own wheels, more axles added and placed for a truck, then the game's suspensions on them, at the car's track.
  await page.getByTestId('toggle-suspension').click();
  await page.getByRole('button', { name: 'Set up axles' }).click();
  await page.getByTestId('suspension-picker').waitFor();
  await page.getByRole('button', { name: 'Back' }).first().click();
  for (let i = 2; i < plan.axles.length; i++) await page.getByTestId('axle-add').click();
  for (const [i, y] of (plan.axlesAt ?? []).entries()) await pressEnter(page.getByLabel('Axle position').nth(i), y);
  for (const [i, name] of (plan.axleNames ?? []).entries()) await page.getByLabel('Axle name').nth(i).fill(name);
  for (const [i, steered] of (plan.steered ?? []).entries()) {
    const sw = page.getByRole('switch', { name: 'Steers' }).nth(i);
    if ((await sw.getAttribute('aria-checked')) !== String(steered)) await sw.click();
  }
  let steerInputs = 0;
  for (const [i, k] of (plan.steer ?? []).entries()) {
    if (!(plan.steered ?? [true, false])[i]) continue;
    if (k !== 1) await pressEnter(page.getByLabel('Steering range').nth(steerInputs), Math.round(k * 100));
    steerInputs++;
  }
  for (const [i, setId] of plan.axles.entries()) {
    await hook(page, 'fitSet', `axle:${i}`, setId);
    await page.getByTestId('suspension-panel').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    // The other suspensions this axle offers (each version picks one).
    for (const alt of plan.axleOptions?.[i] ?? []) {
      await hook(page, 'fitSet', `axleOption:${i}`, alt);
      await page.waitForTimeout(300);
    }
  }
  assert((await page.getByTestId('axle-options').count()) === plan.axles.length, 'each axle lists its other suspensions');
  const tracks = page.getByLabel('Track width');
  for (let i = 0; i < (await tracks.count()); i++) await pressEnter(tracks.nth(i), plan.track);
  let doc = await hook(page, 'projectDoc');
  assert(doc.axles.length === plan.axles.length && doc.axles.every((a) => a.fitted), `every suspension fitted (${doc.axles.map((a) => a.fitted?.setId ?? 'none').join(', ')})`);
  assert(doc.axles.every((a, i) => (a.alternates ?? []).length === (plan.axleOptions?.[i] ?? []).length), `the other suspensions added (${doc.axles.map((a) => (a.alternates ?? []).map((s) => s.setId).join('+')).join(' / ')})`);
  assert(doc.axles.every((a) => Math.abs(a.track - plan.track) < 0.001), `track set to ${plan.track} m (${doc.axles.map((a) => a.track).join(', ')})`);
  if (plan.steer) assert(doc.axles.every((a, i) => (a.steer ?? 1) === plan.steer[i]), `steering ranges set (${doc.axles.map((a) => a.steer ?? 1).join(', ')})`);
  // The game's wheels through the picker (the car's own wheel meshes were only there to place the axles); every axle with the same lugs gets them.
  // A truck whose suspension brings its own wheels (the MD-Series') takes none of the game's: the picker says so and the set's wheels stay.
  // Each axle's picker in turn (the first pick reaches the other axles with the same lugs; an axle with other lugs, or
  // a wheel with no twin of the other end, gets its own pick).
  for (let i = 0; i < plan.axles.length; i++) {
    const before = (await hook(page, 'projectDoc')).axles[i];
    if (i > 0 && Object.keys(before.fitted.choices ?? {}).length) continue;
    await page.getByTestId('axle-wheels').nth(i).click();
    await page.getByTestId('wheel-picker').waitFor();
    if (plan.wheels) {
      await page.getByTestId('wheel-row').first().waitFor({ timeout: 30_000 });
      await page.getByTestId('wheel-search').fill(plan.wheels);
      await page.waitForTimeout(300);
      assert((await page.getByTestId('wheel-row').count()) > 0, `wheels matching "${plan.wheels}" for these hubs`);
      await page.getByTestId('wheel-fit').first().click();
    } else await page.getByText(/takes no game wheels/).waitFor();
    if (i === 0) await shot(page, 'showcase-wheels');
    await page.getByRole('button', { name: 'Back' }).first().click();
    await page.getByTestId('suspension-panel').waitFor();
  }
  doc = await hook(page, 'projectDoc');
  const wheelChoices = doc.axles.map((a) => Object.values(a.fitted.choices ?? {})[0]?.default);
  if (plan.wheels) assert(wheelChoices.every(Boolean), `a game wheel on each axle (${wheelChoices.join(', ')})`);
  const ownWheels = (await hook(page, 'ignoreMeshes', '^(wheel|tire)_[FRM][LR]2?$')) ;
  assert(ownWheels === doc.axles.length * 4, `the car's own wheels and tyres left out of the export (${ownWheels})`);
  await shot(page, 'showcase-suspension');
  // Engines: the default, its gearbox, the others each version picks from, and the fuel the car carries.
  await page.getByTestId('toggle-powertrain').click();
  await page.getByTestId('powertrain-panel').waitFor();
  await hook(page, 'fitSet', 'engine', plan.engine);
  await page.getByTestId('powertrain-panel').waitFor({ timeout: 60_000 });
  await hook(page, 'fitSet', 'gearbox', plan.gearbox);
  await page.getByTestId('powertrain-panel').waitFor({ timeout: 60_000 });
  for (const id of plan.engineOptions) {
    await hook(page, 'fitSet', 'engineOption', id);
    await page.waitForTimeout(300);
  }
  if (plan.fuelL) {
    await page.getByTestId('fuel-card').waitFor();
    await pressEnter(page.getByLabel('Fuel capacity'), plan.fuelL);
  }
  doc = await hook(page, 'projectDoc');
  assert(doc.powertrain.engine && doc.powertrain.gearbox && (doc.powertrain.alternates ?? []).length === plan.engineOptions.length, `engine, gearbox and ${plan.engineOptions.length} other engines fitted`);
  if (plan.fuelL) assert(doc.powertrain.fuelL === plan.fuelL, `fuel capacity ${plan.fuelL} L (${doc.powertrain.fuelL})`);
  await shot(page, 'showcase-powertrain');
  // Sound: the horn.
  await page.getByTestId('workspace-sound').click();
  await page.getByTestId('sound-panel').waitFor();
  await page.getByLabel('Horn').click();
  await page.getByRole('option', { name: plan.horn }).first().click();
  await shot(page, 'showcase-sound');
  // Everything that moves: hinges on every opening panel, the needles and pedals animated, scripts for wipers, windows, mirrors, seats, sunroof.
  if (plan.hinges) {
    await page.getByTestId('workspace-moving').click();
    await page.getByTestId('moving-parts').waitFor();
    await page.getByTestId('moving-hinge-all').click();
    await page.waitForTimeout(500);
    assert((await hook(page, 'projectDoc')).hinges.length >= 2, 'doors and lids hinged');
  }
  if (plan.props) {
    await page.getByTestId('workspace-moving').click();
    await page.getByTestId('moving-parts').waitFor();
    for (let i = 0; i < 40; i++) {
      const suggest = page.getByTestId('moving-parts').getByText(/^Animate as /).first();
      if (!(await suggest.count())) break;
      await suggest.click();
      await page.waitForTimeout(150);
    }
    doc = await hook(page, 'projectDoc');
    assert((doc.props ?? []).length >= 8, `needles, pedals and the wheel animated (${(doc.props ?? []).length})`);
    await shot(page, 'showcase-moving');
  }
  const scriptsAdded = [];
  for (const [template, params] of Object.entries(plan.moving ?? {})) {
    await page.getByTestId('moving-add-script').click();
    await page.getByRole('option', { name: template }).click();
    await page.getByTestId('script-easy').waitFor();
    let picker = 0;
    for (const [label, re] of Object.entries(params)) {
      const keys = await meshKeys(re);
      assert(keys.length, `${template}: meshes for ${label} (${re})`);
      await hook(page, 'selectMeshes', keys);
      await page.getByTestId('script-use-selection').nth(picker++).click();
    }
    scriptsAdded.push(template);
  }
  if (plan.moving) {
    doc = await hook(page, 'projectDoc');
    const withMeshes = (doc.scripts ?? []).filter((s) => Object.values(s.params).some((v) => Array.isArray(v) && v.length));
    assert(withMeshes.length === scriptsAdded.length, `each moving script has its meshes (${withMeshes.length} of ${scriptsAdded.length})`);
  }
  // Every other script template too, from the gallery; the head unit gets its screen mesh.
  if (plan.moving) {
    await page.getByTestId('workspace-scripts').click();
    await page.getByTestId('scripts-panel').waitFor();
    await page.getByTestId('scripts-add-template').click();
    await page.getByTestId('template-gallery').waitFor();
    const cards = page.getByTestId('template-card');
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      // Adding one shows it in the car's list: back to the gallery for the next.
      if (!(await page.getByTestId('template-gallery').count())) {
        await page.getByTestId('scripts-add-template').click();
        await page.getByTestId('template-gallery').waitFor();
      }
      const title = (await cards.nth(i).locator('strong').first().textContent()).trim();
      if (scriptsAdded.includes(title)) continue;
      await cards.nth(i).getByRole('button', { name: `Add ${title}` }).click();
      await page.waitForTimeout(100);
      scriptsAdded.push(title);
    }
    if (plan.headUnit) {
      await page.getByTestId('scripts-view-list').click();
      await page.getByTestId('script-item').filter({ hasText: /Head unit/ }).first().click();
      await page.getByTestId('script-easy').waitFor();
      await hook(page, 'selectMeshes', await meshKeys(plan.headUnit));
      await page.getByTestId('script-use-selection').first().click();
    }
    doc = await hook(page, 'projectDoc');
    assert((doc.scripts ?? []).length === scriptsAdded.length, `every script template on the car (${(doc.scripts ?? []).length} of ${scriptsAdded.length})`);
    await shot(page, 'showcase-scripts');
  }
  // Triggers: a handle on every hinged panel, and a horn button on the dash, mirrored.
  if (plan.triggers) {
    await page.getByTestId('workspace-triggers').click();
    await page.getByTestId('triggers-panel').waitFor();
    await page.getByTestId('trigger-handles').click();
    await page.getByLabel('Kind of trigger').click();
    await page.getByRole('option', { name: 'Button' }).click();
    await page.getByTestId('trigger-add').click();
    await page.getByTestId('trigger-editor').waitFor();
    const canvas = page.locator('[data-panel=viewport] canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await page.getByTestId('trigger-action').click();
    await page.getByRole('option', { name: /Horn/ }).first().click();
    await page.getByTestId('trigger-mirror').click();
    doc = await hook(page, 'projectDoc');
    // Hinged doors bring their own handles; the button and its mirror are triggers of their own.
    assert((doc.triggers ?? []).length >= 2 && doc.hinges.every((h) => h.handles.length || (doc.triggers ?? []).some((t) => t.action === h.action)), `a handle on every opening panel and the horn buttons (${(doc.triggers ?? []).length} triggers)`);
    await shot(page, 'showcase-triggers');
  }
  await hook(page, 'applyPreset', 'modelling');
  // Extras: plates, hitch, nitrous, cameras, a paint design.
  await page.getByTestId('toggle-features').click();
  await page.getByTestId('features-panel').waitFor();
  for (const kind of plan.features) await page.getByTestId(`feature-${kind}`).getByRole('switch').first().click();
  for (const camera of plan.cameras ?? []) {
    await page.getByTestId('camera-add').click();
    await page.getByRole('option', { name: camera }).click();
  }
  for (const skin of plan.skins ?? []) {
    await page.getByTestId('skin-add').click();
    await page.getByTestId('skin-name').fill(skin);
  }
  doc = await hook(page, 'projectDoc');
  assert((doc.cameras ?? []).length === (plan.cameras ?? []).length && doc.features.skins.length === (plan.skins ?? []).length, 'cameras and paint designs added');
  if (plan.cameras) await shot(page, 'showcase-features');
  // Factory paints: a scheme for the three slots and one more paint.
  if (plan.paints) {
    await page.getByTestId('toggle-paints').click();
    await page.getByTestId('paints-panel').waitFor();
    await page.getByTestId('paint-scheme').first().click();
    await page.getByTestId('paint-preset').first().click();
    doc = await hook(page, 'projectDoc');
    assert(doc.paints.list.length >= 2 && doc.paints.defaults.every(Boolean), `paints set up (${doc.paints.list.length})`);
    await shot(page, 'showcase-paints');
  }
  // A part's weight adjustable in the game's tuning menu.
  for (const [re, setting] of plan.tuning ?? []) {
    await hook(page, 'applyPreset', 'modelling');
    await pickPart(re);
    await page.getByTestId(`tuning-var-${setting}`).getByRole('switch').click();
  }
  if (plan.tuning) assert((await hook(page, 'projectDoc')).variables.length === plan.tuning.length, 'tuning variables added');
  // The versions.
  await page.getByTestId('toggle-configs').click();
  await page.getByTestId('configs-panel').waitFor();
  const picked = {};
  for (const cfg of plan.configs) {
    await page.getByTestId('config-add').click();
    await page.getByTestId('config-name').fill(cfg.name);
    await page.getByLabel('Configuration type').click();
    await page.getByRole('option', { name: cfg.type }).click();
    const selects = page.getByTestId('config-slots').locator('button[aria-label$=" part"]');
    const n = await selects.count();
    picked[cfg.name] = [];
    for (let i = 0; i < n; i++) {
      const label = (await selects.nth(i).getAttribute('aria-label')).replace(/ part$/, '');
      const rule = cfg.picks.find(([re]) => re.test(label));
      if (!rule || (await selects.nth(i).isDisabled())) continue;
      await selects.nth(i).click();
      const option = page.getByRole('option', { name: rule[1] === 'empty' ? '(empty)' : rule[1] });
      if (await option.count()) {
        // A long list opens over the panel's edge; the option is there but Playwright may not see it settle.
        await option.first().scrollIntoViewIfNeeded().catch(() => undefined);
        await option.first().click({ force: true });
        picked[cfg.name].push(`${label} → ${rule[1] === 'empty' ? '(empty)' : String(rule[1])}`);
      } else await page.keyboard.press('Escape');
    }
    await shot(page, `showcase-config-${cfg.name.toLowerCase().replace(/\s+/g, '-')}`);
  }
  writeFileSync(join(outDir, 'showcase-configs.json'), JSON.stringify(picked, null, 1));
  for (const cfg of plan.configs) assert(picked[cfg.name].length >= 4, `${cfg.name} picks its parts (${picked[cfg.name].join('; ')})`);
  // Save the project, then export and install.
  const projectPath = join(outDir, `${base}.jbforge`);
  await hook(page, 'queueDialog', [projectPath]);
  await page.getByTestId('toolbar-save').click();
  for (let i = 0; i < 100 && !existsSync(projectPath); i++) await page.waitForTimeout(100);
  await waitSaved(page);
  await page.getByTestId('toolbar-export').click();
  await page.getByTestId('export-dialog').waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'showcase-export-dialog');
  // Nodes that start inside the game's tyres: the dialog's button moves them out, and the warning goes.
  const clearTyres = page.getByTestId('export-clear-tyres');
  if (await clearTyres.count()) {
    const fouls = async () => ((await page.getByTestId('export-dialog').textContent()) ?? '').match(/are inside them/g)?.length ?? 0;
    const before = await fouls();
    await clearTyres.click();
    for (let i = 0; i < 100 && ((await fouls()) >= before || (await page.getByTestId('export-install').isDisabled())); i++) await page.waitForTimeout(100);
    const after = await fouls();
    assert(after < before, `moving the nodes out of the tyres clears the warning (${before} → ${after})`);
  }
  const dialogText = await page.getByTestId('export-dialog').textContent();
  writeFileSync(join(outDir, 'showcase-export-dialog.txt'), dialogText);
  assert(!(await page.getByTestId('export-install').isDisabled()), `the export is not blocked:\n${dialogText.slice(0, 1500)}`);
  await page.getByTestId('export-install').click();
  await page.getByTestId('export-result').waitFor({ timeout: 240_000 });
  await shot(page, 'showcase-exported');
  const unpacked = join(fakeUserDir, 'mods', 'unpacked');
  const mod = readdirSync(unpacked).sort((a, b) => statSync(join(unpacked, b)).mtimeMs - statSync(join(unpacked, a)).mtimeMs)[0];
  const modDir = join(outDir, `${base}-mod`);
  cpSync(join(unpacked, mod), modDir, { recursive: true });
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const lint = spawnSync(process.execPath, [tsx, '--tsconfig', join(ROOT, 'tsconfig.node.json'), join(ROOT, 'scripts', 'lint-mod.ts'), modDir], { encoding: 'utf8', env: { ...process.env, BEAMNG_INSTALL: realInstall } });
  writeFileSync(join(outDir, 'showcase-lint.txt'), lint.stdout + lint.stderr);
  const vdir = join(modDir, 'vehicles', readdirSync(join(modDir, 'vehicles'))[0]);
  const pcs = readdirSync(vdir).filter((f) => f.endsWith('.pc'));
  const checks = pcs.map((pc) => ({ pc, r: spawnSync(process.execPath, [tsx, join(ROOT, 'scripts', 'dev', 'jbeamStability.mts'), vdir, pc], { encoding: 'utf8', env: { ...process.env, STEPS: '6000' } }) }));
  writeFileSync(join(outDir, 'showcase-stability.txt'), checks.map((c) => `${c.pc}\n${c.r.stdout}${c.r.stderr}`).join('\n'));
  assert(lint.status === 0, `the mod lints clean:\n${(lint.stdout + lint.stderr).split('\n').slice(0, 30).join('\n')}`);
  assert(pcs.length === plan.configs.length + 1, `every version exported (${pcs.join(', ')})`);
  for (const c of checks) assert(/RUN: \d+ steps .* stable/.test(c.r.stdout), `${c.pc} holds together at 2000 Hz:\n${c.r.stdout.split('\n').filter((l) => /RUN|worst|nodes,/.test(l)).join('\n')}${c.r.stderr.slice(0, 400)}`);
  await closeDialogs();
}
