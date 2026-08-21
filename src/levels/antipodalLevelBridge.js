// antipodalLevelBridge.js — turn the analytic par formula into *playable* levels.
//
// antipodalRandomizer.js works in the abstract fibre: partitions (n00, n11, n_A)
// of P orbit pairs. This module lands those partitions on a real cube so the
// staging pipeline (levelStaging.buildLevelStartState) can open on them and the
// existing CLASSIC win condition can score them.
//
// What is authorable — and what is not. A level is staged from a solved cube by
// `scrambleSequence` (face turns) then `flipSequence` (native antipodal flips).
// Native flips are *paired*: flipping one β-pair toggles both members, so it can
// only ever produce SYMMETRIC fibre states (n_A = 0). Asymmetric defect pairs
// (0,1) are precisely the ∆ ≠ 0 states the monograph proves unreachable by
// paired moves — they live in the worm/heal move model, not classic staging.
// This bridge therefore realises the **Invariant Plane** sector exactly:
//
//     flip n11 distinct β-pairs  →  n_A = 0, dirty pairs = n11
//     CLASSIC solve un-flips each →  par = n11   (= C_dir when n_A = 0)
//
// Everything is deterministic from a seed: the same seed selects the same
// β-pairs, so a generated pack is stable across builds and players.

import { makeCubies } from '../game/cubeState.js';
import { enumerateBetaPairs } from '../game/antipodalEngine.js';
import { createLevel, createLevelPack, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from './schema.js';
import { makeRng } from './antipodalRandomizer.js';

/** Every flippable β-pair of a solved `size` cube, as `{x,y,z,dirKey}` anchors. */
export function betaPairAnchors(size) {
  return enumerateBetaPairs(makeCubies(size), size)
    .filter((p) => p.b) // needs a partner to be flippable
    .map((p) => ({ x: p.a.x, y: p.a.y, z: p.a.z, dirKey: p.a.dir }));
}

/** The number of β-pairs (the physical P) for a solved cube of `size`. */
export function betaPairCount(size) {
  return betaPairAnchors(size).length;
}

/**
 * Deterministically choose `flipCount` distinct β-pair anchors to author as a
 * flipSequence. Seeded Fisher–Yates over the anchor list — no Math.random.
 */
export function buildAntipodalFlipSequence(size, flipCount, seed = 0) {
  const anchors = betaPairAnchors(size);
  if (flipCount < 0 || flipCount > anchors.length) {
    throw new RangeError(`flipCount ${flipCount} out of range [0, ${anchors.length}] for size ${size}`);
  }
  const rng = makeRng(`${seed}:${size}:${flipCount}`);
  const order = anchors.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, flipCount).map((i) => anchors[i]);
}

/**
 * Build one playable CLASSIC flip-solve level with an exact par.
 *
 * @param {object} opts
 * @param {number} opts.id         globally unique level id (see LEVEL_ID_RANGES)
 * @param {number} [opts.size]     cube size (default 3)
 * @param {number} opts.targetPar  exact number of flips to undo (= C_dir, n_A=0)
 * @param {number|string} [opts.seed]
 * @param {object} [opts.meta]     name / description / background / tutorial etc.
 * @returns a createLevel descriptor with an authored flipSequence and `par`.
 */
export function buildPlayableAntipodalLevel({ id, size = 3, targetPar, seed = 0, meta = {} }) {
  const P = betaPairCount(size);
  if (targetPar < 0 || targetPar > P) {
    throw new RangeError(`targetPar ${targetPar} unreachable on a ${size}×${size} cube (P=${P}, par ∈ [0, ${P}])`);
  }
  const flipSequence = buildAntipodalFlipSequence(size, targetPar, `${seed}:lvl:${id}`);
  return createLevel({
    id,
    name: meta.name ?? `Antipodal Descent ${id}`,
    description: meta.description ?? `Flip ${targetPar} antipodal pair${targetPar === 1 ? '' : 's'} back home`,
    cubeSize: size,
    scrambleSequence: null,
    scrambleMoves: 0, // no random turns on top of the authored flips
    flipSequence,
    par: targetPar,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: meta.background ?? BACKGROUNDS.COLLEGE,
    features: {
      rotations: true,
      tunnels: false,
      flips: true,
      chaos: false,
      explode: false,
      parity: true,
      net: false,
      ...(meta.features ?? {})
    },
    tutorial: meta.tutorial ?? {
      title: 'Antipodal Descent',
      text: `${targetPar} antipodal pair${targetPar === 1 ? '' : 's'} show the opposite home colour. Tap each back — no layer turns needed.`,
      objective: `Return every flipped pair. Par is ${targetPar} flip${targetPar === 1 ? '' : 's'}.`,
      tip: 'A flipped pair shows its antipode. Tapping either member sends both home.'
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: meta.winMessage ?? 'Fibre restored — every pair back home. ⭐',
    difficulty: meta.difficulty ?? DIFFICULTY.MEDIUM,
    tags: meta.tags ?? [LEVEL_TAGS.PUZZLE],
    requirements: meta.requirements ?? { previousLevel: null, stars: 0, achievements: [] }
  });
}

// The pack's id band (see schema.LEVEL_ID_RANGES; 301–399 is unused).
export const ANTIPODAL_PACK_BASE_ID = 301;

/**
 * A deterministic playable pack: a ramp of flip-solve levels of increasing par.
 * Par climbs 1→count on a size that comfortably holds it (3×3 up to par 6, then
 * 4×4). This is the invariant-plane sector of the campaign made playable today;
 * the heal (n_A > 0) tiers await the worm/heal move model.
 */
export function buildAntipodalDescentLevels(count = 12, seed = 20260821) {
  const levels = [];
  for (let i = 0; i < count; i++) {
    const targetPar = i + 1;
    const size = targetPar <= 6 ? 3 : 4;
    levels.push(
      buildPlayableAntipodalLevel({
        id: ANTIPODAL_PACK_BASE_ID + i,
        size,
        targetPar,
        seed,
        meta: {
          name: `Antipodal Descent ${i + 1}`,
          difficulty: targetPar <= 3 ? DIFFICULTY.EASY : targetPar <= 6 ? DIFFICULTY.MEDIUM : DIFFICULTY.HARD,
          requirements: { previousLevel: i === 0 ? null : ANTIPODAL_PACK_BASE_ID + i - 1, stars: 0, achievements: [] }
        }
      })
    );
  }
  return levels;
}

/** The full playable pack, ready to register with LevelsManager. */
export function buildAntipodalDescentPack({ count = 12, seed = 20260821 } = {}) {
  return createLevelPack({
    id: 'antipodal-descent',
    name: 'Antipodal Descent',
    description: 'Analytically generated flip-solve puzzles — each level has an exact par from C_dir = n_A + min(n11, P − n11).',
    author: 'WORM³ Team',
    version: '1.0.0',
    levels: buildAntipodalDescentLevels(count, seed),
    difficulty: DIFFICULTY.MEDIUM,
    tags: [LEVEL_TAGS.PUZZLE],
    requirements: { completedPacks: [], totalStars: 0 }
  });
}
