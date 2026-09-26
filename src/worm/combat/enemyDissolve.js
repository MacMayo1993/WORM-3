// src/worm/combat/enemyDissolve.js
//
// A defeated enemy leaves the way the opening's cube does (introDissolve.js,
// introMotion.introFleck): it crumbles like sand behind a thin glowing edge, top
// first, and sheds a few flecks that drift off and up as the front passes them.
//
// Pure timing and fleck motion only — no three.js, no store — so the combat sim
// can hold the records and the tests can read every value. The sim keeps each
// kill on the combat clock (portalCombat.js `dying`), so pause, tunnel rides and
// every other combat hold freeze a dissolve mid-crumble, exactly like a burst.
//
// Coordinates are the enemy rig's own frame: x across, y along its heading (head
// at +y), and z up off the tile (the surface normal).
//
// The intro's cube crumbles top first because the camera sees it from the side.
// WORM's chase camera looks down on the tile, so a front running up the surface
// normal would come straight at the lens and read as static. The same field runs
// head to tail instead: the sweep crosses the body in every view the game uses.

/** Seconds for the crumble front to cross the whole body. */
export const ENEMY_DISSOLVE_SECONDS = 1.1;
/** Seconds a fleck stays in the air after the front sheds it. */
export const ENEMY_FLECK_LIFE = 0.7;
/** How long the sim keeps a record: the crumble plus the last fleck's flight. */
export const ENEMY_DISSOLVE_HOLD = ENEMY_DISSOLVE_SECONDS + ENEMY_FLECK_LIFE;
/** Flecks per defeated enemy (the intro sheds 54 from a whole cube). */
export const ENEMY_FLECKS = 9;
/** Dissolving records the sim keeps at once; the oldest goes first. */
export const MAX_DISSOLVING = 4;

// The intro's field is sized for its 3×3 cube: its front starts at y = 1.7 and
// ends at -1.7, with grain frequencies to match. An enemy is about 0.95 long from
// horn tips to tail, so its frame is scaled onto that same field — same grain
// relative to the body, same sweep — rather than retuning the shader.
export const ENEMY_BODY_FRONT = 0.5;
export const ENEMY_BODY_BACK = -0.45;
export const ENEMY_FIELD_SCALE = 3.4 / (ENEMY_BODY_FRONT - ENEMY_BODY_BACK);
export const ENEMY_FIELD_MID = (ENEMY_BODY_FRONT + ENEMY_BODY_BACK) / 2;

const clamp01 = v => Math.min(1, Math.max(0, v));
const fract = v => v - Math.floor(v);

/** 0→1 crumble front for a record `t` seconds after the kill. Linear, like the intro. */
export const dissolveProgress = t => clamp01(t / ENEMY_DISSOLVE_SECONDS);

/**
 * Fleck `index` shed by an enemy `t` seconds after it was defeated. Born on the
 * body where the (head-to-tail) front crosses it, it drifts outward and up off the
 * tile, spinning, and shrinks away. `seed` keeps two kills from shedding the same
 * pattern. Every third fleck is dark shell; the rest take the enemy's glow colour.
 * `null` while the fleck is not in the air, and always for reduced motion.
 */
export function enemyFleck(index, t, seed = 0, reducedMotion = false) {
  if (reducedMotion) return null;
  const k = index + seed * 7.13;
  const angle = fract(k * 0.7548776662) * Math.PI * 2;
  const reach = 0.55 + 0.45 * fract(k * 0.5698402910);
  const home = [Math.cos(angle) * 0.26 * reach, Math.sin(angle) * 0.36 * reach, 0.05 + fract(k * 0.3819660113) * 0.25];
  const sweep = clamp01((ENEMY_BODY_FRONT - home[1]) / (ENEMY_BODY_FRONT - ENEMY_BODY_BACK));
  const born = ENEMY_DISSOLVE_SECONDS * (0.1 + 0.6 * sweep + 0.2 * fract(k * 0.2360679775));
  const age = t - born;
  if (age <= 0 || age >= ENEMY_FLECK_LIFE) return null;
  const off = 0.16 * (1 - Math.exp(-age * 2.6));
  const rise = 0.42 * age + 0.2 * age * age;
  const sway = 0.05 * Math.sin(age * 4 + index);
  const fade = age < ENEMY_FLECK_LIFE * 0.45 ? 1 : 1 - (age - ENEMY_FLECK_LIFE * 0.45) / (ENEMY_FLECK_LIFE * 0.55);
  return {
    position: [home[0] + Math.cos(angle) * off - Math.sin(angle) * sway,
      home[1] + Math.sin(angle) * off + Math.cos(angle) * sway, home[2] + rise],
    spin: [age * (4 + index % 4), age * (3 + index % 3), age * 1.5],
    scale: 0.05 * Math.min(1, age / 0.08) * Math.max(0, fade),
    shell: index % 3 === 2,
  };
}

/**
 * Give every live and dissolving enemy a stable render slot, keyed by id, so a
 * defeated enemy keeps the rig (pose, facing, materials) it died in instead of
 * jumping to whichever slot its array index lands on. Live enemies are placed
 * first; when the pool is full a new live enemy takes the slot of the oldest
 * dissolving one, and a dissolve that finds no room is simply not drawn.
 *
 * @param {{enemies: Array, dying?: Array}|null} c  combat state
 * @param {Map<number, number>} map  id → slot, kept between frames (mutated)
 * @param {Array} slots  slot → entity, rewritten in place (length = pool size)
 */
export function allocateEnemySlots(c, map, slots) {
  const live = c ? c.enemies.concat(c.dying || []) : [];
  const ids = new Set(live.map(e => e.id));
  for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id);
  const used = new Set(map.values());
  for (const e of live) {
    if (map.has(e.id)) continue;
    let free = -1;
    for (let i = 0; i < slots.length; i++) if (!used.has(i)) { free = i; break; }
    if (free < 0) {
      if (e.dissolveT != null) continue;
      const victim = (c.dying || []).find(d => map.has(d.id));
      if (!victim) continue;
      free = map.get(victim.id);
      map.delete(victim.id);
    }
    map.set(e.id, free);
    used.add(free);
  }
  slots.fill(null);
  for (const e of live) {
    const slot = map.get(e.id);
    if (slot != null) slots[slot] = e;
  }
  return slots;
}
