import { makeAmbientCombat, stepAmbientCombat } from '../combat/ambientCombat.js';
import { makeEnemy, stepCombat, COMBAT } from '../combat/portalCombat.js';
import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';

export function makeStoryCombat(size) {
  return Object.assign(makeAmbientCombat(size), { story: true, quiet: 6 });
}
// Dedicated enemy rifts remain available after healing the traversable tunnels.
// Use the same aim, surface projectiles, shields, element effects and retreat
// transaction as Free Play; Story alone owns the finish/reward conditions.
export function stepStoryCombat(c, delta, player, goal, onHit) {
  const dt = Math.max(0, Math.min(delta, 0.05));
  if (!c.encounter) {
    // Reuse ambient upkeep (healing shields, clocks, pause/death gates).
    stepAmbientCombat(c, dt, player, [], onHit);
    if (player.blocked || player.alive === false || player.phase !== 'active' || player.rotating || player.hazardBusy || c.health <= 0 || c.quiet > 0 || c.kills >= goal) return;
    const tile = getAllSurfaceTiles(c.size).find(t => t.dirKey === player.head.dirKey &&
      Math.hypot(t.x-player.head.x,t.y-player.head.y,t.z-player.head.z) >= 3);
    if (!tile) return;
    c.portal = { ...tile }; c.portalOpen = true; c.encounter = true;
    c.warning = 2.5; c.remaining = 22; c.ammo = COMBAT.magazine;
    c.notice = 'Enemy rift · Face the enemy and fire'; c.noticeT = 4;
    return;
  }
  if (player.rotating || player.alive === false || player.phase !== 'active') {
    // Missing source deliberately invokes the existing cleanup transaction.
    stepAmbientCombat(c, 0, player, [], onHit); c.quiet = 6; return;
  }
  if (player.blocked) { c.fireHeld = false; c.fireRequested = false; return; }
  c.noticeT = Math.max(0, c.noticeT - dt);
  if (player.healed > c.healed) c.health = Math.min(COMBAT.health, c.health + player.healed - c.healed);
  c.healed = player.healed;
  if (c.warning > 0) {
    c.warning = Math.max(0, c.warning - dt);
    if (c.warning === 0) {
      if (c.portal.dirKey !== player.head.dirKey || Math.hypot(c.portal.x-player.head.x,c.portal.y-player.head.y,c.portal.z-player.head.z) < 2) {
        stepAmbientCombat(c, 0, { ...player, blocked: true }, [], onHit); c.quiet = 3; return;
      }
      c.enemies = [makeEnemy(c, ['crawler', 'scout', 'brute'][c.kills % 3])];
      c.encounters++;
    }
    return;
  }
  c.element = player.elementT > 0 ? player.element : null; c.elementT = player.elementT;
  let touched = false;
  stepCombat(c, dt, { ...player, portalOpen: true, canFinish: false }, health => { touched = true; onHit?.(health); });
  c.remaining -= dt;
  if (touched || c.enemies.length === 0 || c.remaining <= 0) {
    stepAmbientCombat(c, 0, { ...player, blocked: true }, [], onHit);
    c.quiet = 6;
  }
}
