import { getNextSurfacePosition } from '../wormLogic.js';
import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';
import { getStickerWorldPos } from '../../game/coordinates.js';

export const COMBAT = Object.freeze({ magazine: 3, recharge: 1.4, fireInterval: 0.32,
  health: 3, maxEnemies: 2, warning: 2.5, spawnInterval: 6, enemySpeed: 0.85,
  shotSpeed: 8, range: 7, invulnerability: 1.6 });
export const combatBridge = { current: null };
export const combatKey = p => `${p.x},${p.y},${p.z},${p.dirKey}`;
const normals = { PX: [1,0,0], NX: [-1,0,0], PY: [0,1,0], NY: [0,-1,0], PZ: [0,0,1], NZ: [0,0,-1] };
const graphs = new Map();
const routes = new Map();
function graph(size) {
  if (!graphs.has(size)) graphs.set(size, new Map(getAllSurfaceTiles(size).map(tile => [combatKey(tile),
    ['up', 'right', 'down', 'left'].map(d => getNextSurfacePosition(tile, d, size)).filter(Boolean)])));
  return graphs.get(size);
}
// A route follows the same surface adjacency as the player. Never use a straight
// world-space ray: it would shoot through the cube to the opposite face.
export function surfaceRoute(from, to, size, maxSteps = Infinity) {
  const start = combatKey(from), end = combatKey(to);
  if (start === end) return [];
  const cacheKey = `${size}|${start}|${end}|${maxSteps}`;
  if (routes.has(cacheKey)) return routes.get(cacheKey);
  const queue = [{ tile: from, path: [] }], seen = new Set([start]);
  const neighbors = graph(size);
  for (let i = 0; i < queue.length; i++) {
    const { tile, path } = queue[i];
    if (path.length >= maxSteps) continue;
    for (const next of neighbors.get(combatKey(tile)) || []) {
      const key = combatKey(next);
      if (seen.has(key)) continue;
      const route = [...path, next];
      if (key === end) {
        if (routes.size >= 256) routes.clear();
        routes.set(cacheKey, route); return route;
      }
      seen.add(key); queue.push({ tile: next, path: route });
    }
  }
  return null;
}
export function surfacePose(from, to, t, size, lift = 0.18) {
  const aNormal = normals[from.dirKey], bNormal = normals[to.dirKey];
  const a = getStickerWorldPos(from.x, from.y, from.z, from.dirKey, size).map((v,i) => v + aNormal[i] * lift);
  const b = getStickerWorldPos(to.x, to.y, to.z, to.dirKey, size).map((v,i) => v + bNormal[i] * lift);
  let start = a, end = b, u = t;
  if (from.dirKey !== to.dirKey) {
    // Two legs through the outside corner, not a chord through the cubelet.
    const corner = a.map((v,i) => aNormal[i] ? v : bNormal[i] ? b[i] : (v + b[i]) / 2);
    start = t < 0.5 ? a : corner; end = t < 0.5 ? corner : b; u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  }
  const normal = aNormal.map((v,i) => v * (1-t) + bNormal[i] * t);
  const length = Math.hypot(...normal);
  return { position: start.map((v,i) => v + (end[i]-v) * u), normal: normal.map(v => v / length) };
}
const distanceSq = (a,b) => a.reduce((sum,v,i) => sum + (v-b[i]) ** 2, 0);
const pose = (actor,c,lift) => surfacePose(actor.tile, actor.next || actor.tile, actor.t || 0, c.size, lift).position;
export function makeCombat(size, portal) {
  return { size, portal, started: false, won: false, time: 0, ammo: COMBAT.magazine,
    health: COMBAT.health, recharge: 0, cooldown: 0, invulnerable: 0,
    kills: 0, shotsFired: 0, shotsHit: 0, dropsCollected: 0, seq: 0,
    enemies: [], shots: [], bursts: [], drops: [], spawnTimer: COMBAT.warning,
    portalOpen: true, lockedId: null, fireRequested: false, held: false };
}
export function acquireTarget(c, head) {
  let best = null, distance = Infinity;
  for (const enemy of c.enemies) {
    if (enemy.emerging > 0) continue;
    const route = surfaceRoute(head, enemy.tile, c.size, COMBAT.range);
    if (route && route.length < distance) { best = enemy; distance = route.length; }
  }
  return best;
}
function fire(c, player) {
  if (c.ammo <= 0 || c.cooldown > 0 || c.shots.length >= 8) return;
  const target = acquireTarget(c, player.head);
  const next = target ? surfaceRoute(player.head, target.tile, c.size)?.[0]
    : getNextSurfacePosition(player.head, player.heading, c.size);
  c.ammo--; c.cooldown = COMBAT.fireInterval; c.shotsFired++;
  c.shots.push({ id: ++c.seq, tile: { ...player.head }, next: next || null, t: 0,
    heading: next?.moveDir || player.heading, targetId: target?.id, life: 2,
    color: c.shotsFired % 2 ? '#c38bff' : '#8af7ee' });
}
function burst(c, tile, kind) {
  c.bursts.push({ id: ++c.seq, tile: { ...tile }, life: 0.55, kind });
  if (c.bursts.length > 8) c.bursts.shift();
}
function hitEnemy(c, shot, enemy) {
  if (!c.enemies.includes(enemy)) return;
  c.enemies.splice(c.enemies.indexOf(enemy), 1); shot.life = 0;
  c.kills++; c.shotsHit++; burst(c, enemy.tile, 'kill');
  c.drops.push({ id: ++c.seq, tile: { ...enemy.tile }, life: 14 });
  if (c.drops.length > 6) c.drops.shift();
}
// No wall-clock timers: pause, tunnel travel, claim beats and rotations hold all
// combat clocks together. Requests made while held are discarded, never buffered.
export function stepCombat(c, delta, player, onHit = () => {}) {
  if (!c || !c.started || c.won || player.blocked) { if (c) c.fireRequested = false; return; }
  const dt = Math.max(0, Math.min(0.05, delta));
  c.held = false; c.time += dt;
  c.portalOpen = player.portalOpen;
  if (!c.portalOpen && player.canFinish) {
    c.won = true; c.enemies = []; c.shots = []; c.fireRequested = false; return;
  }
  c.cooldown = Math.max(0, c.cooldown - dt);
  c.invulnerable = Math.max(0, c.invulnerable - dt);
  if (c.ammo < COMBAT.magazine) {
    c.recharge += dt;
    if (c.recharge >= COMBAT.recharge) { c.ammo++; c.recharge -= COMBAT.recharge; }
  } else c.recharge = 0;
  c.lockedId = acquireTarget(c, player.head)?.id ?? null;
  if (c.fireRequested) fire(c, player);
  c.fireRequested = false;
  if (c.portalOpen && c.enemies.length < COMBAT.maxEnemies) {
    c.spawnTimer -= dt;
    if (c.spawnTimer <= 0) {
      c.enemies.push({ id: ++c.seq, tile: { ...c.portal }, next: null, t: 0, emerging: 0.8, stun: 0 });
      c.spawnTimer = COMBAT.spawnInterval;
    }
  }
  for (const enemy of c.enemies) {
    if (enemy.emerging > 0) { enemy.emerging = Math.max(0, enemy.emerging-dt); continue; }
    if (enemy.stun > 0) { enemy.stun -= dt; continue; }
    if (!enemy.next) enemy.next = surfaceRoute(enemy.tile, player.head, c.size)?.[0] || null;
    if (enemy.next) {
      enemy.t += dt * COMBAT.enemySpeed;
      if (enemy.t >= 1) { enemy.tile = enemy.next; enemy.next = null; enemy.t = 0; }
    }
  }
  // Small substeps keep fast shots from tunneling through a crawler.
  for (const shot of c.shots) {
    for (let remaining = dt; remaining > 0 && shot.life > 0;) {
      const step = Math.min(remaining, 0.02); remaining -= step; shot.life -= step;
      if (!shot.next) {
        const target = c.enemies.find(e => e.id === shot.targetId);
        shot.next = target ? surfaceRoute(shot.tile, target.tile, c.size)?.[0]
          : getNextSurfacePosition(shot.tile, shot.heading, c.size);
        if (shot.next) shot.heading = shot.next.moveDir;
      }
      if (shot.next) {
        shot.t += step * COMBAT.shotSpeed;
        if (shot.t >= 1) { shot.tile = shot.next; shot.next = null; shot.t = 0; }
      }
      const position = pose(shot,c,0.2);
      const hit = c.enemies.find(e => e.emerging <= 0 && distanceSq(position,pose(e,c,0.2)) < 0.42 ** 2);
      if (hit) hitEnemy(c,shot,hit);
    }
  }
  c.shots = c.shots.filter(s => s.life > 0);
  if (!player.protected && c.invulnerable <= 0) {
    const enemy = c.enemies.find(e => e.emerging <= 0 && e.stun <= 0 && distanceSq(player.position,pose(e,c,0.18)) < 0.48 ** 2);
    if (enemy) {
      c.health--; c.invulnerable = COMBAT.invulnerability; enemy.stun = 1;
      burst(c,player.head,'hit'); onHit(c.health);
    }
  }
  for (const drop of c.drops) {
    drop.life -= dt;
    if (combatKey(drop.tile) === combatKey(player.head) && !player.protected) {
      c.ammo = Math.min(COMBAT.magazine,c.ammo+1); c.dropsCollected++; drop.life = 0;
      burst(c,drop.tile,'pickup');
    }
  }
  c.drops = c.drops.filter(d => d.life > 0);
  for (const b of c.bursts) b.life -= dt;
  c.bursts = c.bursts.filter(b => b.life > 0);
}
