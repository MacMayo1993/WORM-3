import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS } from './constants.js';
import { SPRING_CHARGE, SIGNATURES } from './signatures.js';

const Z = new THREE.Vector3(0, 0, 1);
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
// Character markers obey depth so the opposite face stays hidden.
export function SignatureEffects({ worm, size }) {
    const r = useMemo(() => ({
        target: instances(new THREE.RingGeometry(0.32, 0.36, 40), '#c6ec86', 4),
        pulse: instances(new THREE.RingGeometry(0.48, 0.5, 48), '#8eefff', 3),
        lock: instances(new THREE.RingGeometry(0.32, 0.39, 4), '#ceacff', 3),
        pages: instances(new THREE.PlaneGeometry(0.46, 0.65), '#ffda91', 3),
        pose: new THREE.Object3D(), normal: new THREE.Vector3(), axis: new THREE.Vector3(),
    }), []);
    useEffect(() => () => {
        for (const mesh of [r.target, r.pulse, r.lock, r.pages]) {
            mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
        }
    }, [r]);
    useFrame(() => {
        for (const mesh of [r.target, r.pulse, r.lock, r.pages]) mesh.count = 0;
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
        if (sig.character === 'book' && (sig.active > 0 || sig.fxT > 0)) {
            r.pages.material.opacity = sig.active > 0 ? 0.8 : sig.fxT;
            const tile = worm.pos.current;
            for (let i = 0; i < 3; i++) place(r.pages, tile, 0.85, 0.18 + i * 0.07, (i - 1) * 0.2);
        } else if (sig.character === 'wiggle') {
            r.target.material.color.set(sig.reason ? '#ffbb72' : '#ffb5d7');
            if (sig.sweep) place(r.target, sig.target);
            if (sig.fxT > 0) {
                r.pulse.material.color.set('#ffb5d7'); r.pulse.material.opacity = sig.fxT * 0.55;
                for (let i = 0; i < 3; i++) place(r.pulse, sig.fxTile, 0.4 + i * 0.3 + (reduced ? 0 : 0.7 - sig.fxT), 0.08);
            }
        } else if (sig.character === 'inch') {
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
            const tile = sig.mobiTunnel ? sig.target : sig.preview;
            r.lock.material.opacity = sig.mobiTunnel ? 0.6 : 0.35;
            place(r.lock, tile, 1.12, 0.14, Math.PI / 4);
        } else if (sig.character === 'glow' && sig.active > 0) {
            const age = SIGNATURES.glow.duration - sig.active;
            const fade = Math.min(1, sig.active * 2);
            r.pulse.material.color.set('#8eefff'); r.pulse.material.opacity = 0.24 * fade;
            for (let i = 0; i < 3; i++) place(r.pulse, worm.pos.current,
                reduced ? 1.4 + i * 0.8 : 0.7 + ((age * 1.8 + i) % 3), 0.12 + i * 0.02);
        }
    });
    return <>{[r.target, r.pulse, r.lock, r.pages].map((mesh, i) => <primitive key={i} object={mesh} />)}</>;
}
