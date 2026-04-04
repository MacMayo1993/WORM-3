import { makeCubies } from '../../game/cubeState.js';
import { exportCubeState, importCubeState } from '../../game/cubeUtils.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid, flipStickerPair } from '../../game/manifoldLogic.js';
import { computeAntipodalIntegrity, K_STAR, getRegime } from '../../game/antipodalIntegrity.js';

const AXES = ['col', 'row', 'depth'];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const verifyCubeStateShape = (cubies, size) => {
  if (!Array.isArray(cubies) || cubies.length !== size) return false;

  for (let x = 0; x < size; x++) {
    if (!Array.isArray(cubies[x]) || cubies[x].length !== size) return false;
    for (let y = 0; y < size; y++) {
      if (!Array.isArray(cubies[x][y]) || cubies[x][y].length !== size) return false;
      for (let z = 0; z < size; z++) {
        const cubie = cubies[x][y][z];
        if (!cubie || typeof cubie !== 'object' || !cubie.stickers || typeof cubie.stickers !== 'object') {
          return false;
        }
      }
    }
  }

  return true;
};

export class Worm3CubeVerifier {
  constructor(size = 3, cubies = null) {
    this.size = size;
    this.cubies = cubies ?? makeCubies(size);
    this.moveHistory = [];
    this._manifoldMap = null; // lazily built, invalidated by rotations
  }

  // Returns the cached manifold map, building it on first access or after rotation.
  _getManifoldMap() {
    if (!this._manifoldMap) {
      this._manifoldMap = buildManifoldGridMap(this.cubies, this.size);
    }
    return this._manifoldMap;
  }

  rotateSlice(axis, sliceIndex, turns = 1) {
    if (!AXES.includes(axis)) throw new Error(`Invalid axis: ${axis}`);
    if (sliceIndex < 0 || sliceIndex >= this.size) throw new Error(`Invalid slice index: ${sliceIndex}`);

    const dir = turns > 0 ? 1 : -1;
    const count = Math.abs(turns) % 4;

    for (let i = 0; i < count; i++) {
      this.cubies = rotateSliceCubies(this.cubies, this.size, axis, sliceIndex, dir);
    }

    this._manifoldMap = null; // rotation changes cubie geometry — invalidate cache
    this.moveHistory.push({ type: 'rotate', axis, sliceIndex, dir, turns: count });
  }

  flipPair(x, y, z, dirKey) {
    const manifoldMap = this._getManifoldMap();
    const sticker = this.cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
    if (!sticker) return false;

    const antipodal = findAntipodalStickerByGrid(manifoldMap, sticker, this.size);
    this.cubies = flipStickerPair(this.cubies, this.size, x, y, z, dirKey, manifoldMap);

    this.moveHistory.push({
      type: 'flip',
      source: { x, y, z, dirKey },
      antipodal: antipodal ? { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey } : null
    });

    return true;
  }

  computeIntegrity() {
    const metrics = computeAntipodalIntegrity(this.cubies, this.size);
    return {
      ...metrics,
      regime: getRegime(metrics.integrity),
      aboveKStar: metrics.integrity > K_STAR
    };
  }

  isValid(minIntegrity = 0.721) {
    if (!verifyCubeStateShape(this.cubies, this.size)) return false;
    const metrics = this.computeIntegrity();
    return metrics.aboveKStar && metrics.integrity >= minIntegrity;
  }

  verifyState({ minIntegrity = 0.721 } = {}) {
    const shapeValid = verifyCubeStateShape(this.cubies, this.size);
    const integrity = this.computeIntegrity();

    return {
      shapeValid,
      integrity,
      valid: shapeValid && integrity.aboveKStar && integrity.integrity >= minIntegrity
    };
  }

  toJSON() {
    return exportCubeState(this.cubies);
  }

  static fromJSON(jsonStr, size = 3) {
    const cubies = importCubeState(jsonStr);
    return new Worm3CubeVerifier(size, cubies);
  }

  randomMove(rotationChance = 0.7) {
    if (Math.random() < rotationChance) {
      const axis = AXES[randomInt(0, AXES.length - 1)];
      const sliceIndex = randomInt(0, this.size - 1);
      const turns = Math.random() < 0.5 ? 1 : -1;
      this.rotateSlice(axis, sliceIndex, turns);
      return;
    }

    const x = randomInt(0, this.size - 1);
    const y = randomInt(0, this.size - 1);
    const z = randomInt(0, this.size - 1);
    const dirs = Object.keys(this.cubies[x][y][z].stickers);
    if (dirs.length === 0) return;
    const dirKey = dirs[randomInt(0, dirs.length - 1)];
    this.flipPair(x, y, z, dirKey);
  }
}
