/**
 * Algorithm Codex — ten levels, one per famous speedcubing algorithm.
 *
 * Every level is a solved cube disturbed by exactly the INVERSE of its
 * algorithm, so performing that algorithm solves the level. Par therefore
 * equals the algorithm's quarter-turn count, and three stars means you executed
 * it clean — which is the same thing speedcubers already measure.
 *
 * The pairing with WORM³'s topology is the point of the pack: these sequences
 * are famous because of what they do to a cube, and this cube also identifies
 * antipodal points, so each one says something extra here. Tunnels stay on
 * throughout so the player can watch which pieces an algorithm moves *through*
 * the manifold rather than only around the surface.
 *
 * Sequences are checked against the rotation engine in
 * __tests__/algorithmScramble.test.js — scramble, apply, assert solved — so a
 * notation slip fails the build rather than shipping an unsolvable lesson.
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { algorithmToScramble, quarterTurnCount } from '../algorithmScramble.js';

// Flips are off across the pack: these levels teach turning, and leaving the
// antipodal tap enabled would let a player "solve" a recognition case by
// recolouring tiles instead of executing the algorithm.
const CODEX_FEATURES = {
  rotations: true,
  tunnels: true,
  flips: false,
  chaos: false,
  explode: false,
  parity: false,
  net: false,
};

/**
 * Build one Codex level from its algorithm.
 * @param {object} spec id, name, notation, and the teaching copy
 */
function algorithmLevel({
  id, name, notation, description, background, difficulty,
  title, text, objective, tip, mobiLines, winMessage, previousLevel,
}) {
  return createLevel({
    id,
    name,
    description,
    cubeSize: 3,
    scrambleSequence: algorithmToScramble(notation),
    flipSequence: [],
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background,
    features: { ...CODEX_FEATURES },
    // The algorithm itself, surfaced to the HUD so the player can follow along.
    algorithm: { notation, quarterTurns: quarterTurnCount(notation) },
    tutorial: { title, text, objective, tip, mobiLines },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage,
    difficulty,
    tags: [LEVEL_TAGS.PUZZLE, LEVEL_TAGS.TUTORIAL],
    requirements: { previousLevel, stars: 0, achievements: [] },
  });
}

export const ALGORITHM_CODEX_LEVELS = [
  algorithmLevel({
    id: 201,
    name: 'Sexy Move',
    notation: "R U R' U'",
    description: 'The trigger everything is built from',
    background: BACKGROUNDS.DAYCARE,
    difficulty: DIFFICULTY.TUTORIAL,
    previousLevel: null,
    title: 'The Trigger',
    text: 'Four moves. Right, Up, Right back, Up back. Speedcubers call it the sexy move and they run it thousands of times a day.',
    objective: "Perform R U R' U' — turn the right layer, the top, then both back.",
    tip: 'Right up, top left, right down, top right. It is one rhythm, not four decisions — let your hand learn the shape.',
    mobiLines: [
      'Every algorithm you will ever learn is built out of a handful of triggers.',
      "This is the first one. R U R' U' — four turns, and the cube almost returns to where it started.",
      'Almost. Run it six times and it comes all the way back. That is the loop we are going to live inside.',
    ],
    winMessage: 'The trigger is yours. Everything else is built from this. 🎯',
  }),

  algorithmLevel({
    id: 202,
    name: 'Sledgehammer',
    notation: "R' F R F'",
    description: 'The second primitive',
    background: BACKGROUNDS.ELEMENTARY,
    difficulty: DIFFICULTY.TUTORIAL,
    previousLevel: 201,
    title: 'Sledgehammer',
    text: "The other primitive. R' F R F' — the same shape as the trigger, swung on a different pair of faces.",
    objective: "Perform R' F R F'.",
    tip: 'It is the sexy move with the front face standing in for the top. Recognising that shape is most of learning algorithms.',
    mobiLines: [
      'Two triggers and you can already build most of the beginner method.',
      "Sledgehammer is R' F R F'. Notice it is the same gesture as the last one, just rotated onto another pair of faces.",
      'Algorithms are not memorised strings. They are shapes you learn to see.',
    ],
    winMessage: 'Two triggers down. You can build from here. 🔨',
  }),

  algorithmLevel({
    id: 203,
    name: 'The Insert',
    notation: "U R U' R'",
    description: 'Pairing and placing',
    background: BACKGROUNDS.MIDDLESCHOOL,
    difficulty: DIFFICULTY.EASY,
    previousLevel: 202,
    title: 'The Insert',
    text: "U R U' R' — the F2L insertion. This is the move that fills the first two layers, and it is where most of a real solve is spent.",
    objective: "Perform U R U' R'.",
    tip: 'The trigger, inverted and led with the top. It lifts a pair out, spins the top, and drops the pair back in place.',
    mobiLines: [
      'The first two layers are most of a solve, and this is how they get built.',
      "U R U' R' takes a corner and its edge, moves them out of the way, and puts them back together in the right slot.",
      'Speedcubers do not solve piece by piece. They solve in pairs.',
    ],
    winMessage: 'Pairs, not pieces. That is how solves get fast. 🧩',
  }),

  algorithmLevel({
    id: 204,
    name: 'Sune',
    notation: "R U R' U R U2 R'",
    description: 'The famous OLL',
    background: BACKGROUNDS.HIGHSCHOOL,
    difficulty: DIFFICULTY.EASY,
    previousLevel: 203,
    title: 'Sune',
    text: 'Sune. The best-known orientation case in cubing — it twists three corners and leaves everything else alone.',
    objective: "Perform R U R' U R U2 R'.",
    tip: 'It is the trigger, then the trigger again with a double turn on the end. Your first algorithm with a half turn in it.',
    mobiLines: [
      'Sune is the one everybody knows. Named by Lars Petrus, and it does exactly one job.',
      'Three corners twist. Nothing else moves. That surgical quality is what makes an algorithm worth memorising.',
      'It also has a half turn in it — U2 — which costs you two quarter turns. Par counts them honestly.',
    ],
    winMessage: 'Three corners, one algorithm, nothing else disturbed. ☀️',
  }),

  algorithmLevel({
    id: 205,
    name: 'Anti-Sune',
    notation: "R U2 R' U' R U' R'",
    description: 'Sune, the other way',
    background: BACKGROUNDS.COLLEGE,
    difficulty: DIFFICULTY.EASY,
    previousLevel: 204,
    title: 'Anti-Sune',
    text: 'Anti-Sune twists the same three corners the other way. Telling it apart from Sune at a glance is the real skill.',
    objective: "Perform R U2 R' U' R U' R'.",
    tip: 'The half turn moves to the front this time. If you run Sune on an Anti-Sune case you get a longer case, not a solved cube.',
    mobiLines: [
      'Sune and Anti-Sune are a pair, and this is where cubing stops being memorisation.',
      'The two cases look almost identical. Choosing correctly in under a second is what separates speeds.',
      'Recognition is the skill. The fingers are the easy part.',
    ],
    winMessage: 'You can tell them apart now. That is the hard half. 🌑',
  }),

  algorithmLevel({
    id: 206,
    name: 'Niklas',
    notation: "R U' L' U R' U' L",
    description: 'Your first commutator',
    background: BACKGROUNDS.JOB,
    difficulty: DIFFICULTY.MEDIUM,
    previousLevel: 205,
    title: 'Niklas',
    text: 'Niklas cycles three corners using both hands — and it is a commutator: do a thing, do another, undo the first, undo the second.',
    objective: "Perform R U' L' U R' U' L.",
    tip: 'Commutators are how almost every algorithm is actually derived. Once you see the pattern you can build your own.',
    mobiLines: [
      'This one is worth more than the moves in it.',
      'Niklas is a commutator — two operations that almost cancel, leaving a small clean change behind.',
      'Trace a closed loop and return changed. You have met that idea here before, under the name holonomy.',
    ],
    winMessage: 'Commutators unlocked. You can derive algorithms now, not just recall them. 🔁',
  }),

  algorithmLevel({
    id: 207,
    name: 'U-Perm',
    notation: "M2 U M U2 M' U M2",
    description: 'Three edges, one cycle',
    background: BACKGROUNDS.NASA,
    difficulty: DIFFICULTY.MEDIUM,
    previousLevel: 206,
    title: 'U-Perm',
    text: 'The first permutation most people learn. It cycles three edges — and it is built almost entirely from middle-slice turns.',
    objective: "Perform M2 U M U2 M' U M2.",
    tip: 'M is the slice between L and R. Slice moves carry the centres with them, which is why this one feels different in the hand.',
    mobiLines: [
      'Everything so far turned faces. This one turns the slice between them.',
      'Slice moves take the centres along for the ride — which is exactly why our own solver has to reorient the cube before it can think.',
      'Three edges rotate. Everything else stays exactly where it was.',
    ],
    winMessage: 'Three edges cycled with the slice. The centres came too. 🛰️',
  }),

  algorithmLevel({
    id: 208,
    name: 'T-Perm',
    notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
    description: 'The most-executed PLL',
    background: BACKGROUNDS.ROCKET,
    difficulty: DIFFICULTY.MEDIUM,
    previousLevel: 207,
    title: 'T-Perm',
    text: 'The T-Perm is probably the single most executed algorithm in the sport. Two corners swap, two edges swap, everything else holds.',
    objective: "Perform R U R' U' R' F R2 U' R' U' R U R' F'.",
    tip: 'It opens with the sexy move and closes with a sledgehammer. Every long algorithm is short ones stitched together.',
    mobiLines: [
      'Fourteen moves, and you already know the first four and the last four.',
      'The T-Perm opens with the trigger and closes with the sledgehammer. The middle is the part that does the work.',
      'This is why we started with triggers. Nobody memorises fifteen random turns.',
    ],
    winMessage: 'The most-run algorithm in cubing, executed clean. 🚀',
  }),

  algorithmLevel({
    id: 209,
    name: 'J-Perm',
    notation: "R U R' F' R U R' U' R' F R2 U' R'",
    description: 'T-Perm’s sibling',
    background: BACKGROUNDS.MOON,
    difficulty: DIFFICULTY.HARD,
    previousLevel: 208,
    title: 'J-Perm',
    text: 'The J-Perm swaps an adjacent pair instead of a diagonal one. Beside the T-Perm, the difference on the cube is two stickers.',
    objective: "Perform R U R' F' R U R' U' R' F R2 U' R'.",
    tip: 'Learn to spot the block of matching colours on the side faces. That block tells you which perm you are looking at.',
    mobiLines: [
      'T and J are a recognition pair, the same way Sune and Anti-Sune were.',
      'Two stickers is the entire difference between running the right algorithm and making things worse.',
      'You are not learning turns any more. You are learning to look.',
    ],
    winMessage: 'You read the case before you moved. That is a cuber. 🌙',
  }),

  algorithmLevel({
    id: 210,
    name: 'Superflip',
    notation: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    description: 'Every edge flipped — the furthest point from solved',
    background: BACKGROUNDS.BLACKHOLE,
    difficulty: DIFFICULTY.EXPERT,
    previousLevel: 209,
    title: 'Superflip',
    text: 'Every corner home. Every edge home. Every edge flipped. It is provably twenty moves from solved — no position on a 3×3 is further.',
    objective: 'Restore the cube from superflip: twenty moves, and no shortcut exists.',
    tip: 'Superflip is its own inverse. The sequence that made it will also undo it — run it again and the cube comes home.',
    mobiLines: [
      'This is the far side of the cube. Not a hard scramble — the hardest one there is.',
      'Twenty moves. God’s number. No position on a 3×3 is further from solved than this one.',
      'And look at what it is: every edge sitting in its own home, showing the wrong side.',
      'A whole cube of tiles that are exactly where they belong and still inverted. You have been playing with that idea since your first flip.',
    ],
    winMessage: 'YOU CAME BACK FROM SUPERFLIP. Twenty moves, the far edge of the cube. 🕳️',
  }),
];

export const getAlgorithmLevel = (id) => ALGORITHM_CODEX_LEVELS.find((l) => l.id === id) || null;
export const getAlgorithmLevelIds = () => ALGORITHM_CODEX_LEVELS.map((l) => l.id);
