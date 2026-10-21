// src/worm/healerWorm/elementalShell.js
//
// How far the shell skins stand off the stickers (ElementalSurface.jsx), shared
// with the drips and icicles that hang from their rims (elementalAdornments.js).

// Water depth above the stickers: a base, four ripple waves and one broad swell.
// Even when every wave bottoms out together the trough stays above the tile, and
// the crest stays under the worm's back.
export const WATER_HEIGHT = { base: 0.105, ripple: 0.011, swell: 0.03 };
// Shell depth for the other two: ice is a thick carved layer, lightning a skin of
// charge lying on the tiles.
export const ICE_DEPTH = 0.075;
export const CHARGE_DEPTH = 0.016;
// How far the flat part of an edge cell runs past its sticker lattice before the
// wrap begins: the cell's origin sits SURFACE_OFFSET (0.52) off the cubie centre,
// so the wrap's axis — shared by both faces — is 0.02 beyond the lattice edge.
export const EDGE_PAD = 0.02;
