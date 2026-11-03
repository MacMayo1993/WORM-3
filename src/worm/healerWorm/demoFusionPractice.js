import { activeFusion } from './elementalFusion.js';
import { SURFACE_JUMP_HEIGHT } from './constants.js';

// Each lab names only the reaction it can verify. Enemy/bomb consequences are
// described separately in the catalogue; an empty board never earns kill credit.
export const FUSION_PRACTICE_GOALS = {
  steam: 'Keep straight: Steam must pull in the burning orb behind the side lane.',
  slipstream: 'Turn while grounded and keep full Water momentum through the turn.',
  bloom: 'Keep crawling until the ongoing Bloom trail grows a new spring pad.',
  conductor: 'Watch a marked bolt land and fork through the wet ground.',
  quench: 'Keep crawling to lay a fresh obsidian trail beyond the ignition ring.',
  coldfire: 'Keep crawling to lay fresh blue-fire trail beyond the ignition ring.',
  wildfire: 'Jump from a spring pad and land to ignite the surrounding tiles.',
  plasma: 'Watch a marked bolt leave its target burning with Plasma.',
  geyser: 'Jump from the geyser pad at full momentum, then land the amplified leap.',
  emberseed: 'Keep moving while an unused ember pad withers into a real flame burst.',
  'ski-jump': 'Jump from the ground and land your full spring leap.',
  thunderpad: 'Jump from the charged pad and land the rocket-high spring leap.',
  'frozen-wake': 'Keep crawling to leave a fresh frozen trail beyond the ignition ring.',
  meltdown: 'Turn while sliding to trigger a dash and melt the turn tile.',
  frostbloom: 'Jump from the iced spring pad and land to freeze the surrounding tiles.',
  static: 'Turn while sliding to release a real drift-triggered chain discharge.',
  current: 'Keep Water momentum high until a marked bolt is safely absorbed.',
  firestorm: 'Watch a marked bolt ignite its cross of fire.',
  cryostorm: 'Watch the longer storm mark resolve into frost.',
  grounded: 'Watch a marked strike grow a charged spring pad.',
  'water-air': 'Jump, turn while airborne without losing momentum, then land.',
  'air-water': 'Jump and land to release the Rainwind burst and refill momentum.',
  'fire-air': 'Jump from the hot tile for an amplified Updraft, then land.',
  'air-fire': 'Jump to paint fresh flame beneath your flight, then land.',
  'grass-air': 'Jump from a spring to release the Dust Devil gust, then land.',
  'air-grass': 'Jump and land to grow a fresh charged Highland pad.',
  'ice-air': 'Jump to leave fresh frost beneath your flight, then land.',
  'air-ice': 'Jump from the ground to freeze a cross, then land.',
  'lightning-air': 'Watch a storm mark become a safe gust and speed burst.',
  'air-lightning': 'Jump and land to discharge the Stormwind cross.',
};
const STORM_RECIPES = new Set(['conductor', 'plasma', 'current', 'firestorm', 'cryostorm', 'grounded', 'lightning-air']);
const tileKey = p => `${p.x},${p.y},${p.z},${p.dirKey}`;
const patches = sim => [...sim.elementalPatches.values(), ...sim.bouncePads.values()];

export function readFusionPractice(sim, practice, state) {
  const recipe = practice.fusion;
  if (!recipe) return { done: false, progress: 'Choose a valid ordered fusion recipe' };
  const id = recipe.id;
  if (activeFusion(sim) !== id) return { done: false, progress: sim.elementalT > 0
    ? `Now collect ${recipe.catalyst} to fuse the pair` : `Collect ${recipe.base} first, then ${recipe.catalyst}` };
  if (!practice.reaction) practice.reaction = {
    patches: new Set(patches(sim)), patchKeys: new Set(patches(sim).map(tileKey)), burstSeq: sim.fusionSeq, abilitySeq: sim.elementalAbilities.seq,
    wasJumping: sim.isJumping, heading: sim.moveDir, face: sim.pos.dirKey,
  };
  const r = practice.reaction;
  const fresh = patches(sim).filter(p => !r.patches.has(p));
  const extendedTrail = fresh.filter(p => !r.patchKeys.has(tileKey(p)));
  const bursts = sim.fusionBursts.filter(b => b.seq > r.burstSeq);
  const airBurst = bursts.some(b => b.kind === 'air-reaction' && b.recipe === id);
  const tookOff = sim.isJumping && !r.wasJumping;
  if (tookOff) {
    r.launched = true;
    r.spring ||= sim.springLaunch;
    r.amplified ||= id === 'geyser' ? sim.springLaunch && sim.jumpSpan >= 3.2
      : id === 'thunderpad' ? sim.springLaunch && sim.jumpHeight >= 3
        : id === 'fire-air' ? sim.jumpHeight > SURFACE_JUMP_HEIGHT * 1.4 + 1 : false;
  }
  if (r.launched && r.wasJumping && !sim.isJumping && sim.alive) r.landed = true;
  const turned = sim.moveDir !== r.heading && sim.pos.dirKey === r.face;
  if (turned && sim.waterMomentum >= .95) {
    if (id === 'slipstream' && !sim.isJumping) r.momentumTurn = true;
    if (id === 'water-air' && sim.isJumping) r.momentumTurn = true;
  }
  if (sim.elementalAbilities.driftT > 0) {
    r.drift = true;
    r.driftAbilitySeq ??= sim.elementalAbilities.seq;
  }
  r.wasJumping = sim.isJumping; r.heading = sim.moveDir; r.face = sim.pos.dirKey;
  let reacted = false;
  if (STORM_RECIPES.has(id)) reacted = state.demoWormHazardCleared === `fusion:${id}`;
  else switch (id) {
    case 'steam': reacted = !!practice.fusionOrb?.ignited && !sim.powerups.includes(practice.fusionOrb) && state.wormSessionOrbs > 0; break;
    case 'slipstream': reacted = r.momentumTurn; break;
    case 'bloom': reacted = sim.fusionTiles >= 4 && fresh.some(p => p.type === 'grass'); break;
    case 'quench': reacted = extendedTrail.some(p => p.type === 'fire' && p.obsidian); break;
    case 'coldfire': reacted = extendedTrail.some(p => p.type === 'fire' && p.cold); break;
    case 'frozen-wake': reacted = extendedTrail.some(p => p.type === 'frost'); break;
    case 'emberseed': reacted = bursts.some(b => b.kind === 'emberseed'); break;
    case 'wildfire': reacted = bursts.some(b => b.kind === 'wildfire') && r.spring && r.landed; break;
    case 'frostbloom': reacted = bursts.some(b => b.kind === 'frostbloom') && r.spring && r.landed; break;
    case 'geyser': case 'thunderpad': case 'fire-air': reacted = r.amplified && r.landed; break;
    case 'ski-jump': reacted = r.spring && r.landed; break;
    case 'meltdown': reacted = r.drift && sim.meltdownT > 0 && fresh.some(p => p.melt); break;
    case 'static':
      reacted = r.drift && sim.elementalAbilities.events.some(e => e.kind === 'lightning' && e.id >= r.driftAbilitySeq);
      break;
    case 'water-air': reacted = r.momentumTurn && r.landed; break;
    case 'air-water': reacted = airBurst && r.landed && sim.waterMomentum >= .95; break;
    case 'grass-air': case 'air-ice': case 'air-lightning':
      r.airBurst ||= airBurst;
      reacted = r.airBurst && r.landed;
      break;
    case 'air-grass': reacted = r.landed && fresh.some(p => p.type === 'grass' && p.charged); break;
    case 'air-fire': case 'ice-air':
      r.flightTrail ||= r.launched && sim.isJumping && fresh.some(p => p.type === (id === 'air-fire' ? 'fire' : 'frost'));
      reacted = r.flightTrail && r.landed;
      break;
  }
  r.reacted ||= !!reacted;
  return { done: r.reacted && sim.elementalFocusT <= 0 && sim.alive,
    progress: r.reacted ? `${recipe.label}: reaction demonstrated` : `${recipe.label}: ${FUSION_PRACTICE_GOALS[id]}` };
}
