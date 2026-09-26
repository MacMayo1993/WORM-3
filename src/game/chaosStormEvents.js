// src/game/chaosStormEvents.js
//
// Translates one chaos-worker TICK into the render events the chaos storm draws.
//
// The worker already reports what happened — chain hops (cascades), flips, Conway
// recoveries and deaths — but only as grid coordinates and, for hops, as world
// positions frozen at the moment the sim computed them. Those frozen positions are
// why bolts used to fire at empty space once flipped cubies started rising to
// their Explode position: the tile moved and the bolt did not.
//
// So the storm is told WHICH TILE each event touched, never where it was. The
// renderer resolves that tile against the live cubie transform every frame, and a
// bolt stays welded to a piece that is rising, springing or riding a slice turn.
//
// Pure: no React, no Three, no Math.random. Every seed comes from the caller's
// counter so a test can pin the output and nothing here can perturb the sim.

import { getManifoldGridId } from './gridIds.js';
import { findAntipodalStickerByGrid } from './manifoldLogic.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

/**
 * Per-tick ceilings. The worker already caps its own output (MAX_OPS_PER_CHAIN_TICK,
 * the Conway birth caps); these bound the render side independently so a burst can
 * never queue more work than the storm's fixed pools can draw.
 */
export const STORM_EVENT_CAPS = { bolts: 3, charges: 6, recoveries: 2, overloads: 2 };

/** Same format WormholeNetwork and useCubeState build: sorted grid ids joined by '|'. */
export const stormPairId = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** A well-mixed integer seed from a running counter. */
export const stormSeed = (n) => (Math.imul((n | 0) + 1, 2654435761) >>> 0) % 100000;

/**
 * The pair a grid id belongs to, whether or not its twin is on the board: the twin
 * shares the index on the antipodal manifold face. Same key PadSprings publishes
 * pad lifts under (flipPadPair), so the storm can land a bolt on a raised pad.
 */
export function stormPairKey(gridId) {
  const m = /^M(\d)-(\d+)$/.exec(gridId ?? '');
  if (!m) return null;
  const twin = ANTIPODAL_COLOR[Number(m[1])];
  return twin ? stormPairId(gridId, `M${twin}-${m[2]}`) : null;
}

/** A tile's identity as the renderer needs it — never the sticker object itself. */
function tileLoc(cubies, size, x, y, z, dirKey) {
  const st = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!st) return null;
  const gridId = getManifoldGridId(st, size);
  return { x, y, z, dirKey, gridId, pairKey: stormPairKey(gridId), flips: st.flips || 0, curr: st.curr };
}

/**
 * The antipodal twin of a tile, read from the CURRENT board.
 *
 * The manifold map is only trusted for where the twin sits: flips never move
 * stickers, so a map built a few ticks ago still locates it, but the sticker
 * object it holds may be several flips stale.
 */
function twinLoc(cubies, size, manifoldMap, x, y, z, dirKey) {
  const st = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!st || !manifoldMap) return null;
  const at = findAntipodalStickerByGrid(manifoldMap, st, size);
  return at ? tileLoc(cubies, size, at.x, at.y, at.z, at.dirKey) : null;
}

const fromTuple = (cubies, size, t) => (Array.isArray(t) && t.length >= 4 ? tileLoc(cubies, size, t[0], t[1], t[2], t[3]) : null);

/**
 * @param {object} payload     the worker TICK payload (cascades, flips, recoveries, deaths)
 * @param {Array}  cubies      the board BEFORE this tick's flips are applied
 * @param {number} size
 * @param {Map}    manifoldMap gridId → location (positions only are relied on)
 * @param {number} cap         the effective flip cap in force
 * @param {object} [o]
 * @param {number} [o.seed]        running counter; each event consumes one
 * @param {Array}  [o.cascadeIds]  store ids parallel to payload.cascades, so the
 *                                 renderer can retire the HUD's bolt entry when
 *                                 its bolt finishes
 * @returns {{ events: object[], nextSeed: number }}
 */
export function chaosStormEvents(payload, cubies, size, manifoldMap, cap, { seed = 0, cascadeIds = [] } = {}) {
  const events = [];
  let n = seed;
  const nextSeed = () => stormSeed(n++);
  const safeCap = Math.max(1, cap || 1);

  // ── The first strike: the tile the player picked takes a bolt out of the sky ─
  const ignition = fromTuple(cubies, size, payload?.ignition);
  if (ignition) events.push({ type: 'ignition', to: ignition, heat: 0, seed: nextSeed() });

  // ── Bolts: one per chain hop between different cubies ──────────────────────
  const cascades = payload?.cascades ?? [];
  let bolts = 0;
  for (let i = 0; i < cascades.length && bolts < STORM_EVENT_CAPS.bolts; i++) {
    const c = cascades[i];
    if (!c) continue;
    const from = fromTuple(cubies, size, c.fromTile);
    const to = fromTuple(cubies, size, c.toTile);
    // A hop the worker described only in world space still gets drawn from its
    // frozen positions; it just cannot follow the tiles.
    if ((!from || !to) && !(c.from && c.to)) continue;
    events.push({
      type: 'bolt',
      cascadeId: cascadeIds[i] ?? null,
      from,
      to,
      fromPos: c.from ?? null,
      toPos: c.to ?? null,
      crossFace: !!c.crossFace,
      // How close the struck tile is to its cap — hot tiles take hotter bolts.
      heat: to ? Math.min(1, (to.flips + 1) / safeCap) : 0,
      seed: nextSeed()
    });
    bolts++;
  }

  // ── Charges: every flip sends a surge through its wormhole to the twin ──────
  const seenPairs = new Set();
  const flips = payload?.flips ?? [];
  let charges = 0;
  for (let i = 0; i < flips.length && charges < STORM_EVENT_CAPS.charges; i++) {
    const f = flips[i];
    if (!Array.isArray(f)) continue;
    const from = fromTuple(cubies, size, f);
    if (!from || from.flips >= safeCap) continue;
    const to = twinLoc(cubies, size, manifoldMap, f[0], f[1], f[2], f[3]);
    if (!to) continue;
    const pairId = stormPairId(from.gridId, to.gridId);
    if (seenPairs.has(pairId)) continue;
    seenPairs.add(pairId);
    events.push({
      type: 'charge',
      // A pair's first flip is the moment its wormhole opens.
      kind: from.flips === 0 ? 'birth' : 'surge',
      pairId,
      from,
      to,
      heat: Math.min(1, (from.flips + 1) / safeCap),
      seed: nextSeed()
    });
    charges++;
  }

  // ── Recoveries: the charge drains back out of the pair ─────────────────────
  const recoveries = payload?.recoveries ?? [];
  let drained = 0;
  for (let i = 0; i < recoveries.length && drained < STORM_EVENT_CAPS.recoveries; i++) {
    const r = recoveries[i];
    if (!Array.isArray(r)) continue;
    const from = fromTuple(cubies, size, r);
    if (!from || from.flips <= 0 || from.flips >= safeCap) continue;
    const to = twinLoc(cubies, size, manifoldMap, r[0], r[1], r[2], r[3]);
    if (!to) continue;
    const pairId = stormPairId(from.gridId, to.gridId);
    if (seenPairs.has(pairId)) continue;
    seenPairs.add(pairId);
    // Drains run twin → tile, the reverse of the surge that charged it.
    events.push({ type: 'charge', kind: 'recover', pairId, from: to, to: from, heat: Math.max(0, (from.flips - 1) / safeCap), seed: nextSeed() });
    drained++;
  }

  // ── Overloads: a pair driven over its cap blows its wormhole ───────────────
  const deaths = payload?.deaths ?? [];
  const seenDeaths = new Set();
  let overloads = 0;
  for (let i = 0; i < deaths.length && overloads < STORM_EVENT_CAPS.overloads; i++) {
    const at = deaths[i]?.gridId ? manifoldMap?.get(deaths[i].gridId) : null;
    if (!at) continue;
    const from = tileLoc(cubies, size, at.x, at.y, at.z, at.dirKey);
    if (!from) continue;
    const to = twinLoc(cubies, size, manifoldMap, at.x, at.y, at.z, at.dirKey);
    const pairId = to ? stormPairId(from.gridId, to.gridId) : from.gridId;
    // Both members of a pair usually die in the same tick — one blast per pair.
    if (seenDeaths.has(pairId)) continue;
    seenDeaths.add(pairId);
    events.push({ type: 'overload', pairId, from, to, heat: 1, seed: nextSeed() });
    overloads++;
  }

  return { events, nextSeed: n };
}

/** Flat cubie-ref index, matching CubeAssembly's x → y → z layout. */
export const stormMeshIndex = (loc, size) => (loc.x * size + loc.y) * size + loc.z;
