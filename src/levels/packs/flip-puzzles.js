import { BACKGROUNDS, createLevel, createLevelPack, DIFFICULTY, WIN_CONDITIONS } from '../schema.js';

// One scene per level, climbing the Story's journey from the daycare to the black
// hole. A level without one fell back to 'abstract', which has no scene at all.
export const FLIP_PUZZLE_BACKGROUNDS = [
  BACKGROUNDS.DAYCARE, BACKGROUNDS.ELEMENTARY, BACKGROUNDS.MIDDLESCHOOL, BACKGROUNDS.HIGHSCHOOL, BACKGROUNDS.COLLEGE,
  BACKGROUNDS.JOB, BACKGROUNDS.NASA, BACKGROUNDS.ROCKET, BACKGROUNDS.MOON, BACKGROUNDS.BLACKHOLE,
];

const turn = (axis, sliceIndex) => ({ axis, sliceIndex, dir: 1 });
const right = turn('col', 2), left = turn('col', 0), up = turn('row', 2);
const front = turn('depth', 2), down = turn('row', 0);
const face = (x, y, z, dirKey) => ({ x, y, z, dirKey });
const edge = face(1, 2, 2, 'PZ'), corner = face(2, 2, 2, 'PZ');
const centre = face(1, 2, 1, 'PY'), sideEdge = face(2, 1, 2, 'PZ');
const topCorner = face(0, 2, 0, 'PY'), lowCorner = face(0, 0, 2, 'PZ');

// On a solved cube these three faces contain one representative of all 27 pairs.
// Membership in two half-turn bands cancels at their intersection.
function bandFlips(axes) {
  const pairs = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (const tile of [face(i, j, 2, 'PZ'), face(i, 2, j, 'PY'), face(2, i, j, 'PX')]) {
        if (axes.filter(axis => tile[axis] === 1).length % 2) pairs.push(tile);
      }
    }
  }
  return pairs;
}

const puzzles = [
  { name: 'First Flip', target: 1, repairs: [edge],
    line: 'Tap the odd edge. Watch its twin on the far side.', hint: 'The front top edge and the back bottom edge change together.' },
  { name: 'Centre Swap', target: 1, turns: [up], repairs: [centre],
    line: 'The white and yellow centres traded colours. Can you fix both?', hint: 'Turn the top layer back. Tap either misplaced centre.' },
  { name: 'Twin Trouble', target: 2, turns: [right], repairs: [corner, edge],
    line: 'Two pairs changed colour and one layer turned. Turns are free.', hint: 'Line up the right layer first, then inspect the remaining pairs.' },
  { name: 'Half-Turn Trick', target: 0, bands: ['x'],
    line: 'Six pairs changed colour. How many flips do you need?', hint: 'Follow the middle column over the top. Turn that whole slice halfway around.' },
  { name: 'Scar Tissue', target: 2, repairs: [corner], scars: [[sideEdge, 2]], lesson: true,
    line: 'Watch the cracked edge flip by itself. Then repair both pairs.', hint: 'The marked edge and its twin change together. Each player tap costs one flip.' },
  { name: 'Mixed Signals', target: 2, turns: [right, up], bands: ['y'], repairs: [corner, topCorner],
    line: 'A familiar pattern is hiding among two stray pairs.', hint: 'Straighten the outer layers, then inspect the horizontal middle band.' },
  { name: 'Deep Scars', target: 3, turns: [left, up, front], repairs: [edge, centre, corner], scars: [[topCorner, 4], [lowCorner, 4]],
    line: 'Two deep scars may shift. Choose when to make your repairs.', hint: 'Use free turns to line things up before leaving freshly healed pairs exposed.' },
  { name: 'Antipodal Shuffle', target: 1, turns: [front, right], bands: ['x', 'z'], repairs: [corner],
    line: 'Two middle bands cross. What happens to the tiles they share?', hint: 'Restore the outer layers. Try half turns about two different middle axes.' },
  { name: 'Last Life', target: 3, turns: [right, up, front, left], repairs: [sideEdge], scars: [[corner, 5], [centre, 5]],
    line: 'Two pairs have one flip left. Heal them to seal their scars in gold.', hint: 'Use a final flip on each deep wound. Those pairs will stay stable while you work.' },
  { name: 'Event Horizon', target: 1, turns: [right, up, front, left, down, right], bands: ['z'], repairs: [corner], scars: [[edge, 2], [lowCorner, 4]],
    line: 'Find the band that brings the faces together. One pair will remain.', hint: 'Restore the outer layers. A half turn through the middle leaves one corner pair to fix.' },
];

export const FLIP_PUZZLES = puzzles.map((puzzle, index) => {
  const id = 601 + index;
  return createLevel({
    id, name: puzzle.name, description: puzzle.line, scoring: 'flips', flipPar: puzzle.target,
    relapse: index >= 4, relapseLesson: !!puzzle.lesson, winCondition: WIN_CONDITIONS.FLIP,
    background: FLIP_PUZZLE_BACKGROUNDS[index],
    scrambleMoves: 0, scrambleSequence: puzzle.turns ?? [],
    flipSequence: [...bandFlips(puzzle.bands ?? []), ...(puzzle.repairs ?? []),
      ...(puzzle.scars ?? []).flatMap(([tile, count]) => Array(count).fill(tile))],
    features: { rotations: true, flips: true, tunnels: true, net: true },
    tutorial: { text: puzzle.line, objective: puzzle.line, tip: puzzle.hint, mobiLines: [puzzle.line] },
    difficulty: index < 3 ? DIFFICULTY.EASY : index < 6 ? DIFFICULTY.MEDIUM : DIFFICULTY.HARD,
    requirements: { previousLevel: index ? id - 1 : null, stars: 0, achievements: [] },
  });
});

export default createLevelPack({ id: 'flip-puzzles', name: 'Flip Cube Levels',
  description: 'Ten puzzles. Turn freely and solve all six faces in as few flips as possible.', levels: FLIP_PUZZLES });
