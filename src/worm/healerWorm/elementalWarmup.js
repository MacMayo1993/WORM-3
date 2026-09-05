// src/worm/healerWorm/elementalWarmup.js
//
// Pre-compile every elemental cube-skin shader before a player can claim an orb.
//
// The first time a ShaderMaterial is rendered the driver blocks for the GLSL
// compile — the same ~200 ms stall that scripts/../TileStyleMaterials.jsx warms
// away for tile styles and that HealerBombs' <WarmUp> warms away for bombs. The
// elemental skins had no equivalent: their materials are built lazily inside
// getElementalSurfaceMaterial / getFlameMaterial / getGrassBladeMaterial, which
// run for the first time in the frame ElementalAtmosphere mounts — i.e. exactly
// when the player claims a power-up. The wash was landing on top of a compile.
//
// renderer.compile() walks a throwaway scene and builds the GPU programs without
// drawing anything, so a missing instanced attribute here is harmless: we are
// linking programs, not issuing draws.
//
// Call once, inside the Canvas, while the board is still scrambling.

import * as THREE from 'three';
import { ELEMENTAL_DEFS } from './elementalDefs.js';
import { getElementalSurfaceMaterial } from '../ElementalSurface.jsx';
import { getFlameMaterial } from '../ElementalFireSkin.jsx';
import { getGrassBladeMaterial } from '../../3d/styles/GrassBlades.jsx';
import { getElementalOrbMaterials } from './elementalOrbShader.js';

/**
 * Every material an elemental theme can put on screen, one per definition.
 * Unknown renderer keys are skipped rather than guessed at — a definition that
 * names a renderer this module has not been taught about simply goes unwarmed,
 * which costs a stall, not a crash.
 */
function collectElementalMaterials() {
  const materials = [];
  for (const [element, def] of Object.entries(ELEMENTAL_DEFS)) {
    if (!def) continue;

    // The pickup itself, before anything is claimed: an orb spawning on the board
    // is the first moment these three programs are needed.
    const orb = getElementalOrbMaterials(element, def.color, def.accent);
    if (orb) materials.push(orb.core, orb.shell, orb.inner);

    // The wash that arrives when it is claimed.
    switch (def.renderer) {
      case 'surface':
        materials.push(getElementalSurfaceMaterial(element, def.color, def.accent));
        break;
      case 'flames':
        // Both detail tiers: quality is resolved per device at claim time, and
        // warming only one leaves half the fleet paying the compile.
        materials.push(getFlameMaterial(true), getFlameMaterial(false));
        break;
      case 'blades':
        materials.push(getGrassBladeMaterial(def.color));
        break;
      default:
        break;
    }
  }
  return materials;
}

/**
 * Compile every elemental skin program.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera} camera
 * @returns {number} how many materials were warmed (0 if called without a renderer)
 */
export function warmUpElementalSkins(renderer, camera) {
  if (!renderer || !camera) return 0;

  const materials = collectElementalMaterials();
  if (materials.length === 0) return 0;

  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(0.1, 0.1);
  for (const material of materials) {
    if (material) scene.add(new THREE.Mesh(geo, material));
  }

  renderer.compile(scene, camera);

  // The dummy meshes go; the materials are module-cached by their own getters and
  // are what the real skins will pick up, so they must outlive this scene.
  scene.clear();
  geo.dispose();

  return materials.length;
}
