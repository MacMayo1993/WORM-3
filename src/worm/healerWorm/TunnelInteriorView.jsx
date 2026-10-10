import { bindTileStyleIdentity } from '../../3d/tileStyleIdentity.js';
import { wormExpansion } from '../wormExpansion.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
// src/worm/healerWorm/TunnelInteriorView.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { ANTIPODAL_COLOR, FACE_COLORS, SURFACE_OFFSET } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import { withPortalCutout } from '../../3d/portalCutout.js';
import { makeInteriorPortals, syncInteriorPortals, interiorPortalGLSL } from './interiorPortals.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { getWormTunnelSnapshot } from '../tunnelSnapshot.js';
import { WORM_PAD_HEIGHT } from '../../game/raisedCubie.js';
import { tunnelRouteKey } from './tunnelTubePool.js';

// ─── Tunnel Interior View — all 6 inner faces of the Rubik's cube ────────────
// During wormhole traversal shows the coloured back-sides of every sticker on
// all 6 faces so the camera looks like it is inside the cube.

// Keep the patterned antipodal walls readable behind the bright track and core.
const DIM_STRENGTH = 0.48;

// Maps each face direction to its antipodal (opposite) face direction.

// Euler angles to rotate a PlaneGeometry (default +Z normal) so its front face
// points INWARD (toward the cube centre) for each cube face direction.
const _INWARD_FACE_EULER = {
    PZ: [0, Math.PI, 0],
    NZ: [0, 0, 0],
    PX: [0, -Math.PI / 2, 0],
    NX: [0, Math.PI / 2, 0],
    PY: [Math.PI / 2, 0, 0],
    NY: [-Math.PI / 2, 0, 0],
};
// All 6 faces with their (a,b) → (sx,sy,sz) mapping.
const _FACE_DEFS = [
    { dirKey: 'PZ', pos: (a, b, n) => [a, b, n] },
    { dirKey: 'NZ', pos: (a, b)    => [a, b, 0] },
    { dirKey: 'PX', pos: (a, b, n) => [n, a, b] },
    { dirKey: 'NX', pos: (a, b)    => [0, a, b] },
    { dirKey: 'PY', pos: (a, b, n) => [a, n, b] },
    { dirKey: 'NY', pos: (a, b)    => [a, 0, b] },
];

export function TunnelInteriorView({ worm, size }) {
    const groupRef = useRef();
    const backingMatRef = useRef();
    const dimMatRef = useRef();
    const stickerMeshesRef = useRef([]);
    const prevPhaseRef = useRef('crawling');
    const stickerMatsAssigned = useRef(false);
    const materialSnapshot = useRef({ cubies: null, settings: null, cap: null });
    const portalColorSnapshot = useRef({});
    const networkSnapshot = useRef({});
    const portals = useMemo(() => makeInteriorPortals(), []);
    const ownedMaterials = useMemo(() => new Map(), []);
    useEffect(() => () => {
        portals.dispose();
        ownedMaterials.forEach(material => material.dispose());
    }, [portals, ownedMaterials]);
    const clipBacking = useMemo(() => material => {
        withPortalCutout(material, portals.uniforms, interiorPortalGLSL, 'interior');
    }, [portals]);

    // Precompute every surface sticker's world position and rotation (size-dependent only).
    // Materials read each tile's live outward color, then its antipodal back,
    // exactly as StickerPlane does, including after flips and slice rotations.
    const expansion = useGameStore(s => s.wormPhase === 'crawling' ? 0 : wormExpansion.amount);
    const scale = cubeExpansionScale(size, expansion);
    const stickerLayout = useMemo(() => {
        const n = size - 1;
        const layout = [];
        for (const { dirKey, pos } of _FACE_DEFS) {
            const [rx, ry, rz] = _INWARD_FACE_EULER[dirKey];
            for (let a = 0; a < size; a++) {
                for (let b = 0; b < size; b++) {
                    const [sx, sy, sz] = pos(a, b, n);
                    const wp = getStickerWorldPos(sx, sy, sz, dirKey, size, expansion);
                    if (!wp) continue;
                    layout.push({
                        sx, sy, sz, dirKey, px: wp[0], py: wp[1], pz: wp[2], rx, ry, rz,
                    });
                }
            }
        }
        return layout;
    }, [size, expansion]);

    const planeGeo = useMemo(() => new THREE.PlaneGeometry(0.88, 0.88), []);
    const placeholder = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0, depthWrite: false }), []);

    // Solid black backing box, seen from inside (BackSide) — sits just beyond the sticker
    // planes so it shows through the gaps between tiles instead of background/exterior cube.
    const backingGeo = useMemo(() => {
        const half = (size - 1) / 2 * scale + SURFACE_OFFSET + 0.03;
        return new THREE.BoxGeometry(half * 2, half * 2, half * 2);
    }, [size, scale]);

    // Dimming shell — sits just INSIDE the sticker planes and is drawn after them,
    // so it tints the whole interior down. Without it the six inner faces sit at
    // full saturation and fill the frame during the ride, competing with the very
    // thing the player is supposed to be looking at. Tinting rather than fading
    // keeps the antipodal colours readable, which is the point of this view.
    const dimGeo = useMemo(() => {
        const half = (size - 1) / 2 * scale + SURFACE_OFFSET - 0.02;
        return new THREE.BoxGeometry(half * 2, half * 2, half * 2);
    }, [size, scale]);

    // Set static positions/rotations after mount (or size change).
    useEffect(() => {
        stickerMatsAssigned.current = false;
        stickerLayout.forEach(({ px, py, pz, rx, ry, rz }, i) => {
            const m = stickerMeshesRef.current[i];
            if (!m) return;
            m.position.set(px, py, pz);
            m.rotation.set(rx, ry, rz);
        });
    }, [stickerLayout]);

    useEffect(() => () => {
        backingGeo.dispose(); dimGeo.dispose();
    }, [backingGeo, dimGeo]);
    useEffect(() => () => planeGeo.dispose(), [planeGeo]);
    useEffect(() => () => placeholder.dispose(), [placeholder]);

    useFrame((_state, delta) => {
        const phase = worm.phase.current;
        const prevPhase = prevPhaseRef.current;
        // Show the room through the open entrance before the lens crosses the
        // shell. A phase-boundary fade exposed a dark backing for a few frames.
        const inTraversal = ['windup', 'entering', 'tunnel', 'exiting', 'windout'].includes(phase);
        const active = inTraversal;
        const tunnel = worm.activeTunnel?.current ?? worm.tunnelPassages?.current?.at(-1)?.tunnel ?? null;
        const st = useGameStore.getState(), cap = selectEffectiveFlipCap(st);
        const old = networkSnapshot.current;
        if (old.cubies !== st.cubies || old.size !== size || old.epoch !== st.rotationEpoch || old.cap !== cap || old.tunnel !== tunnel || old.expansion !== expansion) {
            // Share the simulation's cached topology; don't scan the cube each frame.
            const snapshot = getWormTunnelSnapshot(st.cubies, size, st.rotationEpoch);
            const routes = tunnel ? [tunnel] : [];
            const seen = new Set(routes.map(tunnelRouteKey));
            for (const { tunnel: route } of snapshot.tunnels) {
                const key = tunnelRouteKey(route);
                if (seen.has(key)) continue;
                if ([route.entry, route.exit].some(cell =>
                    (st.cubies[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey]?.flips ?? cap) >= cap)) continue;
                seen.add(key);
                routes.push({ ...route, padHeight: WORM_PAD_HEIGHT, padExpansion: expansion });
            }
            networkSnapshot.current = { cubies: st.cubies, size, epoch: st.rotationEpoch, cap, tunnel, expansion, routes };
        }
        const routes = inTraversal ? networkSnapshot.current.routes : [];
        const hasPortals = routes.length > 0;
        syncInteriorPortals(portals, routes, size, expansion);

        // Assign on the first observed transit frame and on actual cube/style
        // changes. Avoids 54+ per-frame GPU state changes while still refreshing
        // backs when a pair heals or the player changes the equipped styles.
        const changed = materialSnapshot.current.cubies !== st.cubies || materialSnapshot.current.settings !== st.settings || materialSnapshot.current.cap !== cap
            || materialSnapshot.current.portals !== hasPortals;
        if (!st.wormPaused && !st.settings?.reducedMotion && !prefersReducedMotion()) portals.time.value += Math.min(delta, 0.05);
        const portalColors = portalColorSnapshot.current;
        if (hasPortals && (portalColors.routes !== routes || portalColors.cubies !== st.cubies || portalColors.settings !== st.settings)) {
            const fc = resolveColors(st.settings, st.settings?.biomeMode?.faceAssignment) || FACE_COLORS;
            for (let i = 0; i < portals.uniforms.uInteriorCount.value; i++) {
                const route = routes[Math.floor(i / 2)];
                const cell = i % 2 === 0 ? route.entry : route.exit;
                const sticker = st.cubies?.[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey];
                portals.mouths[i].material.uniforms.uColor.value.set(fc[ANTIPODAL_COLOR[sticker?.curr]] ?? '#88ccff');
            }
            portalColorSnapshot.current = { routes, cubies: st.cubies, settings: st.settings };
        }
        if (inTraversal && (!stickerMatsAssigned.current || changed)) {
            const { cubies, settings } = st;
            const fc = resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS;
            const manifoldStyles = settings?.manifoldStyles ?? {};
            const usedMaterials = new Set();
            for (let i = 0; i < stickerLayout.length; i++) {
                const { sx, sy, sz, dirKey } = stickerLayout[i];
                const mesh = stickerMeshesRef.current[i];
                if (!mesh) continue;
                const sticker = cubies?.[sx]?.[sy]?.[sz]?.stickers?.[dirKey];
                if (!sticker) { mesh.visible = false; continue; }
                const antipodalFaceId = ANTIPODAL_COLOR[sticker.curr];
                if (!antipodalFaceId) { mesh.visible = false; continue; }
                const dead = sticker.flips >= cap;
                const colorHex = dead ? '#555555' : (fc[antipodalFaceId] ?? '#444');
                const style = dead ? 'solid' : (manifoldStyles[antipodalFaceId] ?? 'solid');
                const antiColorHex = fc[ANTIPODAL_COLOR[antipodalFaceId]] ?? '#ffffff';
                mesh.onBeforeRender = bindTileStyleIdentity(sticker.origPos, sticker.orig);
                const source = getTileStyleMaterial(style, colorHex, false, null, antiColorHex);
                if (hasPortals) {
                    usedMaterials.add(source);
                    if (!ownedMaterials.has(source)) {
                        const material = source.clone();
                        // Keep the tile cache's animation clock; customize only this interior.
                        material.uniforms = { ...source.uniforms };
                        ownedMaterials.set(source, withPortalCutout(material, portals.uniforms, interiorPortalGLSL, 'interior'));
                    }
                    mesh.material = ownedMaterials.get(source);
                } else mesh.material = source;
                mesh.visible = false; // revealed together once materials are assigned
            }
            stickerMatsAssigned.current = true;
            materialSnapshot.current = { cubies, settings, cap, portals: hasPortals };
            ownedMaterials.forEach((material, source) => {
                if (!usedMaterials.has(source)) { material.dispose(); ownedMaterials.delete(source); }
            });
        }
        // Clear assignment flag once the whole traversal is over, so the next transit
        // gets fresh sticker colours. Gated on inTraversal, not active — 'entering' is
        // part of the trip even though nothing is drawn yet.
        if (!inTraversal && prevPhase !== 'crawling') stickerMatsAssigned.current = false;

        prevPhaseRef.current = phase;

        const opacity = active ? 1 : 0;
        if (groupRef.current) groupRef.current.visible = active && opacity >= 0.01;

        if (backingMatRef.current) backingMatRef.current.opacity = opacity;
        if (dimMatRef.current) dimMatRef.current.opacity = opacity * DIM_STRENGTH;

        const meshes = stickerMeshesRef.current;
        if (!active || opacity < 0.01 || !stickerMatsAssigned.current) {
            for (const m of meshes) if (m) m.visible = false;
            return;
        }

        // Materials already assigned — reveal the complete room in this frame
        for (let i = 0; i < stickerLayout.length; i++) {
            const mesh = meshes[i];
            if (mesh) mesh.visible = true;
        }
    });

    return (
        <group ref={groupRef} name="tunnel-interior" visible={false}>
            {/* Solid black backing — fills the gaps between tiles like real Rubik's plastic */}
            <mesh geometry={backingGeo} frustumCulled={false}>
                <meshBasicMaterial ref={backingMatRef} onUpdate={clipBacking} color="#000000" side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Interior dimmer. renderOrder 1 puts it after the sticker planes (0) so it
                tints them, and before TunnelTube (2) so the shaft still reads at full
                strength against a darkened room. */}
            <mesh geometry={dimGeo} frustumCulled={false} renderOrder={1}>
                <meshBasicMaterial ref={dimMatRef} onUpdate={clipBacking} color="#05060c" side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* All 6 faces × size² sticker planes, coloured imperatively */}
            {stickerLayout.map(({ sx, sy, sz, dirKey }, i) => (
                <mesh
                    key={i}
                    name={`tunnel-interior-${sx}-${sy}-${sz}-${dirKey}`}
                    dispose={null}
                    material={placeholder}
                    ref={el => { stickerMeshesRef.current[i] = el; }}
                    visible={false}
                    frustumCulled={false}
                >
                    <primitive object={planeGeo} attach="geometry" />
                </mesh>
            ))}
            {portals.mouths.map(mouth => <primitive key={mouth.name} object={mouth} dispose={null} />)}
        </group>
    );
}
