// src/worm/healerWorm/DroppedOrbs.jsx
// A cut tail's orbs, scattered like Sonic's rings (see droppedOrbs.js). Each one
// is the orb in its own colour inside a spinning gold ring. It bursts out of its
// severed bead, arcs onto its tile with a little bounce, bobs there while it can
// be taken back, blinks faster and faster as its time runs out, and then crumbles
// away with the opening cube's dissolve (introDissolve.js).
//
// Render only: it reads worm.droppedOrbs (the sim's authoritative list) and
// worm.pendingDropDissolves (orbs that expired) every frame, and writes nothing
// back. Two instanced draws cover every orb on the board.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { addInstanceDissolve } from '../../components/intro/introDissolve.js';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS, WORM_LIFT } from './constants.js';
import {
    MAX_DROPPED_ORBS, DROPPED_ORB_DISSOLVE, dropFlightInto, dropVisible, dropDissolveProgress,
} from './droppedOrbs.js';

// Live orbs plus the ones still crumbling after they expired.
const POOL = MAX_DROPPED_ORBS + 12;
const ORB_RADIUS = 0.12;
const RING_RADIUS = 0.2;
const REST_LIFT = WORM_LIFT + 0.19;
const RING_GOLD = '#ffcf33';

const _pos = [0, 0, 0];
const _rest = [0, 0, 0];
const _normal = [0, 0, 1];
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

// A tile's rest point and outward normal, following a slice that is turning under it.
function tileRestInto(tile, size) {
    const [wx, wy, wz] = getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size);
    const face = FACE_NORMALS[tile.dirKey] ?? FACE_NORMALS.PZ;
    _v.set(wx, wy, wz);
    _n.copy(face);
    const angle = liveLayerAngle(tile.x, tile.y, tile.z);
    if (angle !== null) {
        const axis = liveRotation.axis;
        _axis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
        _v.applyAxisAngle(_axis, angle);
        _n.applyAxisAngle(_axis, angle);
    }
    _v.addScaledVector(_n, REST_LIFT);
    _rest[0] = _v.x; _rest[1] = _v.y; _rest[2] = _v.z;
    _normal[0] = _n.x; _normal[1] = _n.y; _normal[2] = _n.z;
}

function makeDissolvingMesh(geometry, material) {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aDissolve', attr);
    addInstanceDissolve(material);
    const mesh = new THREE.InstancedMesh(geometry, material, POOL);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

export function DroppedOrbs({ worm, size }) {
    const { core, ring } = useMemo(() => {
        const coreMesh = makeDissolvingMesh(
            new THREE.SphereGeometry(1, 20, 14),
            new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 })
        );
        // Seed the colour buffer so the material compiles with instance colours.
        coreMesh.setColorAt(0, _col.set('#ffffff'));
        const ringMesh = makeDissolvingMesh(
            new THREE.TorusGeometry(1, 0.15, 10, 32),
            new THREE.MeshStandardMaterial({ color: RING_GOLD, metalness: 0.85, roughness: 0.25, emissive: RING_GOLD, emissiveIntensity: 0.35 })
        );
        return { core: coreMesh, ring: ringMesh };
    }, []);
    useEffect(() => () => {
        for (const mesh of [core, ring]) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); }
    }, [core, ring]);

    const clockRef = useRef(0);
    const bornRef = useRef(new Map());      // id → render time it burst out
    const dissolvingRef = useRef([]);       // { id, x,y,z,dirKey, color, t }
    const seenRef = useRef(new Set());
    const reducedMotion = useMemo(() => prefersReducedMotion(), []);

    useFrame((_, rawDelta) => {
        const store = useGameStore.getState();
        const delta = store.wormPaused && store.wormAlive ? 0 : Math.min(rawDelta, 0.05);
        clockRef.current += delta;
        const now = clockRef.current;

        const drops = worm.droppedOrbs?.current ?? [];
        const born = bornRef.current;
        const seen = seenRef.current;
        seen.clear();
        for (const drop of drops) {
            seen.add(drop.id);
            if (!born.has(drop.id)) born.set(drop.id, now);
        }
        for (const id of born.keys()) if (!seen.has(id)) born.delete(id);

        // Expired orbs leave the sim's list; crumble them where they lay.
        const expired = worm.pendingDropDissolves?.current;
        const dissolving = dissolvingRef.current;
        if (expired?.length) {
            for (const gone of expired) dissolving.push({ ...gone, t: 0 });
            expired.length = 0;
            while (dissolving.length > POOL - MAX_DROPPED_ORBS) dissolving.shift();
        }
        if (!drops.length && !dissolving.length) {
            if (core.count) { core.count = 0; ring.count = 0; }
            return;
        }

        const coreFront = core.geometry.getAttribute('aDissolve');
        const ringFront = ring.geometry.getAttribute('aDissolve');
        let n = 0;
        const place = (color, front, visible, spinT, pos) => {
            _dummy.position.set(pos[0], pos[1], pos[2]);
            _q.setFromUnitVectors(_zAxis, _n.set(_normal[0], _normal[1], _normal[2]));
            _dummy.quaternion.copy(_q);
            _dummy.scale.setScalar(visible ? ORB_RADIUS : 0);
            _dummy.updateMatrix();
            core.setMatrixAt(n, _dummy.matrix);
            core.setColorAt(n, _col.set(color));
            coreFront.array[n] = front;
            // The ring stands up off the face and spins about its normal, like a
            // scattered ring turning on the spot.
            _spin.setFromAxisAngle(_n, spinT);
            _dummy.quaternion.copy(_spin).multiply(_q);
            _dummy.rotateX(Math.PI / 2);
            _dummy.scale.setScalar(visible ? RING_RADIUS : 0);
            _dummy.updateMatrix();
            ring.setMatrixAt(n, _dummy.matrix);
            ringFront.array[n] = front;
            n++;
        };

        for (const drop of drops) {
            if (n >= POOL) break;
            tileRestInto(drop, size);
            const t = now - (born.get(drop.id) ?? now) - (drop.delay ?? 0);
            let visible = t >= 0;
            if (reducedMotion) {
                _pos[0] = _rest[0]; _pos[1] = _rest[1]; _pos[2] = _rest[2];
            } else {
                const landed = dropFlightInto(_pos, drop.from, _rest, _normal, Math.max(0, t)) >= 1;
                if (landed) {
                    const bob = 0.03 * Math.sin(now * 3.2 + (drop.x + drop.y * 3 + drop.z * 7));
                    _pos[0] += _normal[0] * bob; _pos[1] += _normal[1] * bob; _pos[2] += _normal[2] * bob;
                }
                visible = visible && dropVisible(drop.ttl, now);
            }
            place(drop.color, 0, visible, reducedMotion ? 0 : now * 4.5, _pos);
        }

        for (let i = dissolving.length - 1; i >= 0; i--) {
            dissolving[i].t += delta;
            if (dissolving[i].t >= DROPPED_ORB_DISSOLVE) dissolving.splice(i, 1);
        }
        for (const gone of dissolving) {
            if (n >= POOL) break;
            tileRestInto(gone, size);
            place(gone.color, dropDissolveProgress(gone.t), true, reducedMotion ? 0 : now * 4.5, _rest);
        }

        core.count = n;
        ring.count = n;
        core.instanceMatrix.needsUpdate = true;
        ring.instanceMatrix.needsUpdate = true;
        if (core.instanceColor) core.instanceColor.needsUpdate = true;
        coreFront.needsUpdate = true;
        ringFront.needsUpdate = true;
    });

    return (
        <>
            <primitive object={core} dispose={null} />
            <primitive object={ring} dispose={null} />
        </>
    );
}
