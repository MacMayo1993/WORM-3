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
// frame and the far-side window re-aims them for its own pass, then back. Styled
// tiles shade from the same directions (sharedUniforms.rigKey…, stickerFinish.js),
// so plain and styled stickers agree on every face. Only positions change: no
// light is added, removed or made to cast, so no program is re-keyed.
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
