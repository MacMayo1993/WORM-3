/**
 * CUBE Campaign: progressive 3×3 lessons for learning slice rotations and flips.
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

const cubeTags = [LEVEL_TAGS.TUTORIAL, LEVEL_TAGS.PUZZLE];

export const CUBE_CAMPAIGN_LEVELS = [
  createLevel({
    id: 1,
    name: 'The Middle Layer',
    description: 'One middle-layer turn is out of place. Spin it back.',
    cubeSize: 3,
    // Deterministic teaching scramble: a single turn of the middle horizontal
    // layer. The whole level is solved by rotating that one layer back.
    scrambleSequence: [{ axis: 'row', sliceIndex: 1, dir: 1 }],
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.DAYCARE,
    features: { rotations: true, tunnels: false, flips: false, chaos: false, explode: false, parity: false, net: false },
    tutorial: {
      title: 'CUBE 1: The Middle Layer',
      text: 'This is a real 3×3 cube, but only the middle layer is out of place. Turn it back to solve the whole cube.',
      tip: 'Grab any tile on the middle horizontal band and rotate that layer until the colors line up again.',
      mobiLines: [
        "Aloha! I'm a Multi Orientable Block Intelligence...",
        "...but you can call me Mobi for short!",
        "Welcome to your very first cube. Take a breath — this one is easy.",
        "I gave the middle layer a single twist. That's the only thing out of place.",
        "Your one job: rotate that middle band back until every face lines up.",
        "Grab a middle tile, spin the layer the other way, and you've solved it. Let's go!",
      ],
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'That\'s it! One clean middle-layer turn and the cube is solved.',
    difficulty: DIFFICULTY.TUTORIAL,
    tags: cubeTags,
    requirements: { previousLevel: null, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 2,
    name: 'Through the Cube',
    description: 'Every center shows its antipodal twin. Flip them back through the cube.',
    cubeSize: 3,
    // The cube is solved EXCEPT all six face centers show their antipodal color.
    // flipStickerPair flips a sticker AND its antipodal partner, so flipping the three
    // "near" centers (front/right/top) during setup flips all six centers. The player
    // then flips those same three back — three flips fixes all six.
    flipSequence: [
      { x: 1, y: 1, z: 2, dirKey: 'PZ' }, // front center  (also flips back center)
      { x: 2, y: 1, z: 1, dirKey: 'PX' }, // right center  (also flips left center)
      { x: 1, y: 2, z: 1, dirKey: 'PY' }, // top center    (also flips bottom center)
    ],
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.ELEMENTARY,
    features: { rotations: true, tunnels: true, flips: true, chaos: false, explode: false, parity: false, net: false },
    tutorial: {
      title: 'CUBE 2: Through the Cube',
      text: 'This cube is already solved — except every center tile shows its antipodal twin, the color from the opposite side. Tapping a center flips it straight through the cube and back. Fix the three odd center pairs to solve it.',
      tip: 'Tap a mismatched center. Each flip travels through the cube and fixes the opposite center too — so three taps cleans up all six. Only tap centers that still look wrong.',
      mobiLines: [
        "Back again! Ready to learn the cube's secret shortcut?",
        "Every center tile is showing the color from the OPPOSITE side of the cube.",
        "That's a flip — the tile folded straight through the manifold to its antipodal twin.",
        "Tap a wrong-looking center and watch: it flips back... and so does the center across from it!",
        "Two centers fixed per tap. Three taps total and the whole cube snaps solved.",
        "Go on — flip them home. This is the move that makes WORM³ special.",
      ],
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'Three flips, six centers home — flips can solve the cube too!',
    difficulty: DIFFICULTY.TUTORIAL,
    tags: cubeTags,
    requirements: { previousLevel: 1, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 3,
    name: 'First Flip',
    description: 'Introduce antipodal flips without chaos pressure.',
    cubeSize: 3,
    scrambleMoves: 4,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.MIDDLESCHOOL,
    features: { rotations: true, tunnels: true, flips: true, chaos: false, explode: false, parity: false, net: false },
    tutorial: {
      title: 'CUBE 3: First Flip',
      text: 'Flip mode is now enabled. A flip links a sticker through the cube to its antipodal partner, teaching how WORM³ folds the cube through itself.',
      tip: 'Use flips as a learning tool first: click a sticker, then look for the paired change across the cube.',
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'You used the cube seam without getting lost.',
    difficulty: DIFFICULTY.EASY,
    tags: cubeTags,
    requirements: { previousLevel: 2, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 4,
    name: 'Flip Pairs',
    description: 'Learn opposite-face relationships on a 3×3.',
    cubeSize: 3,
    scrambleMoves: 6,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.HIGHSCHOOL,
    features: { rotations: true, tunnels: true, flips: true, chaos: false, explode: true, parity: true, net: false },
    tutorial: {
      title: 'CUBE 4: Flip Pairs',
      text: 'Parity indicators and explode view are unlocked so you can inspect where flipped stickers live. This is the sandbox for understanding paired tiles.',
      tip: 'Toggle explode view if the cube feels crowded; separated cubies make opposite relationships easier to read.',
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'Flip pairs clicked into place.',
    difficulty: DIFFICULTY.EASY,
    tags: cubeTags,
    requirements: { previousLevel: 3, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 5,
    name: 'Guided Mini Solve',
    description: 'A modest 3×3 solve with all learning views available.',
    cubeSize: 3,
    scrambleMoves: 8,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.COLLEGE,
    features: { rotations: true, tunnels: true, flips: true, chaos: false, explode: true, parity: true, net: true },
    tutorial: {
      title: 'CUBE 5: Guided Mini Solve',
      text: 'Net view joins the toolkit. You now have rotation, flip, parity, explode, and net views for a short but real 3×3 solve.',
      tip: 'Use net view to plan, then return to the cube to execute turns and flips.',
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'That was a real 3×3 solve path.',
    difficulty: DIFFICULTY.MEDIUM,
    tags: cubeTags,
    requirements: { previousLevel: 4, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 6,
    name: 'CUBE Graduation',
    description: 'A longer 3×3 practice level before freeplay.',
    cubeSize: 3,
    scrambleMoves: 12,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.NASA,
    features: { rotations: true, tunnels: true, flips: true, chaos: false, explode: true, parity: true, net: true },
    tutorial: {
      title: 'CUBE 6: Graduation',
      text: 'This final campaign level is longer, but still calmer than freeplay. Solve it to prove you understand 3×3 turns and how flips travel through the cube.',
      tip: 'When stuck, isolate one face, then use flips to reason about the opposite face instead of guessing.',
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'CUBE Campaign complete — you are ready for Rubik\'s freeplay.',
    difficulty: DIFFICULTY.MEDIUM,
    tags: cubeTags,
    requirements: { previousLevel: 5, stars: 0, achievements: [] },
  }),
];

export const getCubeCampaignLevel = (id) => CUBE_CAMPAIGN_LEVELS.find((level) => level.id === id);
