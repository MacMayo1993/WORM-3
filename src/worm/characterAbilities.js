// Central balance values shared by simulation, rewards and character descriptions.
export const BOOK_XP_MULTIPLIER = 1.25;
export const BOOK_PAUSE_SECONDS = 5;
export const CLASSIC_ORB_CALL_SECONDS = 6;
export const CLASSIC_ORB_CALL_COOLDOWN = 20;
export const GLOW_TRAIL_SECONDS = 8;
export const GLOW_TRAIL_LINGER_SECONDS = 12;
export const GLOW_TRAIL_FADE_SECONDS = 2;
export const MOBI_REENTRY_SECONDS = 10;
export const characterXpMultiplier = character => character === 'book' ? BOOK_XP_MULTIPLIER : 1;
export const characterOrbCount = (count, character) => character === 'classic' ? Math.ceil(count * 1.5) : count;
export const holdsRotationTimer = signature => !!signature?.sweep || (signature?.character === 'book' && signature.active > 0);
