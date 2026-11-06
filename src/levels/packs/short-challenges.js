import { createLevel, createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

const turn = (axis, sliceIndex, dir = 1) => ({ axis, sliceIndex, dir });
const front = (x, y) => ({ x, y, z: 2, dirKey: 'PZ' });
const top = (x, z) => ({ x, y: 2, z, dirKey: 'PY' });
const challenges = [
  { name: 'Crossed bands', turns: [turn('row', 1), turn('col', 2)], flips: [front(0, 0), front(1, 1)],
    tip: 'Separate misplaced pieces from opposite colors. A flip repairs a pair; it does not move the band.' },
  { name: 'Hidden partners', turns: [turn('col', 0), turn('depth', 2), turn('row', 2, -1)], flips: [front(0, 1), top(2, 1)],
    tip: 'Inspect the other faces before spending moves. Partners keep their identities as layers move.' },
  { name: 'Three-axis knot', turns: [turn('depth', 0), turn('row', 1), turn('col', 2, -1)], flips: [front(0, 0), front(2, 2), top(1, 1)],
    tip: 'Find a band that can be restored without breaking a larger solved block.' },
  { name: 'Broken symmetry', turns: [turn('row', 2), turn('col', 2), turn('row', 2, -1), turn('depth', 1)], flips: [front(0, 1), front(1, 2), top(2, 0)],
    tip: 'Similar-looking faces can hide different tile identities. Check both ends of a pair.' },
  { name: 'Four repairs deep', turns: [turn('col', 0), turn('row', 1, -1), turn('depth', 2), turn('col', 2)], flips: [front(0, 0), front(2, 1), top(0, 1), top(2, 2)],
    tip: 'Plan the layer work before repairing the final opposite-color pairs.' },
  { name: 'Untangle the cube', turns: [turn('row', 2), turn('col', 0), turn('depth', 1, -1), turn('row', 0), turn('col', 2, -1)], flips: [front(0, 2), front(2, 0), top(0, 0), top(1, 1)],
    tip: 'Work backward from a solved face. The shortest-looking local repair may disturb another face.' },
];

export const SHORT_CHALLENGE_LEVELS = challenges.map((item, index) => {
  const par = item.turns.length + item.flips.length;
  const objective = `Restore all six faces. Aim for ${par} moves.`;
  return createLevel({
    // Retire the easy 501–506 boards without reusing their earned stars.
    id: 511 + index, name: item.name, description: objective, cubeSize: 3,
    scrambleMoves: 0, scrambleSequence: item.turns, flipSequence: item.flips, chaosLevel: 0,
    features: { rotations: true, flips: true, tunnels: true, chaos: false, explode: false, parity: false, net: false },
    tutorial: { title: item.name, text: objective, objective, tip: item.tip, cues: ['link', 'turn'] },
    // Par is a replay-verified solution target, not a claim of global optimality.
    par, actionFocus: null,
    winMessage: 'All six faces restored. Can you improve your move count?',
    difficulty: index < 2 ? DIFFICULTY.MEDIUM : index < 4 ? DIFFICULTY.HARD : DIFFICULTY.EXPERT,
    tags: [LEVEL_TAGS.CHALLENGE, LEVEL_TAGS.PUZZLE],
    requirements: { previousLevel: null, stars: 0, achievements: [] },
  });
});

export default createLevelPack({
  id: 'short-challenges', name: 'Short Challenges', version: '2.0.0',
  description: 'Six mixed turn-and-flip puzzles. Plan across all six faces, with 4–9 move targets and optional hints.',
  levels: SHORT_CHALLENGE_LEVELS, difficulty: DIFFICULTY.HARD, tags: [LEVEL_TAGS.CHALLENGE, LEVEL_TAGS.PUZZLE],
});
