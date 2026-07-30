import * as THREE from 'three';
import { rotateVec90 } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR, DIR_TO_VEC, VEC_TO_DIR } from '../utils/constants.js';
import { isTileInSlice } from './wormLogic.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { liveCubies } from './liveCubies.js';
import { liveRotation } from './liveRotation.js';
import { ttAt, ttTrimTo, shTrimTo } from './circularBuffers.js';
import {
    FACE_NORMALS,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    WORM_LIFT,
} from './healerWorm/constants.js';
import { orbsCarried } from './healerWorm/economy.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

// Pre-allocated axis vector for applying liveRotation to the worm during scramble
const _liveAxis = new THREE.Vector3();
// Scratch for reading live tile transforms straight off the cubie meshes.
const _meshHeadC = new THREE.Vector3();
const _meshHeadP = new THREE.Vector3();
const _meshNorm = new THREE.Vector3();
const _meshNormP = new THREE.Vector3();

// Read a tile's live world surface position + outward normal straight from its cubie mesh —
// the SAME source the body trail uses (resolveTrailTile). Returns false if the mesh isn't
// available. liveCubies.refs are CubeAssembly's per-cubie groups, indexed by grid cell.
export function readLiveTile(tile, outPos, outNorm) {
    const lc = liveCubies.refs;
    const lsz = liveCubies.size;
    if (!lc || lsz <= 0) return false;
    const mesh = lc[tile.x * lsz * lsz + tile.y * lsz + tile.z];
    const localNorm = FACE_NORMALS[tile.dirKey];
    if (!mesh || !localNorm) return false;
    outNorm.copy(localNorm).applyQuaternion(mesh.quaternion).normalize();
    outPos.copy(mesh.position).addScaledVector(outNorm, SURFACE_OFFSET);
    return true;
}

// Anchor the worm's head to the LIVE cubie meshes instead of the grid-math rest position, so
// it rides a mid-rotation slice and lands on the committed tile automatically.
export function rideLiveRotation(worm) {
    const cur = worm.pos.current;

    // Rest-read: the current step crossed onto (or is stepping back off) a mid-rotation
    // slice from static ground. tick()'s grid math already targets the committed
    // end-of-rotation positions, so skip live anchoring entirely — following the live
    // meshes here would chase the outgoing tile (a visible teleport onto the rotating
    // layer) and then snap when the rotation commits.
    const rr = worm.restReadSlice?.current;
    if (rr && liveRotation.active && rr.axis === liveRotation.axis && rr.sliceIndex === liveRotation.sliceIndex) {
        return false;
    }

    if (worm.crossingCorner.current) {
        if (!liveRotation.active) return false;
        const { axis, sliceIndex, angle } = liveRotation;
        if (!isTileInSlice(axis, sliceIndex, cur.x, cur.y, cur.z)) return false;
        _liveAxis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
        worm.headInterpPos.current.applyAxisAngle(_liveAxis, angle);
        worm.currentNormal.current.applyAxisAngle(_liveAxis, angle).normalize();
        return true;
    }

    if (!readLiveTile(cur, _meshHeadC, _meshNorm)) return false;
    const t = worm.interpT.current;
    const prev = worm.prevTile.current;
    if (t < 1 && prev && readLiveTile(prev, _meshHeadP, _meshNormP)) {
        worm.headInterpPos.current.copy(_meshHeadP).lerp(_meshHeadC, t);
        worm.currentNormal.current.copy(_meshNormP).lerp(_meshNorm, t).normalize();
    } else {
        worm.headInterpPos.current.copy(_meshHeadC);
        worm.currentNormal.current.copy(_meshNorm);
    }
    return true;
}

// Ensures orb colors are always visible regardless of color scheme.
export function ensureOrbContrast(hex) {
    if (!hex || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum <= 0.72) return hex;
    const factor = 0.55 / Math.max(lum, 0.01);
    const nr = Math.min(255, Math.round(r * factor * 255));
    const ng = Math.min(255, Math.round(g * factor * 255));
    const nb = Math.min(255, Math.round(b * factor * 255));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Resolve a parity orb's primary color from the antipode of its host manifold.
 * Keeping this in the shared worm layer ensures the board orb, pickup flash, and
 * colors added to the worm's body all use the same palette lookup.
 */
export function getAntipodalOrbColor(faceId, faceColors, fallback = '#22ff88') {
    const antipodalFaceId = ANTIPODAL_COLOR[faceId];
    return ensureOrbContrast((antipodalFaceId && faceColors?.[antipodalFaceId]) ?? fallback);
}

// Transforms a {x, y, z, dirKey} surface tile through a cube slice rotation.
export function rotateTilePosition(tile, axis, sliceIndex, dir, size) {
    const { x, y, z, dirKey } = tile;
    const inSlice = (axis === 'col' && x === sliceIndex) ||
        (axis === 'row' && y === sliceIndex) ||
        (axis === 'depth' && z === sliceIndex);
    if (!inSlice) return tile;

    const k = (size - 1) / 2;
    const cx = x - k, cy = y - k, cz = z - k;
    const [nx, ny, nz] = rotateVec90(cx, cy, cz, axis, dir);
    const newX = Math.round(nx + k), newY = Math.round(ny + k), newZ = Math.round(nz + k);

    const [vx, vy, vz] = DIR_TO_VEC[dirKey];
    const [rvx, rvy, rvz] = rotateVec90(vx, vy, vz, axis, dir);
    const newDirKey = VEC_TO_DIR(rvx, rvy, rvz);

    return { ...tile, x: newX, y: newY, z: newZ, dirKey: newDirKey };
}

// All surface sticker positions in the rotating slice.
export function getSliceSurfaceStickers(size, axis, sliceIndex) {
    const stickers = [];
    for (let a = 0; a < size; a++) {
        for (let b = 0; b < size; b++) {
            let x, y, z;
            if (axis === 'col') { x = sliceIndex; y = a; z = b; }
            else if (axis === 'row') { x = a; y = sliceIndex; z = b; }
            else { x = a; y = b; z = sliceIndex; }
            if (x === 0) stickers.push({ x, y, z, dirKey: 'NX' });
            if (x === size - 1) stickers.push({ x, y, z, dirKey: 'PX' });
            if (y === 0) stickers.push({ x, y, z, dirKey: 'NY' });
            if (y === size - 1) stickers.push({ x, y, z, dirKey: 'PY' });
            if (z === 0) stickers.push({ x, y, z, dirKey: 'NZ' });
            if (z === size - 1) stickers.push({ x, y, z, dirKey: 'PZ' });
        }
    }
    return stickers;
}

// Scratch object reused by parseTileKey
const _parseTile = { x: 0, y: 0, z: 0, dirKey: '' };

export function parseTileKey(key, out) {
    const c1 = key.indexOf(',');
    const c2 = key.indexOf(',', c1 + 1);
    const c3 = key.indexOf(',', c2 + 1);
    out.x = parseInt(key, 10);
    out.y = parseInt(key.substring(c1 + 1), 10);
    out.z = parseInt(key.substring(c2 + 1), 10);
    out.dirKey = key.substring(c3 + 1);
    return out;
}

export { _parseTile };

// Extract a single coordinate (0=x,1=y,2=z) from a tile key without allocating.
export function tileKeyCoordAt(key, idx) {
    let commasSeen = 0, start = 0;
    for (let i = 0; i < key.length; i++) {
        if (key.charCodeAt(i) === 44) { // ','
            if (commasSeen === idx) return parseInt(key.substring(start, i), 10);
            commasSeen++;
            start = i + 1;
        }
    }
    return parseInt(key.substring(start), 10);
}

// Returns null | { type:'death' } | { type:'cut', cutTrailIdx }
//
// Rocket overdrive makes the entire worm impenetrable. Landing grace only clears the
// head, while still allowing the normal tail-cut behavior.
export function checkWormHitBySlice(worm, axis, sliceIndex) {
    if (worm.rocketActive?.current) return null;
    const head = worm.pos.current;
    const axisCoord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
    const coordIdx  = axis === 'col' ? 0 : axis === 'row' ? 1 : 2;
    const airborne = (worm.landingGraceT?.current ?? 0) > 0;
    const headOnSlice = head[axisCoord] === sliceIndex && !airborne;
    const trail = worm.tileTrail.current;

    const activeTiles = Math.max(1, Math.ceil(worm.tailLength.current * BODY_BALL_SPACING));
    const bodyEnd = Math.min(activeTiles, trail.count);

    if (!headOnSlice) {
        for (let i = 1; i < bodyEnd; i++) {
            if (tileKeyCoordAt(ttAt(trail, i), coordIdx) === sliceIndex) {
                return { type: 'cut', cutTrailIdx: i };
            }
        }
        return null;
    }

    for (let i = 1; i < bodyEnd; i++) {
        if (tileKeyCoordAt(ttAt(trail, i), coordIdx) !== sliceIndex) {
            return { type: 'death' };
        }
    }
    return null;
}

// Remove all worm segments at and beyond cutTrailIdx.
export function cutWormTail(worm, cutTrailIdx) {
    ttTrimTo(worm.tileTrail.current, cutTrailIdx);
    const histLen = cutTrailIdx * STEPS_PER_TILE;
    shTrimTo(worm.stepHistory.current, histLen);
    worm.tailLength.current = Math.max(BASE_TAIL_LENGTH, Math.round(cutTrailIdx / BODY_BALL_SPACING));
    const orbsLeft = orbsCarried(worm.tailLength.current);
    if (worm.orbPickupColorsRef.current.length > orbsLeft) {
        worm.orbPickupColorsRef.current.length = orbsLeft;
        worm.colorEpochRef.current++;
    }
    useGameStore.getState().setWormBodyTiles(orbsLeft);
}
