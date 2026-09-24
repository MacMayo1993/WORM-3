import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { parseAlgorithm } from './algorithms.js';

// A single fixed grip throughout: yellow U, white D, red F. Practice boards
// are legal face-turn states, constructed from the inverse of the lesson.
export const TEACH_LESSONS = [
  { id: 'turn', chapter: 'Notation', title: 'Read a face turn', notation: 'R',
    goal: 'Turn the right face clockwise, looking directly at that face.',
    notice: 'Centers identify faces. Edges have two stickers; corners have three. Orbiting the camera only changes your view.',
    why: 'R moves the entire right layer. The other five letters are L (left), U (up), D (down), F (front), and B (back).' },
  { id: 'prime', chapter: 'Notation', title: 'Reverse and double', notation: "R' U2",
    goal: 'Read the apostrophe and the 2 as different instructions.',
    notice: 'Prime means counterclockwise when looking at that face. A 2 means 180 degrees, in either direction.',
    why: 'Read left to right. R followed by R′ cancels; R2 is two quarter turns counted as one instruction.' },
  { id: 'cross', chapter: '1 · White cross', title: 'Match an edge', notation: 'F2',
    goal: 'Put the white edge into the bottom cross with its side sticker matching the front center.',
    notice: 'In this case the edge is directly above its destination. In a full solve, first align each edge with its matching side center using U.',
    why: 'A half turn brings the aligned edge from the top to the bottom. Check all four side colors, not just the white plus sign.' },
  { id: 'corner-right', chapter: '2 · White corners', title: 'Insert a corner', notation: "R U R'",
    goal: 'Insert the prepared corner into the front-right bottom slot.',
    notice: 'The corner belongs between the centers matching its three colors. Use U to position it above its slot before choosing an insertion.',
    why: 'Open the slot, bring the corner over, then close the slot. An incorrectly placed corner can be taken out with this same trigger.' },
  { id: 'corner-front', chapter: '2 · White corners', title: 'Handle the other side', notation: "U R U' R'",
    goal: 'Insert the corner when its white sticker faces the other side.',
    notice: 'The same target slot needs a different setup when the white sticker points in another direction.',
    why: 'Move the corner away first, open the slot, then bring it back and close. The white cross is restored at the end.' },
  { id: 'corner-up', chapter: '2 · White corners', title: 'White facing up', notation: "R U2 R' U' R U R'",
    goal: 'Insert a corner whose white sticker points up.',
    notice: 'Keep the target slot at front-right. This case takes two connected triggers.',
    why: 'The first trigger changes the corner’s orientation and position so the second can insert it. Check the whole first layer afterward.' },
  { id: 'middle-right', chapter: '3 · Middle layer', title: 'Send an edge right', notation: "U R U' R' U' F' U F",
    goal: 'Insert the front top edge into the middle-right slot.',
    notice: 'Choose an edge without yellow. Match its front sticker to the front center; its top sticker tells you whether it goes right or left.',
    why: 'Two linked insertions move the edge into the middle and restore the first layer. For a trapped or reversed edge, insert another edge to eject it first.' },
  { id: 'middle-left', chapter: '3 · Middle layer', title: 'Send an edge left', notation: "U' L' U L U F U' F'",
    goal: 'Insert the front top edge into the middle-left slot.',
    notice: 'Match the front sticker first. Here the top sticker matches the left center.',
    why: 'This mirrors the right insertion. Check the middle edges and the white layer when the sequence finishes.' },
  { id: 'yellow-cross', chapter: '4 · Yellow cross', title: 'Orient the last edges', notation: "F R U R' U' F'",
    goal: 'Make the yellow cross while keeping the first two layers solved.',
    notice: 'For this prepared line case, hold the yellow line left-to-right. With an L, put its yellow edges at back and left; with a dot, apply once and inspect again.',
    why: 'The outer F and F′ turns wrap a four-move trigger. Recheck the pattern after each application and adjust U as needed.' },
  { id: 'yellow-face', chapter: '5 · Yellow corners', title: 'Orient the yellow face', notation: "R U R' U R U2 R'",
    goal: 'Orient the prepared last-layer corners with Sune.',
    notice: 'Count yellow corners pointing up. With one, put it at front-left. With zero, use U until the front-left corner has yellow on its left side. With two, put yellow on its front side there. Apply Sune, count again, and repeat the setup until all four point up.',
    why: 'Sune changes last-layer corner orientation and also moves last-layer pieces. Positioning those pieces comes next.' },
  { id: 'last-corners', chapter: '6 · Corner positions', title: 'Position the corners', notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
    goal: 'Put the oriented corners in their matching locations.',
    notice: 'Look for two matching corner side stickers and hold that pair on the left. If no pair matches, apply once, inspect, then set up the matching pair.',
    why: 'This T permutation exchanges two corners and two edges without twisting them. The last step will deal with the remaining edges.' },
  { id: 'last-edges', chapter: '7 · Edge positions', title: 'Finish the cube', notation: "R U' R U R U R U' R' U' R2",
    goal: 'Cycle the last three edges into place.',
    notice: 'Hold the solved edge at the back. If the cycle runs the other way, repeat; if no edge matches, apply once and inspect. Finish with U alignment if needed.',
    why: 'This edge cycle preserves the corners and the first two layers. A solved face has one color, with every adjacent layer matching its centers.' },
];
export const COURSE_STORAGE_KEY = 'worm3-teach-course-v1';
export function readCourseProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(COURSE_STORAGE_KEY));
    return Array.isArray(value) ? value.filter(id => TEACH_LESSONS.some(l => l.id === id) || id === 'full-solve') : [];
  } catch { return []; }
}
export function applyCourseMove(cubies, move) {
  let next = cubies;
  for (let i = 0; i < (move.numTurns ?? 1); i++) next = rotateSliceCubies(next, 3, move.axis, move.sliceIndex, move.dir);
  return next;
}
export function courseHome() {
  let cube = makeCubies(3);
  for (let sliceIndex = 0; sliceIndex < 3; sliceIndex++) cube = applyCourseMove(cube, { axis: 'depth', sliceIndex, dir: 1, numTurns: 2 });
  return cube;
}
export function courseSignature(cubies) {
  return cubies.flat(2).map(c => Object.keys(c.stickers).sort().map(k => `${k}:${c.stickers[k].curr}`).join(',')).join('|');
}
export function prepareLesson(lesson) {
  const moves = parseAlgorithm(lesson.notation, 3);
  let cube = courseHome();
  for (const move of [...moves].reverse()) cube = applyCourseMove(cube, { ...move, dir: -move.dir });
  const frames = [cube];
  for (const move of moves) frames.push(applyCourseMove(frames.at(-1), move));
  return { moves, frames, signatures: frames.map(courseSignature) };
}
export const FULL_SOLVE = {
  id: 'full-solve', chapter: 'Put it together', title: 'Your first full solve',
  notation: TEACH_LESSONS.slice(2).map(l => l.notation).join(' '),
  goal: 'Solve this legal scramble using the seven stages, without a move prompt.',
  notice: 'Work through cross, first layer, middle layer, yellow cross, yellow face, corner positions, then edge positions. All lessons remain available for review.',
  why: 'Take your time. Use the face buttons or drag layers. Show hint reveals the prepared solution one move at a time; restart for an independent attempt.',
};

// Stage checks are independent of the authored solution. Alternative legal
// solutions in the final exercise receive the same completion credit.
export function inspectCourseStage(cube) {
  const centers = { PY: cube[1][2][1].stickers.PY.curr, NY: cube[1][0][1].stickers.NY.curr, PX: cube[2][1][1].stickers.PX.curr, NX: cube[0][1][1].stickers.NX.curr, PZ: cube[1][1][2].stickers.PZ.curr, NZ: cube[1][1][0].stickers.NZ.curr };
  const matches = (x, y, z) => Object.entries(cube[x][y][z].stickers).every(([d, s]) => s.curr === centers[d]);
  const edges = [[1, 0], [2, 1], [1, 2], [0, 1]];
  const corners = [[0, 0], [0, 2], [2, 0], [2, 2]];
  if (!edges.every(([x, z]) => matches(x, 0, z))) return '1 · White cross';
  if (!corners.every(([x, z]) => matches(x, 0, z))) return '2 · White corners';
  if (!corners.every(([x, z]) => matches(x, 1, z))) return '3 · Middle layer';
  if (!edges.every(([x, z]) => cube[x][2][z].stickers.PY.curr === 6)) return '4 · Yellow cross';
  if (!corners.every(([x, z]) => cube[x][2][z].stickers.PY.curr === 6)) return '5 · Yellow corners';
  if (!corners.every(([x, z]) => matches(x, 2, z))) return '6 · Corner positions';
  if (!edges.every(([x, z]) => matches(x, 2, z))) return '7 · Edge positions';
  return 'Solved';
}
