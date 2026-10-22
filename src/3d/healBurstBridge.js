// src/3d/healBurstBridge.js
//
// One-shot heal cues for the stickers, keyed by the sticker's manifold grid id.
// A plain module with no dependencies, so the worm's hook can write them without
// pulling the tile-style materials into its import graph.
//
//   healBurstMap     a tunnel or ring heal sealed this tile: StickerPlane plays the
//                    heal seal (a golden ring closing, then home-colour rings) and
//                    its sparks, then deletes the entry. Written by applyHeal in
//                    useWormCrawler for BOTH mouths: the pair goes home together.
//   healParticleMap  a Disparity tap-heal: sparks only, no seal.
//
// StickerAnimationDriver wakes any sticker with an entry, so a resting tile still
// picks its cue up on the next frame.
export const healBurstMap = new Map();
export const healParticleMap = new Map();
