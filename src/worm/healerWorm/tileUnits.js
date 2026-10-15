import { BODY_BALL_SPACING, ORB_SEGMENT_GROWTH } from './constants.js';

// One tile is one unit of travel across the cube surface. Keep simulation and
// saved goal values intact; translate their body-length budget at the UI boundary.
export const segmentsToTiles = segments => Math.round(Math.max(0, Number(segments) || 0) * BODY_BALL_SPACING * 100) / 100;
export const ORB_TILE_GROWTH = segmentsToTiles(ORB_SEGMENT_GROWTH);
export const TILE_GROWTH_HELP = `1 normal orb adds ${ORB_TILE_GROWTH} tiles of length; 4 add ${ORB_TILE_GROWTH * 4} tiles.`;
export const goalDisplayValue = (goal, value) => goal.key === 'bodyLength' ? segmentsToTiles(value) : value;
