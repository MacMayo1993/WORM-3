---
name: elemental-fusions
description: Design map and implementation guide for WORM elemental fusions. There are 20 ordered pairs of the 5 elements, and pickup order matters (Water then Fire is not Fire then Water). Use when adding, changing, tuning or testing a fusion combo, when touching elementalFusion.js / elementalGameplay.js / the storm / the spring pads, or when asked what two elements do together.
---

# Elemental fusions

Claiming an element while another's wash is up **fuses** them. This skill is the
full map: every ordered pair of the five elements, what each one does, which are
live, and how to build the rest without breaking the ones that work.

Read `src/worm/healerWorm/elementalFusion.js` and the "Two elements fuse" note in
`CLAUDE.md` before changing anything.

## The five elements (base effects, always on while their half of a pair is up)

| Element | Key | Base effect | Where it lives |
|---|---|---|---|
| Water | `water` | Builds momentum on straight runs, up to +25% speed; turns shed it (×0.35) | `tickElementalGameplay`, `waterSpeedBonus`, `turnShedsMomentum` |
| Fire | `fire` | Leaves a 3 s trail of hot tiles: firebreak vs bomb blasts, fuses on them burn 3× faster | `addElementalPatch(..., 'fire')`, `isHotTile` |
| Nature | `grass` | Every landing grows an 8 s spring pad; jumping from one is a 2.2-tile leap | `consumeSpring`, landing in `stepWormSim` |
| Ice | `ice` | The worm slides to the next tile before a turn takes; jumping steers at once | `iceHoldsTurn` |
| Lightning | `lightning` | The storm marks 6 tiles; strikes kill a head, cut a tail, kill enemies, flip bare tiles into charged tunnels | `lightningStorm.js`, `runStorm` in `HealerWormMode.jsx` |

## Order: base, then catalyst

The **first** element claimed is the **base**: it lays down the field (a trail,
pads, momentum, a storm). The **second** is the **catalyst**: it acts on that
field. So the same two elements make two different fusions:

- **Water → Fire = Steam**: fire boils the water you are carrying; the trail steams.
- **Fire → Water = Quench**: water hits hot ground; the trail sets into obsidian.

In the sim the base is `sim.elementalPair` (older) and the catalyst is
`sim.elementalType` (newest). The ordered key is `` `${base}>${catalyst}` ``.

### How order changes during a wash

| Situation | Before | Claim | After | Notes |
|---|---|---|---|---|
| First element | none | A | A alone | no fusion |
| Second element | A | B | **A → B** | fuses; offering wiped |
| Same as catalyst | A → B | B | A → B | refresh only |
| Same as base | A → B | A | **B → A** | order flips, so the fusion flips too |
| Third element | A → B | C | **B → C** | oldest (A) drops out |

Reclaiming the base to flip the order is a deliberate skill move. Keep it.

## The full map (20 ordered pairs)

Status: every recipe below is **Live** (shipped with its own rule).

Every fusion keeps both base effects on; the rule below is added on top.

### Water first

| Order | Name | Rule | Status |
|---|---|---|---|
| Water → Fire | **Steam** | The fire trail steams: enemies stepping onto it are scalded and stunned (joins the light wall via `steamTiles`), and a bomb sitting on it is put out like a disarm. | Live |
| Water → Ice | **Slipstream** | Turns no longer shed momentum; full momentum is worth +40% instead of +25%. | Live |
| Water → Nature | **Bloom** | Rain makes things grow: every 4th tile crawled grows a spring pad by itself (`sim.fusionTiles`), no landing needed, and pads last 12 s instead of 8 s. | Live |
| Water → Lightning | **Conductor** | The wet worm is grounded: marks never aim at the body (body keys join `avoid`, `bodyShare: 0`), and every strike on a bare tile forks to a second tile two away (`addStormFlash`): a second flip and a second 3x3 of enemy kills. | Live |

### Fire first

| Order | Name | Rule | Status |
|---|---|---|---|
| Fire → Water | **Quench** | The fire trail sets into obsidian: tiles last 8 s instead of 3 s and stay a firebreak, but no longer speed up bomb fuses; crawling on obsidian keeps full water momentum through turns. | Live |
| Fire → Ice | **Coldfire** | The trail burns blue (`cold: true`, 5 s): still a firebreak, never speeds a fuse (`isHotTile` is false), and enemies arriving on it freeze (`frostTiles` → `player.frost`). | Live |
| Fire → Nature | **Wildfire** | A spring landing sets its 3x3 alight (fire patches) and kills the enemies in it (a `'wildfire'` fusion burst → `strikeEnemies`). | Live |
| Fire → Lightning | **Plasma** | Twice the marks (`beginStorm(storm, 12)`), never on the fire trail or the body, and each strike on a bare tile leaves it burning for 8 s. | Live |

### Nature first

| Order | Name | Rule | Status |
|---|---|---|---|
| Nature → Water | **Geyser** | A pad launch refills water momentum and keeps it through the leap; a launch at ≥ 0.8 momentum goes +1 tile and +0.8 lift. | Live |
| Nature → Fire | **Emberseed** | Pads last 4 s (`ember: true`, drawn as coals); a pad that withers unused bursts: its 3x3 burns and a fusion burst of kind `'emberseed'` kills the enemies in it. | Live |
| Nature → Ice | **Ski Jump** | Every grounded jump (not across a seam) is a full spring leap, no pad needed; Nature's landing pad then chains the next one. | Live |
| Nature → Lightning | **Thunderpad** | The storm aims `STORM.padShare` (half) of its marks at free spring pads; a struck pad is charged (violet) instead of flipped, and a leap from it uses `CHARGED_SPRING_SPAN`/`HEIGHT`. | Live |

### Ice first

| Order | Name | Rule | Status |
|---|---|---|---|
| Ice → Water | **Frozen Wake** | Every tile the worm leaves becomes frost (type `'frost'`, 5 s): a bomb on frost stops ticking, an enemy arriving on it freezes. | Live |
| Ice → Fire | **Meltdown** | A turn the ice slide held (`sim.iceHeldTurn`) ends in a dash (+30% for 0.6 s, `fusionSpeedBonus`) and melts the tile it turned on (`melt: true`); a bomb on a melted tile is put out. | Live |
| Ice → Nature | **Frostbloom** | A spring landing frosts its 3x3 (bombs stop ticking) and a fusion burst of kind `'frostbloom'` freezes its enemies; the pad grown there is iced and lasts 12 s. | Live |
| Ice → Lightning | **Static** | A strike within 2 tiles of the head discharges into the worm: no harm, no flip, +35% speed for 1.5 s (`sim.staticT`); enemies in its 3x3 still die. | Live |

### Lightning first

| Order | Name | Rule | Status |
|---|---|---|---|
| Lightning → Water | **Current** | At ≥ 0.8 water momentum a strike on the head or body is absorbed and arcs on: it kills the nearest enemy within 3 tiles (`nearestEnemy`) and puts out the nearest bomb within 3. | Live |
| Lightning → Fire | **Firestorm** | Every strike ignites a plus-shaped cross (the tile and 2 tiles each way, `computeBlastTiles`) of 5 s fire patches; enemies in it get `burn` 3 s. | Live |
| Lightning → Ice | **Cryostorm** | Marks telegraph twice as long (2.8 s) and strike as frost: no harm to the worm, no flip; the 3x3 frosts (bombs stop) and enemies within 2 tiles freeze 4 s. | Live |
| Lightning → Nature | **Grounded** | A strike on a bare tile grows a charged spring pad instead of flipping it, and a strike on the body grows one there instead of cutting (the head is still telegraphed and still dies). | Live |

Recipes are keyed by order in `ORDERED_FUSIONS`, and all twenty are live with their
own rule: no recipe borrows its reverse's, so picking the same two elements up in the
other order always changes what happens. `fallback` is still supported by
`fusionEffect` for a future recipe that has to borrow a rule, but nothing uses it.
Every fusion also posts `ctx.onFusion('<base>><catalyst>')`, which the HUD turns into
the FUSION banner (`FusionBanner` in `WormCrawlerHUD.jsx`) naming the recipe and its rule
over the claim camera beat.

Shared hooks the newer rules added: patch kinds `'frost'` and the flags `cold`, `melt`,
`ember`, `iced` (`addElementalPatch`, drawn by `patchVariant` in `ElementalPatches.jsx`);
`frostTiles(sim)` → `player.frost()` freezes enemies arriving on frost (`portalCombat.js`);
`afflictEnemies` / `nearestEnemy` for fusion statuses; `isFrostTile` stops a bomb's fuse
and `isMeltTile` puts it out in the bomb loop; `fusionSpeedBonus` (Meltdown, Static) adds
to ground speed; the storm takes a quota (`beginStorm`), a `telegraph` and a `bodyShare`;
the mode lays patches through `worm.addPatch`. All numbers live in `FUSION`
(`elementalGameplay.js`).

Level 24 teaches Steam and Quench with `steamFusions` / `quenchFusions` objectives.
The Story scheduler offers a needed catalyst during the base wash, after the focus
shot, only on a short reachable surface route. Partners expire with that wash; missed
recipes retry. Other Story lessons retain sequential offerings. Free Play still uses
two-orb offerings and its existing cooldown; repeated mid-wash reversals are taught
by the Story lesson, not an unlimited Free Play supply. A base reclaim posts a new
ordered recipe event; a catalyst refresh posts none. Pause contains the recipe guide,
and the live power chip previews the available next recipe.

## Ignition: the moment of fusing

The claim that forms a pair also sets off that recipe's **ignition** around the head
(`IGNITIONS` in `fusionIgnition.js`, called from `startElemental` with the board
size). Each ignition has a `boost` (instant: full momentum, Meltdown's dash, Static's
burst, Slipstream's `surgeT` surge) and a `ground` (the recipe's own patches: a
two-deep ring of steam/obsidian/blue fire/frost, a 3x3 garden of pads, ember pads on
the corners, ramps two out, a charged pad underfoot, a three-long fire cross). It
posts a fusion burst of kind `'ignite'` with `tiles` and `hit` (`freeze`, `kill`,
`burn` or `stun`), which `runFusionBurst` resolves against enemies once, with blast
flames for the fire recipes. It lands during the claim camera's pull-out, alongside
`FusionAura`'s two shockwaves (`fusionNova.js`; dropped under reduced motion) and the
FUSION banner, which shows the ignition's `text` between the name and the rule. A
refresh of the newest element is not a fusion and never re-ignites. A new recipe
needs an `IGNITIONS` entry too (a test checks all twenty).

## What a fusion looks like

A pair is drawn as its own reaction, never as its two elements' skins stacked:
`FUSION_LOOKS` in `fusionLooks.js` gives every recipe a coat pattern (`mist`, `crust`,
`flame`, `plasma`, `bloom`, `storm`, `flow`), a palette, a fill-light `glow` and a
particle kind (`steam`, `smoke`, `sparks`, `petals`, `snow`, `plasma`, `embers`,
`spray`, `frost`, `spores`). `ElementalAtmosphere` mounts `ElementalCubeSkin` with
`recipe` (the reaction coat, `ReactionSurfaceSkin` in `ElementalSurface.jsx`, shader
mode 3 with `REACTION_PATTERN`) and `FusionParticles` in place of the element layers.
The particles erupt off the cube's faces and the worm's body (`wormSegments`) the
moment the pair forms. A new recipe needs a `FUSION_LOOKS` entry (a test checks all
twenty, and that every look is distinct and differs from its reverse order); a new
pattern needs a branch in the shell's fragment stage and is warmed automatically.

## Implementing a planned fusion

1. **Keep identity separate from the live effect.** `getFusion(base, catalyst)` and
   `fusionKey(base, catalyst)` are chronological and return ordered definitions/keys.
   `activeFusion(sim)` and `fusionOf(element, partner)` return the shipped **effect**
   ID via `fusionEffect`, including an explicit fallback. Implementing a planned rule
   means adding its description, setting `rule`, and clearing its fallback. Do not
   change the recipe ID or accidentally activate both the new rule and its fallback.
2. **Put the rule where the base effect already lives** (table above), behind
   `activeFusion(sim) === '<id>'`. Do not branch on `elementalType` alone.
3. **Reuse the hooks that exist; don't add a parallel system:**
   - trail and pad tiles: `sim.elementalPatches` via `addElementalPatch`. The type is
     `'fire'` or `'grass'`; add fields (like `charged`) rather than new types where
     you can, since `ElementalPatches.jsx` draws by type.
   - enemy effects from the sim side: `steamTiles`-style tile sets through the
     `lit()` wall (stun and burn on contact), or a one-shot fusion burst
     (`postFusionBurst(sim, { kind, tile })`, queued in `sim.fusionBursts`) that
     `runFusionBurst` in `HealerWormMode.jsx` resolves once per `seq`. Never write
     a single burst slot: two beats in one tick would overwrite each other.
   - enemy statuses: `stun`, `freeze`, `root`, `burn` in `portalCombat.js`, and
     `strikeEnemies` for kills.
   - storm: `pickStrikeTile({ tiles, body, avoid, pads })` and the strike
     resolution loop in `runStorm`. Change marks through `avoid`, `pads` and
     `STORM`, never by skipping the telegraph.
   - speed and steering: `waterSpeedBonus`, `turnShedsMomentum`, `iceHoldsTurn`,
     `startJump`'s spring branch (`consumeSpring` returns the pad).
   - bombs: the disarm condition in the bomb loop in `HealerWormMode.jsx`.
4. **The sim decides; render only shows.** Gameplay state goes in `sim` (pure,
   testable). Visuals read it. Randomness comes from `sim.rand`, never
   `Math.random`.
5. **Name and text:** update the entry's `label`/`description`. The HUD reads them
   (`WormCrawlerHUD`), and `elementalFeedback(lead, buffs, fusionId)` gives the
   one-line live readout. Add a line there for the new id.
6. **Document:** set its status to Live in this table, and keep the "Two elements
   fuse" note in `CLAUDE.md` in step.

## Fairness rules every fusion must keep

- **Readable before it hurts.** Anything that can kill or cut the worm is telegraphed
  like the storm's marks. Nothing new strikes without warning.
- **Never take control of the worm.** Speed, slides and leaps change; the player's
  input is never ignored or rerouted.
- **Held like the rest of the sim:** pause, tunnels, slice turns, the claim and cut
  freeze beats, countdown. Use the crawling-only clock (`sim.phase === 'crawling'`).
- **Bounded:** patch counts stay under `ELEMENTAL_PATCH_LIMIT`, and no per-frame
  React state.
- **Reduced motion:** gameplay is unchanged; drop the motion-only flourishes.
- **The demo is untouched:** ambient offerings don't spawn in demos or Story. Story uses its own controlled quest scheduler, with partners only for explicit fusion objectives.

## Tests to add per fusion

In `src/__tests__/elementalFusion.test.js`, pattern after the existing
Steam / Slipstream / Wildfire / Thunderpad blocks:

- The ordered claim produces the right id, and the **reverse order produces a
  different one** (or its documented fallback).
- The rule fires when its fusion is active and **not** for either element alone or
  for the reverse order.
- Any sim event (a fusion burst, a patch flag) is posted once and read once, and two
  posted in the same tick are both read.
- A storm change goes through `pickStrikeTile` with an injected `rng`.
- Reclaiming the base flips the order and the rule with it.
