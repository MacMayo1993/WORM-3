import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS, WORM_LIFT } from './constants.js';
import { SPRING_COIL_SECONDS, SPRING_HEIGHT, SIGNATURES } from './signatures.js';
import { SPRING_SLAM_WINDOW } from '../characterAbilities.js';
import { springLanding } from './jumpLanding.js';
import { arcLift } from './jumpArc.js';
import { surfacePose } from '../combat/portalCombat.js';
import { ttAt } from '../circularBuffers.js';

const Z = new THREE.Vector3(0, 0, 1);
const ARC_DOTS = 16;
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
        arc: instances(new THREE.CircleGeometry(0.055, 12), '#c6ec86', ARC_DOTS),
        route: [],
        pose: new THREE.Object3D(), normal: new THREE.Vector3(), axis: new THREE.Vector3(),
    }), []);
    useEffect(() => () => {
        for (const mesh of [r.target, r.pulse, r.lock, r.pages, r.arc]) {
            mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
        }
    }, [r]);
    useFrame(() => {
        for (const mesh of [r.target, r.pulse, r.lock, r.pages, r.arc]) mesh.count = 0;
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
        if (sig.character === 'classic' && sig.active > 0) {
            const age = SIGNATURES.classic.duration - sig.active;
            r.pulse.material.color.set(SIGNATURES.classic.color);
            r.pulse.material.opacity = 0.35 * Math.min(1, sig.active * 2);
            for (let i = 0; i < 3; i++) place(r.pulse, worm.pos.current,
                reduced ? 1 + i * 0.7 : 3 - ((age * 1.5 + i) % 2.4), 0.12 + i * 0.02);
        } else if (sig.character === 'book' && (sig.active > 0 || sig.fxT > 0)) {
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
            const grounded = !liveRotation.active && !worm.restRead.current && !worm.isJumping.current;
            const color = sig.reason ? '#ffbb72' : '#c6ec86';
            if (grounded) {
                const tile = sig.charge > 0 ? sig.target : sig.preview;
                r.target.material.color.set(color);
                place(r.target, tile);
                if (sig.charge > 0) {
                    const compressed = 1 - sig.charge / SPRING_COIL_SECONDS;
                    for (let i = 0; i < 3; i++) place(r.target, worm.pos.current, 0.6 + i * 0.18,
                        0.13 + i * 0.12 * (1 - compressed * 0.7));
                }
                if (tile) {
                    // The leap, drawn: dots along the arc it will fly, from the head to the landing.
                    r.arc.material.color.set(color);
                    const interpT = worm.interpT.current, from = worm.prevTile.current ?? worm.pos.current;
                    const { span } = springLanding(worm.pos.current, worm.moveDir.current, size, interpT, r.route);
                    const path = r.route;                               // pos, then each tile to the landing
                    for (let j = 1; j <= ARC_DOTS; j++) {
                        const u = j / (ARC_DOTS + 1), progress = interpT + u * span;
                        // Progress 0 is the tile the head left, 1 is pos, k + 1 is path[k].
                        const m = Math.floor(progress), last = path.length - 1;
                        const a = m < 1 ? from : path[Math.min(m - 1, last)], b = path[Math.min(Math.max(m, 0), last)];
                        const at = surfacePose(a, b, progress - m, size, WORM_LIFT + arcLift(u, SPRING_HEIGHT));
                        const { pose: dot, normal } = r;
                        dot.position.fromArray(at.position);
                        normal.fromArray(at.normal);
                        dot.quaternion.setFromUnitVectors(Z, normal);
                        dot.scale.setScalar(0.7 + 0.5 * Math.sin(Math.PI * u));
                        dot.updateMatrix();
                        r.arc.setMatrixAt(r.arc.count++, dot.matrix);
                    }
                    r.arc.instanceMatrix.needsUpdate = true;
                }
            }
            // Launch: rings spring out of the tile it left.
            if (sig.active > 0 && sig.fxT > 0 && sig.fxTile) {
                r.pulse.material.color.set('#c6ec86'); r.pulse.material.opacity = sig.fxT * 0.7;
                for (let i = 0; i < 3; i++) place(r.pulse, sig.fxTile, 0.3 + i * 0.28 + (reduced ? 0 : 0.9 - sig.fxT), 0.1);
            }
            // Touchdown: the slam's shockwave runs out across the 3x3 it covers and beyond.
            if (sig.slamT > 0 && sig.slam) {
                const age = 1 - sig.slamT / SPRING_SLAM_WINDOW;
                r.pulse.material.color.set('#c6ec86'); r.pulse.material.opacity = 0.8 * (1 - age);
                for (let i = 0; i < 3; i++) place(r.pulse, sig.slam.tile, reduced ? 1.2 + i * 0.5 : 0.5 + (age * 3.2 + i * 0.55), 0.12 + i * 0.01);
            }
        } else if (sig.character === 'mobi') {
            const tile = sig.mobiTunnel ? sig.target : sig.preview;
            r.lock.material.opacity = sig.mobiTunnel ? 0.6 : 0.35;
            place(r.lock, tile, 1.12, 0.14, Math.PI / 4);
        } else if (sig.character === 'glow' && sig.active > 0 && sig.glowTrail?.path.count) {
            const key = ttAt(sig.glowTrail.path, 0);
            if (!key) return;
            const [x, y, z, dirKey] = key.split(',');
            const tailTile = { x: Number(x), y: Number(y), z: Number(z), dirKey };
            const age = SIGNATURES.glow.duration - sig.active;
            const fade = Math.min(1, sig.active * 2);
            r.pulse.material.color.set('#8eefff'); r.pulse.material.opacity = 0.24 * fade;
            for (let i = 0; i < 3; i++) place(r.pulse, tailTile,
                reduced ? 1.4 + i * 0.8 : 0.7 + ((age * 1.8 + i) % 3), 0.12 + i * 0.02);
        }
    });
    return <>{[r.target, r.pulse, r.lock, r.pages, r.arc].map((mesh, i) => <primitive key={i} object={mesh} />)}</>;
}
