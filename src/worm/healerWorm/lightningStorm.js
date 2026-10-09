// src/worm/healerWorm/lightningStorm.js
//
// The Lightning orb's storm, as pure state so it can be reasoned about and tested away
// from the renderer and the mode. While the wash is up the sky marks a tile, charges it
// for STORM.telegraph seconds, and then strikes it: a head under the bolt dies, a body
// segment under it is cut off there, an enemy near it is killed, and a bare tile is
// flipped into a charged wormhole. Everything the bolt does lives in HealerWormMode and
// the crawler; this module only decides WHEN and WHERE, from an injected random source.
//
// Spots keep their telegraph after the wash itself has run out: a marked tile always
// strikes. Only new marks stop.

export const STORM = Object.freeze({
  strikes: 6,          // marks per orb
  firstDelay: 1.0,     // seconds from the claim to the first mark
  gapMin: 1.2,         // seconds between marks
  gapMax: 1.9,
  telegraph: 1.4,      // seconds a mark charges before it strikes
  flash: 0.6,          // seconds a landed strike stays on screen
  bodyShare: 0.4,      // share of marks aimed at the worm's own body
  headSafeTiles: 2,    // never aimed this close to the head, or ahead of it
  padShare: 0.5,       // Thunderpad: share of marks aimed at a spring pad when one is free
  retry: 0.1           // seconds before trying again when no tile could be found
});

export function makeStorm() {
  return { spots: [], flashes: [], spawned: 0, timer: 0, seq: 0, fired: [] };
}

/** A new orb: its six marks start counting. Marks already charging still strike. */
export function beginStorm(storm) {
  storm.spawned = 0;
  storm.timer = STORM.firstDelay;
}

export function clearStorm(storm) {
  storm.spots.length = 0; storm.flashes.length = 0; storm.fired.length = 0;
  storm.spawned = 0; storm.timer = 0;
}

/**
 * Advance the storm and return the spots that strike this tick (a reused array: read it
 * now). `pick(rng)` chooses a tile for a new mark, or null when there is none.
 * @param {object} storm
 * @param {number} delta seconds, already clamped by the caller
 * @param {{ spawning: boolean, pick: (rng: () => number) => object|null, rng: () => number }} ctx
 */
export function tickStorm(storm, delta, { spawning, pick, rng }) {
  storm.fired.length = 0;
  if (spawning && storm.spawned < STORM.strikes) {
    storm.timer -= delta;
    if (storm.timer <= 0) {
      const tile = pick(rng);
      if (tile) {
        storm.spots.push({ id: ++storm.seq, tile: { x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey }, age: 0, delay: STORM.telegraph });
        storm.spawned++;
        storm.timer = STORM.gapMin + rng() * (STORM.gapMax - STORM.gapMin);
      } else storm.timer = STORM.retry;
    }
  }
  for (let i = storm.spots.length - 1; i >= 0; i--) {
    const spot = storm.spots[i];
    spot.age += delta;
    if (spot.age >= spot.delay) {
      storm.spots.splice(i, 1);
      storm.fired.push(spot);
      storm.flashes.push({ id: spot.id, tile: spot.tile, age: 0 });
    }
  }
  storm.fired.reverse();   // earliest mark first
  for (let i = storm.flashes.length - 1; i >= 0; i--) {
    const flash = storm.flashes[i];
    // A flash created this tick starts at zero; older ones age.
    if (storm.fired.some(spot => spot.id === flash.id)) continue;
    flash.age += delta;
    if (flash.age >= STORM.flash) storm.flashes.splice(i, 1);
  }
  return storm.fired;
}

/**
 * Where a new mark may go. Candidates are the free tiles and the worm's own body, but
 * never the head or the tiles just ahead of it, so a mark always gives the worm room to
 * react; tiles holding an orb, a special or a bomb are left alone.
 * @param {object} args
 * @param {Array<object>} args.tiles every surface tile
 * @param {Array<string>} args.body body tile keys, head first (index 0)
 * @param {Set<string>} args.avoid keys never to mark (head zone, orbs, specials, bombs, open marks)
 * @param {Array<object>} [args.pads] Thunderpad: spring pad tiles the storm aims for first
 * @param {() => number} rng
 */
export function pickStrikeTile({ tiles, body, avoid, pads = null }, rng) {
  const key = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
  if (pads?.length) {
    const free = pads.filter(t => !avoid.has(key(t)));
    if (free.length && rng() < STORM.padShare) return free[Math.floor(rng() * free.length)];
  }
  if (body.length > 0 && rng() < STORM.bodyShare) {
    const hittable = body.filter(k => k && !avoid.has(k));
    if (hittable.length) {
      const [x, y, z, dirKey] = hittable[Math.floor(rng() * hittable.length)].split(',');
      return { x: +x, y: +y, z: +z, dirKey };
    }
  }
  const pool = tiles.filter(t => !avoid.has(key(t)));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}
