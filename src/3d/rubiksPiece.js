// The opening's Rubik's cube, as parts: a black-plastic cubie body, a glossy
// domed sticker, and the finish of each. IntroScene and the main menu cube both
// build from these, so the cube that lands in the opening is the one that spins
// on the menu.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** How far a sticker's centre sits from its cubie's centre: half a cubie and a hair. */
export const STICKER_OFFSET = 0.5 + 0.012;

/** One cubie's body: a softly rounded unit box with a thin seam to its neighbours. */
export const createCubieGeometry = () => new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.08);

/**
 * A glossy, slightly domed sticker: a rounded square with a bevelled edge that
 * catches the key light as it turns. Faces +Z, centred on the origin.
 */
export function createStickerGeometry() {
  const geometry = new THREE.ExtrudeGeometry(roundedSquare(0.84, 0.14), {
    depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 5
  });
  geometry.translate(0, 0, -0.01);
  return geometry;
}

/** Thickness of the in-game sticker, front face to back. */
export const PLAY_STICKER_DEPTH = 0.016;

/**
 * The same sticker for the play cube, where it stands in for the old flat
 * 0.85 quad: the same rounded outline and bevelled rim, but thin, with its
 * front face at z = 0 so the tile marks, flip glow and seals that sit a few
 * thousandths in front of the sticker stay in front of it, and its back well
 * clear of the cubie face 0.02 behind. UVs are 0–1 across the front, as on a
 * PlaneGeometry, so textured stickers map exactly as they did.
 */
export function createPlayStickerGeometry(size = 0.85) {
  const bevel = 0.008;
  const geometry = new THREE.ExtrudeGeometry(roundedSquare(size - 2 * bevel, 0.13), {
    depth: PLAY_STICKER_DEPTH - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5
  });
  geometry.translate(0, 0, -(PLAY_STICKER_DEPTH - bevel));
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / size + 0.5, pos.getY(i) / size + 0.5);
  uv.needsUpdate = true;
  return geometry;
}

function roundedSquare(size, r) {
  const h = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return shape;
}

/**
 * The two finishes: black plastic with a light clearcoat, and stickers with a
 * full one. Performance mode drops to MeshStandardMaterial and loses the coat.
 */
export function rubiksFinish(performanceMode = false) {
  const coat = (params) => (performanceMode ? {} : params);
  return {
    Material: performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial,
    plastic: { color: '#141416', roughness: 0.34, metalness: 0, ...coat({ clearcoat: 0.4, clearcoatRoughness: 0.35 }) },
    sticker: { roughness: 0.24, metalness: 0, ...coat({ clearcoat: 1, clearcoatRoughness: 0.12 }) }
  };
}
