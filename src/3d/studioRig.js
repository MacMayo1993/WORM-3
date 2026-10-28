// The play scene's studio rig (cubeLighting.js) turns with the camera drawing it.
//
// The rig is authored for a camera in front of the cube (+Z, up +Y), as the menu
// shows it. It used to stay there while the camera went round, so every face
// turned from it (the bottom most of all) drew its stickers at a third of the
// front's light, and a WORM run spends half its time on those faces. Turned with
// the camera, whatever face is in view is lit as the front is at the default pose,
// where nothing changes.
//
// GameScene registers its three directional lights; the main camera aims them each
// frame and the far-side window re-aims them for its own pass, then back
// (createStudioRigPass, which also gives that pass shadows of its own). Styled
// tiles shade from the same directions (sharedUniforms.rigKey…, stickerFinish.js),
// so plain and styled stickers agree on every face. Only positions change: no
// light is added, removed or made to cast, so no program is re-keyed.
import { Matrix4, WebGLRenderTarget } from 'three';
import { CUBE_LIGHT_RIG } from './cubeLighting.js';
import { sharedUniforms } from './styles/TileStyleMaterials.jsx';

const RIG = [CUBE_LIGHT_RIG.key, CUBE_LIGHT_RIG.fill, CUBE_LIGHT_RIG.rim];
const DIRS = [sharedUniforms.rigKey.value, sharedUniforms.rigFill.value, sharedUniforms.rigRim.value];
const lights = [null, null, null];

/** GameScene's key, fill and rim lights. */
export function setStudioRigLights(key, fill, rim) {
  lights[0] = key; lights[1] = fill; lights[2] = rim;
}

/** The scene's own rig is off (wireframe, glass) or gone: styled tiles fall back to the authored rig. */
export function releaseStudioRig() {
  setStudioRigLights(null, null, null);
  for (const dir of DIRS) dir.set(0, 0, 0);
}

/** Turn the rig to a camera's orientation (world quaternion). Allocates nothing. */
export function aimStudioRig(quaternion) {
  if (!lights[0]) return;
  for (let i = 0; i < 3; i++) {
    const [x, y, z] = RIG[i].position;
    const dir = DIRS[i].set(x, y, z).applyQuaternion(quaternion);
    lights[i]?.position.copy(dir);
    dir.normalize();
  }
}

/**
 * A second pass drawn with the rig turned to its own camera (the far-side window),
 * with shadows of its own. Re-aiming the casting key moves its light, but its
 * shadow map is drawn only when the renderer redraws shadows, and with reduced FX
 * that is every fourth frame (GameScene's ShadowCadence), on the main pass, which
 * also clears the request: the window was lit from its side of the cube and
 * shadowed from the main camera's, on every frame. Each casting rig light now
 * draws this pass's shadows into a map and matrix of its own, swapped in for the
 * pass and swapped back after, so the main pass keeps exactly the map it drew.
 * This pass redraws its map on the frames the main pass redraws its own, so both
 * lag the same few frames, and on its first frame or after a frame it was not
 * drawn. Allocates nothing per frame.
 */
export function createStudioRigPass() {
  const ownMaps = [null, null, null], ownLights = [null, null, null];
  const ownMatrices = [new Matrix4(), new Matrix4(), new Matrix4()];
  const mainMaps = [null, null, null], mainMatrices = [new Matrix4(), new Matrix4(), new Matrix4()];
  const swapped = [null, null, null];
  let stale = true;
  const release = i => {
    ownMaps[i]?.dispose();
    ownMaps[i] = null;
    ownLights[i] = null;
  };
  return {
    /**
     * Turn the rig to `quaternion` and give the casting lights this pass's shadows.
     * `refresh`: whether the renderer redraws shadows this frame, read before the
     * main pass drew (and cleared the request).
     */
    begin(renderer, quaternion, refresh) {
      aimStudioRig(quaternion);
      let redraw = refresh || stale, casting = false;
      for (let i = 0; i < 3; i++) {
        const light = lights[i], shadow = light?.castShadow ? light.shadow : null;
        swapped[i] = shadow ? light : null;
        if (!shadow) continue;
        casting = true;
        if (ownLights[i] !== light) release(i);
        const main = shadow.map;
        // Shaped like the main pass's map (three makes it on that pass's first
        // shadow draw), so the first frame samples a map that this draw fills.
        if (!ownMaps[i] && main) {
          ownMaps[i] = new WebGLRenderTarget(main.width, main.height,
            { minFilter: main.texture.minFilter, magFilter: main.texture.magFilter });
          ownMaps[i].texture.name = `${main.texture.name}.pass`;
          ownLights[i] = light;
          redraw = true;
        }
        mainMaps[i] = main;
        mainMatrices[i].copy(shadow.matrix);
        shadow.map = ownMaps[i];
        shadow.matrix.copy(ownMatrices[i]);
      }
      if (casting && redraw) renderer.shadowMap.needsUpdate = true;
    },
    /** Hand the main pass back its shadows and turn the rig back to `quaternion`. */
    end(quaternion) {
      for (let i = 0; i < 3; i++) {
        const light = swapped[i];
        if (!light) continue;
        swapped[i] = null;
        const shadow = light.shadow;
        ownMaps[i] = shadow.map;
        ownLights[i] = light;
        ownMatrices[i].copy(shadow.matrix);
        shadow.map = mainMaps[i];
        shadow.matrix.copy(mainMatrices[i]);
        mainMaps[i] = null;
      }
      stale = false;
      aimStudioRig(quaternion);
    },
    /** A frame the pass was not drawn: its shadows are out of date. */
    idle() {
      stale = true;
    },
    dispose() {
      for (let i = 0; i < 3; i++) release(i);
    }
  };
}
