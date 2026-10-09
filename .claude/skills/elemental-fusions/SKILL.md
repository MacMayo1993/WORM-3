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

Status:
- **Live**: shipped.
- **Live (shared)**: the pair's other order shares this rule today, until its own rule is built.
- **Planned**: designed here, not built.

Every fusion keeps both base effects on; the rule below is added on top.

### Water first

| Order | Name | Rule | Status |
|---|---|---|---|
| Water → Fire | **Steam** | The fire trail steams: enemies stepping onto it are scalded and stunned (joins the light wall via `steamTiles`), and a bomb sitting on it is put out like a disarm. | Live |
| Water → Ice | **Slipstream** | Turns no longer shed momentum; full momentum is worth +40% instead of +25%. | Live |
| Water → Nature | **Bloom** | Rain makes things grow: every 4th tile crawled grows a spring pad by itself, no landing needed, and pads last 12 s instead of 8 s. | Planned |
| Water → Lightning | **Conductor** | The wet worm is grounded: marks never aim at the body (`bodyShare` → 0), and a strike within 2 tiles of the last 6 trail tiles chains to every enemy within 2 tiles of where it landed. | Planned |

### Fire first

| Order | Name | Rule | Status |
|---|---|---|---|
| Fire → Water | **Quench** | The fire trail sets into obsidian: tiles last 8 s instead of 3 s and stay a firebreak, but no longer speed up bomb fuses; crawling on obsidian keeps full water momentum through turns. | Planned (Steam until built) |
| Fire → Ice | **Coldfire** | The trail burns blue: enemies that touch it freeze (`enemy.freeze` 2.2 s, as the ice shot does) instead of burning, and the trail lasts 5 s. | Planned |
| Fire → Nature | **Wildfire** | A spring landing sets its 3x3 alight (fire patches) and kills the enemies in it (`sim.fusionBurst` → `strikeEnemies`). | Live |
| Fire → Lightning | **Plasma** | A strike on a bare tile also leaves an 8 s fire patch, and marks never land on your fire trail (it repels them; add the trail to the storm's `avoid` set). | Planned |

### Nature first

| Order | Name | Rule | Status |
|---|---|---|---|
| Nature → Water | **Geyser** | Spring pads erupt: a launch keeps water momentum through the leap, and at full momentum the leap is 1 tile longer. | Planned |
| Nature → Fire | **Emberseed** | Pads you never use burst when they wither: a 3x3 fire burst that kills enemies, like Wildfire's (reuse `fusionBurst`, kind `'emberseed'`). | Planned (Wildfire until built) |
| Nature → Ice | **Ski Jump** | A spring launch lets you turn once in mid-air, and landing never starts an ice slide (you steer at once). | Planned |
| Nature → Lightning | **Thunderpad** | The storm aims `STORM.padShare` (half) of its marks at free spring pads; a struck pad is charged (violet) instead of flipped, and a leap from it uses `CHARGED_SPRING_SPAN`/`HEIGHT`. | Live |

### Ice first

| Order | Name | Rule | Status |
|---|---|---|---|
| Ice → Water | **Frozen Wake** | The water you shed freezes behind you: the last 5 trail tiles freeze enemies that step on them (`enemy.freeze`). | Planned (Slipstream until built) |
| Ice → Fire | **Meltdown** | Each finished slide ends in a dash: +30% speed for one tile, a fire patch on the tile slid across, and a slide over a bomb's tile puts it out. | Planned |
| Ice → Nature | **Frostbloom** | A spring landing freezes enemies in its 3x3 (`enemy.freeze`) instead of hurting them; the pad it grows is iced and lasts 12 s. | Planned |
| Ice → Lightning | **Static** | A sliding head cannot be struck; each mark that lands within 2 tiles while you slide discharges into you as a 1 s speed burst instead of hitting the board. | Planned |

### Lightning first

| Order | Name | Rule | Status |
|---|---|---|---|
| Lightning → Water | **Current** | At full water momentum the worm is a lightning rod: a mark aimed at the body is redirected to the nearest enemy within 3 tiles (or fizzles if none). | Planned |
| Lightning → Fire | **Firestorm** | Every strike ignites a plus-shaped cross (the tile and 2 tiles each way) of fire patches; enemies in it get `enemy.burn` 3 s. | Planned |
| Lightning → Ice | **Cryostorm** | Marks charge twice as long (2.8 s telegraph) and strike as a freeze: enemies in a 5x5 freeze, and the head and body are cut, not killed (a struck head loses its tail instead). | Planned |
| Lightning → Nature | **Grounded** | A strike grows a spring pad on its tile instead of flipping it, and a mark on the body grows a pad there instead of cutting the tail. | Planned (Thunderpad until built) |

The four that share a pair with a live rule fall back to it today, because the code is
keyed by the unordered pair: Fire → Water runs Steam, Nature → Fire runs Wildfire,
Lightning → Nature runs Thunderpad, Ice → Water runs Slipstream. The other twelve
run both base effects and nothing else.

## Implementing a planned fusion

1. **Key by order.** Today `FUSION_DEFS` is keyed by the sorted pair (`fusionKey`).
   Move to `ORDERED_FUSIONS` keyed `base>catalyst` with all 20 entries. Make
   `activeFusion(sim)` read `` `${sim.elementalPair}>${sim.elementalType}` `` and
   `fusionOf(element, partner)` take `(base = partner, catalyst = element)`. Keep a
   `fallback` field on each planned entry naming the live id it borrows, so nothing
   that works today stops working while the reverse is being built.
2. **Put the rule where the base effect already lives** (table above), behind
   `activeFusion(sim) === '<id>'`. Do not branch on `elementalType` alone.
3. **Reuse the hooks that exist; don't add a parallel system:**
   - trail and pad tiles: `sim.elementalPatches` via `addElementalPatch`. The type is
     `'fire'` or `'grass'`; add fields (like `charged`) rather than new types where
     you can, since `ElementalPatches.jsx` draws by type.
   - enemy effects from the sim side: `steamTiles`-style tile sets through the
     `lit()` wall (stun and burn on contact), or a one-shot `sim.fusionBurst`
     (`{ seq, kind, tile }`) that `runFusionBurst` in `HealerWormMode.jsx`
     resolves once per `seq`.
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
- **The demo is untouched:** offerings don't spawn in demo or story lessons.

## Tests to add per fusion

In `src/__tests__/elementalFusion.test.js`, pattern after the existing
Steam / Slipstream / Wildfire / Thunderpad blocks:

- The ordered claim produces the right id, and the **reverse order produces a
  different one** (or its documented fallback).
- The rule fires when its fusion is active and **not** for either element alone or
  for the reverse order.
- Any sim event (`fusionBurst`, a patch flag) is posted once and read once.
- A storm change goes through `pickStrikeTile` with an injected `rng`.
- Reclaiming the base flips the order and the rule with it.
