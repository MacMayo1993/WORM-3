import { COMBAT, combatKey, makeCombat, makeEnemy, stepCombat, stepEnemyDissolves } from './portalCombat.js';

export const AMBIENT = Object.freeze({ grace: 12, cooldown: 24, retry: 3, warning: 1.5, lifetime: 20 });
export function makeAmbientCombat(size) {
  return Object.assign(makeCombat(size,null), { ambient: true, started: true,
    portalOpen: false, encounter: false, sourceId: null, age: 0,
    quiet: AMBIENT.grace, warning: 0, remaining: 0, encounters: 0, healed: 0, notice: null, noticeT: 0 });
}
function retreat(c, keepBurst = false) {
  c.encounter = false; c.sourceId = null; c.portalOpen = false; c.portal = null;
  c.quiet = c.enemies.length === 0 && c.warning > 0 ? AMBIENT.retry : AMBIENT.cooldown;
  c.warning = 0; c.remaining = 0;
  c.enemies = []; c.shots = []; c.drops = []; c.arcs = []; c.muzzle = null;
  // A kill keeps its burst and its crumble; any other retreat (a rotation, a heal,
  // a lock) clears them, since their tiles may no longer be where they were drawn.
  if (!keepBurst) { c.bursts = []; c.dying = []; }
  c.fireHeld = false; c.fireRequested = false; c.lockedId = null; c.aim = null;
}
export function cancelAmbientEncounter(c) {
  if (c?.ambient && c.encounter) retreat(c);
}
function safeMouth(tile, player) {
  if (player.aimBlocked || tile.dirKey !== player.head.dirKey) return false;
  const distance = Math.hypot(tile.x-player.head.x,tile.y-player.head.y,tile.z-player.head.z);
  return distance >= 2 && distance <= 6;
}
const locked = (hit,player) => player.lockedTile && [hit.tunnel.entry,hit.tunnel.exit].some(t => combatKey(t) === combatKey(player.lockedTile));

// A separate director, not waves: one source, one enemy, no backlog of spawns.
// Every encounter reserves a quiet window from the normal bomb/rotation scheduler.
export function stepAmbientCombat(c, delta, player, tunnels, onHit) {
  if (!c) return;
  const dt = Math.max(0,Math.min(.05,delta));
  if (player.healed > c.healed && c.health < COMBAT.health) {
    c.health = Math.min(COMBAT.health,c.health+player.healed-c.healed);
    c.notice = `Shield repaired · ${c.health}/3`; c.noticeT = 4;
  }
  c.healed = player.healed ?? c.healed;
  const source = tunnels.find(hit => hit.tunnel.pairId === c.sourceId);
  if (c.encounter && (!source || locked(source,player) || player.rotating || player.phase !== 'active' || player.alive === false)) retreat(c);
  if (player.blocked || player.phase !== 'active' || player.alive === false || c.health <= 0) {
    c.fireHeld = false; c.fireRequested = false; c.lockedId = null; c.aim = null;
    return;
  }
  c.age += dt; c.noticeT = Math.max(0,c.noticeT-dt);
  if (!c.encounter) {
    c.time += dt;
    for (const burst of c.bursts) burst.life -= dt;
    c.bursts = c.bursts.filter(b => b.life > 0);
    stepEnemyDissolves(c, dt);
    c.quiet = Math.max(0,c.quiet-dt);
    if (c.quiet > 0 || player.hazardBusy || player.rotating) return;
    for (const hit of tunnels) {
      if (locked(hit,player)) continue;
      const mouth = [hit.tunnel.entry,hit.tunnel.exit].find(t => safeMouth(t,player));
      if (!mouth) continue;
      c.portal = {...mouth}; c.sourceId = hit.tunnel.pairId; c.encounter = true;
      c.portalOpen = true; c.warning = AMBIENT.warning; c.ammo = COMBAT.magazine;
      c.recharge = 0; c.cooldown = 0; c.invulnerable = 0;
      break;
    }
    return;
  }
  // Healing either mouth closes this encounter; rotations cancel it before any
  // old surface coordinates can attack the player on a newly committed face.
  if (source && ![source.tunnel.entry,source.tunnel.exit].some(t => combatKey(t) === combatKey(c.portal))) {
    retreat(c); return;
  }
  if (c.warning > 0) {
    c.warning = Math.max(0,c.warning-dt);
    if (c.warning === 0) {
      if (!safeMouth(c.portal,player)) { retreat(c); c.quiet = AMBIENT.retry; return; }
      const type = c.age < 90 ? 'crawler' : c.age < 150 || c.encounters%3 !== 2 ? 'scout' : 'brute';
      c.enemies = [makeEnemy(c,type)]; c.encounters++; c.remaining = AMBIENT.lifetime;
    }
  } else {
    c.remaining -= dt;
    if (c.remaining <= 0 || c.enemies.length === 0) { retreat(c); return; }
  }
  c.element = player.elementT > 0 ? player.element || null : null; c.elementT = player.elementT || 0;
  let touched = false;
  stepCombat(c,dt,{...player,portalOpen:true,canFinish:false},health => { touched = true; c.notice = `Shield hit · ${health}/3 left. Heal a tunnel to repair.`; c.noticeT = 4; onHit?.(health); });
  // One contact per encounter; the remaining shields last for the run. Healing
  // restores one. No surprise repeated bites while the worm is turning away.
  if (touched || (c.warning === 0 && c.enemies.length === 0)) retreat(c,true);
}
