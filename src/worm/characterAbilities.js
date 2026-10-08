// Central balance values shared by simulation, rewards and character descriptions.
export const BOOK_XP_MULTIPLIER = 1.25;
export const BOOK_PAUSE_SECONDS = 5;
export const CLASSIC_ORB_CALL_SECONDS = 6;
export const CLASSIC_ORB_CALL_COOLDOWN = 20;
export const GLOW_TRAIL_SECONDS = 8;
export const GLOW_TRAIL_LINGER_SECONDS = 12;
export const GLOW_TRAIL_FADE_SECONDS = 2;
export const MOBI_REENTRY_SECONDS = 10;
// Inch Worm's Spring: the body coils while the worm keeps crawling, then leaps. It out-flies
// the free double jump (about 2.4 tiles), and its landing slams: bombs and enemies within
// the 3x3 around it are dealt with (springSlamTiles), and orbs within GRAB tiles are the worm's.
export const SPRING_COIL_SECONDS = 0.28;
export const SPRING_SPAN = 3.6;
export const SPRING_HEIGHT = 2.4;
export const SPRING_COOLDOWN = 14;
export const SPRING_GRAB_TILES = 2;
export const SPRING_SLAM_WINDOW = 0.6;
export const characterXpMultiplier = character => character === 'book' ? BOOK_XP_MULTIPLIER : 1;
export const characterOrbCount = (count, character) => character === 'classic' ? Math.ceil(count * 1.5) : count;
export const holdsRotationTimer = signature => !!signature?.sweep || (signature?.character === 'book' && signature.active > 0);
