import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { raisedPortalPosition } from '../raisedPortalPosition.js';
import { tunnelState } from '../tunnelProgressBridge.js';
import { liveRotation } from '../liveRotation.js';
import { wormBuffs } from '../wormBuffs.js';
import { FACE_NORMALS } from './constants.js';
import { readableTunnelExit } from './tunnelReadout.js';

const forward = new Vector3(0, 0, 1);

/** Two pooled, single-draw accents; no lights, rays, particle updates or post FX. */
export function TunnelReadability({ worm, size }) {
    const exitRef = useRef();
    const headRef = useRef();
    const pose = useMemo(() => ({ exitRot: new Quaternion(), lens: new Vector3(), aim: new Vector3() }), []);
    useFrame(({ camera }) => {
        const exitMesh = exitRef.current, headMesh = headRef.current;
        const state = useGameStore.getState();
        const phase = worm.phase.current;
        // During the crossing, only track the active route. At the surface,
        // respect the existing forward scan (including the wrapped next face).
        const exit = state.wormAlive && !state.animState && !liveRotation.active && !tunnelState.fallOpening && phase !== 'dead' && phase !== 'falling'
            ? (!wormBuffs.tunnelCrossing && wormBuffs.tunnelTail?.exit) || readableTunnelExit(wormBuffs.tunnelNeeds) : null;
        exitMesh.visible = false;
        if (exit && phase !== 'tunnel') {
            const normal = FACE_NORMALS[exit.dirKey];
            const point = raisedPortalPosition(exit.x, exit.y, exit.z, exit.dirKey, size, state);
            exitMesh.position.set(point[0], point[1], point[2]).addScaledVector(normal, 0.045);
            // Never x-ray the far side. The pause dock names the destination
            // when a surface face cannot yet be seen from the chase camera.
            if (pose.lens.subVectors(camera.position, exitMesh.position).dot(normal) > 0) {
                exitMesh.quaternion.copy(pose.exitRot.setFromUnitVectors(forward, normal));
                exitMesh.visible = true;
            }
        }

        const subject = tunnelState.rideHead;
        const t = tunnelState.t;
        // A thin view-facing outline tracks the real head, leaving its face and
        // surrounding walls intact. Only the outline ignores depth, so it stays
        // identifiable against chrome/reflections without flooding the screen.
        headMesh.visible = !!(state.wormAlive && subject && tunnelState.active && t >= .37 && t <= .65);
        if (headMesh.visible) {
            headMesh.position.copy(subject).addScaledVector(worm.currentNormal.current, worm.tunnelHeadShift ?? 0);
            pose.aim.set(0, 0, -1).applyQuaternion(camera.quaternion);
            const depth = pose.lens.subVectors(headMesh.position, camera.position).dot(pose.aim);
            headMesh.visible = depth > camera.near + .025;
            if (!headMesh.visible) return;
            headMesh.quaternion.copy(camera.quaternion);
            const scale = Math.max(.09, Math.min(.22, depth * .13));
            headMesh.scale.setScalar(scale);
        }
    });

    return <>
        <mesh ref={exitRef} visible={false} name="tunnel-exit-preview">
            <ringGeometry args={[.29, .335, 36, 1, Math.PI * .2, Math.PI * 1.6]} />
            <meshBasicMaterial color="#fff0c2" toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={headRef} visible={false} name="tunnel-head-outline" renderOrder={30}>
            <ringGeometry args={[.91, 1, 32]} />
            <meshBasicMaterial color="#ffefc7" transparent opacity={.8} depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
    </>;
}
