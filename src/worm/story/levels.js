// Authored chapter one. Cosmetic IDs are shared with the existing Parity Store.
export const WORM_STORY_LEVELS = [
  { id: 1, cubeSize: 6, title: 'First Crawl', subtitle: 'The whole cube is your route.',
    goal: 'Collect 18 orbs, including all six colors, before time runs out.',
    kind: 'orbs', target: 18, colors: 6, speed: 1.5, par: 70, limit: 125, points: 25 },
  { id: 2, cubeSize: 6, title: 'Through the Looking Glass', subtitle: 'Four different ways through.',
    goal: 'Jump onto raised tunnel tiles to traverse four different pairs. The marker points to an unvisited pair. Clear your tail to finish.',
    kind: 'tunnel', target: 4, speed: 1.65, par: 95, limit: 165, points: 25 },
  { id: 3, cubeSize: 6, title: 'Clear Your Tail', subtitle: 'Lay your path. Cross it. Keep moving.',
    goal: 'Land four jumps over your own body and collect 12 orbs. Empty jumps do not count.',
    kind: 'jump', target: 4, orbs: 12, speed: 1.76, par: 105, limit: 180,
    reward: ['hat_party', 'hat_tophat'], rewardLabel: 'Choose a hat', fallback: 100 },
  { id: 4, cubeSize: 6, title: 'Moving Ground', subtitle: 'The route will not stay still.',
    goal: 'Collect 18 orbs and survive six layer turns. Turns keep coming until you finish.',
    kind: 'rotation', target: 6, orbs: 18, speed: 1.88, rotateEvery: 14, par: 130, limit: 205, points: 25 },
  { id: 5, cubeSize: 6, title: 'Color Collector', subtitle: 'Plan your colors while the cube shifts.',
    goal: 'Collect all six colors and heal four tunnel pairs while layers turn. Clear your tail to finish.',
    kind: 'collector', target: 4, colors: 6, speed: 2.06, rotateEvery: 14, par: 165, limit: 260,
    reward: ['scheme_forest', 'scheme_tropical'], rewardLabel: 'Choose a palette', fallback: 100 },
  { id: 6, cubeSize: 6, title: 'Restore the Cube', subtitle: 'Bring every skill. Leave no tunnel open.',
    goal: 'Heal six tunnel pairs, collect 30 orbs and survive six turns. Clear your tail before the clock runs out.',
    kind: 'restore', target: 6, orbs: 30, rotations: 6, speed: 2.25, rotateEvery: 11, par: 220, limit: 340,
    reward: ['skin_royal', 'skin_ocean'], rewardLabel: 'Choose a skin', fallback: 150 },
  { id: 7, cubeSize: 6, title: 'Full Throttle', subtitle: 'Own the air. Control the landing.',
    goal: 'Finish two boosts, land two double jumps and a rocket flight, attract four remote orbs with a magnet, collect 24 orbs and heal two pairs.',
    kind: 'mastery', target: 2, orbs: 24, speed: 2.25, rotateEvery: 13, par: 230, limit: 380,
    mechanics: { boosts: 2, doubleJumps: 2, rockets: 1, magnetOrbs: 4 },
    reward: ['trail_comet', 'trail_circuit'], rewardLabel: 'Choose a trail', fallback: 200 },
  { id: 8, cubeSize: 6, title: 'Force of Nature', subtitle: 'Collect two elemental powers.',
    goal: 'Pick up 2 elemental orbs. Collect 24 orbs and heal three pairs while layers turn. Steer onto each marked elemental orb to claim it.',
    kind: 'mastery', target: 3, orbs: 24, speed: 2.25, rotateEvery: 13, par: 300, limit: 475,
    mechanics: { elementPickups: 2 },
    reward: ['scheme_aurora', 'scheme_cosmic'], rewardLabel: 'Choose a palette', fallback: 150 },
  { id: 9, cubeSize: 6, title: 'Under Siege', subtitle: 'Fight. Encircle. Turn danger into a route.',
    goal: 'Surround a tunnel to heal it, use your ability twice, disarm one bomb by encircling it, defeat one enemy, collect 24 orbs and restore four pairs. Tunnel deposits seal after the surround and ability tasks.',
    kind: 'mastery', target: 4, orbs: 24, speed: 2.25, rotateEvery: 14, par: 325, limit: 515,
    mechanics: { ringHeals: 1, signatures: 2, bombs: 1, kills: 1 },
    reward: ['hat_crown', 'hat_wizard'], rewardLabel: 'Choose a hat', fallback: 150 },
  { id: 10, cubeSize: 6, title: 'Worm Ascendant', subtitle: 'A final lap. Four clear goals.',
    goal: 'Collect 24 orbs, heal three tunnel pairs, survive four layer turns and defeat one enemy. Orbs keep returning; clear your tail to finish.',
    kind: 'mastery', target: 3, orbs: 24, rotations: 4, speed: 2.25, rotateEvery: 14, par: 220, limit: 380,
    mechanics: { kills: 1 },
    reward: ['skin_gold', 'skin_galaxy'], rewardLabel: 'Choose a champion skin', fallback: 300 },

  // ── Chapter 2 · Every Size ───────────────────────────────────────────────
  // The same crawl on every board from the 2×2 pocket cube to 8×8, with the
  // cube's alternate views (grid, numbers, glass, chrome, gap, neon) and the
  // explode power introduced along the way.
  { id: 11, title: 'Pocket Crawl', subtitle: 'The smallest cube. Every tile is a corner.', cubeSize: 2,
    goal: 'Collect 10 orbs, including all 6 colors, on the 2×2 pocket cube.',
    kind: 'orbs', target: 10, colors: 6, orbsPerFace: 2, speed: 1.2, par: 70, limit: 125, points: 30 },
  { id: 12, title: 'Grid Lines', subtitle: 'Every tile wears its address.', cubeSize: 3,
    goal: 'Jump onto raised tunnel tiles to cross 3 different pairs on a 3×3 cube in Grid view. Clear your tail to finish.',
    kind: 'tunnel', target: 3, orbsPerFace: 3, speed: 1.5, par: 90, limit: 165, points: 30 },
  { id: 13, title: 'Numbers Underfoot', subtitle: 'Numbers instead of colors. Same jumps.', cubeSize: 4,
    goal: 'Land 3 jumps over your own body and collect 10 orbs on a 4×4 cube in Numbers view.',
    kind: 'jump', target: 3, orbs: 10, speed: 2.03, par: 90, limit: 165,
    reward: ['hat_beanie', 'hat_flower'], rewardLabel: 'Choose a hat', fallback: 120 },
  { id: 14, title: 'Glass Carousel', subtitle: 'A see-through cube that will not sit still.', cubeSize: 3,
    goal: 'Collect 12 orbs and survive 5 layer turns on a 3×3 glass cube. Turns come every 13 seconds.',
    kind: 'rotation', target: 5, orbs: 12, orbsPerFace: 3, speed: 1.58, rotateEvery: 13, par: 110, limit: 190, points: 30 },
  { id: 15, title: 'Chrome Works', subtitle: 'Six faces wide, polished to a mirror.', cubeSize: 6,
    goal: 'Collect all 6 colors and heal 4 tunnel pairs on a 6×6 chrome cube while layers turn. Clear your tail to finish.',
    kind: 'collector', target: 4, colors: 6, speed: 2.25, rotateEvery: 14, par: 180, limit: 285,
    reward: ['scheme_gemstone', 'scheme_noire'], rewardLabel: 'Choose a palette', fallback: 120 },
  { id: 16, title: 'Mind the Gap', subtitle: 'Seven layers, and space between every piece.', cubeSize: 7,
    goal: 'Heal 5 tunnel pairs, collect 24 orbs and survive 5 turns on a 7×7 cube in Gap view. Clear your tail to finish.',
    kind: 'restore', target: 5, orbs: 24, rotations: 5, speed: 2.33, rotateEvery: 13, par: 245, limit: 395, points: 35 },
  { id: 17, title: 'Launch Pad', subtitle: 'Boost, bounce and fly on a tight board.', cubeSize: 4,
    goal: 'Finish 2 boosts, land 2 double jumps and 1 rocket flight, collect 14 orbs and heal 2 pairs on a 4×4 cube.',
    kind: 'mastery', target: 2, orbs: 14, speed: 2.25, par: 165, limit: 285,
    mechanics: { boosts: 2, doubleJumps: 2, rockets: 1 },
    reward: ['trail_ember', 'trail_frost'], rewardLabel: 'Choose a trail', fallback: 150 },
  { id: 18, title: 'Blast Radius', subtitle: 'Pull the cube apart and keep crawling.', cubeSize: 6,
    goal: 'Ride out 2 explosions, collect 20 orbs and heal 3 pairs on a 6×6 cube. Steer onto the marked explode orb to split the cube.',
    kind: 'mastery', target: 3, orbs: 20, speed: 2.33, rotateEvery: 15, par: 230, limit: 380,
    mechanics: { explodes: 2 },
    reward: ['skin_lava', 'skin_ice'], rewardLabel: 'Choose a skin', fallback: 150 },
  { id: 19, title: 'Neon Arcade', subtitle: 'Eight layers of light. Six ways through.', cubeSize: 8,
    goal: 'Cross 6 different tunnel pairs on an 8×8 neon cube. Clear your tail to finish.',
    kind: 'tunnel', target: 6, speed: 2.4, par: 205, limit: 340, points: 35 },
  { id: 20, title: 'Size Summit', subtitle: 'The biggest board yet. Every tool you own.', cubeSize: 8,
    goal: 'Ride out an explosion, land a rocket flight, catch 4 remote orbs with a magnet, collect 2 elemental orbs and use your ability once. Collect 30 orbs, survive 6 turns and heal 4 pairs on an 8×8 cube.',
    kind: 'mastery', target: 4, orbs: 30, rotations: 6, speed: 2.4, rotateEvery: 13, par: 405, limit: 625,
    mechanics: { explodes: 1, rockets: 1, magnetOrbs: 4, elementPickups: 2, signatures: 1 },
    reward: ['accessory_knittedScarf', 'accessory_leafCape'], rewardLabel: 'Choose an accessory', fallback: 250 },

  // ── Chapter 3 · Strange Views ────────────────────────────────────────────
  // The cube stops looking like a cube: hollow frames, bare wireframe, bricks,
  // biomes, the far-side window and Random's constant remix.
  { id: 21, title: 'Hollow Hills', subtitle: 'Every piece is an open frame.', cubeSize: 5,
    goal: 'Collect 20 orbs, including all 6 colors, on a hollow 5×5 cube.',
    kind: 'orbs', target: 20, colors: 6, speed: 2.33, par: 85, limit: 150, points: 35 },
  { id: 22, title: 'Ghost Frame', subtitle: 'No stickers. Only edges and tunnels.', cubeSize: 5,
    goal: 'Cross 4 different tunnel pairs on a 5×5 wireframe cube. The edges still show each face’s color. Clear your tail to finish.',
    kind: 'tunnel', target: 4, speed: 2.33, par: 110, limit: 190, points: 35 },
  { id: 23, title: 'Brick by Brick', subtitle: 'A toy-brick cube with your tail across it.', cubeSize: 4,
    goal: 'Land 4 jumps over your own body and collect 12 orbs on a 4×4 brick cube.',
    kind: 'jump', target: 4, orbs: 12, speed: 2.1, par: 110, limit: 190,
    reward: ['hat_acorn', 'hat_toadstool'], rewardLabel: 'Choose a hat', fallback: 150 },
  { id: 24, title: 'Biome Crossing', subtitle: 'Lava, grass, ice and water faces.', cubeSize: 6,
    goal: 'Collect 3 elemental orbs, 18 orbs and heal 3 pairs on a 6×6 Biome cube while layers turn. Steer onto each marked elemental orb to claim it.',
    kind: 'mastery', target: 3, orbs: 18, speed: 2.4, rotateEvery: 14, par: 300, limit: 460,
    mechanics: { elementPickups: 3 }, points: 40 },
  { id: 25, title: 'The Far Side', subtitle: 'Watch where your twins land.', cubeSize: 5,
    goal: 'Heal 4 tunnel pairs, collect 20 orbs and survive 4 turns on a 5×5 cube. The far-side window shows the opposite face. Clear your tail to finish.',
    kind: 'restore', target: 4, orbs: 20, rotations: 4, speed: 2.4, rotateEvery: 13, par: 205, limit: 340,
    reward: ['scheme_eclipse', 'scheme_midnight'], rewardLabel: 'Choose a palette', fallback: 150 },
  { id: 26, title: 'Remix', subtitle: 'The colors and tiles change every 10 seconds.', cubeSize: 5,
    goal: 'Collect 18 orbs and survive 6 layer turns on a 5×5 cube in Random mode. The look changes; the faces do not.',
    kind: 'rotation', target: 6, orbs: 18, speed: 2.4, rotateEvery: 11, par: 125, limit: 220, points: 40 },
  { id: 27, title: 'Neon Storm', subtitle: 'Master three elements under neon light.', cubeSize: 6,
    goal: 'Master water, fire and grass, collect 20 orbs and heal 3 pairs on a 6×6 neon cube.',
    kind: 'mastery', target: 3, orbs: 20, speed: 2.47, rotateEvery: 14, par: 325, limit: 515,
    mechanics: { elements: 3 },
    reward: ['trail_nebula', 'trail_prism'], rewardLabel: 'Choose a trail', fallback: 200 },
  { id: 28, title: 'Shatterglass', subtitle: 'Blow the glass cube apart, then fly.', cubeSize: 7,
    goal: 'Ride out 2 explosions, land a rocket flight, collect 24 orbs and heal 3 pairs on a 7×7 glass cube.',
    kind: 'mastery', target: 3, orbs: 24, speed: 2.47, rotateEvery: 14, par: 315, limit: 490,
    mechanics: { explodes: 2, rockets: 1 },
    reward: ['skin_coral', 'skin_emerald'], rewardLabel: 'Choose a skin', fallback: 200 },
  { id: 29, title: 'Number Siege', subtitle: 'Fight across a cube of numbers.', cubeSize: 7,
    goal: 'Surround a tunnel to heal it, use your ability once, disarm 1 bomb, defeat 2 enemies, collect 24 orbs and restore 4 pairs on a 7×7 cube in Numbers view. Tunnel deposits seal after the surround and ability tasks.',
    kind: 'mastery', target: 4, orbs: 24, speed: 2.47, rotateEvery: 14, par: 355, limit: 540,
    mechanics: { ringHeals: 1, signatures: 1, bombs: 1, kills: 2 }, points: 45 },
  { id: 30, title: 'Kaleidoscope', subtitle: 'Every view at once, and it keeps changing.', cubeSize: 6,
    goal: 'Master 3 elements (water, fire and grass), ride out an explosion, land 2 double jumps and catch 4 remote orbs with a magnet. Collect 30 orbs, survive 6 turns and heal 5 pairs on a 6×6 cube in Random mode.',
    kind: 'mastery', target: 5, orbs: 30, rotations: 6, speed: 2.55, rotateEvery: 11, par: 490, limit: 730,
    mechanics: { elements: 3, explodes: 1, doubleJumps: 2, magnetOrbs: 4 },
    reward: ['skin_void', 'skin_sunset'], rewardLabel: 'Choose a champion skin', fallback: 300 },

  // ── Chapter 4 · Grand Crawl ──────────────────────────────────────────────
  // Nine, ten and fifteen layers; the smallest cube at full speed; every view
  // and power combined, with shorter clocks and faster turns.
  { id: 31, title: 'Nine Lives', subtitle: 'Nine layers. Six colors. Keep your tail.', cubeSize: 9,
    goal: 'Collect 36 orbs, including all 6 colors, on a 9×9 cube.',
    kind: 'orbs', target: 36, colors: 6, speed: 2.55, par: 180, limit: 300, points: 45 },
  { id: 32, title: 'Tenfold Tunnels', subtitle: 'Six ways through a ten-layer cube.', cubeSize: 10,
    goal: 'Cross 6 different tunnel pairs on a 10×10 cube. Clear your tail to finish.',
    kind: 'tunnel', target: 6, speed: 2.47, par: 230, limit: 380, points: 45 },
  { id: 33, title: 'Knife Edge', subtitle: 'The pocket cube, turning every 7 seconds.', cubeSize: 2,
    goal: 'Collect 10 orbs and survive 8 layer turns on a 2×2 cube in Gap view. Turns come every 7 seconds.',
    kind: 'rotation', target: 8, orbs: 10, orbsPerFace: 2, speed: 1.42, rotateEvery: 10, par: 125, limit: 205,
    reward: ['hat_halo', 'hat_grad'], rewardLabel: 'Choose a hat', fallback: 200 },
  { id: 34, title: 'Chrome Gauntlet', subtitle: 'Nine polished layers that never stop turning.', cubeSize: 9,
    goal: 'Heal 6 tunnel pairs, collect 30 orbs and survive 6 turns on a 9×9 chrome cube. Turns come every 7 seconds. Clear your tail to finish.',
    kind: 'restore', target: 6, orbs: 30, rotations: 6, speed: 2.47, rotateEvery: 10, par: 355, limit: 540, points: 50 },
  { id: 35, title: 'Hollow Siege', subtitle: 'Enemies and bombs inside an open frame.', cubeSize: 8,
    goal: 'Surround a tunnel to heal it, use your ability twice, disarm 2 bombs, defeat 3 enemies, collect 24 orbs and restore 4 pairs on a hollow 8×8 cube. Tunnel deposits seal after the surround and ability tasks.',
    kind: 'mastery', target: 4, orbs: 24, speed: 2.55, rotateEvery: 14, par: 405, limit: 625,
    mechanics: { ringHeals: 1, signatures: 2, bombs: 2, kills: 3 },
    reward: ['skin_toxic', 'skin_bubble'], rewardLabel: 'Choose a skin', fallback: 250 },
  { id: 36, title: 'Ghost Storm', subtitle: 'Four elements on a cube with no stickers.', cubeSize: 6,
    goal: 'Collect 4 elemental orbs, 20 orbs and heal 3 pairs on a 6×6 wireframe cube while layers turn every 8 seconds.',
    kind: 'mastery', target: 3, orbs: 20, speed: 2.55, rotateEvery: 11, par: 340, limit: 515,
    mechanics: { elementPickups: 4 },
    reward: ['accessory_buttonGoggles', 'accessory_crookedBow'], rewardLabel: 'Choose an accessory', fallback: 250 },
  { id: 37, title: 'Brick Blast', subtitle: 'Ten layers of bricks, blown apart three times.', cubeSize: 10,
    goal: 'Ride out 3 explosions, land 2 rocket flights, collect 30 orbs and heal 4 pairs on a 10×10 brick cube.',
    kind: 'mastery', target: 4, orbs: 30, speed: 2.47, rotateEvery: 14, par: 450, limit: 675,
    mechanics: { explodes: 3, rockets: 2 }, points: 60 },
  { id: 38, title: 'Mirror Numbers', subtitle: 'Numbers on this side. Twins on the far side.', cubeSize: 7,
    goal: 'Heal 6 tunnel pairs, collect 30 orbs and survive 8 turns on a 7×7 cube in Numbers view with the far-side window open. Turns come every 6 seconds. Clear your tail to finish.',
    kind: 'restore', target: 6, orbs: 30, rotations: 8, speed: 2.47, rotateEvery: 8, par: 340, limit: 515,
    reward: ['scheme_inkwell', 'scheme_vaporwave'], rewardLabel: 'Choose a palette', fallback: 250 },
  { id: 39, title: 'Mega Crawl', subtitle: 'Fifteen layers. The largest cube there is.', cubeSize: 15,
    goal: 'Collect 40 orbs, including all 6 colors, on the 15×15 mega cube.',
    kind: 'orbs', target: 40, colors: 6, speed: 2.62, par: 355, limit: 570, points: 75 },
  { id: 40, title: 'Worm Eternal', subtitle: 'Every size of trouble, every trick, one remixing cube.', cubeSize: 10,
    goal: 'Master all 5 elements, ride out 2 explosions, boost twice, land 2 double jumps and a rocket flight, catch 4 remote orbs, surround a tunnel, use your ability twice, disarm 2 bombs and defeat 6 enemies. Collect 40 orbs, survive 10 turns and restore all 6 pairs on a 10×10 cube in Random mode. Surround and ability tasks unlock tunnel sealing.',
    kind: 'mastery', target: 6, orbs: 40, rotations: 10, speed: 2.55, rotateEvery: 10, par: 650, limit: 975,
    mechanics: { ringHeals: 1, signatures: 2, boosts: 2, doubleJumps: 2, rockets: 1, magnetOrbs: 4, explodes: 2, elements: 5, bombs: 2, kills: 6 },
    reward: ['skin_mono', 'skin_cherry'], rewardLabel: 'Choose a grandmaster skin', fallback: 500 },
];
// Ten levels to a chapter. Unlocks stay linear across chapter boundaries: the
// first level of a chapter opens when the last level of the one before is cleared.
export const STORY_CHAPTER_SIZE = 10;
export const WORM_STORY_CHAPTERS = [
  { id: 1, title: 'Hatchling', blurb: 'Learn to crawl, jump, heal and fight on a classic six-color cube.' },
  { id: 2, title: 'Every Size', blurb: 'From the 2×2 pocket cube to 8×8, in grid, number, glass, chrome, gap and neon views.' },
  { id: 3, title: 'Strange Views', blurb: 'Hollow frames, bare wireframe, bricks, biomes, the far side and Random’s remix.' },
  { id: 4, title: 'Grand Crawl', blurb: 'Nine, ten and fifteen layers. Every view and power, on shorter clocks.' },
].map(chapter => ({ ...chapter, levels: WORM_STORY_LEVELS.filter(level => storyChapterId(level.id) === chapter.id) }));
export function storyChapterId(id) { return Math.ceil(id / STORY_CHAPTER_SIZE); }
export const storyChapter = id => WORM_STORY_CHAPTERS.find(chapter => chapter.id === storyChapterId(id)) ?? null;
// Position within the chapter, 1-10.
export const storyChapterIndex = id => ((id - 1) % STORY_CHAPTER_SIZE) + 1;
export const isChapterFinale = id => storyChapterIndex(id) === STORY_CHAPTER_SIZE || id === WORM_STORY_LEVELS.at(-1).id;
// Everything a launch needs from a level, so every entry point starts it the
// same way (the 15×15 board also needs Mega's lighter effects tier).
export const storyLaunchSettings = level => ({ storyLevel: level.id, cubeSize: level.cubeSize ?? 5, megaMode: (level.cubeSize ?? 5) >= 15,
  wormSpeed: level.speed, wormOrbCount: 1, wormholeInterval: 30, wormCombatMode: false, wormEnemiesEnabled: false });
export const STORY_MECHANIC_LABELS = { boosts: 'boosts finished', doubleJumps: 'double jumps landed', rockets: 'rocket landings',
  magnetOrbs: 'remote magnet catches', explodes: 'explosions ridden out', elements: 'elements mastered', elementPickups: 'elemental orbs collected', ringHeals: 'ring heals', signatures: 'signatures used', bombs: 'bombs disarmed', kills: 'enemies defeated' };
// A repeating authored cycle spans all axes and includes central layers. Retain
// the normal warning and collision transaction; never steer hazards at the head.
export const storyRotationCycle = size => [
  { axis: 'col', sliceIndex: 0, dir: 1 },
  { axis: 'row', sliceIndex: Math.floor(size / 2), dir: -1 },
  { axis: 'depth', sliceIndex: size - 1, dir: 1 },
  { axis: 'col', sliceIndex: Math.floor(size / 2), dir: -1 },
  { axis: 'row', sliceIndex: size - 1, dir: 1 },
  { axis: 'depth', sliceIndex: 0, dir: -1 },
];
export const storyLevel = id => WORM_STORY_LEVELS.find(level => level.id === id) ?? null;
export const storyStars = (progress, id) => progress?.wormStory?.stars?.[id] || 0;
export const storyUnlocked = (progress, id) => !!storyLevel(id) && (id === 1 || storyStars(progress, id - 1) > 0);
export const nextStoryLevel = progress => WORM_STORY_LEVELS.find(level => !storyStars(progress, level.id)) ?? WORM_STORY_LEVELS.at(-1);
export function sanitizeStoryProgress(raw) {
  const result = { stars: {}, claimed: {} };
  for (const level of WORM_STORY_LEVELS) {
    const stars = raw?.stars?.[level.id];
    // Invalid/gapped progress cannot unlock later chapters or reward claims.
    if (!Number.isInteger(stars) || stars < 1 || stars > 3 || (level.id > 1 && !result.stars[level.id - 1])) break;
    result.stars[level.id] = stars;
    const claim = raw?.claimed?.[level.id];
    if (level.reward && (claim === 'points' || level.reward.includes(claim))) result.claimed[level.id] = claim;
  }
  return result;
}
export function storyOutcome(level, metrics) {
  if (!level || !metrics.alive || !Number.isFinite(metrics.elapsed) || metrics.elapsed <= 0 || metrics.elapsed > level.limit) return null;
  if ((metrics.orbs ?? 0) < (level.orbs ?? 0) || (metrics.colors ?? 0) < (level.colors ?? 0) ||
      (metrics.rotations ?? 0) < (level.rotations ?? 0)) return null;
  if (Object.entries(level.mechanics ?? {}).some(([key, target]) => (metrics[key] ?? 0) < target)) return null;
  if (level.mechanics && !metrics.landed) return null;
  const complete = level.kind === 'orbs' ? metrics.orbs >= level.target
    : level.kind === 'tunnel' ? metrics.uniqueTunnels >= level.target && metrics.tailClear
    : level.kind === 'jump' ? metrics.bodyJumps >= level.target && metrics.landed
    : level.kind === 'rotation' ? metrics.rotations >= level.target && metrics.rotationSettled
    : metrics.healed >= level.target && metrics.remaining === 0 && metrics.tailClear && metrics.rotationSettled;
  if (!complete) return null;
  return { stars: 1 + Number(metrics.elapsed <= level.par) + Number(metrics.cuts === 0), seconds: Math.ceil(metrics.elapsed) };
}

export function storyProgressText(level, metrics) {
  const count = (n, target, label) => `${Math.min(n || 0, target)}/${target} ${label}`;
  if (level.mechanics) {
    const goals = [...Object.entries(level.mechanics), ['healed', level.target], ['orbs', level.orbs], ...(level.rotations ? [['rotations', level.rotations]] : [])];
    const missing = goals.filter(([key, target]) => (metrics[key] ?? 0) < target);
    const next = missing[0];
    return `${goals.length - missing.length}/${goals.length} goals · ${next ? count(metrics[next[0]], next[1], STORY_MECHANIC_LABELS[next[0]] ?? { healed: 'pairs healed', orbs: 'orbs', rotations: 'turns' }[next[0]]) : 'Clear your tail and land'}${metrics.powerHint ? ` · ${metrics.powerHint}` : ''} · ${Math.max(0, Math.ceil(level.limit - metrics.elapsed))}s left`;
  }
  const parts = [count(level.kind === 'orbs' ? metrics.orbs : level.kind === 'tunnel' ? metrics.uniqueTunnels
    : level.kind === 'jump' ? metrics.bodyJumps : level.kind === 'rotation' ? metrics.rotations : metrics.healed,
  level.target, { orbs: 'orbs', tunnel: 'pairs crossed', jump: 'body jumps', rotation: 'turns', collector: 'pairs healed', restore: 'pairs healed' }[level.kind])];
  if (level.orbs) parts.push(count(metrics.orbs, level.orbs, 'orbs'));
  if (level.colors) parts.push(count(metrics.colors, level.colors, 'colors'));
  if (level.rotations) parts.push(count(metrics.rotations, level.rotations, 'turns'));
  if (!metrics.tailClear && ['tunnel', 'collector', 'restore'].includes(level.kind)) parts.push('Tail in transit');
  parts.push(`${Math.max(0, Math.ceil(level.limit - metrics.elapsed))}s left`);
  return parts.join(' · ');
}

// Shared objective data for the preflight checklist and live completion marks.
export function storyChecklist(level, metrics = {}) {
  const primary = { orbs: 'orbs', tunnel: 'uniqueTunnels', jump: 'bodyJumps', rotation: 'rotations' }[level.kind] ?? 'healed';
  const targets = { ...level.mechanics, [primary]: level.target };
  for (const key of ['orbs', 'colors', 'rotations']) if (level[key]) targets[key] = level[key];
  const labels = { boosts: 'Finish boosts', doubleJumps: 'Land double-jumps', rockets: 'Land a rocket flight',
    magnetOrbs: 'Catch orbs with a magnet', explodes: 'Ride out an explosion', elements: 'Use each element', elementPickups: 'Pick up elemental orbs', ringHeals: 'Surround a tunnel',
    signatures: 'Use your ability', bombs: 'Disarm bombs', kills: 'Defeat enemies',
    orbs: 'Collect orbs', colors: "Collect each color", uniqueTunnels: "Cross tunnel pairs",
    bodyJumps: 'Jump over your body', rotations: 'Survive layer turns', healed: 'Heal tunnel pairs' };
  return Object.entries(targets).map(([key, target]) => {
    const value = Math.min(target, Math.max(0, metrics[key] ?? 0));
    return { key, label: labels[key], value, target, done: value >= target };
  });
}
