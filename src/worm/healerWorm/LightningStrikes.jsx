import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { wormRaisedAmount } from '../../game/raisedCubie.js';
import { FACE_NORMALS } from './constants.js';
import { STORM } from './lightningStorm.js';

// The Lightning orb, drawn. Render only: it reads the storm (lightningStorm.js) and the
// charged tunnels and writes nothing back.
//
//   mark    a closing ring and a diamond on the tile that will be struck, a filling disc
//           inside them. The marker is the warning, so it is readable without any flash.
//   strike  a column of light down the tile's normal and a white disc, for STORM.flash.
//   mouth   a crackling ring on each end of a charged tunnel.

const Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const MARK_COLOR = new THREE.Color('#a78bfa');
const BOLT_COLOR = new THREE.Color('#ffffff');
const CHARGE_COLOR = new THREE.Color('#8b9bff');
const _color = new THREE.Color();
const MAX_MARKS = STORM.strikes;
const MAX_MOUTHS = 16;

function instances(geometry, count) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
    }), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _color.set('#000000'));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

export function LightningStrikes({ stormRef, worm, size }) {
    const r = useMemo(() => ({
        ring: instances(new THREE.RingGeometry(0.4, 0.45, 40), MAX_MARKS),
        diamond: instances(new THREE.RingGeometry(0.2, 0.25, 4), MAX_MARKS),
        disc: instances(new THREE.CircleGeometry(0.4, 32), MAX_MARKS * 2),
        // Unit radius and length, so scale sets the width and the height.
        column: instances(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), MAX_MARKS),
        crackle: instances(new THREE.RingGeometry(0.3, 0.36, 24, 1), MAX_MOUTHS),
        pose: new THREE.Object3D(), normal: new THREE.Vector3(), axis: new THREE.Vector3(),
    }), []);
    const meshes = useMemo(() => [r.ring, r.diamond, r.disc, r.column, r.crackle], [r]);
    useEffect(() => () => {
        for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); }
    }, [meshes]);

    useFrame(({ clock } = {}) => {
        for (const mesh of meshes) mesh.count = 0;
        const storm = stormRef.current;
        const mouths = worm.chargedMouths?.();
        if (!storm.spots.length && !storm.flashes.length && !mouths?.length) return;
        const reduced = prefersReducedMotion();
        const time = clock?.elapsedTime ?? 0;

        // Put `mesh`'s next instance on `tile`, standing off its surface by `lift`, in the
        // frame of the layer that is turning (if it is) so a mark rides the slice it is on.
        const place = (mesh, tile, color, brightness, scale = 1, lift = 0.08, spin = 0, height = 0) => {
            if (mesh.count >= mesh.instanceMatrix.count) return;
            const { pose, normal, axis } = r;
            normal.copy(FACE_NORMALS[tile.dirKey]);
            pose.position.fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0)).addScaledVector(normal, lift);
            const angle = liveLayerAngle(tile.x, tile.y, tile.z);
            if (angle !== null) {
                axis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
                pose.position.applyAxisAngle(axis, angle); normal.applyAxisAngle(axis, angle);
            }
            pose.rotation.set(0, 0, 0);
            if (height > 0) {
                // A column stands on the tile: its axis is the normal, its middle half a length up.
                pose.position.addScaledVector(normal, height / 2);
                pose.quaternion.setFromUnitVectors(UP, normal);
                pose.scale.set(scale, height, scale);
            } else {
                pose.quaternion.setFromUnitVectors(Z, normal);
                pose.rotateZ(spin); pose.scale.setScalar(scale);
            }
            pose.updateMatrix();
            mesh.setMatrixAt(mesh.count, pose.matrix);
            mesh.setColorAt(mesh.count, _color.copy(color).multiplyScalar(brightness));
            mesh.count++;
        };

        for (const spot of storm.spots) {
            const u = Math.min(1, spot.age / spot.delay);
            // The last fifth of the charge pulses faster so the final beat reads as "now".
            const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(time * (u > 0.8 ? 30 : 10));
            place(r.ring, spot.tile, MARK_COLOR, 0.55 + 0.45 * u, reduced ? 1 : 2.1 - 1.1 * u, 0.1);
            place(r.diamond, spot.tile, MARK_COLOR, (0.5 + 0.5 * u) * pulse, 1, 0.1, reduced ? 0 : time * (1 + 3 * u));
            place(r.disc, spot.tile, MARK_COLOR, 0.12 + 0.4 * u * u * pulse, 1, 0.09);
        }
        for (const flash of storm.flashes) {
            const fade = 1 - Math.min(1, flash.age / STORM.flash);
            place(r.disc, flash.tile, BOLT_COLOR, reduced ? 0.35 * fade : fade * fade, 1.5 - 0.5 * fade, 0.12);
            if (!reduced) place(r.column, flash.tile, BOLT_COLOR, fade * fade, 0.06 + 0.1 * fade, 0, 0, 3.2);
        }
        if (mouths?.length) {
            const lift = wormRaisedAmount(size) + 0.12;
            for (const hit of mouths) {
                for (const end of [hit.tunnel.entry, hit.tunnel.exit]) {
                    const flicker = reduced ? 0.7 : 0.55 + 0.45 * Math.abs(Math.sin(time * 9 + end.x * 2.1 + end.y * 3.7 + end.z * 1.3));
                    place(r.crackle, end, CHARGE_COLOR, flicker, 1.15 + (reduced ? 0 : 0.08 * Math.sin(time * 5)), lift, reduced ? 0 : time * 1.5);
                }
            }
        }
        for (const mesh of meshes) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
        }
    });

    return <group name="lightning-strikes">{meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}</group>;
}
