// src/worm/healerWorm/TunnelInteriorView.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getManifoldMap } from '../../game/manifoldMapStore.js';
import { findAntipodalStickerByGrid } from '../../game/manifoldLogic.js';
import { ANTIPODAL_COLOR, FACE_COLORS, SURFACE_OFFSET } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';

// ─── Tunnel Interior View — all 6 inner faces of the Rubik's cube ────────────
// During wormhole traversal shows the coloured back-sides of every sticker on
// all 6 faces so the camera looks like it is inside the cube.

// How far down the interior faces are tinted while riding. High enough that the
// tunnel is clearly the brightest thing in frame, low enough that the antipodal
// tile colours — the reason this view exists — stay legible behind it.
const DIM_STRENGTH = 0.34;

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
    const wireMatRef = useRef();
    const backingMatRef = useRef();
    const dimMatRef = useRef();
    const stickerMeshesRef = useRef([]);
    const opacityRef = useRef(0);
    const prevPhaseRef = useRef('crawling');
    const stickerMatsAssigned = useRef(false);

    // Precompute every surface sticker's world position and rotation (size-dependent only).
    // Antipodal partner resolution is deferred to tunnel-entry time so it always reflects
    // the current manifold map rather than the geometric (n-sx, n-sy, n-sz) position that
    // becomes wrong after any slice rotation or scramble.
    const stickerLayout = useMemo(() => {
        const n = size - 1;
        const layout = [];
        for (const { dirKey, pos } of _FACE_DEFS) {
            const [rx, ry, rz] = _INWARD_FACE_EULER[dirKey];
            for (let a = 0; a < size; a++) {
                for (let b = 0; b < size; b++) {
                    const [sx, sy, sz] = pos(a, b, n);
                    const wp = getStickerWorldPos(sx, sy, sz, dirKey, size, 0);
                    if (!wp) continue;
                    layout.push({
                        sx, sy, sz, dirKey, px: wp[0], py: wp[1], pz: wp[2], rx, ry, rz,
                    });
                }
            }
        }
        return layout;
    }, [size]);

    // One merged BufferGeometry of 12-edge outlines for every cubie.
    const edgeGeo = useMemo(() => {
        const k = (size - 1) / 2;
        const hs = 0.46;
        const pts = new Float32Array(size ** 3 * 72);
        let i = 0;
        const ln = (ax, ay, az, bx, by, bz) => {
            pts[i++]=ax; pts[i++]=ay; pts[i++]=az;
            pts[i++]=bx; pts[i++]=by; pts[i++]=bz;
        };
        for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
            const cx=x-k, cy=y-k, cz=z-k;
            ln(cx-hs,cy-hs,cz-hs, cx+hs,cy-hs,cz-hs); ln(cx-hs,cy+hs,cz-hs, cx+hs,cy+hs,cz-hs);
            ln(cx-hs,cy-hs,cz+hs, cx+hs,cy-hs,cz+hs); ln(cx-hs,cy+hs,cz+hs, cx+hs,cy+hs,cz+hs);
            ln(cx-hs,cy-hs,cz-hs, cx-hs,cy+hs,cz-hs); ln(cx+hs,cy-hs,cz-hs, cx+hs,cy+hs,cz-hs);
            ln(cx-hs,cy-hs,cz+hs, cx-hs,cy+hs,cz+hs); ln(cx+hs,cy-hs,cz+hs, cx+hs,cy+hs,cz+hs);
            ln(cx-hs,cy-hs,cz-hs, cx-hs,cy-hs,cz+hs); ln(cx+hs,cy-hs,cz-hs, cx+hs,cy-hs,cz+hs);
            ln(cx-hs,cy+hs,cz-hs, cx-hs,cy+hs,cz+hs); ln(cx+hs,cy+hs,cz-hs, cx+hs,cy+hs,cz+hs);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        return geo;
    }, [size]);

    const planeGeo = useMemo(() => new THREE.PlaneGeometry(0.88, 0.88), []);

    // Solid black backing box, seen from inside (BackSide) — sits just beyond the sticker
    // planes so it shows through the gaps between tiles instead of background/exterior cube.
    const backingGeo = useMemo(() => {
        const half = (size - 1) / 2 + SURFACE_OFFSET + 0.03;
        return new THREE.BoxGeometry(half * 2, half * 2, half * 2);
    }, [size]);

    // Dimming shell — sits just INSIDE the sticker planes and is drawn after them,
    // so it tints the whole interior down. Without it the six inner faces sit at
    // full saturation and fill the frame during the ride, competing with the very
    // thing the player is supposed to be looking at. Tinting rather than fading
    // keeps the antipodal colours readable, which is the point of this view.
    const dimGeo = useMemo(() => {
        const half = (size - 1) / 2 + SURFACE_OFFSET - 0.02;
        return new THREE.BoxGeometry(half * 2, half * 2, half * 2);
    }, [size]);

    // Set static positions/rotations after mount (or size change).
    useEffect(() => {
        stickerLayout.forEach(({ px, py, pz, rx, ry, rz }, i) => {
            const m = stickerMeshesRef.current[i];
            if (!m) return;
            m.position.set(px, py, pz);
            m.rotation.set(rx, ry, rz);
        });
    }, [stickerLayout]);

    useEffect(() => () => {
        edgeGeo.dispose(); planeGeo.dispose(); backingGeo.dispose(); dimGeo.dispose();
    }, [edgeGeo, planeGeo, backingGeo, dimGeo]);

    useFrame((_, delta) => {
        const phase = worm.phase.current;
        const prevPhase = prevPhaseRef.current;
        // Only while the camera is genuinely inside. Including 'entering' meant the
        // interior shell was drawn during the dive, which — with the real cube hidden
        // at the same time — let the player see straight through the near walls to the
        // far inner faces. The dive is an exterior shot; the cube must look solid.
        const active = phase === 'tunnel' || phase === 'exiting';

        // Batch-assign sticker materials ONCE on tunnel entry (opacity still ~0, so no visible pop).
        // Avoids 54+ per-frame GPU state changes that caused hitching on the first visible frame.
        // Partner sticker is resolved via the manifold map so scrambled/rotated states are correct.
        if (prevPhase === 'windup' && phase === 'entering') {
            const st = useGameStore.getState();
            const { cubies, settings } = st;
            const fc = resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS;
            const manifoldStyles = settings?.manifoldStyles ?? {};
            const manifoldMap = getManifoldMap(cubies, size, st.rotationEpoch);
            for (let i = 0; i < stickerLayout.length; i++) {
                const { sx, sy, sz, dirKey } = stickerLayout[i];
                const mesh = stickerMeshesRef.current[i];
                if (!mesh) continue;
                const sticker = cubies?.[sx]?.[sy]?.[sz]?.stickers?.[dirKey];
                if (!sticker) { mesh.visible = false; continue; }
                const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
                const antipodalFaceId = antipodalLoc?.sticker?.curr;
                if (!antipodalFaceId) { mesh.visible = false; continue; }
                const colorHex = fc[antipodalFaceId] ?? '#444';
                const style = manifoldStyles[antipodalFaceId] ?? 'solid';
                const antiColorHex = fc[ANTIPODAL_COLOR[antipodalFaceId]] ?? '#ffffff';
                mesh.material = getTileStyleMaterial(style, colorHex, false, null, antiColorHex);
                mesh.visible = false; // revealed gradually by opacity ramp
            }
            stickerMatsAssigned.current = true;
        }
        // Clear assignment flag on tunnel exit so the next transit gets fresh sticker colors
        if (!active && prevPhase !== 'crawling') stickerMatsAssigned.current = false;

        prevPhaseRef.current = phase;

        opacityRef.current += ((active ? 1 : 0) - opacityRef.current) * Math.min(1, delta * (active ? 10 : 5));
        const opacity = opacityRef.current;

        if (wireMatRef.current) wireMatRef.current.opacity = opacity * 0.45;
        if (backingMatRef.current) backingMatRef.current.opacity = opacity;
        if (dimMatRef.current) dimMatRef.current.opacity = opacity * DIM_STRENGTH;

        const meshes = stickerMeshesRef.current;
        if (!active || opacity < 0.01 || !stickerMatsAssigned.current) {
            for (const m of meshes) if (m) m.visible = false;
            return;
        }

        // Materials already assigned — just reveal stickers as opacity ramps in
        for (let i = 0; i < stickerLayout.length; i++) {
            const mesh = meshes[i];
            if (mesh) mesh.visible = true;
        }
    });

    return (
        <>
            {/* Solid black backing — fills the gaps between tiles like real Rubik's plastic */}
            <mesh geometry={backingGeo} frustumCulled={false}>
                <meshBasicMaterial ref={backingMatRef} color="#000000" side={THREE.BackSide} transparent opacity={0} depthWrite={true} />
            </mesh>
            {/* Interior dimmer. renderOrder 1 puts it after the sticker planes (0) so it
                tints them, and before TunnelTube (2) so the shaft still reads at full
                strength against a darkened room. */}
            <mesh geometry={dimGeo} frustumCulled={false} renderOrder={1}>
                <meshBasicMaterial ref={dimMatRef} color="#05060c" side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Black plastic skeleton — all cubie edges in one draw call */}
            <lineSegments geometry={edgeGeo} frustumCulled={false}>
                <lineBasicMaterial ref={wireMatRef} color="#222222" transparent opacity={0} depthWrite={false} />
            </lineSegments>
            {/* All 6 faces × size² sticker planes, coloured imperatively */}
            {stickerLayout.map((_, i) => (
                <mesh
                    key={i}
                    ref={el => { stickerMeshesRef.current[i] = el; }}
                    visible={false}
                    frustumCulled={false}
                >
                    <primitive object={planeGeo} attach="geometry" />
                    <meshBasicMaterial color="#1a1a1a" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
            ))}
        </>
    );
}
