/**
 * CUBE Campaign: progressive 3×3 lessons for learning slice rotations and flips.
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

const cubeTags = [LEVEL_TAGS.TUTORIAL, LEVEL_TAGS.PUZZLE];

export const CUBE_CAMPAIGN_LEVELS = [
  createLevel({
    id: 101,
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
        "Welcome to your very first cube. Take a breath. This one is easy.",
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
    id: 102,
    name: 'Through the Cube',
    description: 'The middle tile of each side is wrong. Tap them to flip the colors back.',
    cubeSize: 3,
    // The cube is solved EXCEPT all six face centers show their antipodal color.
    // flipStickerPair flips a sticker AND its antipodal partner, so flipping the three
    // "near" centers (front/right/top) during setup flips all six centers. The player
    // then flips those same three back, so three flips fix all six.
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
      text: 'This cube is almost solved. Only the six middle tiles are wrong, one in the center of each side. Each one shows the color from the other side of the cube. Tap a wrong middle tile to flip it back. The matching tile on the far side flips back too, so three taps fix all six.',
      tip: 'Tapping is already turned on, so just tap. Tap only the middle tiles that still look wrong. Each tap fixes two tiles at once, so you only need three taps.',
      mobiLines: [
        "Welcome back! Last time you turned a layer. Now let's try something new.",
        "Look closely. This cube is almost solved. Every side is one color.",
        "But the tile in the middle of each side is the wrong color. There are six of them.",
        "Each middle tile is showing the color from the other side of the cube.",
        "You can fix it with a flip. A flip sends a tile through the cube to the other side.",
        "Just tap a middle tile. You do not need any buttons. Tapping is already turned on.",
        "When you tap one, it flips back. The matching tile on the far side flips back too!",
        "So you only need three taps. Each tap fixes two tiles at once.",
        "Tap the middle tiles that still look wrong. Leave the ones that already match.",
        "Try your first flip now. This is the special move that makes this game fun!",
      ],
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: 'Three taps, six tiles fixed. Now you know how to flip!',
    difficulty: DIFFICULTY.TUTORIAL,
    tags: cubeTags,
    requirements: { previousLevel: 101, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 103,
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
    requirements: { previousLevel: 102, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 104,
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
    requirements: { previousLevel: 103, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 105,
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
    requirements: { previousLevel: 104, stars: 0, achievements: [] },
  }),
  createLevel({
    id: 106,
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
    winMessage: 'CUBE Campaign complete. You are ready for Rubik\'s freeplay.',
    difficulty: DIFFICULTY.MEDIUM,
    tags: cubeTags,
    requirements: { previousLevel: 105, stars: 0, achievements: [] },
  }),
];

export const getCubeCampaignLevel = (id) => CUBE_CAMPAIGN_LEVELS.find((level) => level.id === id);
