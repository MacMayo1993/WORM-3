import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { collectManifoldRing } from '../wormLogic.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS } from './constants.js';
import { signatureKey, SPRING_CHARGE, SIGNATURES } from './signatures.js';

const Z = new THREE.Vector3(0, 0, 1);
const LIMIT = 32;
function instances(geometry, color, count, reveal = false) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8, depthWrite: false,
        depthTest: !reveal, side: THREE.DoubleSide, toneMapped: false,
    }), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

// A bounded set of surface markers, with no extra lights or postprocessing.
// Beacon alone reveals through the cube; landing and lock markers obey depth.
export function SignatureEffects({ worm, size }) {
    const r = useMemo(() => ({
        target: instances(new THREE.RingGeometry(0.32, 0.36, 40), '#c6ec86', 4),
        pulse: instances(new THREE.RingGeometry(0.48, 0.5, 48), '#8eefff', 3),
        orbs: instances(new THREE.RingGeometry(0.14, 0.18, 20), '#8eefff', LIMIT, true),
        mouths: instances(new THREE.RingGeometry(0.34, 0.38, 4), '#ffd080', LIMIT, true),
        lock: instances(new THREE.RingGeometry(0.32, 0.39, 4), '#ceacff', 3),
        pose: new THREE.Object3D(), normal: new THREE.Vector3(), axis: new THREE.Vector3(),
        reach: new Set(), orbTiles: [], mouthTiles: [], scanAt: -1, seq: -1, epoch: -1,
    }), []);
    useEffect(() => () => {
        for (const mesh of [r.target, r.pulse, r.orbs, r.mouths, r.lock]) {
            mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
        }
    }, [r]);
    useFrame(() => {
        for (const mesh of [r.target, r.pulse, r.orbs, r.mouths, r.lock]) mesh.count = 0;
        const sig = worm.signature.current;
        const state = useGameStore.getState();
        if (!state.wormAlive || worm.phase.current !== 'crawling'
            || !['active', 'finalHealing'].includes(state.wormGamePhase)) return;
        const reduced = prefersReducedMotion();
        const place = (mesh, tile, scale = 1, lift = 0.08, spin = 0) => {
            if (!tile) return;
            const { pose, normal, axis } = r;
            normal.copy(FACE_NORMALS[tile.dirKey]);
            pose.position.fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0)).addScaledVector(normal, lift);
            const angle = liveLayerAngle(tile.x, tile.y, tile.z);
            if (angle !== null) {
                axis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
                pose.position.applyAxisAngle(axis, angle); normal.applyAxisAngle(axis, angle);
            }
            pose.quaternion.setFromUnitVectors(Z, normal);
            pose.rotateZ(spin); pose.scale.setScalar(scale); pose.updateMatrix();
            mesh.setMatrixAt(mesh.count++, pose.matrix);
            mesh.instanceMatrix.needsUpdate = true;
        };
        if (sig.character === 'inch') {
            const tile = sig.charge > 0 ? sig.target : sig.preview;
            if (!liveRotation.active && !worm.restRead.current && !worm.isJumping.current) {
                r.target.material.color.set(sig.reason ? '#ffbb72' : '#c6ec86');
                place(r.target, tile);
                if (sig.charge > 0) {
                    const compressed = 1 - sig.charge / SPRING_CHARGE;
                    for (let i = 0; i < 3; i++) place(r.target, worm.pos.current, 0.6 + i * 0.18,
                        0.13 + i * 0.12 * (1 - compressed * 0.7));
                }
            }
        } else if (sig.character === 'mobi') {
            const active = sig.active > 0;
            const tile = active ? sig.target : sig.preview;
            r.lock.material.opacity = active ? 0.85 * Math.min(1, sig.active) : 0.35;
            place(r.lock, tile, 1.12, 0.14, Math.PI / 4);
            if (active) {
                const age = SIGNATURES.mobi.duration - sig.active;
                place(r.lock, tile, 0.65, 0.32, reduced ? 0 : age * 0.65);
                place(r.lock, tile, 0.3, 0.43, reduced ? Math.PI / 4 : -age * 0.9);
            }
        } else if (sig.character === 'glow' && sig.active > 0) {
            const age = SIGNATURES.glow.duration - sig.active;
            if (r.seq !== sig.seq || r.epoch !== state.rotationEpoch || Math.abs(sig.active - r.scanAt) > 0.15) {
                r.seq = sig.seq; r.scanAt = sig.active; r.epoch = state.rotationEpoch;
                const p = worm.pos.current;
                collectManifoldRing(p.x, p.y, p.z, p.dirKey, size, 3, r.reach);
                r.orbTiles = (state.wormPowerups ?? []).filter(p => r.reach.has(signatureKey(p))).slice(0, LIMIT);
                r.mouthTiles.length = 0;
                for (const key of r.reach) {
                    const [x, y, z, dirKey] = key.split(',');
                    const sticker = state.cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                    if (sticker && sticker.curr !== sticker.orig) r.mouthTiles.push({ x: +x, y: +y, z: +z, dirKey });
                    if (r.mouthTiles.length === LIMIT) break;
                }
            }
            const fade = Math.min(1, sig.active * 2);
            r.orbs.material.opacity = 0.8 * fade;
            r.mouths.material.opacity = 0.6 * fade;
            for (const tile of r.orbTiles) place(r.orbs, tile, 1, 0.23);
            for (const tile of r.mouthTiles) place(r.mouths, tile, 1, 0.15, Math.PI / 4);
            r.pulse.material.opacity = 0.24 * fade;
            for (let i = 0; i < 3; i++) place(r.pulse, worm.pos.current,
                reduced ? 1.4 + i * 0.8 : 0.7 + ((age * 1.8 + i) % 3), 0.12 + i * 0.02);
        }
    });
    return <>{[r.target, r.pulse, r.orbs, r.mouths, r.lock].map((mesh, i) => <primitive key={i} object={mesh} />)}</>;
}
