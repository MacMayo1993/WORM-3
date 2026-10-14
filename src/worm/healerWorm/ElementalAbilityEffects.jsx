import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { readLiveTile } from '../wormHelpers.js';
import { wormSegments } from '../wormSegments.js';
import { FACE_NORMALS, ORB_HOVER_HEIGHT, ORB_ELEVATED_HOVER_HEIGHT } from './constants.js';
import { ELEMENT_ABILITIES } from './elementalAbilities.js';
import { prefersReducedMotion } from '../../utils/device.js';

const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const CAPACITY = 96, LINE_POINTS = 12 * 4 * 12;
function instances(geometry) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ transparent: true,
        opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), CAPACITY);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    return mesh;
}
// Three bounded instance batches and one line buffer for all abilities. Gameplay
// owns event ages and bud maturity, so pause/capture never changes their outcome.
export function ElementalAbilityEffects({ worm, size }) {
    const r = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        const bolts = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#e4caff', transparent: true, opacity: 0.9, toneMapped: false }));
        bolts.frustumCulled = false;
        return { flames: instances(new THREE.ConeGeometry(0.1, 0.4, 5)),
            buds: instances(new THREE.IcosahedronGeometry(0.11, 1)),
            rings: instances(new THREE.RingGeometry(0.28, 0.32, 24)), bolts,
            pose: new THREE.Object3D(), color: new THREE.Color(), p: new THREE.Vector3(), n: new THREE.Vector3(),
            head: new THREE.Vector3(), q: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), point: new THREE.Vector3(), last: new THREE.Vector3() };
    }, []);
    useEffect(() => () => {
        for (const mesh of [r.flames, r.buds, r.rings, r.bolts]) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose?.(); }
    }, [r]);
    useFrame(() => {
        const meshes = [r.flames, r.buds, r.rings];
        const previous = meshes.map(m => m.count);
        for (const m of meshes) m.count = 0;
        r.bolts.geometry.setDrawRange(0, 0);
        const a = worm.elementalAbilities?.current, store = useGameStore.getState();
        if (!a || !store.wormAlive || worm.phase.current !== 'crawling') return;
        const reduced = store.settings?.reducedMotion || prefersReducedMotion();
        const time = worm.timeAlive?.current ?? 0;
        const active = type => (worm.elementalT?.current ?? 0) > 0 && (worm.elementalType.current === type || worm.elementalPair.current === type);
        const tilePose = (tile, out, height = 0.08) => {
            if (!readLiveTile(tile, out, r.n)) {
                out.fromArray(getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0));
                r.n.copy(FACE_NORMALS[tile.dirKey]);
            }
            out.addScaledVector(r.n, height);
        };
        const put = (mesh, point, normal, scale, color, stretch = 1) => {
            if (mesh.count >= CAPACITY) return;
            r.pose.position.copy(point);
            r.pose.quaternion.setFromUnitVectors(mesh === r.flames ? UP : Z, normal);
            r.pose.scale.set(scale, mesh === r.flames ? scale * stretch : scale, mesh === r.flames ? scale : scale * stretch);
            r.pose.updateMatrix(); mesh.setMatrixAt(mesh.count, r.pose.matrix);
            mesh.setColorAt(mesh.count++, r.color.set(color));
        };
        for (const orb of worm.powerups.current) {
            if (!orb.ignited && !orb.garden) continue;
            const sticker = store.cubies?.[orb.x]?.[orb.y]?.[orb.z]?.stickers?.[orb.dirKey];
            tilePose(orb, r.p, sticker && sticker.curr !== sticker.orig ? ORB_ELEVATED_HOVER_HEIGHT : ORB_HOVER_HEIGHT);
            if (orb.ignited && active('fire') && a.fireBonus > 0) {
                for (let j = 0; j < 3; j++) {
                    r.q.copy(r.p).addScaledVector(r.n, 0.08 + j * 0.09);
                    put(r.flames, r.q, r.n, 1 - j * 0.2, j === 2 ? '#fff1a3' : '#ff7a25', reduced ? 1 : 1 + 0.2 * Math.sin(time * 8 + j));
                }
                put(r.rings, r.p, r.n, 1.2, '#ffb43c');
            }
            if (orb.garden) {
                const maturity = 1 - Math.min(1, orb.garden.remaining / ELEMENT_ABILITIES.gardenRipen);
                put(r.buds, r.p, r.n, 0.65 + maturity * 1.1, maturity === 1 ? '#ffe27a' : '#6feb84');
                tilePose(orb, r.q, 0.1);
                put(r.flames, r.q, r.n, 0.6, '#42ce72', 1.2);
                put(r.rings, r.q, r.n, 0.7 + maturity * 0.35, maturity === 1 ? '#ffe27a' : '#42ce72');
            }
        }
        if (wormSegments.count) r.head.fromArray(wormSegments.positions);
        else r.head.copy(worm.headInterpPos.current);
        r.n.copy(worm.currentNormal.current);
        if (active('water')) {
            const momentum = worm.waterMomentum.current;
            r.p.copy(r.head).addScaledVector(r.n, -0.08);
            put(r.rings, r.p, r.n, 1 + momentum * 1.8, momentum >= 0.8 ? '#ccfaff' : '#3fafff', 0.65);
        }
        if (active('fire')) {
            const heat = a.fireReady ? 6 : a.heat.size;
            // Six pips give the heat meter a readable spatial count around the head.
            for (let i = 0; i < heat; i++) {
                r.pose.quaternion.setFromUnitVectors(Z, r.n);
                r.p.set(Math.cos(i * Math.PI / 3) * 0.36, Math.sin(i * Math.PI / 3) * 0.36, 0).applyQuaternion(r.pose.quaternion).add(r.head);
                put(r.buds, r.p, r.n, 0.4, a.fireReady ? '#ffe19a' : '#ff7a25');
            }
            if (a.fireDashT > 0) {
                put(r.rings, r.head, r.n, 2.2, '#ff9a35');
                r.from.copy(r.head);
                if (wormSegments.count > 1) r.from.sub(r.q.fromArray(wormSegments.positions, 3)).normalize();
                else r.from.set(0, 1, 0);
                for (let j = 0; j < 4; j++) {
                    r.p.copy(r.head).addScaledVector(r.from, 0.18 + j * 0.17);
                    put(r.flames, r.p, r.from, 1.5 - j * 0.2, j > 1 ? '#ffeaa0' : '#ff7625', 1.5);
                }
            }
        }
        if (active('ice') && (a.iceShield || a.icePhaseT > 0)) {
            put(r.rings, r.head, r.n, a.icePhaseT > 0 ? 1.8 : 1.15, '#d7f7ff');
            for (let j = 0; j < 4; j++) {
                r.p.copy(r.head).addScaledVector(r.n, (j - 1.5) * 0.12);
                put(r.buds, r.p, r.n, a.icePhaseT > 0 ? 0.4 : 0.6, '#a5dfff');
            }
        }
        if (active('air') && worm.isJumping.current) {
            put(r.rings, r.head, r.n, a.gliding ? 1.8 : 1.3, '#b9f5ed', 0.6);
        }
        if (active('lightning')) put(r.rings, r.head, r.n, 0.6 + 0.7 * (1 - a.lightningT / ELEMENT_ABILITIES.lightningCooldown), '#d0abff');
        let lineCount = 0;
        const positions = r.bolts.geometry.attributes.position;
        for (const event of a.events) {
            const progress = 1 - event.ttl / 0.65;
            const color = event.kind === 'fire' ? '#ff933b' : event.kind === 'garden' ? '#7aef92' : event.kind === 'lightning' ? '#e4caff' : '#c6f1ff';
            tilePose(event.tiles[0], r.p);
            put(r.rings, r.p, r.n, reduced ? 1.5 : 1 + progress * 3, color);
            if (event.kind !== 'lightning') continue;
            for (let i = 1; i < event.tiles.length; i++) {
                tilePose(event.tiles[i - 1], r.from, 0.3); tilePose(event.tiles[i], r.to, 0.3);
                r.last.copy(r.from);
                for (let j = 1; j <= 6 && lineCount + 2 <= LINE_POINTS; j++) {
                    const t = j / 6;
                    r.point.lerpVectors(r.from, r.to, t);
                    // Keep the arc outside the shell when it crosses a cube edge.
                    const extent = Math.max(Math.abs(r.point.x), Math.abs(r.point.y), Math.abs(r.point.z));
                    const shell = Math.min(r.from.length(), r.to.length(), size / 2 + 0.25);
                    if (extent > 0 && extent < shell) r.point.multiplyScalar(shell / extent);
                    if (!reduced && j < 6) r.point.addScaledVector(r.n, Math.sin(j * 7 + event.id) * 0.08);
                    positions.setXYZ(lineCount++, r.last.x, r.last.y, r.last.z);
                    positions.setXYZ(lineCount++, r.point.x, r.point.y, r.point.z); r.last.copy(r.point);
                }
            }
        }
        r.bolts.geometry.setDrawRange(0, lineCount);
        if (lineCount) positions.needsUpdate = true;
        meshes.forEach((mesh, i) => { if (mesh.count || previous[i]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } });
    });
    return <group name="elemental-ability-feedback"><primitive object={r.flames} /><primitive object={r.buds} /><primitive object={r.rings} /><primitive object={r.bolts} /></group>;
}
