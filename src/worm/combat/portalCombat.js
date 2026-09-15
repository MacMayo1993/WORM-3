import { ENEMIES, WAVES, ELEMENTS, ELEMENT_ORDER, ELEMENT_DURATION } from './combatDefs.js';
import { DIR_FORWARD } from '../healerWorm/constants.js';
import { getNextSurfacePosition } from '../wormLogic.js';
import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';
import { getStickerWorldPos } from '../../game/coordinates.js';

export const COMBAT = Object.freeze({ magazine: 3, recharge: 1.4, fireInterval: 0.32,
  health: 3, maxEnemies: 4, warning: 2.5, spawnInterval: 6, enemySpeed: 0.85,
  shotSpeed: 8, range: 7, aimCos: Math.cos(Math.PI / 9), invulnerability: 1.6 });
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
    wave: 0, waveSpawned: 0, wavesCleared: 0, intermission: 0, endReason: null,
    element: null, elementT: 0, score: 0, combo: 0, bestCombo: 0, lastKill: -Infinity,
    killsByType: { crawler: 0, scout: 0, brute: 0 }, damageTaken: 0, fireHeld: false,
    kills: 0, shotsFired: 0, shotsHit: 0, dropsCollected: 0, seq: 0,
    enemies: [], shots: [], bursts: [], drops: [], arcs: [], spawnTimer: COMBAT.warning,
    portalOpen: true, lockedId: null, aim: null, fireRequested: false, held: false };
}
// Aim and projectiles share a face plane. No route-finding or homing can turn a
// forward shot into a hit behind the worm or on a hidden face.
function shotOrigin(c, head, position) {
  const center = surfacePose(head,head,0,c.size,0.2).position;
  return center.map((v,i) => normals[head.dirKey][i] ? v
    : Math.max(-c.size/2,Math.min(c.size/2,position?.[i] ?? v)));
}
export function acquireTarget(c, head, heading, position) {
  const forward = DIR_FORWARD[head.dirKey]?.[heading];
  if (!forward) return null;
  const origin = shotOrigin(c,head,position);
  let best = null, alignment = COMBAT.aimCos, distance = Infinity;
  for (const enemy of c.enemies) {
    if (enemy.emerging > 0 || enemy.tile.dirKey !== head.dirKey ||
      (enemy.next && enemy.next.dirKey !== head.dirKey)) continue;
    const offset = pose(enemy,c,0.2).map((v,i) => normals[head.dirKey][i] ? 0 : v-origin[i]);
    const length = Math.hypot(...offset);
    if (length < 0.001 || length > COMBAT.range) continue;
    const dot = offset.reduce((sum,v,i) => sum+v*forward[i],0)/length;
    if (dot >= COMBAT.aimCos && (dot > alignment+1e-6 || (Math.abs(dot-alignment) <= 1e-6 && length < distance))) {
      best = enemy; alignment = dot; distance = length;
    }
  }
  return best;
}
function aimShot(c, player) {
  const origin = shotOrigin(c,player.head,player.position);
  const target = acquireTarget(c,player.head,player.heading,player.position);
  const forward = DIR_FORWARD[player.head.dirKey]?.[player.heading];
  if (!forward) return null;
  const offset = target ? pose(target,c,0.2).map((v,i) => normals[player.head.dirKey][i] ? 0 : v-origin[i]) : forward;
  const length = Math.hypot(...offset), direction = offset.map(v => v/length);
  let range = COMBAT.range;
  for (let i=0;i<3;i++) if (Math.abs(direction[i]) > 1e-6) {
    range = Math.min(range,(Math.sign(direction[i])*c.size/2-origin[i])/direction[i]);
  }
  return { origin, direction, range: Math.max(0,range), targetId: target?.id ?? null, face: player.head.dirKey };
}
function fire(c) {
  if (!c.aim || c.ammo <= 0 || c.cooldown > 0 || c.shots.length >= 8) return;
  const aim = c.aim;
  c.ammo--; c.cooldown = COMBAT.fireInterval; c.shotsFired++;
  c.shots.push({ id: ++c.seq, position: [...aim.origin], direction: [...aim.direction],
    face: aim.face, remaining: aim.range, life: COMBAT.range/COMBAT.shotSpeed,
    element: c.element, color: ELEMENTS[c.element]?.color || (c.shotsFired % 2 ? '#c38bff' : '#8af7ee') });
}
function burst(c, tile, kind) {
  c.bursts.push({ id: ++c.seq, tile: { ...tile }, life: 0.55, kind });
  if (c.bursts.length > 8) c.bursts.shift();
}
export function makeEnemy(c, type = 'crawler') {
  const def = ENEMIES[type];
  return { id: ++c.seq, type, hp: def.hp, tile: { ...c.portal }, next: null, t: 0,
    emerging: 0.8, stun: 0, freeze: 0, root: 0, burn: 0, dashClock: 0, hitFlash: 0 };
}
function damageEnemy(c, enemy, amount) {
  if (!c.enemies.includes(enemy)) return;
  enemy.hp = (enemy.hp ?? 1) - amount;
  if (amount >= 1) enemy.hitFlash = 0.15;
  if (enemy.hp > 0) return;
  c.enemies.splice(c.enemies.indexOf(enemy), 1);
  const type = enemy.type || 'crawler';
  c.kills++; c.killsByType[type]++;
  c.combo = c.time-c.lastKill <= 5 ? Math.min(5,c.combo+1) : 1;
  c.lastKill = c.time; c.bestCombo = Math.max(c.bestCombo,c.combo);
  c.score += ENEMIES[type].points * c.combo;
  burst(c,enemy.tile,'kill');
  const element = c.kills % 2 === 1 ? ELEMENT_ORDER[Math.floor(c.kills/2) % ELEMENT_ORDER.length] : null;
  c.drops.push({ id: ++c.seq, tile: { ...enemy.tile }, life: 20, element });
  if (c.drops.length > 6) c.drops.shift();
}
function hitEnemy(c, shot, enemy, player) {
  if (!c.enemies.includes(enemy)) return;
  shot.life = 0; c.shotsHit++;
  burst(c,enemy.tile,'impact');
  // Keep the impact tile for chaining even if the first target dies.
  const impact = { ...enemy.tile };
  if (shot.element === 'fire') enemy.burn = 3;
  if (shot.element === 'ice') enemy.freeze = 2.2;
  if (shot.element === 'grass') enemy.root = 3;
  if (shot.element === 'water') {
    let best = enemy.tile, distance = -1;
    for (const next of graph(c.size).get(combatKey(enemy.tile)) || []) {
      const route = surfaceRoute(next,player.head,c.size);
      if (route && route.length > distance) { best = next; distance = route.length; }
    }
    // A short surface step makes the push visible without crossing the cube.
    enemy.next = best; enemy.t = 0; enemy.knockback = true; enemy.stun = 0.35;
  }
  damageEnemy(c,enemy,1);
  if (shot.element === 'lightning') {
    const chained = c.enemies.filter(e => e !== enemy && e.emerging <= 0 && surfaceRoute(impact,e.tile,c.size,2));
    for (const other of chained.slice(0,2)) {
      c.arcs.push({ id: ++c.seq, tiles: [impact, ...surfaceRoute(impact,other.tile,c.size,2)], life: 0.3 });
      if (c.arcs.length > 6) c.arcs.shift();
      burst(c,other.tile,'lightning'); damageEnemy(c,other,1);
    }
  }
}
function finishCombat(c, reason) {
  c.won = true; c.endReason = reason; c.enemies = []; c.shots = [];
  c.fireRequested = false; c.fireHeld = false; c.lockedId = null; c.aim = null;
}
// No wall-clock timers: pause, tunnel travel, claim beats and rotations hold all
// combat clocks together. Requests made while held are discarded, never buffered.
export function stepCombat(c, delta, player, onHit = () => {}) {
  if (!c || !c.started || c.won || c.health <= 0 || player.blocked) { if (c) { c.fireRequested = false; c.fireHeld = false; c.lockedId = null; c.aim = null; } return; }
  const dt = Math.max(0, Math.min(0.05, delta));
  c.held = false; c.time += dt;
  c.portalOpen = player.portalOpen;
  if (!c.portalOpen && player.canFinish) {
    finishCombat(c,'sealed'); return;
  }
  c.elementT = Math.max(0,c.elementT-dt);
  if (c.elementT === 0) c.element = null;
  if (c.time-c.lastKill > 5) c.combo = 0;
  if (c.intermission > 0) {
    c.intermission = Math.max(0,c.intermission-dt);
    if (c.intermission === 0) {
      c.wave++; c.waveSpawned = 0; c.spawnTimer = COMBAT.warning;
      c.health = Math.min(COMBAT.health,c.health+1); c.ammo = COMBAT.magazine; c.recharge = 0;
    }
  }
  c.cooldown = Math.max(0, c.cooldown - dt);
  c.invulnerable = Math.max(0, c.invulnerable - dt);
  if (c.ammo < COMBAT.magazine) {
    c.recharge += dt;
    if (c.recharge >= COMBAT.recharge) { c.ammo++; c.recharge -= COMBAT.recharge; }
  } else c.recharge = 0;
  c.aim = aimShot(c,player);
  c.lockedId = c.aim?.targetId ?? null;
  if (c.fireRequested || c.fireHeld) fire(c);
  c.fireRequested = false;
  const wave = WAVES[c.wave];
  if (c.portalOpen && c.intermission === 0 && c.waveSpawned < wave.enemies.length && c.enemies.length < wave.cap) {
    c.spawnTimer -= dt;
    if (c.spawnTimer <= 0) {
      c.enemies.push(makeEnemy(c,wave.enemies[c.waveSpawned++]));
      c.spawnTimer = wave.interval;
    }
  }
  for (const enemy of [...c.enemies]) {
    if (enemy.burn > 0) {
      const burnTime = Math.min(dt,enemy.burn); enemy.burn -= burnTime;
      damageEnemy(c,enemy,burnTime*0.75);
      if (!c.enemies.includes(enemy)) continue;
    }
    enemy.hitFlash = Math.max(0,(enemy.hitFlash || 0)-dt);
    if (enemy.emerging > 0) { enemy.emerging = Math.max(0, enemy.emerging-dt); continue; }
    if (enemy.knockback) {
      enemy.t += dt*6;
      if (enemy.t >= 1) { enemy.tile = enemy.next; enemy.next = null; enemy.t = 0; enemy.knockback = false; }
      continue;
    }
    enemy.dashClock = ((enemy.dashClock || 0)+dt)%3;
    if (enemy.freeze > 0 || enemy.root > 0 || enemy.stun > 0) {
      enemy.freeze = Math.max(0,(enemy.freeze || 0)-dt);
      enemy.root = Math.max(0,(enemy.root || 0)-dt);
      enemy.stun = Math.max(0,enemy.stun-dt); continue;
    }
    if (!enemy.next) enemy.next = surfaceRoute(enemy.tile, player.head, c.size)?.[0] || null;
    if (enemy.next) {
      const dash = enemy.type === 'scout' ? (enemy.dashClock < 0.45 ? 0 : enemy.dashClock < 0.95 ? 2.4 : 1) : 1;
      enemy.t += dt * (ENEMIES[enemy.type]?.speed ?? COMBAT.enemySpeed) * dash;
      if (enemy.t >= 1) { enemy.tile = enemy.next; enemy.next = null; enemy.t = 0; }
    }
  }
  // Small substeps keep fast shots from tunneling through a crawler.
  for (const shot of c.shots) {
    for (let remaining = dt; remaining > 0 && shot.life > 0;) {
      const step = Math.min(remaining, 0.02); remaining -= step; shot.life -= step;
      const travel = Math.min(step*COMBAT.shotSpeed,shot.remaining);
      for (let i=0;i<3;i++) shot.position[i] += shot.direction[i]*travel;
      shot.remaining -= travel;
      const hit = c.enemies.find(e => e.emerging <= 0 && e.tile.dirKey === shot.face &&
        (!e.next || e.next.dirKey === shot.face) && distanceSq(shot.position,pose(e,c,0.2)) < 0.42 ** 2);
      if (shot.remaining <= 0) shot.life = 0;
      if (hit) hitEnemy(c,shot,hit,player);
    }
  }
  c.shots = c.shots.filter(s => s.life > 0);
  if (!player.protected && c.invulnerable <= 0) {
    const enemy = c.enemies.find(e => e.emerging <= 0 && e.stun <= 0 && !(e.freeze > 0) && !e.knockback && distanceSq(player.position,pose(e,c,0.18)) < 0.48 ** 2);
    if (enemy) {
      c.health = Math.max(0,c.health-1); c.damageTaken++; c.combo = 0; c.lastKill = -Infinity; c.invulnerable = COMBAT.invulnerability; enemy.stun = 1;
      burst(c,player.head,'hit'); onHit(c.health);
    }
  }
  for (const drop of c.drops) {
    drop.life -= dt;
    if (surfaceRoute(player.head,drop.tile,c.size,1) && !player.protected) {
      c.ammo = Math.min(COMBAT.magazine,c.ammo+1); c.dropsCollected++; drop.life = 0;
      if (drop.element) { c.element = drop.element; c.elementT = ELEMENT_DURATION; }
      burst(c,drop.tile,'pickup');
    }
  }
  c.drops = c.drops.filter(d => d.life > 0);
  for (const arc of c.arcs) arc.life -= dt;
  c.arcs = c.arcs.filter(arc => arc.life > 0);
  for (const b of c.bursts) b.life -= dt;
  c.bursts = c.bursts.filter(b => b.life > 0);
  if (c.health > 0 && c.intermission === 0 && c.waveSpawned === wave.enemies.length && c.enemies.length === 0) {
    c.wavesCleared++;
    if (c.wave === WAVES.length-1) finishCombat(c,'waves');
    else c.intermission = 4;
  }
}
