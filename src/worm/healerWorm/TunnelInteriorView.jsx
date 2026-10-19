import { makeInteriorTileBatches } from './interiorTileBatches.js';
import { wormExpansion } from '../wormExpansion.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
// src/worm/healerWorm/TunnelInteriorView.jsx
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { ANTIPODAL_COLOR, SURFACE_OFFSET } from '../../utils/constants.js';
import { resolveCubeViewAppearance } from '../../3d/cubeViewAppearance.js';
import { withPortalCutout } from '../../3d/portalCutout.js';
import { makeInteriorPortals, syncInteriorPortals, interiorPortalGLSL } from './interiorPortals.js';
import { prefersReducedMotion } from '../../utils/device.js';

// ─── Tunnel Interior View — all 6 inner faces of the Rubik's cube ────────────
// During wormhole traversal shows the coloured back-sides of every sticker on
// all 6 faces so the camera looks like it is inside the cube.

// Keep the patterned antipodal walls readable behind the bright track and core.
const DIM_STRENGTH = 0.48;

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
    const materialSnapshot = useRef({ cubies: null, settings: null, cap: null });
    const portalColorSnapshot = useRef({});
    const portals = useMemo(() => makeInteriorPortals(), []);
    const tiles = useMemo(() => makeInteriorTileBatches(portals.uniforms), [portals]);
    useEffect(() => () => {
        portals.dispose();
        tiles.dispose();
    }, [portals, tiles]);
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

    useEffect(() => () => {
        backingGeo.dispose(); dimGeo.dispose();
    }, [backingGeo, dimGeo]);

    useFrame((_state, delta) => {
        const phase = worm.phase.current;
        // Show the room through the open entrance before the lens crosses the
        // shell. A phase-boundary fade exposed a dark backing for a few frames.
        const inTraversal = ['windup', 'entering', 'tunnel', 'exiting', 'windout'].includes(phase);
        const active = inTraversal;
        const tunnel = worm.activeTunnel?.current ?? worm.tunnelPassages?.current?.at(-1)?.tunnel ?? null;
        syncInteriorPortals(portals, tunnel, size, expansion);

        // Refresh on cube, layout, equipped styles, or a temporary view changing.
        // Pickups can change while the same paused tunnel and cube stay mounted.
        const st = useGameStore.getState(), cap = selectEffectiveFlipCap(st);
        const viewPower = st.wormHealerMode ? st.wormViewPower : null;
        const changed = materialSnapshot.current.cubies !== st.cubies || materialSnapshot.current.settings !== st.settings || materialSnapshot.current.cap !== cap
            || materialSnapshot.current.layout !== stickerLayout || materialSnapshot.current.viewPower !== viewPower;
        if (!st.wormPaused && !st.settings?.reducedMotion && !prefersReducedMotion()) portals.time.value += Math.min(delta, 0.05);
        const portalColors = portalColorSnapshot.current;
        if (tunnel && (portalColors.tunnel !== tunnel || portalColors.cubies !== st.cubies || portalColors.settings !== st.settings || portalColors.viewPower !== viewPower)) {
            const { colors: fc } = resolveCubeViewAppearance(st.settings, viewPower);
            for (let side = 0; side < 2; side++) {
                const cell = side === 0 ? tunnel.entry : tunnel.exit;
                const sticker = st.cubies?.[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey];
                portals.mouths[side].material.uniforms.uColor.value.set(fc[ANTIPODAL_COLOR[sticker?.curr]] ?? '#88ccff');
            }
            portalColorSnapshot.current = { tunnel, cubies: st.cubies, settings: st.settings, viewPower };
        }
        // Prepare hidden walls too: the run-start compile sees the exact portal
        // variant used on entry, instead of linking hundreds of tiles mid-dive.
        if (changed) {
            tiles.sync(stickerLayout, st.cubies, st.settings, cap, viewPower);
            materialSnapshot.current = { cubies: st.cubies, settings: st.settings, cap, layout: stickerLayout, viewPower };
        }
        if (groupRef.current) groupRef.current.visible = active;
        if (backingMatRef.current) backingMatRef.current.opacity = active ? 1 : 0;
        if (dimMatRef.current) dimMatRef.current.opacity = active ? DIM_STRENGTH : 0;

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
            <primitive object={tiles.group} dispose={null} />
            {portals.mouths.map(mouth => <primitive key={mouth.name} object={mouth} dispose={null} />)}
        </group>
    );
}
