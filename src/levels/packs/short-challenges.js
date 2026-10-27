import { createLevel, createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

const turn = (axis, sliceIndex, dir = 1) => ({ axis, sliceIndex, dir });
const front = (x, y) => ({ x, y, z: 2, dirKey: 'PZ' });
const challenges = [
  { name: 'Move the band', turns: [turn('row', 1)], flips: [], cues: ['turn'],
    objective: 'Restore the cube with one middle-layer turn.',
    tip: 'Turn the middle horizontal band back. The whole band travels together.',
    result: 'One turn carried every piece of the band back into place.' },
  { name: 'Two ends, one action', turns: [], flips: [front(1, 1)], cues: ['link'], focus: 'M1-005',
    objective: 'Restore the two linked centre tiles with one flip.',
    tip: 'Flip either outlined centre. Its linked partner changes at the same time.',
    result: 'One flip restored both ends of the same pair.' },
  { name: 'Find the travelling twin', turns: [turn('col', 2)], flips: [front(2, 1)], cues: ['link', 'turn'], focus: 'M6-006',
    objective: 'Restore one linked pair and undo one layer turn.',
    tip: 'A turn moves tile identities, but preserves their partner. Repair the flipped pair and turn the right layer back.',
    result: 'You restored a linked pair after its tiles had moved with the cube.' },
  { name: 'Reverse the route', turns: [turn('row', 2), turn('col', 2)], flips: [], cues: ['turn'],
    objective: 'Restore the cube in two turns. Think about the order.',
    tip: 'The top turned first, then the right. Undo the right turn before undoing the top.',
    result: 'Reversing the order retraced the pieces’ route.' },
  { name: 'Two repairs', turns: [turn('row', 1)], flips: [front(1, 1), front(0, 0)], cues: ['link', 'turn'],
    objective: 'Repair two linked pairs and restore the middle band. Aim for three actions.',
    tip: 'Restore the middle band, then look for the two pairs still showing their opposite colours.',
    result: 'Two pair repairs and one layer turn restored the cube.' },
  { name: 'Read, plan, restore', turns: [turn('depth', 2), turn('row', 2)], flips: [front(1, 1)], cues: ['link', 'turn'],
    objective: 'Combine two turns and a paired flip to restore all six faces.',
    tip: 'Undo the top turn and then the front turn. A paired flip repairs the remaining centre colours.',
    result: 'You combined movement and paired colour changes in one short solve.' },
];

export const SHORT_CHALLENGE_LEVELS = challenges.map((item, index) => createLevel({
  id: 501 + index, name: item.name, description: item.objective, cubeSize: 3,
  scrambleMoves: 0, scrambleSequence: item.turns, flipSequence: item.flips, chaosLevel: 0,
  features: { rotations: item.turns.length > 0, flips: item.flips.length > 0, tunnels: true, chaos: false, explode: false, parity: false, net: false },
  tutorial: { title: item.name, text: item.objective, objective: item.objective, tip: item.tip, cues: item.cues },
  actionFocus: item.focus ?? null,
  winMessage: item.result, difficulty: DIFFICULTY.EASY, tags: [LEVEL_TAGS.TUTORIAL, LEVEL_TAGS.PUZZLE],
  // All are selectable: these are short, repeatable skill checks, not a gate.
  requirements: { previousLevel: null, stars: 0, achievements: [] },
}));

export default createLevelPack({
  id: 'short-challenges', name: 'Short Challenges',
  description: 'Six small puzzles: read a layer, find its linked tiles, and plan a two- or three-action repair.',
  levels: SHORT_CHALLENGE_LEVELS, difficulty: DIFFICULTY.EASY, tags: [LEVEL_TAGS.TUTORIAL, LEVEL_TAGS.PUZZLE],
});
