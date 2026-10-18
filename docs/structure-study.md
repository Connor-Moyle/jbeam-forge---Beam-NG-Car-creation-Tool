# Structure study: every car in the game

`scripts/dev/study-all-cars.mts` reads each drivable car in the install (38 in BeamNG.drive 0.39), sorts its parts into the kinds the generator builds, and prints the medians. Aggregates only: nothing from the game's files is kept. The generator's presets (`src/shared/proxy/presets.ts`) are set from this table; re-run the script before changing them.

    npx tsx --tsconfig tsconfig.node.json scripts/dev/study-all-cars.mts

Columns: nodes per part as p10–median–p90; the rest are medians of the part's own `|NORMAL` beams (attachments to the parent are another preset).

| kind | parts | nodes/part | kg/node | beams/node | length m | spring | damp | deform | strength | tris/node |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| suspension | 264 | 2–6–24 | 4.70 | 4.0 | 0.40 | 6.0M | 141 | 68k | 350k | 0.50 |
| light | 134 | 3–5–8 | 0.60 | 4.0 | 0.19 | 659k | 50 | 12k | 60k | 1.20 |
| bumper | 130 | 2–17–27 | 1.11 | 8.0 | 0.44 | 801k | 80 | 15k | 59k | 1.33 |
| body | 126 | 2–22–144 | 2.82 | 10.0 | 0.58 | 2.1M | 125 | 11k | 150k | 1.99 |
| seat | 119 | 3–6–9 | 2.20 | 5.0 | 0.71 | 2.4M | 300 | 10k | 150k | 0.67 |
| fender | 112 | 2–10–20 | 0.70 | 6.0 | 0.44 | 601k | 50 | 6k | 63k | 1.00 |
| mirror | 98 | 4–7–11 | 0.35 | 6.0 | 0.17 | 401k | 40 | 4k | 50k | 0.86 |
| exhaust | 93 | 2–8–18 | 1.60 | 6.0 | 0.56 | 1.0M | 100 | 8k | 65k | 1.00 |
| spoiler | 89 | 2–7–27 | 0.30 | 7.0 | 0.42 | 201k | 25 | 5k | 25k | 1.14 |
| transmission | 85 | 1–2–6 | 10.00 | 3.0 | 0.34 | 3.8M | 250 | 190k | ∞ | 0.00 |
| intake | 82 | 1–4–10 | 2.00 | 3.0 | 0.36 | 1.0M | 100 | 15k | 22k | 0.00 |
| door | 78 | 3–15–16 | 1.15 | 7.0 | 0.53 | 1.0M | 90 | 5k | 127k | 0.87 |
| roof | 71 | 5–10–22 | 0.94 | 6.0 | 0.51 | 601k | 50 | 8k | 36k | 1.56 |
| glass | 69 | 1–2–9 | 1.00 | 1.0 | 0.56 | 241k | 25 | 4k | 6k | 3.00 |
| hood | 64 | 2–13–27 | 0.80 | 8.0 | 0.49 | 701k | 60 | 7k | 128k | 1.00 |
| trunk | 60 | 2–10–20 | 0.80 | 7.0 | 0.48 | 701k | 59 | 8k | 65k | 1.05 |
| fuel_tank | 51 | 3–9–21 | 0.50 | 3.0 | 0.62 | 2.4M | 160 | 21k | 125k | 0.00 |
| engine | 43 | 4–10–14 | 14.50 | 8.0 | 0.59 | 6.0M | 400 | 175k | 10k | 0.22 |
| radiator | 39 | 1–2–12 | 3.06 | 5.0 | 0.59 | 2.0M | 160 | 30k | 13k | 0.00 |
| side_skirt | 38 | 1–10–16 | 0.40 | 7.0 | 0.47 | 201k | 20 | 8k | 60k | 0.94 |
| dash | 27 | 5–9–15 | 1.00 | 4.0 | 0.35 | 801k | 55 | 12k | 150k | 2.07 |
| grille | 21 | 3–8–12 | 1.07 | 5.0 | 0.40 | 801k | 60 | 10k | 149k | 0.80 |
| subframe | 9 | 2–14–63 | 4.00 | 9.0 | 0.49 | 4.0M | 100 | 18k | 6k | 1.37 |

## What changed from the Sunburst-only numbers (0.16.0 → 0.17.0)

The old presets came from one car. Over all 38:

- **Body shell** is three times stronger than we had it (strength 150k, not 50k) and deforms later (11k).
- **Bumpers** are stiff metal-like parts (800k spring, 80 damping, 15k deform), not soft plastic, but they share the plastic panel preset with skirts and spoilers (200k), and a thin skirt's 0.15 kg nodes blew up at spawn when the preset was raised to 400k, or when its damping was dropped to the game's 25. The preset keeps 200k/60 with the game's deform and strength (8k/55k). Bumpers now have a preset of their own (`panel_bumper`: 600k/80/15k/59k on 1.1 kg nodes), a little under the game's.
- **Light mechanical parts** (radiator, fuel tank, intake, steering wheel, exhaust) are 1–2.4M spring in the game, but the practice car's exhaust manifold and steering wheel blew up at spawn at 800k and above: their generated nodes are too light for it. Stiffness stays at 300k; deform and strength go to the game's 15k/40k.
- **Trim** (lights, mirrors, grilles, dashboards, exhausts) was far too weak at 300k spring and 12k strength: the game's trim runs 400k–1M and 50k–150k, so ours tore off in any touch. Now 600k/50/8k/55k.
- **Glass** damping is 25 across the game (the Sunburst's 250 was the outlier); strength 6k with deform 4k.
- **Engine blocks** are 6M spring (not 15M); suspension arms deform at 60k (not 25k).
- **Panel node counts**: hood 13 (up to 27), boot 10 (up to 20), wing 10 (up to 20), roof 10 (up to 22); doors stay at 15–16.

## Layout: how many nodes, and how a part hangs on

The same script run with `--mod <exported mod folder>` measures our output the same way, so the gap is a table. Each part's size is the area of its outline seen flat on (`src/shared/proxy/layout.ts`), so counts compare as nodes per square metre. Attachments are a part's beams that reach another part's nodes.

| kind | game nodes/m² | ours before | ours now | game attach/part · per node · share of nodes | ours before | ours now |
|---|---:|---:|---:|---|---|---|
| bumper | 25 | 47 | 29 | 30 · 3.2 · 71% | 14 · 2.0 · 32% | 30 · 3.0 · 77% |
| fender | 22 | 17 | 20 | 27 · 3.4 · 92% | 18 · 3.0 · 55% | 30 · 3.0 · 77% |
| hood | 16 | 13 | 14 | 17 · 3.0 · 67% | 33 · 3.0 · 58% | 45 · 3.0 · 75% |
| trunk | 22 | 20 | 20 | 16 · 3.8 · 67% | 24 · 3.0 · 62% | 30 · 3.0 · 77% |
| spoiler | 35 | 24 | 33 | 30 · 4.0 · 100% | 12 · 2.0 · 55% | 45 · 3.0 · 100% |
| grille | 30 | 42 | 36 | 22 · 3.9 · 86% | 16 · 2.0 · 57% | 30 · 3.0 · 83% |
| door | 16 | 14 | 18 | 13 · 4.3 · 27% (hinged) | 30 · 3.0 · 59% | 54 · 3.0 · 82% (bolted in this test) |
| side skirt | 39 | 55 | 57 | 32 · 4.3 · 88% | 16 · 2.0 · 29% | 54 · 3.0 · 62% |

What the generator does with it (0.17.2):

- **Node count from area.** A hull-built panel or trim part gets `area × the game's density` nodes at the middle of the Detail slider (0.6× to 1.4× across it), within its kind's budget. The body shell keeps its surface budget: with the density rule its node count dropped and a door's hinge mounts landed on other body nodes, so the hinge sandbox's door no longer opened.
- **Attachments like the game's.** Clipped parts hang on 3 beams per attached node (was 2), and a part attaches every node within 0.22 m of its parent (was 0.15 m), which takes the attached share of bumpers, fenders and grilles from a third to three quarters, as the game has them.
- **Left alone.** Side skirts stay denser than the game's: a long thin part is given extra nodes until the game can hang its mesh on it (the "bindable" rule), which outweighs the density. Their nodes are light (0.22 kg against the game's 0.4), which is why the plastic preset keeps its damping.
