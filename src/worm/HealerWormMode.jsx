// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — complete rewrite.
// Chase camera follows the worm crawling on the cube exterior.
// Disparity Level 1 runs in background. Flipped tiles are instant wormholes; jump to clear them.

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerWorldPos } from '../game/coordinates.js';
import { getActiveTunnels, getTunnelWorldPosInto, getWindWorldPosInto, findStickerByStableKey, isTileInSlice, makeTunnelCenterline, buildTunnelCenterlineInto, tunnelTToArc, getTunnelArcPosInto } from './wormLogic.js';
import { setWormTurnCallback } from './wormTurnBridge.js';
import { buildManifoldGridMap, buildManifoldGridMapIncremental, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { getStickerSafe } from '../game/cubeState.js';
import { DIR_TO_VEC, VEC_TO_DIR, ANTIPODAL_COLOR, FACE_COLORS, SURFACE_OFFSET } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import {
    WORM_LIFT,
    FACE_NORMALS,
    DIR_FORWARD,
    ORB_SEGMENT_GROWTH,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    MAX_TAIL,
    HEAL_COST,
    SURFACE_JUMP_HEIGHT,
    BOOST_MULTIPLIER,
    BOOST_DURATION,
    BOOST_COOLDOWN,
    AUTO_ROTATE_WARNING,
    SCRAMBLE_STEPS,
    ACTIVE_ROTATE_INTERVAL,
    COUNTDOWN_STEP_DURATION,
    WORMHOLE_MAX_TRAVERSALS,
    GLASS_MIN_OPACITY,
    GLASS_MAX_OPACITY,
    GLASS_MIN_TRANSMISSION,
    GLASS_MAX_TRANSMISSION,
    TUNNEL_SPEED_SCALE,
    DEFAULT_POWERUP_COUNT,
} from './healerWorm/constants.js';
import ParityOrbs, { OrbCollectEffect } from './ParityOrb.jsx';
import { isMobile as _isMobile } from '../utils/device.js';
import WormHat3D from './wormCosmetics.jsx';
import { getSkin, _hatAlignQuat, _hatYUp } from './wormCosmeticsData.js';
import { getWormCharacter } from './wormCharacterData.js';
import { EARN_ORB_COLLECT, EARN_WORM_SURVIVAL_TICK, EARN_WORM_HEALED_FACE, SURVIVAL_TICK_INTERVAL } from '../utils/economyConstants.js';
import { liveRotation } from './liveRotation.js';
import { liveCubies } from './liveCubies.js';
import { shAt, ttAt } from './circularBuffers.js';
import { rideLiveRotation, getSliceSurfaceStickers, _parseTile, checkWormHitBySlice, cutWormTail, ensureOrbContrast } from './wormHelpers.js';
import { useWormCrawler } from './useWormCrawler.js';
import WormChaseCamera from './WormChaseCamera.jsx';
import WormSwipeControls from './WormSwipeControls.jsx';
import { UI_FONT, DISPLAY_FONT } from '../utils/uiTheme.js';



const SPAWN_DURATION = 0.75;

// Pre-allocated scratch vectors for TunnelSurfFX sparks
const _sparkCenter = new THREE.Vector3();
const _sparkForward = new THREE.Vector3();
const _sparkUp = new THREE.Vector3();
const _sparkRight = new THREE.Vector3();
const _tunnelDirScratch = new THREE.Vector3();

// Pre-allocated scratch vectors for mapOrientedDirection (called on every input event)
const _mapCamForward = new THREE.Vector3();
const _mapCamUp = new THREE.Vector3();
const _mapCamRight = new THREE.Vector3();
const _mapDesired = new THREE.Vector3();
const _mapCandVec = new THREE.Vector3();

function TunnelSurfFX({ worm, size }) {
    const sparksRef = useRef([]);

    useFrame(({ clock }) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        if (!tunnel) return;

        const active = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const sparkMeshes = sparksRef.current;
        if (!active) {
            for (let i = 0; i < sparkMeshes.length; i++) {
                if (sparkMeshes[i]) sparkMeshes[i].visible = false;
            }
            return;
        }

        const baseT = worm.tunnelProgress.current;
        const tt = clock.elapsedTime;
        const exitNormal = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
        const entryNormal = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;

        for (let i = 0; i < sparkMeshes.length; i++) {
            const mesh = sparkMeshes[i];
            if (!mesh) continue;
            const trailOffset = i * 0.06;
            const travel = (baseT + trailOffset + tt * 0.8) % 1;
            getTunnelWorldPosInto(_sparkCenter, tunnel, travel, size);
            getTunnelWorldPosInto(_tunnelDirScratch, tunnel, Math.min(travel + 0.03, 1), size);
            // Reuse scratch vectors instead of allocating new arrays/vectors each iteration
            _sparkForward.copy(_tunnelDirScratch).sub(_sparkCenter).normalize();
            _sparkUp.lerpVectors(entryNormal, exitNormal, travel).normalize();
            _sparkRight.crossVectors(_sparkForward, _sparkUp).normalize();

            const angle = tt * 5 + i * 0.9;
            const radius = 0.35 + Math.sin(tt * 2.4 + i) * 0.08;
            mesh.position.copy(_sparkCenter)
                .addScaledVector(_sparkRight, Math.cos(angle) * radius)
                .addScaledVector(_sparkUp, Math.sin(angle) * radius * 0.6);
            mesh.scale.setScalar(0.035 + Math.sin(tt * 8 + i * 1.3) * 0.01);
            mesh.visible = true;
            mesh.material.opacity = 0.35 + Math.sin(tt * 10 + i) * 0.25;
        }
    });

    return (
        <group>
            {Array.from({ length: 14 }).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        sparksRef.current[i] = el;
                    }}
                >
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial color="#80eaff" transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ─── Tunnel Interior View — all 6 inner faces of the Rubik's cube ────────────
// During wormhole traversal shows the coloured back-sides of every sticker on
// all 6 faces so the camera looks like it is inside the cube.

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

function TunnelInteriorView({ worm, size }) {
    const wireMatRef = useRef();
    const backingMatRef = useRef();
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

    // Set static positions/rotations after mount (or size change).
    useEffect(() => {
        stickerLayout.forEach(({ px, py, pz, rx, ry, rz }, i) => {
            const m = stickerMeshesRef.current[i];
            if (!m) return;
            m.position.set(px, py, pz);
            m.rotation.set(rx, ry, rz);
        });
    }, [stickerLayout]);

    useEffect(() => () => { edgeGeo.dispose(); planeGeo.dispose(); backingGeo.dispose(); }, [edgeGeo, planeGeo, backingGeo]);

    useFrame((_, delta) => {
        const phase = worm.phase.current;
        const prevPhase = prevPhaseRef.current;
        const active = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';

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

// ─── Swipe Controls ───────────────────────────────────────────────────────────

// ─── Worm Trail scratch — zero per-frame allocation ───────────────────────────
const _trailDummy = new THREE.Object3D();
const _trailPos   = new THREE.Vector3();
const _trailNorm  = new THREE.Vector3();
const _trailColor = new THREE.Color();
const _trailGlowColor = new THREE.Color(); // additive halo tint (skin glow colour)
const _trailRingZ = new THREE.Vector3(0, 0, 1); // ringGeometry default normal
const _trailPrevPos = new THREE.Vector3(); // newer neighbor's position, for tangent/stretch
const _trailTangent = new THREE.Vector3();
const _trailXAxis    = new THREE.Vector3();
const _trailMat       = new THREE.Matrix4();
// Wavy-stroke scratch: the trail is rebuilt each frame along the worm's recorded tile
// path, subdivided and offset laterally so it mirrors the character's gait — a Wiggle Worm
// leaves a serpentine trail, Classic a gentle wave, Inch Worm a straight crawl line.
const _trailCA   = new THREE.Vector3(); // centerline surface point of the newer tile
const _trailNA   = new THREE.Vector3(); // its world normal
const _trailCB   = new THREE.Vector3(); // centerline surface point of the older tile
const _trailNB   = new THREE.Vector3(); // its world normal
const _trailSub  = new THREE.Vector3(); // interpolated centerline point between A and B
const _trailSubN = new THREE.Vector3(); // interpolated normal
const _trailSide = new THREE.Vector3(); // lateral (wiggle) axis in the tangent plane
const _trailStretch = new THREE.Vector3(); // wavy-path tangent toward the previous daub
// The persistent trail paints the worm's full route on the current surface traversal
// (reset only when it dives through a Möbius tunnel). Older history is rendered with
// progressively coarser tile-LOD + daub spacing so per-frame work and the instanced-disc
// budget stay bounded no matter how long the run gets.
const TRAIL_DAUB_CAP = 4000;    // instanced discs painted along the (LOD-thinned) full route
const TRAIL_SUB_STEP = 0.09; // base spacing between daubs near the head (world units); grows with age
const TRAIL_FADE_FLOOR = 0.22; // oldest daubs never fade below this, so the whole route stays a faint "where I've been" map
// Local additive glow halo over the recent trail daubs — mirrors the Glow worm's glowAltRef
// overlay. This is plain extra geometry sitting on the trail's surface positions: there is NO
// post-processing pass, so by construction it cannot bloom the background or the cube interior.
const TRAIL_GLOW_CAP = 200;   // ONLY the freshest daubs glow — keeps old, over-traversed areas
                              // (e.g. the face centre) from stacking additive halos into a blinding blob
const TRAIL_GLOW_SCALE = 1.7; // halo disc size relative to its trail daub
const TRAIL_LIFT  = 0.045; // hover distance above tile surface (raised so filled slime discs don't z-fight)

// Lateral wiggle the trail inherits from each gait, so the painted path mirrors how that
// character slithers. amp = lateral reach in world units; omega = wave phase advanced per
// visited tile (so wavelength ≈ 2π/omega tiles). Phase is driven by each tile's fixed
// lay-down sequence number, which keeps the wave frozen in place as the worm crawls away
// instead of scrolling along with it.
function trailGaitParams(charId) {
    if (charId === 'wiggle') return { amp: 0.26, omega: 2.4 }; // ~2.6-tile serpentine
    if (charId === 'inch')   return { amp: 0.0,  omega: 0 };   // straight crawl line
    return { amp: 0.08, omega: 1.5 }; // classic / glow / book / prism — gentle ~4-tile wave
}

// Resolve a tileTrail entry to its world surface point + normal. Reads the live cubie
// transform every frame so the trail stays glued to the surface through cube rotations.
// Returns false if the tile/cubie is unavailable.
function resolveTrailTile(trail, i, lSize, outPos, outNorm) {
    const key = ttAt(trail, i);
    if (!key) return false;
    // Parse "x,y,z,dirKey" without split() to avoid string allocations
    const c1 = key.indexOf(',');
    const c2 = key.indexOf(',', c1 + 1);
    const c3 = key.indexOf(',', c2 + 1);
    const tx  = parseInt(key.substring(0, c1));
    const ty  = parseInt(key.substring(c1 + 1, c2));
    const tz  = parseInt(key.substring(c2 + 1, c3));
    const tdk = key.substring(c3 + 1);
    const cubie = (lSize > 0 && liveCubies.refs)
        ? liveCubies.refs[tx * lSize * lSize + ty * lSize + tz]
        : null;
    if (!cubie) return false;
    const localNorm = FACE_NORMALS[tdk];
    if (!localNorm) return false;
    outNorm.copy(localNorm).applyQuaternion(cubie.quaternion);
    outPos.copy(cubie.position).addScaledVector(outNorm, SURFACE_OFFSET + TRAIL_LIFT);
    return true;
}

// ─── Worm Body (head = smooth lerp; body = per-step tile history) ─────────────
const _wormDummy = new THREE.Object3D();
// Pre-allocated scratch objects — avoids per-frame GC pressure from WormBody loop
const _bodyColor = new THREE.Color();
const _bodyHeadPos = new THREE.Vector3();
const _bodyNormal = new THREE.Vector3();
const _bodyClonePos = new THREE.Vector3();
const _bodyCloneNormal = new THREE.Vector3();
const _bodySegForward = new THREE.Vector3();
const _bodySideVec = new THREE.Vector3();
// Scratch used to ride mid-rotation body points without mutating the history ring.
const _bodyRideAxis = new THREE.Vector3();
const _bodyEffA = new THREE.Vector3();
const _bodyEffB = new THREE.Vector3();
// Scratch for the suck-in / spit-out tunnel funnel (body segments streamed along the ribbon).
// Centerline is sampled by world arc-length so segments stay evenly spaced (no stretched beads).
const _funnelCenterline = makeTunnelCenterline();
// Stable path-points buffer: reused every frame to avoid spread-array allocation.
// The head point carries a sentinel tile (tx<0) so the body ride never rotates it —
// the head's world position is already ridden upstream in the main worm useFrame.
const _pathPointsBuffer = [];
const _headPathPoint = { pos: _bodyHeadPos, normal: _bodyNormal, tx: -1, ty: -1, tz: -1 };

function WormBody({ worm, size }) {
    const meshRef = useRef();       // sphere body (classic / inch / glow)
    const boxMeshRef = useRef();    // box body (book worm only)
    const glowAltRef = useRef();    // additive overlay — even glow segments only
    const transitScaleRef = useRef(1); // dissolve: 1 on surface, 0 inside tunnel
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormCharacter = getWormCharacter(wormCharacterId);
    const isInch = wormCharacter.id === 'inch';
    const isGlow = wormCharacter.id === 'glow';
    const isBook = wormCharacter.id === 'book';
    const isWiggle = wormCharacter.id === 'wiggle';
    const isPrism = wormCharacter.id === 'prism';
    const skin = getSkin(wormSkinId);
    const wormColor = skin.body;
    const bellyColor = skin.belly;
    // Refs so useFrame always reads latest values without closure staleness
    const wormColorRef = useRef(wormColor);
    wormColorRef.current = wormColor;
    const bellyColorRef = useRef(bellyColor);
    bellyColorRef.current = bellyColor;
    const isInchRef = useRef(isInch);
    isInchRef.current = isInch;
    const isGlowRef = useRef(isGlow);
    isGlowRef.current = isGlow;
    const isBookRef = useRef(isBook);
    isBookRef.current = isBook;
    const isWiggleRef = useRef(isWiggle);
    isWiggleRef.current = isWiggle;
    const isPrismRef = useRef(isPrism);
    isPrismRef.current = isPrism;
    // Inch Worm accordion gait state — advances with real crawl distance (not wall-clock),
    // so the body bunches/extends in lockstep with movement and relaxes when the worm stops.
    const gaitPhaseRef = useRef(0);
    const prevInterpTRef = useRef(0);
    const gaitMoveRef = useRef(0);
    // Tracks the inputs that affect per-segment color so the instanced color buffer
    // is only rewritten on frames where something actually changed (orb pickup,
    // skin/character swap, or tail length change) instead of every frame.
    const prevColorStateRef = useRef({ epoch: -1, visibleCount: -1, baseColor: null, bellyCol: null, isGlow: null, isInch: null });

    useFrame((state, delta) => {
        // Copy head/normal into scratch vectors (avoids .clone() allocation)
        _bodyHeadPos.copy(worm.headInterpPos.current);
        _bodyNormal.copy(worm.currentNormal.current);

        const currentJumpVal = worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        // During transit (entering/tunnel/exiting) and the windout spiral the body segments ride
        // the ribbon/spiral centerline exactly — no face-normal lift, or the head floats off.
        // windout uses getWindWorldPosInto which supplies its own lift, so WORM_LIFT must not
        // be added again here (face is already placed at headInterpPos + 0.09, consistent).
        const _bodyTransit = worm.phase.current === 'entering' || worm.phase.current === 'tunnel' || worm.phase.current === 'exiting' || worm.phase.current === 'windout';
        _bodyHeadPos.addScaledVector(_bodyNormal, _bodyTransit ? 0 : WORM_LIFT + currentJumpVal);

        const _isInch = isInchRef.current;
        const _isGlow = isGlowRef.current;
        const _isBook = isBookRef.current;
        const _isWiggle = isWiggleRef.current;
        const _isPrism = isPrismRef.current;
        const mesh = _isBook ? boxMeshRef.current : meshRef.current;
        if (!mesh) return;

        const tLen = worm.tailLength.current;
        const steps = worm.stepHistory.current;
        const time = state.clock.getElapsedTime();

        // ── Inch Worm accordion driver ─────────────────────────────────────────
        // interpT runs 0→1 within each tile step; its per-frame delta (with wrap) is the
        // distance actually crawled this frame. Accumulate it into a gait phase so the
        // compress→extend cycle stays synced to real movement, and ease a 0..1 "moving"
        // factor that drops to 0 when idle so the body smoothly spreads back out at rest.
        const _interpNow = worm.interpT.current;
        let _dCrawl = _interpNow - prevInterpTRef.current;
        if (_dCrawl < -0.5) _dCrawl += 1;                 // wrapped into the next tile
        if (_dCrawl < 0 || _dCrawl > 0.5) _dCrawl = 0;    // reset / teleport guard
        prevInterpTRef.current = _interpNow;
        const _moveTarget = (worm.phase.current === 'crawling' && _dCrawl > 1e-5) ? 1 : 0;
        gaitMoveRef.current += (_moveTarget - gaitMoveRef.current) * Math.min(1, delta * 6);
        gaitPhaseRef.current += _dCrawl;                  // accordion phase advances with crawl distance
        const _gaitMove = gaitMoveRef.current;
        const _gaitPhase = gaitPhaseRef.current;
        // Slow, symmetric accordion: one smooth squish→expand roughly every 2 tiles crawled
        // (rate 0.5). A raised-cosine pulse (no snap) eases the body together in the middle and
        // back out. Global — only ever one hump — and it rears taller the more orbs are carried.
        const _gaitCyc = ((_gaitPhase * 0.5) % 1 + 1) % 1;
        const _gaitPulse = (0.5 - 0.5 * Math.cos(_gaitCyc * Math.PI * 2)) * _gaitMove;
        const _orbCount = worm.orbPickupColorsRef.current?.length ?? 0;
        const _humpHeight = 0.15 + Math.min(_orbCount, 14) * 0.028; // 0.15 → ~0.54 as orbs stack up

        // Rebuild path-points buffer in-place (no array allocation or spread).
        // Only fill as many step-history points as the visible body can actually walk back
        // to. The tail reaches ~visibleCount × spacing world units behind the head, and the
        // ring stores STEPS_PER_TILE points per ~1-unit tile, so the curve-walk below never
        // needs more than that many points. The ring's `count` saturates to its full capacity
        // (MAX_TAIL × STEPS_PER_TILE = 60 000) over a long run regardless of how short the worm
        // actually is, so capping here keeps this per-frame copy proportional to body length
        // instead of paying for 60 000 ref writes every frame for a 4-segment worm.
        const _bodyReach = Math.min(MAX_TAIL, tLen) * (_isInch ? 0.095 : BODY_BALL_SPACING);
        // ×2 headroom covers corner arcs (which lengthen the path) + 2 spare tiles of margin,
        // so the walk's last segment finds its bracket rather than freezing at the buffer end.
        const _neededSteps = Math.ceil(_bodyReach * STEPS_PER_TILE * 2) + STEPS_PER_TILE * 2;
        const _fillCount = Math.min(steps.count, _neededSteps);
        _pathPointsBuffer.length = _fillCount + 1;
        _pathPointsBuffer[0] = _headPathPoint;
        for (let j = 0; j < _fillCount; j++) _pathPointsBuffer[j + 1] = shAt(steps, j);

        // Ride: while a slice is mid-rotation, body points sitting in that slice must turn
        // with the cube. We rotate their world position about the slice axis on the fly (into
        // scratch vectors, never mutating the ring) by the exact signed angle CubeAssembly
        // applies to the cubies — so the body stays glued to the surface through the tween and,
        // because commit bakes the same turn into history, there is no snap when it lands.
        const _ride = liveRotation.active;
        const _rAxis = liveRotation.axis;
        const _rSlice = liveRotation.sliceIndex;
        const _rAngle = liveRotation.angle;
        if (_ride) _bodyRideAxis.set(_rAxis === 'col' ? 1 : 0, _rAxis === 'row' ? 1 : 0, _rAxis === 'depth' ? 1 : 0);
        // Returns the effective (possibly ridden) world position for a path point, writing into
        // `out` only when a rotation is applied; otherwise returns the point's own vector.
        const effPos = (pt, out) => {
            if (_ride && pt.tx >= 0 && isTileInSlice(_rAxis, _rSlice, pt.tx, pt.ty, pt.tz)) {
                return out.copy(pt.pos).applyAxisAngle(_bodyRideAxis, _rAngle);
            }
            return pt.pos;
        };

        // Worm stays visible through the whole Möbius ride now (the tunnel camera rides inside on
        // the band, so the player watches the worm ride it). No dissolve.
        const _phase = worm.phase.current;
        const targetTS = 1.0;
        transitScaleRef.current += (targetTS - transitScaleRef.current) * Math.min(1, delta * 9);
        const transitScale = transitScaleRef.current;

        if (transitScale < 0.015) {
            mesh.count = 0;
            if (glowAltRef.current) glowAltRef.current.count = 0;
            return;
        }

        // ── Suck-in / spit-out funnel ──────────────────────────────────────────
        // During entering/exiting the head already follows the Möbius ribbon (the main worm
        // useFrame writes headInterpPos along the tunnel). Stream the body behind it along the
        // same ribbon: each segment sits one spacing further back in tunnel-parameter space, so
        // as the head dives in the body gets vacuumed through the entry hole, and as the head
        // climbs out the body is spat from the exit hole. Segments that haven't reached the
        // mouth yet stay on the surface (entering) or are hidden until they emerge (exiting).
        const _funnelTunnel = worm.activeTunnel.current;
        const _funnelOn = (_phase === 'entering' || _phase === 'tunnel' || _phase === 'exiting') && !!_funnelTunnel;
        let _headTunArc = -1;
        if (_funnelOn) {
            const _tprog = worm.tunnelProgress.current;
            const _headTunT = _phase === 'entering' ? _tprog * 0.33
                            : _phase === 'tunnel'   ? 0.33 + _tprog * 0.34
                            :                         0.67 + _tprog * 0.33;
            // Build the centerline once per frame, then place each body segment by world
            // arc-length behind the head so they stay evenly spaced (matches surface spacing).
            buildTunnelCenterlineInto(_funnelCenterline, _funnelTunnel, size);
            _headTunArc = tunnelTToArc(_funnelCenterline, _headTunT);
        }

        // Wind-up: body coils behind the head along the spiral above the entry hole.
        const _windOn = _phase === 'windup' && !!_funnelTunnel;
        const _windSegDt = 0.07; // spacing between segments in spiral-s units
        const _windHeadS = _windOn ? Math.min(1, worm.tunnelProgress.current) : 0;

        // Wind-out: mirror of _windOn — segments emerge from exit hole one by one as head rises.
        // s = 1-progress (1.0 at hole → 0.0 at surface), segments behind head have larger s.
        // _segS > 1 means still inside the tunnel → hidden until they pop out.
        const _windOutOn = _phase === 'windout' && !!_funnelTunnel;
        const _windOutSegDt = 0.07;
        const _windOutHeadS = _windOutOn ? (1.0 - Math.min(1, worm.tunnelProgress.current)) : 0;

        let walkIndex = 0;
        let cumulativeDist = 0;
        let altIdx = 0; // index into glowAltRef (even glow segments)
        let writeIdx = 0; // compacted instance slot — advances only for segments actually drawn

        const visibleCount = Math.min(MAX_TAIL, tLen);

        const orbColors = worm.orbPickupColorsRef.current;
        const baseColor = wormColorRef.current;
        const bellyCol = bellyColorRef.current;

        // Per-segment color only changes on orb pickup/deposit, skin/character swap, or
        // tail growth — not every frame. Skip the setColorAt pass + GPU upload otherwise.
        const colorEpoch = worm.colorEpochRef?.current ?? 0;
        const prevCS = prevColorStateRef.current;
        // Prism cycles its hue continuously, so its color buffer must be rewritten every
        // frame; all other characters only recolor when an input actually changes.
        const colorDirty = _isPrism || colorEpoch !== prevCS.epoch || visibleCount !== prevCS.visibleCount ||
            baseColor !== prevCS.baseColor || bellyCol !== prevCS.bellyCol || _isGlow !== prevCS.isGlow || _isInch !== prevCS.isInch;
        if (colorDirty) {
            prevCS.epoch = colorEpoch;
            prevCS.visibleCount = visibleCount;
            prevCS.baseColor = baseColor;
            prevCS.bellyCol = bellyCol;
            prevCS.isGlow = _isGlow;
            prevCS.isInch = _isInch;
        }

        for (let i = 0; i < visibleCount; i++) {
            // Distance LOD: segments far behind the head are visually indistinguishable at
            // gameplay camera distance, so thin them out — every segment near the head,
            // every 2nd beyond 200, every 4th beyond 600. Skipped segments never run the
            // curve-walk math below; the walk's cumulative distance naturally catches up to
            // the next rendered segment's (larger) target distance. The rendered segment is
            // scaled up to fill the gap left by its skipped neighbors.
            const lodStep = i < 200 ? 1 : (i < 600 ? 2 : 4);
            if (i !== 0 && i % lodStep !== 0) continue;

            const fade = 1 - i / tLen;

            if (i === 0) {
                // Head
                _wormDummy.position.copy(_bodyHeadPos);
                _wormDummy.scale.setScalar(0.092);
            } else {
                // Inch Worm: a single hump locked to the middle of the body (sin profile over
                // the whole length → 0 at head & tail, peak at centre). It rears up and the
                // body scrunches on the gather pulse, then flattens to the full spread when the
                // pulse falls / the worm rests. One arch only, regardless of body length.
                const _inchArch = (_isInch && visibleCount > 1) ? Math.sin(Math.PI * (i / (visibleCount - 1))) : 0;
                const targetDist = _isInch ? (i * 0.095 * (1 - _gaitPulse * 0.28)) : i * 0.09;

                // Clones — parametrically walk backwards along the curve to exact target distance
                let foundPosition = false;

                while (walkIndex < _pathPointsBuffer.length - 1) {
                    const ptA = _pathPointsBuffer[walkIndex];
                    const ptB = _pathPointsBuffer[walkIndex + 1];
                    const aPos = effPos(ptA, _bodyEffA);
                    const bPos = effPos(ptB, _bodyEffB);
                    const distToNext = aPos.distanceTo(bPos);

                    if (cumulativeDist + distToNext >= targetDist) {
                        // Found the bracket on the curve! Interpolate exact point.
                        const t = distToNext > 0 ? (targetDist - cumulativeDist) / distToNext : 0;
                        // Use scratch vectors instead of .clone() to avoid GC pressure
                        _bodyClonePos.lerpVectors(aPos, bPos, t);
                        _bodyCloneNormal.lerpVectors(ptA.normal, ptB.normal, t).normalize();
                        // Keep the surface normal consistent with a ridden segment so the
                        // wiggle/orientation track the rotating face rather than the old one.
                        if (_ride && ptA.tx >= 0 && isTileInSlice(_rAxis, _rSlice, ptA.tx, ptA.ty, ptA.tz)) {
                            _bodyCloneNormal.applyAxisAngle(_bodyRideAxis, _rAngle).normalize();
                        }

                        // Calculate forward/side vector for the wiggle at this exact localized point
                        _bodySegForward.subVectors(aPos, bPos).normalize();
                        _bodySideVec.crossVectors(_bodyCloneNormal, _bodySegForward).normalize();

                        // Wiggle Worm is a sidewinder: a wide, smooth lateral wave that
                        // travels down the whole body like a snake. The wave must span many
                        // segments (small phase-step → long spatial wavelength); a large
                        // phase-step would alias the closely-spaced (0.09 apart) segments into
                        // a jagged scatter instead of a coherent S-curve.
                        const wiggleAmp = _isInch ? 0.0 : (_isWiggle ? 0.26 : 0.08) * Math.sin(fade * Math.PI);
                        const wigglePhase = i * (_isWiggle ? 0.5 : 0.8) - time * (_isWiggle ? 8.0 : 6.0);
                        _bodyClonePos.addScaledVector(_bodySideVec, Math.sin(wigglePhase) * wiggleAmp);
                        // Inch Worm: raise the body's middle up off the surface along the normal
                        // so it arches into a single inchworm hump on the squish — taller with orbs.
                        if (_isInch) _bodyClonePos.addScaledVector(_bodyCloneNormal, _inchArch * _gaitPulse * _humpHeight);
                        foundPosition = true;
                        break;
                    }
                    cumulativeDist += distToNext;
                    walkIndex++;
                }

                // If the track runs out (just spawned and moving), freeze at the last known point.
                if (!foundPosition && _pathPointsBuffer.length > 0) {
                    _bodyClonePos.copy(effPos(_pathPointsBuffer[_pathPointsBuffer.length - 1], _bodyEffA));
                }

                // Funnel override: pull segments that have crossed the mouth onto the ribbon.
                let _funnelHide = false;
                let _funnelPop = 1;
                if (_funnelOn) {
                    // Each segment sits a fixed world distance (0.09 — the surface spacing)
                    // further back along the centerline, so the body reads as a continuous
                    // worm through the tunnel instead of stretched, separated beads.
                    const _segArc = _headTunArc - i * 0.09;
                    if (_segArc >= 0) {
                        // In the tunnel — ride the ribbon one spacing behind the segment ahead.
                        getTunnelArcPosInto(_bodyClonePos, _funnelCenterline, _segArc);
                        if (_phase === 'exiting') {
                            // Squash-and-pop: each segment bulges as it bursts out of the exit
                            // mouth (arc ≈ total), then settles back to normal size as it travels out.
                            const _d = Math.abs(_segArc - _funnelCenterline.total);
                            _funnelPop = 1 + 0.6 * Math.max(0, 1 - _d / 0.18);
                        }
                    } else if (_phase === 'exiting') {
                        // Tail hasn't emerged from the exit hole yet — keep it hidden rather than
                        // show it on the now-stale entry-side surface trail.
                        _funnelHide = true;
                    }
                    // entering & _segArc < 0: leave it on the surface, trailing toward the hole.
                } else if (_windOn) {
                    // Coil the body behind the head along the entry spiral; segments trail
                    // OUTWARD (smaller s). _segS < 0 → still on the surface trail (keep normal).
                    const _segS = _windHeadS - i * _windSegDt;
                    if (_segS >= 0 && _segS <= 1) {
                        getWindWorldPosInto(_bodyClonePos, _funnelTunnel, 'entry', _segS, size);
                    }
                } else if (_windOutOn) {
                    // Exit spiral: segments emerge from hole one by one as the head rises.
                    // _segS > 1 means not yet surfaced — hide until they pop out.
                    const _segS = _windOutHeadS + i * _windOutSegDt;
                    if (_segS <= 1.0) {
                        getWindWorldPosInto(_bodyClonePos, _funnelTunnel, 'exit', _segS, size);
                    } else {
                        _funnelHide = true;
                    }
                }

                _wormDummy.position.copy(_bodyClonePos);
                if (_isInch) {
                    // Segments fatten at the hump's peak, thin elsewhere — only while moving.
                    const sc = 0.082 + _inchArch * _gaitPulse * 0.03; // 0.082 (rest/extended) → fatter at the hump
                    _wormDummy.scale.setScalar(sc);
                } else if (_isBook) {
                    _wormDummy.scale.set(0.088, 0.055, 0.1);
                } else if (_isGlow) {
                    // Slightly varied glow segment sizes
                    const glowSc = 0.088 + Math.sin(time * 3.5 + i * 1.6) * 0.01;
                    _wormDummy.scale.setScalar(glowSc);
                } else {
                    _wormDummy.scale.setScalar(0.09);
                }
                if (_funnelHide) _wormDummy.scale.setScalar(0.00001); // tail not yet spat out
                else if (_funnelPop !== 1) _wormDummy.scale.multiplyScalar(_funnelPop); // burst-out pop
            }

            if (transitScale < 1) _wormDummy.scale.multiplyScalar(transitScale);
            // Compensate for the longitudinal gap left by skipped neighbors so the tail
            // still reads as continuous instead of visibly beaded out at long lengths.
            if (lodStep > 1) _wormDummy.scale.multiplyScalar(lodStep);
            _wormDummy.updateMatrix();
            mesh.setMatrixAt(writeIdx, _wormDummy.matrix);

            // Glow worm: write every other *drawn* segment to additive overlay at 1.4× scale
            // (writeIdx, not i, so the ratio holds regardless of LOD thinning).
            if (_isGlow && writeIdx % 2 === 0) {
                const altMesh = glowAltRef.current;
                if (altMesh) {
                    _wormDummy.scale.setScalar(_wormDummy.scale.x * 1.4);
                    _wormDummy.updateMatrix();
                    altMesh.setMatrixAt(altIdx++, _wormDummy.matrix);
                }
            }

            // Color per segment — only recomputed when colorDirty (see above)
            if (colorDirty) {
                const orbPickupIndex = Math.floor((i - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
                const hasOrbColor = orbPickupIndex >= 0 && orbPickupIndex < orbColors.length;
                if (_isPrism) {
                    // Spectrum: a rainbow that flows down the body and scrolls over time.
                    _bodyColor.setHSL(((i * 0.022) + time * 0.12) % 1, 0.85, 0.6);
                } else if (i === 0 && _isGlow) {
                    // Glow head — use base worm color; GlowWormAura point light provides visible glow
                    _bodyColor.set(baseColor);
                } else if (hasOrbColor) {
                    // Each orb grows a trio of segments (ORB_SEGMENT_GROWTH): 2 in the worm's
                    // own colour + 1 accent in the picked-up orb's colour — e.g. an emerald
                    // worm that eats a yellow orb grows 2 emerald + 1 yellow. The accent sits
                    // on the middle segment of the trio so each orb reads as one clean band
                    // separated from its neighbours by the worm's base colour.
                    const trioOffset = (i - BASE_TAIL_LENGTH) % ORB_SEGMENT_GROWTH;
                    _bodyColor.set(trioOffset === 1 ? orbColors[orbPickupIndex] : baseColor);
                } else if (_isInch) {
                    // Alternating body/belly bands for visible ring pattern. Uses writeIdx
                    // (not i) so bands keep alternating once LOD thinning makes consecutive
                    // drawn segments an even number of real segments apart.
                    _bodyColor.set(writeIdx % 2 === 0 ? baseColor : bellyCol);
                } else {
                    _bodyColor.set(baseColor);
                }
                mesh.setColorAt(writeIdx, _bodyColor);
            }
            writeIdx++;
        }

        mesh.count = writeIdx;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor && colorDirty) mesh.instanceColor.needsUpdate = true;

        // Update glow overlay count
        if (_isGlow) {
            const altMesh = glowAltRef.current;
            if (altMesh) { altMesh.count = altIdx; altMesh.instanceMatrix.needsUpdate = true; }
        }
    });

    return isBook ? (
        /* Box body — Book Worm only. Conditionally mounted so the sphere instancedMesh
           (MAX_TAIL=1200 instances) is not allocated in GPU memory when unused. */
        <instancedMesh ref={boxMeshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
            <boxGeometry args={[1, 0.68, 1.12]} />
            <meshStandardMaterial
                color="white"
                emissive="white"
                emissiveIntensity={0.18}
                roughness={0.58}
                metalness={0.2}
            />
        </instancedMesh>
    ) : (
        /* Sphere body — Classic, Inch Worm, Glow Worm.
           IMPORTANT: material color must be white so per-instance colors (setColorAt)
           pass through unmodified. Three.js multiplies instanceColor × material.color,
           so any non-white material color taints every orb pickup color. */
        <>
            <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                {/* Wet-slime body: a clearcoat layer gives a glossy highlight that slides
                    over each segment as the worm crawls, reading as a moist, jelly-like
                    surface instead of a flat matte ball. color MUST stay white so the
                    per-instance orb colours (setColorAt) pass through untinted. */}
                <meshPhysicalMaterial
                    color="white"
                    emissive="white"
                    emissiveIntensity={0.22}
                    roughness={0.35}
                    metalness={0}
                    clearcoat={1}
                    clearcoatRoughness={0.12}
                    sheen={0.4}
                    sheenRoughness={0.6}
                    sheenColor="#ffffff"
                    toneMapped={false}
                />
            </instancedMesh>
            {isGlow && (
                <instancedMesh ref={glowAltRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                    <sphereGeometry args={[1, 10, 10]} />
                    <meshBasicMaterial color={skin.glow} transparent opacity={0.7}
                        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </instancedMesh>
            )}
        </>
    );
}

// ─── Glow Worm Aura ───────────────────────────────────────────────────────────
// Pulsing point light that follows the Glow Worm's head.
function GlowWormAura({ worm }) {
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const isGlow = wormCharacterId === 'glow';
    const glowColor = getSkin(wormSkinId).glow;
    const lightRef = useRef();

    useFrame(({ clock }) => {
        if (!isGlow) return;
        const t = clock.elapsedTime;

        // Soft pulsing light — illuminates the worm face only.
        // Kept below the 0.82 bloom threshold so nearby cube tiles don't bloom.
        if (lightRef.current) {
            lightRef.current.position.copy(worm.headInterpPos.current)
                .addScaledVector(worm.currentNormal.current, WORM_LIFT + 0.1);
            // Zero out only while inside the Möbius ribbon — worm is visible during entering/exiting
            const inTunnel = worm.phase.current === 'tunnel';
            lightRef.current.intensity = inTunnel ? 0 : 1.2 + Math.sin(t * 4.0) * 0.4;
        }
    });

    if (!isGlow) return null;

    return <pointLight ref={lightRef} color={glowColor} intensity={2.0} distance={5.5} decay={2} />;
}

// Pre-allocated scratch vector for PortalGlow
const _glowPos = new THREE.Vector3();

// ─── Portal indicator (glows when on a flipped tile) ─────────────────────────
function PortalGlow({ worm, size }) {
    const meshRef = useRef();
    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const { x, y, z, dirKey } = worm.pos.current;
        const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
        const n = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
        _glowPos.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.2);
        meshRef.current.position.copy(_glowPos);
        const inTunnel = worm.phase.current !== 'crawling';
        meshRef.current.material.opacity = (!inTunnel && worm.onFlippedTile.current)
            ? 0.3 + Math.sin(clock.elapsedTime * 6) * 0.2
            : 0;
    });

    return (
        <mesh ref={meshRef}>
            <ringGeometry args={[0.4, 0.7, 32]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ─── Worm Trail ───────────────────────────────────────────────────────────────
// Renders a fading, brush-stroke-shaped daub at each tile the worm has visited —
// newest = bright + wide, oldest = dim + thin. Index 0 of tileTrail is the tile the
// head is currently moving INTO (pushed the instant a step begins, before the head's
// smooth interpolation has caught up), so it is used only as a stretch target for
// index 1's daub and is never rendered itself — this keeps the trail entirely behind
// the head instead of flashing a disc out in front of it.
function WormTrail({ worm, size: _size }) {
    const meshRef = useRef();
    const glowRef = useRef(); // additive glow-halo overlay for the recent trail
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const wormShowTrail = useGameStore(s => s.wormShowTrail ?? true);
    const skin = getSkin(wormSkinId);
    const skinRef = useRef(skin);
    skinRef.current = skin;
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const gaitRef = useRef(trailGaitParams(wormCharacterId));
    gaitRef.current = trailGaitParams(wormCharacterId);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const glowMesh = glowRef.current;

        if (!wormShowTrail) { mesh.count = 0; if (glowMesh) glowMesh.count = 0; return; }

        // Hide the surface trail whenever the worm is not crawling on the surface — during
        // wormhole entry/tunnel/exit and the wind spirals the camera is inside the cube, and
        // the surface daubs would otherwise shine through. Only the cube interior should show.
        if (worm.phase.current !== 'crawling') { mesh.count = 0; if (glowMesh) glowMesh.count = 0; return; }

        const trail = worm.pathHistory.current;
        const count = trail.count;
        if (count < 2) { mesh.count = 0; if (glowMesh) glowMesh.count = 0; return; }

        const lSize = liveCubies.size;
        const capCount = count; // render the full retained route, not a fixed window
        const currentSkin = skinRef.current;
        const { amp, omega } = gaitRef.current;

        // Seed the spine just UNDER the last body orb so the slime appears to ooze straight
        // out of the tail. The body spans ~tailLength × BODY_BALL_SPACING tiles behind the head;
        // seeding one tile short of that end makes the freshest daubs overlap the last orb (no
        // gap) and then stream backward. Seeding exactly at the body end left a visible gap;
        // seeding near index 1 painted under the whole body near the head.
        const bodyTiles = Math.max(1, Math.ceil(worm.tailLength.current * BODY_BALL_SPACING));
        let aIdx = Math.max(1, bodyTiles - 1);
        let haveA = false;
        for (; aIdx < capCount; aIdx++) { if (resolveTrailTile(trail, aIdx, lSize, _trailCA, _trailNA)) { haveA = true; break; } }
        if (!haveA) { mesh.count = 0; if (glowMesh) glowMesh.count = 0; return; }
        let seqA = trail.seq[(trail.head + aIdx) % trail.capacity];

        let visible = 0;
        let glowCount = 0;
        let havePrev = false;

        // Age-based level-of-detail: the route nearest the worm is sampled densely for a smooth
        // stroke, while older history is walked with progressively larger tile strides and daub
        // spacing so the whole route fits inside the daub budget at bounded per-frame cost. `i`
        // advances by lodStep (in tiles); subStep widens the daub spacing to match.
        let i = aIdx;
        while (i < capCount && visible < TRAIL_DAUB_CAP) {
            const age = i - aIdx;
            const lodStep = age < 60 ? 1 : age < 180 ? 2 : age < 500 ? 4 : 8;
            const subStep = age < 60 ? TRAIL_SUB_STEP : age < 180 ? 0.22 : age < 500 ? 0.45 : 0.9;
            const nextI = i + lodStep;
            // Skip unavailable tiles; the segment simply bridges A → next valid tile.
            if (!resolveTrailTile(trail, nextI, lSize, _trailCB, _trailNB)) { i = nextI; continue; }
            const seqB = trail.seq[(trail.head + nextI) % trail.capacity];

            _trailTangent.subVectors(_trailCA, _trailCB); // points toward the newer tile
            const segLen = _trailTangent.length();
            if (segLen > 1e-5) {
                _trailTangent.multiplyScalar(1 / segLen);
                const nSub = Math.max(1, Math.ceil(segLen / subStep));
                for (let s = 0; s < nSub && visible < TRAIL_DAUB_CAP; s++) {
                    const t = s / nSub; // 0 at A (newer) → 1 at B (older)
                    _trailSub.lerpVectors(_trailCA, _trailCB, t);
                    _trailSubN.lerpVectors(_trailNA, _trailNB, t).normalize();

                    // Newest = bright/wide, oldest = dim/thin, but floored so the full route
                    // stays visible as a faint "where I've been" map instead of fading to nothing.
                    const fade = Math.max(TRAIL_FADE_FLOOR, 1 - visible / TRAIL_DAUB_CAP);
                    const fs   = fade * fade * (3 - 2 * fade);  // smoothstep

                    // Frozen lateral wiggle baked along the path — this is the gait signature that
                    // makes a Wiggle Worm leave a serpentine trail and an Inch Worm a straight one.
                    // Phase is driven by the tile's fixed lay-down sequence (not distance from the
                    // moving head), so the wave stays painted in place as the worm crawls on.
                    const seqInterp = seqA + (seqB - seqA) * t;
                    _trailSide.crossVectors(_trailSubN, _trailTangent).normalize();
                    _trailPos.copy(_trailSub).addScaledVector(_trailSide, amp * Math.sin(seqInterp * omega));

                    _trailDummy.position.copy(_trailPos);
                    if (havePrev) {
                        // Stretch a thin oval toward the previous (newer) daub so the wavy line
                        // reads as one continuous painted stroke instead of separate puddles.
                        _trailStretch.subVectors(_trailPrevPos, _trailPos);
                        const tl = _trailStretch.lengthSq();
                        if (tl > 1e-6) {
                            _trailStretch.multiplyScalar(1 / Math.sqrt(tl));
                            _trailXAxis.crossVectors(_trailStretch, _trailSubN).normalize();
                            _trailMat.makeBasis(_trailXAxis, _trailStretch, _trailSubN);
                            _trailDummy.quaternion.setFromRotationMatrix(_trailMat);
                            _trailDummy.scale.set((fs * 0.16 + 0.03) * 0.6, fs * 0.34 + 0.05, 1);
                        } else {
                            _trailDummy.quaternion.setFromUnitVectors(_trailRingZ, _trailSubN);
                            _trailDummy.scale.setScalar((fs * 0.16 + 0.03) * 0.6);
                        }
                    } else {
                        _trailDummy.quaternion.setFromUnitVectors(_trailRingZ, _trailSubN);
                        _trailDummy.scale.setScalar((fs * 0.16 + 0.03) * 0.6);
                    }
                    _trailDummy.updateMatrix();
                    mesh.setMatrixAt(visible, _trailDummy.matrix);

                    // Encode fade as color brightness
                    _trailColor.set(currentSkin.body).multiplyScalar(0.20 + fs * 0.80);
                    mesh.setColorAt(visible, _trailColor);

                    // Recent daubs also get a soft additive glow halo in the skin's glow colour,
                    // scaled up from the same daub transform. Purely local geometry — no bloom pass.
                    if (glowMesh && visible < TRAIL_GLOW_CAP) {
                        _trailDummy.scale.multiplyScalar(TRAIL_GLOW_SCALE);
                        _trailDummy.updateMatrix();
                        glowMesh.setMatrixAt(visible, _trailDummy.matrix);
                        _trailGlowColor.set(currentSkin.glow).multiplyScalar(0.14 + fs * 0.36);
                        glowMesh.setColorAt(visible, _trailGlowColor);
                        glowCount = visible + 1;
                    }
                    visible++;

                    _trailPrevPos.copy(_trailPos);
                    havePrev = true;
                }
            }

            _trailCA.copy(_trailCB);
            _trailNA.copy(_trailNB);
            seqA = seqB;
            i = nextI;
        }

        mesh.count = visible;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        if (glowMesh) {
            glowMesh.count = glowCount;
            glowMesh.instanceMatrix.needsUpdate = true;
            if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <>
            <instancedMesh ref={meshRef} args={[undefined, undefined, TRAIL_DAUB_CAP]} frustumCulled={false}>
                {/* Thin, elongated discs stretched toward the next-newer tile read as a continuous
                    painted slime stroke behind the worm. Low roughness + normal blending gives a
                    wet, translucent sheen that catches the scene lights as the worm crawls, instead
                    of a neon additive marker. */}
                <circleGeometry args={[0.5, 16]} />
                <meshStandardMaterial
                    color="white"
                    emissive="white"
                    emissiveIntensity={0.18}
                    roughness={0.12}
                    metalness={0}
                    transparent
                    opacity={0.74}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </instancedMesh>
            {/* Additive glow halo over the recent trail — local geometry only, never a screen
                pass, so it can't touch the background or the cube interior. */}
            <instancedMesh ref={glowRef} args={[undefined, undefined, TRAIL_GLOW_CAP]} frustumCulled={false}>
                <circleGeometry args={[0.5, 16]} />
                <meshBasicMaterial
                    color="white"
                    transparent
                    opacity={0.12}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </instancedMesh>
        </>
    );
}

// ─── Worm Face (eyes + smile) ─────────────────────────────────────────────────
const _faceRight = new THREE.Vector3();
const _faceForward = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();
const _faceTunnelAhead = new THREE.Vector3(); // scratch for tunnel tangent during enter/exit
// Glasses orientation — torus axis (Y) aligned to face-forward so ring appears circular
const _glassAxisY = new THREE.Vector3(0, 1, 0);
const _glassQuat = new THREE.Quaternion();

function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const smile0 = useRef(), smile1 = useRef(), smile2 = useRef();
    const smileRefs = [smile0, smile1, smile2];
    const hatGroupRef = useRef();
    const glassLeftRef = useRef();
    const glassRightRef = useRef();
    const faceOpacityRef = useRef(1);
    const wormHatId = useGameStore(s => s.wormHat ?? 'none');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const isBook = wormCharacterId === 'book';

    useFrame((_, delta) => {
        // Face stays visible through the whole Möbius ride now (worm rides the band on-camera).
        const showFace = true;
        faceOpacityRef.current += ((showFace ? 1 : 0) - faceOpacityRef.current) * Math.min(1, delta * 9);
        const faceVisible = faceOpacityRef.current > 0.05;
        if (leftEyeRef.current)  leftEyeRef.current.visible  = faceVisible;
        if (rightEyeRef.current) rightEyeRef.current.visible = faceVisible;
        for (const ref of smileRefs) if (ref.current) ref.current.visible = faceVisible;
        if (hatGroupRef.current)    hatGroupRef.current.visible    = faceVisible;
        if (glassLeftRef.current)   glassLeftRef.current.visible   = faceVisible;
        if (glassRightRef.current)  glassRightRef.current.visible  = faceVisible;
        if (!faceVisible) return;

        const phase = worm.phase.current;
        const inTransit = (phase === 'entering' || phase === 'tunnel' || phase === 'exiting' || phase === 'windout') && worm.activeTunnel.current;

        let normal;
        if (inTransit) {
            // During entering/tunnel/exiting/windout the head is driven by getTunnelWorldPosInto
            // or getWindWorldPosInto. Read headInterpPos/currentNormal which are always current.
            _faceHeadPos.copy(worm.headInterpPos.current);
            normal = worm.currentNormal.current;

            if (phase === 'windout') {
                // Tangent from the exit spiral: look slightly ahead in s (s decreases as prog rises)
                const prog = worm.tunnelProgress.current;
                const sHead = 1.0 - prog;
                const sAhead = Math.max(0, sHead - 0.05);
                getWindWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, 'exit', sAhead, size);
                _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
                if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
                _faceForward.normalize();
            } else {
                // Derive forward from the tunnel tangent at the current parametric position.
                const tp = worm.tunnelProgress.current;
                const t = phase === 'entering' ? tp * 0.33 : phase === 'tunnel' ? 0.33 + tp * 0.34 : 0.67 + tp * 0.33;
                const tAhead = Math.min(t + 0.02, 1.0);
                getTunnelWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, tAhead, size);
                _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
                if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
                _faceForward.normalize();
            }

            // Head rides the ribbon/spiral centerline; 0.09 keeps face on the head sphere front.
            _faceHeadPos.addScaledVector(normal, 0.09);
        } else {
            const { dirKey } = worm.pos.current;
            normal = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
            _faceForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);

            // Interpolated head world pos (copy into scratch — no .clone())
            const prev = worm.prevWorldPos.current;
            const cur = worm.curWorldPos.current;
            if (!cur) {
                const wp = getStickerWorldPos(worm.pos.current.x, worm.pos.current.y,
                    worm.pos.current.z, dirKey, size, 0);
                _faceHeadPos.set(wp[0], wp[1], wp[2]);
            } else if (prev && worm.interpT.current < 1) {
                _faceHeadPos.lerpVectors(prev, cur, worm.interpT.current);
            } else {
                _faceHeadPos.copy(cur);
            }
            const jumpLiftVal = worm.isJumping.current
                ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
            _faceHeadPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal + 0.09);
        }

        // Rightward axis in the face plane
        _faceRight.crossVectors(_faceForward, normal).normalize();
        if (_faceRight.lengthSq() < 0.001) _faceRight.set(1, 0, 0);

        const S = 0.022;
        if (leftEyeRef.current) {
            leftEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, 0.028)
                .addScaledVector(_faceForward, 0.025);
            leftEyeRef.current.scale.setScalar(S);
        }
        if (rightEyeRef.current) {
            rightEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, -0.028)
                .addScaledVector(_faceForward, 0.025);
            rightEyeRef.current.scale.setScalar(S);
        }
        const smileOffsets = [-0.022, 0, 0.022];
        for (let i = 0; i < smileRefs.length; i++) {
            const ref = smileRefs[i];
            if (!ref.current) continue;
            const xo = smileOffsets[i];
            const yo = i === 1 ? -0.028 : -0.022;
            ref.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, xo)
                .addScaledVector(normal, yo * 0.3)
                .addScaledVector(_faceForward, 0.025);
            ref.current.scale.setScalar(S * 0.55);
        }

        // Hat: position above head, orient Y to face normal
        if (hatGroupRef.current) {
            hatGroupRef.current.position.copy(_faceHeadPos)
                .addScaledVector(normal, 0.04);
            _hatAlignQuat.setFromUnitVectors(_hatYUp, normal);
            hatGroupRef.current.quaternion.copy(_hatAlignQuat);
        }

        // Book worm glasses — torus rings in front of each eye, axis aligned to forward
        if (isBook) {
            _glassQuat.setFromUnitVectors(_glassAxisY, _faceForward);
            const GS = 0.054;
            if (glassLeftRef.current) {
                glassLeftRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, 0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassLeftRef.current.quaternion.copy(_glassQuat);
                glassLeftRef.current.scale.setScalar(GS);
            }
            if (glassRightRef.current) {
                glassRightRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, -0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassRightRef.current.quaternion.copy(_glassQuat);
                glassRightRef.current.scale.setScalar(GS);
            }
        }
    });

    return (
        <>
            <mesh ref={leftEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            <mesh ref={rightEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            {smileRefs.map((ref, i) => (
                <mesh key={i} ref={ref}>
                    <sphereGeometry args={[1, 6, 6]} />
                    <meshBasicMaterial color="#111" />
                </mesh>
            ))}
            {wormHatId !== 'none' && (
                <group ref={hatGroupRef}>
                    <WormHat3D type={wormHatId} scale={0.07} />
                </group>
            )}
            {/* Book worm glasses — two torus rings, only rendered for book character */}
            {isBook && (
                <>
                    <mesh ref={glassLeftRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh ref={glassRightRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                </>
            )}
        </>
    );
}

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
// Each orb inherits the color of the sticker tile it sits on and follows
// that tile through cube rotations. Rendered using the shared ParityOrbs component.
function PowerupOrbs({ size }) {
    const { wormPowerups, cubies, settings, wormCharacter } = useGameStore(useShallow(s => ({
        wormPowerups: s.wormPowerups,
        cubies: s.cubies,
        settings: s.settings,
        wormCharacter: s.wormCharacter ?? 'classic',
    })));
    const faceColors = useMemo(() => resolveColors(settings), [settings]);

    // Cheap signature of just the orb-tile stickers' colors. `cubies` gets a new
    // array reference on every single rotation/flip, but only a handful of tiles
    // (the ~24 orb positions) actually matter here — keying the heavier `orbs`
    // memo below on this signature instead of raw `cubies` lets it skip
    // recomputing (and keep returning the same array reference) on every move
    // that doesn't touch an orb tile.
    const orbSignature = useMemo(() => {
        if (!wormPowerups || !cubies) return '';
        let sig = wormPowerups.length + '|';
        for (const p of wormPowerups) {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            sig += `${p.x},${p.y},${p.z},${p.dirKey}:${sticker?.curr ?? 0},${sticker?.orig ?? 0};`;
        }
        return sig;
    }, [wormPowerups, cubies]);

    const orbs = useMemo(() => {
        if (!wormPowerups || !cubies) return [];
        return wormPowerups.map(p => {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            const faceId = sticker?.curr ?? 0;
            const color = ensureOrbContrast((faceId && faceColors[faceId]) ?? '#22ff88');
            const antipodalFaceId = ANTIPODAL_COLOR[faceId];
            const antipodalColor = ensureOrbContrast((antipodalFaceId && faceColors[antipodalFaceId]) ?? color);
            // Orbs on flipped tiles hover above the surface — worm must jump to collect
            const elevated = !!(sticker && sticker.curr !== sticker.orig);
            return { ...p, color, antipodalColor, elevated };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orbSignature, faceColors]);

    return <ParityOrbs orbs={orbs} size={size} isGlowWorm={wormCharacter === 'glow'} />;
}

// Watches for orb pickups by the glow worm and renders a color bloom at the collect point.
// Follows the same pendingRef + useFrame polling pattern as HeartBurstSystem.
function OrbFlashSystem({ worm }) {
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const [flashes, setFlashes] = useState([]);

    useFrame(() => {
        if (!worm.pendingOrbFlashRef.current) return;
        const { color, pos } = worm.pendingOrbFlashRef.current;
        worm.pendingOrbFlashRef.current = null;
        // Only the glow worm gets the color bloom
        if (wormCharacterId !== 'glow') return;
        const id = Date.now() + Math.random();
        setFlashes(prev => [...prev, { id, pos, color }]);
    });

    if (flashes.length === 0) return null;
    return (
        <>
            {flashes.map(f => (
                <OrbCollectEffect
                    key={f.id}
                    position={f.pos}
                    color={f.color}
                    onDone={() => setFlashes(prev => prev.filter(x => x.id !== f.id))}
                />
            ))}
        </>
    );
}

function WormInteriorGlass({ worm, size }) {
    const glassRef = useRef();

    useFrame(({ clock }) => {
        if (!glassRef.current) return;

        const phase = worm.phase.current;
        const isTunnelPhase = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const tunnelBoost = isTunnelPhase ? 1 : 0;
        const pulse = (Math.sin(clock.elapsedTime * 4.2) + 1) * 0.5;
        const transmission = THREE.MathUtils.lerp(GLASS_MIN_TRANSMISSION, GLASS_MAX_TRANSMISSION, tunnelBoost * 0.7 + pulse * 0.3);
        const opacity = THREE.MathUtils.lerp(GLASS_MIN_OPACITY, GLASS_MAX_OPACITY, tunnelBoost * 0.85 + pulse * 0.15);

        glassRef.current.transmission = transmission;
        glassRef.current.opacity = opacity;
        glassRef.current.emissiveIntensity = tunnelBoost * 0.35 + pulse * 0.08;
    });

    // Keep a thin margin from outer stickers so we read it as an interior shell.
    const innerSize = Math.max(0.8, size - 1.1);

    return (
        <mesh>
            <boxGeometry args={[innerSize, innerSize, innerSize]} />
            <meshPhysicalMaterial
                ref={glassRef}
                color="#b8f6ff"
                emissive="#4ccfe6"
                emissiveIntensity={0.06}
                roughness={0.06}
                metalness={0.02}
                transmission={GLASS_MIN_TRANSMISSION}
                thickness={1.2}
                ior={1.23}
                transparent
                opacity={GLASS_MIN_OPACITY}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ─── Module-level helpers for canonical tunnel key (mirrors useWormCrawler logic) ─
// Used by WormholeRings to check void-tunnel membership without prop-drilling.
const _tileKeyStr = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;
const _canonicalTunnelKeyStr = (tunnel) => {
    const a = _tileKeyStr(tunnel.entry);
    const b = _tileKeyStr(tunnel.exit);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
};

// ─── Wormhole portal rings — spinning neon rings at every flipped tile ────────
// Gives players a clear visual cue for all wormhole locations on the cube surface.
const _ringDummy = new THREE.Object3D();
const _ringUp = new THREE.Vector3();
const _bubbleDummy = new THREE.Object3D();
const _sparkDummy = new THREE.Object3D();
const _cautionDummy = new THREE.Object3D();
const _voidFrameDummy = new THREE.Object3D();
const _voidArcAxisY = new THREE.Vector3(0, 1, 0);
const _voidArcRight = new THREE.Vector3();
const _voidArcForward = new THREE.Vector3();
const _tapeRight = new THREE.Vector3();
const _tapeForward = new THREE.Vector3();
const _liveBaseColor = new THREE.Color('#ff44ff');
const _liveColor = new THREE.Color();

// Void swamp palette — sickly, stagnant, antipodality-gone-wrong
const VOID_OUTER_COLOR = '#b8b1ff';   // inverted-feel rim over dark tiles
const VOID_INNER_COLOR = '#121a3b';   // cool inverted core
const VOID_BUBBLE_COLOR = '#39ff14';  // neon green ooze
const CRITICAL_ARC_COLOR = '#7dff2a';  // electrical warning before full void
const _criticalArcColor = new THREE.Color(CRITICAL_ARC_COLOR);
const _tapeYellow = new THREE.Color('#ffe000');
const _tapeBlack = new THREE.Color('#111111');
// Scratch objects for the per-tape instanced-mesh loop — avoids per-frame allocations
const _tapeEdgeDir = new THREE.Vector3();
const _tapeOutwardDir = new THREE.Vector3();
const _tapeUp = new THREE.Vector3();
const _tapeNormal = new THREE.Vector3();
const _tapeCrossRight = new THREE.Vector3();
const _tapeMat4 = new THREE.Matrix4();
// Static empty collections used as safe fallbacks (never mutated)
const _EMPTY_SET = new Set();
const _EMPTY_MAP = new Map();
const BUBBLES_PER_VOID = 5;          // rising gas bubbles per dead portal
const SPARKS_PER_CRITICAL = 7;
const POLES_PER_TILE = 4;
const TAPES_PER_TILE = 4;
const FRAME_SEGMENTS_PER_VOID = 4;

// ─── Heart Burst Effect — green hearts fly out of healed tiles ────────────────
// Emits a burst of 💚 hearts when the worm exits a healed tunnel.
// Each heart gets its own CSS @keyframes rule injected once so the browser handles
// the smooth per-heart arc entirely on the compositor thread.

const HEART_COUNT = 10;
const HEART_LIFETIME_MS = 1800;

function HeartBurst({ id, wp, onDone }) {
    // Generate stable per-heart motion data once (spread outward, biased upward)
    // Generate stable random motion data once per burst. Using useRef so the data is
    // computed exactly once on mount — useMemo with Math.random() is unsafe because
    // React may evict the cache and recompute, which would re-inject duplicate <style> tags.
    const heartsRef = useRef(null);
    if (heartsRef.current === null) {
        heartsRef.current = Array.from({ length: HEART_COUNT }, (_, i) => {
            const baseAngle = (i / HEART_COUNT) * Math.PI * 2;
            const angle = baseAngle + (Math.random() - 0.5) * 0.7;
            const dist = 50 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = -Math.abs(Math.sin(angle) * dist) - 25 - Math.random() * 30;
            const delay = i * 55 + Math.random() * 40;
            const scale = 0.85 + Math.random() * 0.5;
            const heartId = `wh-${id}-${i}`;
            const cssText = `@keyframes ${heartId}{` +
                `0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0;}` +
                `18%{transform:translate(-50%,-50%) scale(${(scale * 1.6).toFixed(2)}) rotate(10deg);opacity:1;}` +
                `100%{transform:translate(calc(-50% + ${dx.toFixed(1)}px),calc(-50% + ${dy.toFixed(1)}px)) ` +
                `scale(${(scale * 0.25).toFixed(2)}) rotate(${Math.round((Math.random() - 0.5) * 40)}deg);opacity:0;}}`;
            return { heartId, delay, cssText };
        });
    }
    const hearts = heartsRef.current;

    // DOM mutations in useEffect so they are guarded by mount and always cleaned up.
    // useMemo must not mutate the DOM — React may rerun it without a corresponding cleanup.
    useEffect(() => {
        const styleEls = hearts.map(({ heartId, cssText }) => {
            const el = document.createElement('style');
            el.setAttribute('data-worm-heart', heartId);
            el.textContent = cssText;
            document.head.appendChild(el);
            return el;
        });
        const timer = setTimeout(() => {
            styleEls.forEach(el => el.remove());
            onDone();
        }, HEART_LIFETIME_MS + 300);
        return () => {
            clearTimeout(timer);
            styleEls.forEach(el => el.remove());
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fontSize = _isMobile ? '22px' : '18px';
    return (
        <Html position={wp} center>
            <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
                {hearts.map(h => (
                    <div
                        key={h.heartId}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            fontSize,
                            animation: `${h.heartId} ${HEART_LIFETIME_MS}ms ease-out ${h.delay}ms both`,
                            willChange: 'transform, opacity',
                            textShadow: '0 0 6px #22ff66, 0 0 12px #00cc44',
                            lineHeight: 1,
                            userSelect: 'none',
                            filter: 'drop-shadow(0 0 4px #00ff55)',
                        }}
                    >
                        💚
                    </div>
                ))}
            </div>
        </Html>
    );
}

// 3D heal burst — an expanding shockwave + flash on the tile the worm emerges from, so the
// wormhole exit reads as a pop of healing energy instead of the worm just sliding through a
// plain tile. The ring meshes live in the local XY plane (ringGeometry faces +Z), and the
// group is rotated so local +Z aligns with the tile's surface normal — the rings lie flat on
// the face and expand outward across it.
const _healNormalScratch = new THREE.Vector3();
const _healRingZ = new THREE.Vector3(0, 0, 1);

function HealBurst3D({ wp, normal, color = '#3affb0', onDone }) {
    const ringRef = useRef();
    const coreRingRef = useRef();
    const flashRef = useRef();
    const tRef = useRef(0);
    const doneRef = useRef(false);

    const quat = useMemo(() => {
        const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
        return new THREE.Quaternion().setFromUnitVectors(_healRingZ, n);
    }, [normal]);

    useFrame((_s, dt) => {
        tRef.current += dt;
        const t = tRef.current;
        const DUR = 0.95;
        const p = Math.min(1, t / DUR);
        const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic

        if (ringRef.current) {
            const s = 0.15 + ease * 1.75;
            ringRef.current.scale.set(s, s, 1);
            ringRef.current.material.opacity = (1 - p) * 0.9;
        }
        if (coreRingRef.current) {
            const p2 = Math.min(1, t / (DUR * 0.65));
            const e2 = 1 - Math.pow(1 - p2, 3);
            const s = 0.1 + e2 * 1.05;
            coreRingRef.current.scale.set(s, s, 1);
            coreRingRef.current.material.opacity = (1 - p2) * 0.75;
        }
        if (flashRef.current) {
            const fp = Math.min(1, t / 0.28);
            flashRef.current.scale.setScalar(0.2 + fp * 0.95);
            flashRef.current.material.opacity = (1 - fp) * 0.85;
        }
        if (p >= 1 && !doneRef.current) { doneRef.current = true; onDone?.(); }
    });

    return (
        <group position={wp} quaternion={quat}>
            {/* Outer healing shockwave ring */}
            <mesh ref={ringRef}>
                <ringGeometry args={[0.34, 0.5, 48]} />
                <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Inner bright ring */}
            <mesh ref={coreRingRef}>
                <ringGeometry args={[0.16, 0.28, 40]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.75} side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Emergence flash just above the tile */}
            <mesh ref={flashRef} position={[0, 0, 0.06]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.85}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
        </group>
    );
}

// Watches for heal events from the worm hook and manages active burst instances (the 3D
// emergence shockwave plus the floating hearts).
function HeartBurstSystem({ worm, size }) {
    const [bursts, setBursts] = useState([]);

    useFrame(() => {
        if (!worm.pendingHealBurstRef.current) return;
        const { exitTile } = worm.pendingHealBurstRef.current;
        worm.pendingHealBurstRef.current = null;
        const wp = getStickerWorldPos(exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey, size, 0);
        if (!wp) return;
        // World-space surface normal of the exit tile (from the live cubie transform) so the
        // shockwave lies flat on whichever face the worm emerges from, even after rotations.
        const lSize = liveCubies.size;
        const cubie = (lSize > 0 && liveCubies.refs)
            ? liveCubies.refs[exitTile.x * lSize * lSize + exitTile.y * lSize + exitTile.z]
            : null;
        const localN = FACE_NORMALS[exitTile.dirKey];
        let normal = [0, 1, 0];
        if (cubie && localN) {
            _healNormalScratch.copy(localN).applyQuaternion(cubie.quaternion);
            normal = [_healNormalScratch.x, _healNormalScratch.y, _healNormalScratch.z];
        } else if (localN) {
            normal = [localN.x, localN.y, localN.z];
        }
        const id = Date.now();
        setBursts(prev => [...prev, { id, wp: [wp[0], wp[1], wp[2]], normal }]);
    });

    if (bursts.length === 0) return null;
    return (
        <>
            {bursts.map(burst => (
                <React.Fragment key={burst.id}>
                    <HealBurst3D wp={burst.wp} normal={burst.normal} />
                    <HeartBurst
                        id={burst.id}
                        wp={burst.wp}
                        onDone={() => setBursts(prev => prev.filter(b => b.id !== burst.id))}
                    />
                </React.Fragment>
            ))}
        </>
    );
}

function TunnelHealProgress({ size }) {
    const healingProgress = useGameStore((s) => s.wormHealingProgress ?? {});
    const cubies = useGameStore((s) => s.debouncedCubies ?? s.cubies);
    const settings = useGameStore((s) => s.settings);
    const faceColors = useMemo(
        () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || {},
        [settings]
    );

    const entries = useMemo(() => {
        const partial = Object.entries(healingProgress).filter(([, p]) => p.deposited > 0 && p.deposited < HEAL_COST);
        if (partial.length === 0) return [];
        // Build the manifold map once and share it across all findStickerByStableKey calls.
        // Without this, each call rebuilt an O(size³×6) map — 3 tunnels = 3× the work.
        // NOTE: this operates on the *debounced* cubies snapshot, not the live epoch's, so it
        // intentionally bypasses the shared manifoldMapStore owner (which is keyed on the live
        // rotationEpoch) and builds against this lagged snapshot directly.
        const mm = buildManifoldGridMap(cubies, size);
        return partial
            .map(([key, p]) => {
                const pos = findStickerByStableKey(cubies, size, key, mm);
                if (!pos) return null;
                const wp = getStickerWorldPos(pos.x, pos.y, pos.z, pos.dirKey, size, 0);
                if (!wp) return null;
                return { key, wp, remaining: HEAL_COST - p.deposited, faceId: p.faceId };
            })
            .filter(Boolean);
    }, [healingProgress, cubies, size]);

    if (entries.length === 0) return null;

    return (
        <>
            {entries.map(({ key, wp, remaining, faceId }) => {
                const color = faceColors[faceId] ?? '#ffffff';
                return (
                    <Html key={key} position={[wp[0], wp[1], wp[2]]} center>
                        <div style={{
                            background: color,
                            color: '#ffffff',
                            width: _isMobile ? '32px' : '26px',
                            height: _isMobile ? '32px' : '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: _isMobile ? '15px' : '13px',
                            fontWeight: 900,
                            fontFamily: UI_FONT,
                            border: '2.5px solid #ffffff',
                            boxShadow: `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.5)`,
                            lineHeight: 1,
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}>
                            {remaining}
                        </div>
                    </Html>
                );
            })}
        </>
    );
}

function WormholeRings({ cubies, size, worm, voidTunnelKeysRef, tunnelUseCountsRef }) {
    // Patched incrementally instead of rebuilt from scratch on every debounce tick (see
    // buildManifoldGridMapIncremental) — only the cells that changed since the last tick
    // get their gridId entries recomputed.
    const manifoldMapCacheRef = useRef({ map: null, prevCubies: null, size: null });
    const liveRef = useRef();       // live wormhole rings (neon pink)
    const voidOuterRef = useRef();  // void outer ring (sickly green, slow reverse)
    const voidInnerRef = useRef();  // void inner ring (near-black, counter-rotating)
    const bubblesRef = useRef();    // void swamp gas rising from dead portals
    const sparkRef = useRef();      // warning electricity when tunnel is one trip from void
    const poleRef = useRef();       // caution poles
    const tapeRef = useRef();       // caution tape strips
    const voidFrameRef = useRef();  // bright square frame on fully voided tiles

    const cautionTexture = React.useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffe000';
        ctx.fillRect(0, 0, 512, 64);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 44px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CAUTION', 256, 36);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 1);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);

    // Stable random seeds per (position × bubble) slot — no per-frame allocation
    const MAX_RINGS = 6 * size * size;
    const bubbleSeeds = React.useMemo(() => {
        const s = new Float32Array(MAX_RINGS * Math.max(BUBBLES_PER_VOID, SPARKS_PER_CRITICAL, Math.max(POLES_PER_TILE, TAPES_PER_TILE)) * 3);
        for (let i = 0; i < s.length / 3; i++) {
            s[i * 3]     = (Math.random() - 0.5) * 0.18; // lateral x jitter
            s[i * 3 + 1] = (Math.random() - 0.5) * 0.18; // lateral y jitter
            s[i * 3 + 2] = Math.random();                 // phase start offset
        }
        return s;
    }, [MAX_RINGS]);

    // Debounce cubies so the O(size³×6) scan only reruns every 200-400 ms instead
    // of on every individual sticker flip (~12×/sec at chaos L4). Crawling phase can
    // tolerate the longer delay since the rings already throttle to 20 Hz there; tunnel
    // phases (entering/tunnel/exiting) keep the tighter delay for the 60 Hz ring cadence.
    const [debouncedCubies, setDebouncedCubies] = useState(cubies);
    useEffect(() => {
        const phase = worm?.phase?.current ?? 'crawling';
        const delayMs = phase === 'crawling' ? 400 : 200;
        const timer = setTimeout(() => setDebouncedCubies(cubies), delayMs);
        return () => clearTimeout(timer);
    }, [cubies, worm]);

    // All flipped surface positions, augmented with canonical tunnel key so
    // WormholeRings can tell live vs void without re-running manifold logic per frame.
    const allPositions = React.useMemo(() => {
        const manifoldMap = buildManifoldGridMapIncremental(debouncedCubies, size, manifoldMapCacheRef.current);
        const tunnels = getActiveTunnels(debouncedCubies, size, manifoldMap);
        // Build tile-key → canonical-tunnel-key lookup (covers both entry and exit)
        const tunnelKeyMap = new Map();
        for (const t of tunnels) {
            const ck = _canonicalTunnelKeyStr(t);
            tunnelKeyMap.set(_tileKeyStr(t.entry), ck);
            tunnelKeyMap.set(_tileKeyStr(t.exit), ck);
        }

        const result = [];
        const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cubie = debouncedCubies?.[x]?.[y]?.[z];
                    if (!cubie) continue;
                    for (const dk of dirs) {
                        const st = cubie.stickers?.[dk];
                        if (!st || st.curr === st.orig) continue;
                        const isVisible = (
                            (dk === 'PX' && x === size - 1) || (dk === 'NX' && x === 0) ||
                            (dk === 'PY' && y === size - 1) || (dk === 'NY' && y === 0) ||
                            (dk === 'PZ' && z === size - 1) || (dk === 'NZ' && z === 0)
                        );
                        if (!isVisible) continue;
                        result.push({
                            x, y, z, dirKey: dk,
                            tunnelKey: tunnelKeyMap.get(`${x},${y},${z},${dk}`) ?? null,
                            // Cache world position + normal once — constant for the lifetime
                            // of this entry, so the frame loop never recomputes/reallocates.
                            wp: getStickerWorldPos(x, y, z, dk, size, 0),
                            normal: FACE_NORMALS[dk] ?? FACE_NORMALS.PZ
                        });
                    }
                }
            }
        }
        return result;
    }, [debouncedCubies, size]);

    // Performance throttle:
    // - During active tunnel travel, update at full frame rate for smooth motion.
    // - During normal crawling, animate rings at a lower cadence to cut per-frame CPU load.
    const frameBudgetRef = useRef(0);
    const lastPhaseRef = useRef('crawling');
    const clearedRef = useRef(false);

    // Instance capacities. Writes are contiguous from slot 0, so the frame loop sets
    // each mesh.count to the number of slots actually written — the GPU then skips the
    // (previously zero-scaled) unused instances entirely instead of running the vertex
    // stage over the full worst-case allocation every frame (~4 000 instances at size 5).
    const MAX_BUBBLES = MAX_RINGS * BUBBLES_PER_VOID;
    const MAX_SPARKS = MAX_RINGS * SPARKS_PER_CRITICAL;
    const MAX_POLES = MAX_RINGS * POLES_PER_TILE;
    const MAX_TAPES = MAX_RINGS * TAPES_PER_TILE;
    const MAX_VOID_FRAME_SEGMENTS = MAX_RINGS * FRAME_SEGMENTS_PER_VOID;

    useFrame(({ clock }, delta) => {
        const phase = worm?.phase?.current ?? 'crawling';
        const inTunnelPhase = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const targetStep = inTunnelPhase ? (1 / 60) : (1 / 20);

        if (lastPhaseRef.current !== phase) {
            // Prevent carrying large accumulated delta across phase changes.
            frameBudgetRef.current = 0;
            lastPhaseRef.current = phase;
        }

        frameBudgetRef.current += delta;
        if (frameBudgetRef.current < targetStep) return;
        frameBudgetRef.current = 0;

        // Nothing to render and counts already zeroed last pass — skip all work.
        if (allPositions.length === 0 && clearedRef.current) return;

        const liveMesh = liveRef.current;
        const voidOuter = voidOuterRef.current;
        const voidInner = voidInnerRef.current;
        const bubbles = bubblesRef.current;
        const sparks = sparkRef.current;
        const poles = poleRef.current;
        const tapes = tapeRef.current;
        const voidFrames = voidFrameRef.current;
        if (!liveMesh || !voidOuter || !voidInner || !bubbles || !sparks || !poles || !tapes || !voidFrames) return;

        const t = clock.elapsedTime;
        const voidKeys = voidTunnelKeysRef?.current ?? _EMPTY_SET;
        const useCounts = tunnelUseCountsRef?.current ?? _EMPTY_MAP;

        let liveIdx = 0;
        let voidIdx = 0;
        let bubbleIdx = 0;
        let sparkIdx = 0;
        let poleIdx = 0;
        let tapeIdx = 0;
        let frameIdx = 0;

        for (let i = 0; i < allPositions.length; i++) {
            const { tunnelKey, wp, normal: n } = allPositions[i];
            const isVoid = !!(tunnelKey && voidKeys.has(tunnelKey));
            const traversals = tunnelKey ? (useCounts.get(tunnelKey) ?? 0) : 0;
            const isCritical = !isVoid && traversals >= WORMHOLE_MAX_TRAVERSALS;

            _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
            _ringUp.set(0, 1, 0);
            if (Math.abs(n.y) > 0.9) _ringUp.set(1, 0, 0);
            _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);

            if (isVoid) {
                // ── Void swamp portal ───────────────────────────────────────
                // Outer ring: slow reverse rotation, sluggish dying pulse
                _ringDummy.rotateOnAxis(n, -t * 0.35 + voidIdx * 1.1);
                const outerPulse = 0.9 + Math.sin(t * 0.85 + voidIdx * 2.3) * 0.1;
                _ringDummy.scale.setScalar(outerPulse);
                _ringDummy.updateMatrix();
                voidOuter.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Inner ring: slightly different counter-rotation phase, smaller
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * 0.2 - voidIdx * 0.9); // counter-phase
                const innerPulse = 0.7 + Math.sin(t * 1.1 + voidIdx * 1.7) * 0.08;
                _ringDummy.scale.setScalar(innerPulse);
                _ringDummy.updateMatrix();
                voidInner.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Void swamp bubbles — rising gas from the dead portal
                for (let b = 0; b < BUBBLES_PER_VOID && bubbleIdx < MAX_BUBBLES; b++) {
                    const si = (i * BUBBLES_PER_VOID + b) * 3;
                    const phase = (t * 0.55 + bubbleSeeds[si + 2]) % 1;
                    const lift = phase * 0.72;
                    const envelope = Math.sin(phase * Math.PI); // 0→1→0 over lifetime
                    _bubbleDummy.position.set(
                        wp[0] + n.x * lift + bubbleSeeds[si] * envelope,
                        wp[1] + n.y * lift + bubbleSeeds[si + 1] * envelope,
                        wp[2] + n.z * lift
                    );
                    _bubbleDummy.scale.setScalar(Math.max(0, envelope * 0.038));
                    _bubbleDummy.updateMatrix();
                    bubbles.setMatrixAt(bubbleIdx, _bubbleDummy.matrix);
                    bubbleIdx++;
                }

                voidIdx++;
            } else {
                // ── Live wormhole ring — gets severe warning at 3rd traversal ─
                const intensityTier = Math.min(Math.max(traversals, 0), WORMHOLE_MAX_TRAVERSALS);
                const speedMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.55 : 0);
                const glowMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.75 : 0);
                const wobble = Math.sin(t * (9.0 * speedMul) + i * 1.4) * (0.03 + 0.03 * intensityTier);
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08 + wobble);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * (2.1 * speedMul) + i * 0.9);
                const pulse = glowMul + Math.sin(t * (4.8 * speedMul) + i * 1.7) * (0.16 * glowMul);
                _ringDummy.scale.setScalar(pulse);
                _ringDummy.updateMatrix();
                liveMesh.setMatrixAt(liveIdx, _ringDummy.matrix);
                _liveColor.copy(_liveBaseColor).lerp(_criticalArcColor, isCritical ? 0.45 : 0).multiplyScalar(glowMul);
                liveMesh.setColorAt(liveIdx, _liveColor);
                liveIdx++;

                if (isCritical) {
                    _voidArcRight.crossVectors(n, _voidArcAxisY);
                    if (_voidArcRight.lengthSq() < 1e-4) _voidArcRight.set(1, 0, 0);
                    _voidArcRight.normalize();
                    _voidArcForward.crossVectors(n, _voidArcRight).normalize();
                    for (let sp = 0; sp < SPARKS_PER_CRITICAL && sparkIdx < MAX_SPARKS; sp++) {
                        const si = (i * SPARKS_PER_CRITICAL + sp) * 3;
                        const phase = (t * (2.5 + sp * 0.15) + bubbleSeeds[si + 2]) % 1;
                        const radial = 0.08 + Math.sin(phase * Math.PI * 2 + sp) * 0.035;
                        const lift = 0.18 + phase * 0.95;
                        const thickness = 0.010 + Math.sin(phase * Math.PI) * 0.010;
                        const height = 0.10 + Math.sin(phase * Math.PI) * 0.28;

                        _sparkDummy.position.set(
                            wp[0] + n.x * lift + _voidArcRight.x * radial + _voidArcForward.x * bubbleSeeds[si] * 0.12,
                            wp[1] + n.y * lift + _voidArcRight.y * radial + _voidArcForward.y * bubbleSeeds[si + 1] * 0.12,
                            wp[2] + n.z * lift + _voidArcRight.z * radial + _voidArcForward.z * bubbleSeeds[si] * 0.12
                        );
                        _sparkDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                        _sparkDummy.rotateOnAxis(n, phase * Math.PI * 8 + sp * 0.9);
                        _sparkDummy.scale.set(thickness, height, thickness);
                        _sparkDummy.updateMatrix();
                        sparks.setMatrixAt(sparkIdx, _sparkDummy.matrix);
                        sparkIdx++;
                    }
                }
            }

            if (isVoid || isCritical) {
                _tapeRight.crossVectors(n, _voidArcAxisY);
                if (_tapeRight.lengthSq() < 1e-4) _tapeRight.set(1, 0, 0);
                _tapeRight.normalize();
                _tapeForward.crossVectors(n, _tapeRight).normalize();
                
                const half = 0.45;
                const corners = [
                    [half, half],
                    [half, -half],
                    [-half, -half],
                    [-half, half]
                ];
                
                for (let c = 0; c < 4 && poleIdx < MAX_POLES; c++) {
                    const cx = corners[c][0];
                    const cy = corners[c][1];
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * cx + _tapeForward.x * cy + n.x * 0.2,
                        wp[1] + _tapeRight.y * cx + _tapeForward.y * cy + n.y * 0.2,
                        wp[2] + _tapeRight.z * cx + _tapeForward.z * cy + n.z * 0.2
                    );
                    _cautionDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                    _cautionDummy.scale.set(1, 1, 1);
                    _cautionDummy.updateMatrix();
                    poles.setMatrixAt(poleIdx++, _cautionDummy.matrix);
                }
                
                const poleHeight = 0.4;
                const tapeWidth = 0.07;
                // Place tapes near the top of the poles, slightly below the tip
                const tapeLift = 0.2 + (poleHeight / 2) - (tapeWidth / 2) - 0.02;
                
                const loopT = t * 0.8 + i * 2.3;

                for (let e = 0; e < 4 && tapeIdx < MAX_TAPES; e++) {
                    const si = (i * TAPES_PER_TILE + e) * 3;
                    const c1 = corners[e];
                    const c2 = corners[(e + 1) % 4];
                    const mx = (c1[0] + c2[0]) / 2;
                    const my = (c1[1] + c2[1]) / 2;
                    
                    const edgeVecX = c2[0] - c1[0];
                    const edgeVecY = c2[1] - c1[1];
                    const eD_x = _tapeRight.x * edgeVecX + _tapeForward.x * edgeVecY;
                    const eD_y = _tapeRight.y * edgeVecX + _tapeForward.y * edgeVecY;
                    const eD_z = _tapeRight.z * edgeVecX + _tapeForward.z * edgeVecY;
                    _tapeEdgeDir.set(eD_x, eD_y, eD_z).normalize();

                    // Background: A Three.js PlaneGeometry is created on the XY plane and faces +Z.
                    // To hang like a fence around the perimeter:
                    // Width (X-axis) should run along the edge: edgeDir
                    // Height (Y-axis) should point UP relative to the cube surface: tapeUp
                    // Normal (Z-axis) should point OUTWARD from the tile center: tapeNormal

                    // The outward vector for this edge
                    const outwardVecX = mx;
                    const outwardVecY = my;
                    const out_x = _tapeRight.x * outwardVecX + _tapeForward.x * outwardVecY;
                    const out_y = _tapeRight.y * outwardVecX + _tapeForward.y * outwardVecY;
                    const out_z = _tapeRight.z * outwardVecX + _tapeForward.z * outwardVecY;
                    _tapeOutwardDir.set(out_x, out_y, out_z).normalize();

                    // The UP vector is the surface normal 'n'
                    // We want the tape to stand up like a fence, so its Y axis is 'n'
                    _tapeUp.copy(n);

                    // The OUTWARD normal of the tape is 'outwardDir'
                    // We add flutter to it so the tape blows in the wind
                    const flutter = Math.sin(loopT * 15 + e * 2.1) * 0.08;
                    _tapeNormal.copy(_tapeOutwardDir).addScaledVector(n, flutter).normalize();

                    // Re-derive the exact edge direction that is perpendicular to both UP and NORMAL
                    // to ensure an orthogonal basis
                    _tapeCrossRight.crossVectors(_tapeUp, _tapeNormal).normalize();

                    // If _tapeCrossRight points opposite to edgeDir, flip it to keep texture orientation consistent
                    if (_tapeCrossRight.dot(_tapeEdgeDir) < 0) {
                        _tapeCrossRight.negate();
                        _tapeNormal.negate(); // Flip normal too to keep right-handed coordinate system
                    }

                    // X = _tapeCrossRight (along edge), Y = _tapeUp (height), Z = _tapeNormal (outward)
                    _tapeMat4.makeBasis(_tapeCrossRight, _tapeUp, _tapeNormal);
                    
                    // Tape spans from pole to pole. Distance between them is 0.9
                    const tapeLength = 0.9;
                    
                    // Add slight downward sag in the middle of the tape
                    const sag = Math.sin(loopT * 2 + e + bubbleSeeds[si + 2] * Math.PI * 2) * 0.015 - 0.015;
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * mx + _tapeForward.x * my + n.x * (tapeLift + sag),
                        wp[1] + _tapeRight.y * mx + _tapeForward.y * my + n.y * (tapeLift + sag),
                        wp[2] + _tapeRight.z * mx + _tapeForward.z * my + n.z * (tapeLift + sag)
                    );
                    _cautionDummy.quaternion.setFromRotationMatrix(_tapeMat4);
                    // Scale X ensures it reaches exactly pole to pole
                    _cautionDummy.scale.set(tapeLength, tapeWidth, 1);
                    _cautionDummy.updateMatrix();
                    tapes.setMatrixAt(tapeIdx++, _cautionDummy.matrix);
                }
            }


            if (isVoid) {
                const framePulse = 1 + Math.sin(t * 6.5 + i * 0.9) * 0.22;
                const half = 0.50;
                const lift = 0.11;
                const thickness = 0.028 * framePulse;
                const longEdge = 0.96;

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < MAX_VOID_FRAME_SEGMENTS) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < MAX_VOID_FRAME_SEGMENTS) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < MAX_VOID_FRAME_SEGMENTS) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < MAX_VOID_FRAME_SEGMENTS) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);
            }
        }

        // Draw only the slots written this frame. Writes are contiguous from 0, so
        // shrinking mesh.count culls every unused instance on the GPU — no zero-scale
        // matrix scrubbing needed, and re-growth overwrites slots before exposing them.
        liveMesh.count = liveIdx;
        voidOuter.count = voidIdx;
        voidInner.count = voidIdx;
        bubbles.count = bubbleIdx;
        sparks.count = sparkIdx;
        poles.count = poleIdx;
        tapes.count = tapeIdx;
        voidFrames.count = frameIdx;

        // Re-upload only buffers that were written this frame — skips idle GPU uploads.
        if (liveIdx > 0) {
            liveMesh.instanceMatrix.needsUpdate = true;
            if (liveMesh.instanceColor) liveMesh.instanceColor.needsUpdate = true;
        }
        if (voidIdx > 0) {
            voidOuter.instanceMatrix.needsUpdate = true;
            voidInner.instanceMatrix.needsUpdate = true;
        }
        if (bubbleIdx > 0) bubbles.instanceMatrix.needsUpdate = true;
        if (sparkIdx > 0) sparks.instanceMatrix.needsUpdate = true;
        if (poleIdx > 0) poles.instanceMatrix.needsUpdate = true;
        if (tapeIdx > 0) tapes.instanceMatrix.needsUpdate = true;
        if (frameIdx > 0) voidFrames.instanceMatrix.needsUpdate = true;

        clearedRef.current = allPositions.length === 0;
    });

    return (
        <>
            {/* Live wormhole rings — bright neon pink, fast spin */}
            <instancedMesh ref={liveRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.42, 0.025, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" vertexColors transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void outer ring — sickly swamp green, slow reverse rotation */}
            <instancedMesh ref={voidOuterRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.44, 0.030, 8, 32]} />
                <meshBasicMaterial color={VOID_OUTER_COLOR} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void inner ring — near-black green, barely alive counter-rotation */}
            <instancedMesh ref={voidInnerRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.28, 0.018, 6, 24]} />
                <meshBasicMaterial color={VOID_INNER_COLOR} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Void swamp gas bubbles — dark orbs seeping out of dead portals */}
            <instancedMesh ref={bubblesRef} args={[undefined, undefined, MAX_BUBBLES]} frustumCulled={false}>
                <sphereGeometry args={[1, 5, 5]} />
                <meshBasicMaterial color={VOID_BUBBLE_COLOR} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Critical escape arcs — electricity venting from near-void portals */}
            <instancedMesh ref={sparkRef} args={[undefined, undefined, MAX_SPARKS]} frustumCulled={false}>
                <cylinderGeometry args={[1, 1, 1, 5]} />
                <meshBasicMaterial color={CRITICAL_ARC_COLOR} transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Caution poles */}
            <instancedMesh ref={poleRef} args={[undefined, undefined, MAX_POLES]} frustumCulled={false}>
                <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
                <meshBasicMaterial color="#111111" transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Caution tape strips */}
            <instancedMesh ref={tapeRef} args={[undefined, undefined, MAX_TAPES]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={cautionTexture} color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Void tile frame booster — brighter than neighbor tile frames */}
            <instancedMesh ref={voidFrameRef} args={[undefined, undefined, MAX_VOID_FRAME_SEGMENTS]} frustumCulled={false}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#9aff00" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
}

// ─── Tunnel Portal Rings — 3 gyroscope rings during antipodal traversal ──────
// Stacked torus rings rotating around X, Y, Z axes respectively; shown every
// time the worm travels through an antipodal tunnel.
const _portalRingPos = new THREE.Vector3();

function TunnelPortalRings({ worm, size }) {
    const ringXRef = useRef();
    const ringYRef = useRef();
    const ringZRef = useRef();
    // popT: -1 = idle, 0→1 = contracting-and-popping
    const popTRef = useRef(-1);
    // Saved world position for the pop (rings may have been repositioned)
    const popPosRef = useRef(new THREE.Vector3());

    useFrame(({ clock }, delta) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        const active = (phase === 'entering' || phase === 'tunnel' || phase === 'exiting') && tunnel;

        const rings = [ringXRef.current, ringYRef.current, ringZRef.current];

        // Consume healFiredRef → start pop
        if (worm.healFiredRef.current) {
            worm.healFiredRef.current = false;
            popTRef.current = 0;
            popPosRef.current.copy(_portalRingPos);
        }

        // Pop animation: rings spin fast, contract, then vanish
        if (popTRef.current >= 0) {
            popTRef.current = Math.min(1, popTRef.current + delta / 0.30);
            const pt = popTRef.current;
            const scale = Math.max(0, 1 - pt * pt); // quadratic collapse
            const t = clock.elapsedTime;
            const spinBoost = 6.0; // 6× faster spin during pop
            for (const r of rings) {
                if (!r) continue;
                r.visible = pt < 1;
                r.position.copy(popPosRef.current);
                r.scale.setScalar(scale);
            }
            if (ringXRef.current) {
                ringXRef.current.rotation.set(t * 2.2 * spinBoost, t * 0.3 * spinBoost, 0);
                ringXRef.current.material.opacity = 0.75 * (1 - pt);
            }
            if (ringYRef.current) {
                ringYRef.current.rotation.set(t * 0.4 * spinBoost, t * 1.8 * spinBoost, 0);
                ringYRef.current.material.opacity = 0.65 * (1 - pt);
            }
            if (ringZRef.current) {
                ringZRef.current.rotation.set(0, t * 0.5 * spinBoost, t * 2.5 * spinBoost);
                ringZRef.current.material.opacity = 0.55 * (1 - pt);
            }
            if (popTRef.current >= 1) {
                for (const r of rings) if (r) { r.visible = false; r.scale.setScalar(1); }
                popTRef.current = -1;
            }
            return;
        }

        if (!active) {
            for (const r of rings) if (r) r.visible = false;
            return;
        }

        // Map phase progress → tunnel t (same mapping as WormChaseCamera)
        const prog = worm.tunnelProgress.current;
        let tunnelT;
        if (phase === 'entering') tunnelT = prog * 0.35;
        else if (phase === 'exiting') tunnelT = 0.65 + prog * 0.35;
        else tunnelT = 0.35 + prog * 0.30;

        getTunnelWorldPosInto(_portalRingPos, tunnel, Math.min(tunnelT, 1), size);

        const t = clock.elapsedTime;
        // Healing exits: keep rings visible until the pop fires; normal exits fade out.
        let fadeIn;
        if (phase === 'entering') {
            fadeIn = Math.min(1, prog * 5);
        } else if (phase === 'exiting') {
            fadeIn = worm.willHealRef.current ? 1.0 : Math.max(0, 1 - prog * 3);
        } else {
            fadeIn = 1;
        }

        if (ringXRef.current) {
            ringXRef.current.position.copy(_portalRingPos);
            ringXRef.current.rotation.set(t * 2.2, t * 0.3, 0);
            ringXRef.current.material.opacity = 0.75 * fadeIn;
            ringXRef.current.visible = true;
        }
        if (ringYRef.current) {
            ringYRef.current.position.copy(_portalRingPos);
            ringYRef.current.rotation.set(t * 0.4, t * 1.8, 0);
            ringYRef.current.material.opacity = 0.65 * fadeIn;
            ringYRef.current.visible = true;
        }
        if (ringZRef.current) {
            ringZRef.current.position.copy(_portalRingPos);
            ringZRef.current.rotation.set(0, t * 0.5, t * 2.5);
            ringZRef.current.material.opacity = 0.55 * fadeIn;
            ringZRef.current.visible = true;
        }
    });

    return (
        <>
            {/* X-axis ring */}
            <mesh ref={ringXRef} visible={false}>
                <torusGeometry args={[0.40, 0.026, 8, 32]} />
                <meshBasicMaterial color="#cc44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Y-axis ring */}
            <mesh ref={ringYRef} visible={false}>
                <torusGeometry args={[0.36, 0.022, 8, 32]} />
                <meshBasicMaterial color="#aa22ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Z-axis ring */}
            <mesh ref={ringZRef} visible={false}>
                <torusGeometry args={[0.32, 0.020, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}

// ─── Tunnel Portal FX ─────────────────────────────────────────────────────────
// Punchy moment effects layered on the wormhole transition:
//   • Entry vortex — a stack of concentric rings forming a funnel mouth at the entry hole.
//     They spin (faster as the worm dives) and pull inward, so the worm is visibly *sucked*
//     down a swirling throat.
//   • Exit burst — a one-shot shockwave ring + flash that fires the instant the worm breaks
//     out of the exit hole, so it reads as being *spat out*.
const _fxPos = new THREE.Vector3();
const _fxNormal = new THREE.Vector3();
const _fxQuat = new THREE.Quaternion();
const _fxRingUp = new THREE.Vector3(0, 0, 1); // ring/torus geometry lies in XY → flat normal is +Z
const VORTEX_RINGS = 4;

function TunnelPortalFX({ worm, size }) {
    const colors = useGameStore(s => s.wormActiveTunnelColors);
    const entryColor = colors?.entryColor ?? '#33ddff';
    const exitColor = colors?.exitColor ?? '#ff8833';

    const vortexRef = useRef();
    const vortexRingRefs = useRef([]);
    const exitVortexRef = useRef();
    const exitVortexRingRefs = useRef([]);
    const burstRef = useRef();
    const burstFlashRef = useRef();
    const burstTRef = useRef(-1);   // -1 idle, else 0..1 burst progress
    const firedRef = useRef(false); // one-shot guard per traversal

    useFrame(({ clock }, delta) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        const prog = worm.tunnelProgress.current;
        const t = clock.elapsedTime;

        // ── Entry vortex (sucked in) ───────────────────────────────────────────
        const vGroup = vortexRef.current;
        if (vGroup) {
            const showVortex = (phase === 'windup' || phase === 'entering') && !!tunnel;
            vGroup.visible = showVortex;
            if (showVortex) {
                // Sit the swirl on the entry FACE SURFACE (just outside) so it is visible from
                // outside the cube as the worm is sucked down through it.
                const ewp = getStickerWorldPos(tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, size, 0);
                _fxNormal.copy(FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY);
                _fxPos.set(ewp[0], ewp[1], ewp[2]).addScaledVector(_fxNormal, 0.08);
                _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
                vGroup.position.copy(_fxPos);
                vGroup.quaternion.copy(_fxQuat);

                const spin = t * 7 + prog * 14;           // accelerates as the worm dives
                const shrink = 1 - Math.min(1, prog) * 0.65; // funnel narrows inward
                const envelope = Math.sin(Math.min(1, prog * 1.15) * Math.PI); // fade in then out
                for (let i = 0; i < VORTEX_RINGS; i++) {
                    const r = vortexRingRefs.current[i];
                    if (!r) continue;
                    r.rotation.z = spin * (1 + i * 0.35);
                    const baseR = 1 - i * 0.2;
                    r.scale.setScalar(Math.max(0.02, baseR * shrink));
                    r.position.z = -i * 0.16 * (0.6 + shrink); // recede into the hole (−normal)
                    if (r.material) r.material.opacity = Math.max(0, envelope * (0.55 - i * 0.09));
                }
            }
        }

        // ── Exit vortex (windout — spiraling back up to the surface) ──────────
        // Mirror of the entry vortex: rings EXPAND outward from the exit hole as the
        // worm corkscrews up. Counter-spins so it visually reads as "unwinding."
        const exGroup = exitVortexRef.current;
        if (exGroup) {
            const showExitVortex = phase === 'windout' && !!tunnel;
            exGroup.visible = showExitVortex;
            if (showExitVortex) {
                const xwp = getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0);
                _fxNormal.copy(FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY);
                _fxPos.set(xwp[0], xwp[1], xwp[2]).addScaledVector(_fxNormal, 0.08);
                _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
                exGroup.position.copy(_fxPos);
                exGroup.quaternion.copy(_fxQuat);

                // prog 0→1 over windout: rings expand and fade as the worm rises and settles
                const expand = 0.35 + Math.min(1, prog) * 1.2; // grow outward
                const envelope = Math.sin(Math.min(1, prog * 1.15) * Math.PI);
                const spin = -t * 6 - prog * 10; // counter-spin vs entry
                for (let i = 0; i < VORTEX_RINGS; i++) {
                    const r = exitVortexRingRefs.current[i];
                    if (!r) continue;
                    r.rotation.z = spin * (1 + i * 0.35);
                    const baseR = 0.5 + i * 0.18; // outer rings larger than entry (spreading out)
                    r.scale.setScalar(baseR * expand);
                    r.position.z = i * 0.12 * expand; // extend above the hole (+normal)
                    if (r.material) r.material.opacity = Math.max(0, envelope * (0.50 - i * 0.08));
                }
            }
        }

        // ── Exit burst (spat out) ──────────────────────────────────────────────
        // Fire once, the instant the head breaks out of the exit mouth.
        if (phase === 'exiting' && tunnel && !firedRef.current && prog > 0.55) {
            firedRef.current = true;
            burstTRef.current = 0;
            // Burst on the exit FACE SURFACE (just outside) so the spit-out reads from outside.
            const xwp = getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0);
            _fxNormal.copy(FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY);
            _fxPos.set(xwp[0], xwp[1], xwp[2]).addScaledVector(_fxNormal, 0.12);
            _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
            if (burstRef.current) {
                burstRef.current.position.copy(_fxPos).addScaledVector(_fxNormal, 0.12);
                burstRef.current.quaternion.copy(_fxQuat);
            }
            if (burstFlashRef.current) {
                burstFlashRef.current.position.copy(_fxPos).addScaledVector(_fxNormal, 0.12);
            }
        }
        if (phase === 'crawling') firedRef.current = false; // re-arm for the next tunnel

        if (burstTRef.current >= 0) {
            burstTRef.current = Math.min(1.0001, burstTRef.current + delta / 0.5);
            const bt = burstTRef.current;
            const ease = 1 - (1 - bt) * (1 - bt); // ease-out expansion
            if (burstRef.current) {
                burstRef.current.visible = bt < 1;
                burstRef.current.scale.setScalar(0.15 + ease * 2.0);
                if (burstRef.current.material) burstRef.current.material.opacity = (1 - bt) * 0.85;
            }
            if (burstFlashRef.current) {
                burstFlashRef.current.visible = bt < 0.6;
                burstFlashRef.current.scale.setScalar(0.25 + ease * 0.7);
                if (burstFlashRef.current.material) burstFlashRef.current.material.opacity = Math.max(0, 0.6 - bt) * 1.4;
            }
            if (bt >= 1) burstTRef.current = -1;
        } else {
            if (burstRef.current) burstRef.current.visible = false;
            if (burstFlashRef.current) burstFlashRef.current.visible = false;
        }
    });

    return (
        <>
            {/* Entry vortex — concentric funnel rings */}
            <group ref={vortexRef} visible={false}>
                {Array.from({ length: VORTEX_RINGS }, (_, i) => (
                    <mesh key={i} ref={el => (vortexRingRefs.current[i] = el)}>
                        <torusGeometry args={[0.5, 0.045, 8, 36]} />
                        <meshBasicMaterial color={entryColor} transparent opacity={0}
                            blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                    </mesh>
                ))}
            </group>

            {/* Exit vortex — concentric expanding rings that unwind as the worm spirals out */}
            <group ref={exitVortexRef} visible={false}>
                {Array.from({ length: VORTEX_RINGS }, (_, i) => (
                    <mesh key={i} ref={el => (exitVortexRingRefs.current[i] = el)}>
                        <torusGeometry args={[0.5, 0.045, 8, 36]} />
                        <meshBasicMaterial color={exitColor} transparent opacity={0}
                            blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                    </mesh>
                ))}
            </group>

            {/* Exit shockwave ring */}
            <mesh ref={burstRef} visible={false}>
                <ringGeometry args={[0.46, 0.6, 44]} />
                <meshBasicMaterial color={exitColor} transparent opacity={0} side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Exit flash pop */}
            <mesh ref={burstFlashRef} visible={false}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color={exitColor} transparent opacity={0}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
        </>
    );
}

// ─── Slice Warning Lights ─────────────────────────────────────────────────────
// Visual warning for the about-to-rotate slice:
//   1. Spinning rainbow torus ring — encircles the cube at the slice plane, sized to the
//      cube's actual world-space dimensions so it is always visible on any cube size.
//      Vertex-colored with all 6 face colors. Spins in the rotation direction.
//   2. PointLights per face — antipodal-colored scene lighting.
//
// World-space coordinate formula: tile at grid index i on axis with size n
//   maps to world coord  i - (n-1)/2
// So the cube half-extent is (size-1)/2, and the ring radius must clear
// the face diagonal: (size-1)/2 * sqrt(2) plus margin.
const MAX_SLICE_LIGHTS = 6;
const TUBULAR_SEGS = 96;
const RADIAL_SEGS  = 16;

const _ringSpinQ = new THREE.Quaternion();
const _xAxis     = new THREE.Vector3(1, 0, 0);
const _yAxis     = new THREE.Vector3(0, 1, 0);
const _zAxis     = new THREE.Vector3(0, 0, 1);

function SliceWarningLights({ pendingRotRef, warningProgressRef, size, cubies }) {
    const lightGroupRef = useRef();
    const ringRef       = useRef();
    const borderRef     = useRef();
    const hazardBoxRef  = useRef();
    const customGeoRef  = useRef(null); // tracks geometries we created so we can dispose them
    const customBorderGeoRef = useRef(null);
    const dataRef       = useRef(null);
    const lastKeyRef    = useRef(null);
    const spinAngleRef  = useRef(0);

    useFrame(({ clock }, delta) => {
        const lgroup = lightGroupRef.current;
        const ring   = ringRef.current;
        const border = borderRef.current;
        const box    = hazardBoxRef.current;
        if (!lgroup || !ring || !border || !box) return;

        const pending = pendingRotRef.current;
        const t  = clock.elapsedTime;
        const wp = warningProgressRef.current;

        if (!pending) {
            for (const l of lgroup.children) l.intensity = 0;
            ring.visible = false;
            border.visible = false;
            box.visible = false;
            lastKeyRef.current = null;
            dataRef.current    = null;
            return;
        }

        ring.visible = true;
        border.visible = true;
        box.visible = true;

        // Recompute when the slice identity changes
        const key = `${pending.axis}-${pending.sliceIndex}`;
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            const { axis, sliceIndex } = pending;
            const stickers   = getSliceSurfaceStickers(size, axis, sliceIndex);
            const faceColors = resolveColors(useGameStore.getState().settings);

            // Per-face center + color for point lights
            const byFace = {};
            for (const { x, y, z, dirKey } of stickers) {
                const [wx, wy, wz] = getStickerWorldPos(x, y, z, dirKey, size, 0);
                if (!byFace[dirKey]) {
                    const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                    const faceId  = sticker?.curr ?? 0;
                    const antiId  = ANTIPODAL_COLOR[faceId] ?? faceId;
                    const hex     = (antiId && faceColors[antiId]) ?? '#ffcc44';
                    byFace[dirKey] = { wx: 0, wy: 0, wz: 0, n: 0, color: new THREE.Color(hex) };
                }
                byFace[dirKey].wx += wx;
                byFace[dirKey].wy += wy;
                byFace[dirKey].wz += wz;
                byFace[dirKey].n++;
            }
            const faceData = Object.entries(byFace).map(([dirKey, d]) => {
                const nm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
                return { cx: d.wx / d.n, cy: d.wy / d.n, cz: d.wz / d.n, nx: nm.x, ny: nm.y, nz: nm.z, color: d.color };
            });

            // ── Ring position ─────────────────────────────────────────────────
            // Tile grid index i maps to world coord  i - (size-1)/2
            const sliceW = sliceIndex - (size - 1) / 2;
            if (axis === 'col')        { ring.position.set(sliceW, 0, 0); border.position.set(sliceW, 0, 0); }
            else if (axis === 'row')   { ring.position.set(0, sliceW, 0); border.position.set(0, sliceW, 0); }
            else                       { ring.position.set(0, 0, sliceW); border.position.set(0, 0, sliceW); }

            // ── Ring geometry — sized to cube, rainbow vertex colors ───────────
            // halfExt * sqrt(2) is only the corner of the CUBIE LATTICE (centers of the
            // outermost cubies) — the rendered cube extends another ~0.49-0.51 units past
            // that out to the body/sticker surface (see Cubie.jsx EDGE_H / STICKER_POS), so
            // the true rendered corner must include that before the clearance margin is
            // applied, otherwise the ring undershoots and cuts through the cube's corners.
            const halfExt    = (size - 1) / 2;
            const CUBIE_OUTER_HALF = 0.51;
            const cubeCornerRadius = (halfExt + CUBIE_OUTER_HALF) * Math.SQRT2;
            const ringRadius = cubeCornerRadius * 1.3225;
            const ringTube   = Math.max(0.11, halfExt * 0.1);
            const borderTube = ringTube * 1.3; // slightly larger so it rims the colorful ring as a defining edge

            if (customGeoRef.current) { customGeoRef.current.dispose(); customGeoRef.current = null; }
            const geo = new THREE.TorusGeometry(ringRadius, ringTube, RADIAL_SEGS, TUBULAR_SEGS);

            // Vertex colors: cycle through all 6 face colors equally around the ring.
            // Boosted past 1.0 — additive blending only reads as "bright" when the
            // source color itself is hot, otherwise the ring reads as a dim tint.
            const COLOR_BOOST = 1.6;
            const colors6  = [1, 2, 3, 4, 5, 6].map(id => new THREE.Color(faceColors[id] ?? '#ffffff').multiplyScalar(COLOR_BOOST));
            const vertCount = (RADIAL_SEGS + 1) * (TUBULAR_SEGS + 1);
            const colorArr  = new Float32Array(vertCount * 3);
            let ci = 0;
            for (let i = 0; i <= TUBULAR_SEGS; i++) {
                const c = colors6[Math.floor((i / TUBULAR_SEGS) * 6) % 6];
                for (let j = 0; j <= RADIAL_SEGS; j++) {
                    colorArr[ci++] = c.r;
                    colorArr[ci++] = c.g;
                    colorArr[ci++] = c.b;
                }
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
            customGeoRef.current = geo;
            ring.geometry = geo;

            if (customBorderGeoRef.current) { customBorderGeoRef.current.dispose(); customBorderGeoRef.current = null; }
            const borderGeo = new THREE.TorusGeometry(ringRadius, borderTube, RADIAL_SEGS, TUBULAR_SEGS);
            customBorderGeoRef.current = borderGeo;
            border.geometry = borderGeo;

            // ── Ring orientation ──────────────────────────────────────────────
            // Default TorusGeometry: XY plane, hole (symmetry axis) along Z.
            //   col  → rotate 90° around Y   → hole along +X
            //   row  → rotate -90° around X  → hole along +Y
            //   depth→ identity               → hole already along Z
            const baseQ = new THREE.Quaternion();
            if (axis === 'col')      baseQ.setFromAxisAngle(_yAxis,  Math.PI / 2);
            else if (axis === 'row') baseQ.setFromAxisAngle(_xAxis, -Math.PI / 2);

            const rotAxis = axis === 'col'   ? _xAxis.clone()
                          : axis === 'row'   ? _yAxis.clone()
                          :                    _zAxis.clone();

            dataRef.current = { faceData, baseQ, rotAxis };
        }

        const { faceData, baseQ, rotAxis } = dataRef.current;

        // ── 1. Point lights ───────────────────────────────────────────────────
        const strobe   = 0.4 + Math.abs(Math.sin(t * (4 + wp * 14))) * 0.6;
        const lightInt = (3 + wp * 10) * strobe;
        for (let i = 0; i < MAX_SLICE_LIGHTS; i++) {
            const l = lgroup.children[i];
            if (!l) continue;
            if (i >= faceData.length) { l.intensity = 0; continue; }
            const { cx, cy, cz, nx, ny, nz, color } = faceData[i];
            l.position.set(cx + nx * 0.15, cy + ny * 0.15, cz + nz * 0.15);
            l.color.copy(color);
            l.intensity = lightInt;
        }

        // ── 2. Ring spin + pulse ──────────────────────────────────────────────
        spinAngleRef.current += delta * (1.2 + wp * 2.5) * pending.dir;
        _ringSpinQ.setFromAxisAngle(rotAxis, spinAngleRef.current);
        ring.quaternion.multiplyQuaternions(_ringSpinQ, baseQ);
        border.quaternion.copy(ring.quaternion);

        const pulse = 0.85 + 0.15 * Math.sin(t * 7);
        ring.material.opacity = (0.8 + wp * 0.2) * pulse;
        const scale = 1 + Math.sin(t * 4) * 0.02;
        ring.scale.setScalar(scale);
        border.scale.setScalar(scale);
        border.material.opacity = 0.75 + wp * 0.2;

        // ── 3. Hazard box — flash/shake/pulse skin hugging the actual layer ────
        // Sized to the slice's real volume (one cubie thick along the rotation axis).
        // The cross-section spans just PAST the outer sticker surface so the red
        // field coats the layer's exposed faces and is visible from OUTSIDE the cube
        // — not only from the inside tunnel camera. Everything ramps with wp: calm
        // right after the warning arms, frantic by the time the rotation fires.
        const halfExt = (size - 1) / 2;
        const sliceW  = pending.sliceIndex - halfExt;
        let baseX = 0, baseY = 0, baseZ = 0;
        // size + 0.4 reaches ~0.18 beyond the sticker surface on every side, so the
        // slab's perimeter faces sheathe the layer's outer tiles in red.
        const fieldSpan = size + 0.4;
        let dimX = fieldSpan, dimY = fieldSpan, dimZ = fieldSpan;
        if (pending.axis === 'col')      { baseX = sliceW; dimX = 0.94; }
        else if (pending.axis === 'row') { baseY = sliceW; dimY = 0.94; }
        else                             { baseZ = sliceW; dimZ = 0.94; }

        const shakeAmp = 0.05 * wp * wp; // negligible early, rattling hard near zero
        const jx = (Math.sin(t * 37 + 1.3) + Math.sin(t * 53 + 4.1)) * 0.5 * shakeAmp;
        const jy = (Math.sin(t * 41 + 2.7) + Math.sin(t * 59 + 0.6)) * 0.5 * shakeAmp;
        const jz = (Math.sin(t * 47 + 5.2) + Math.sin(t * 61 + 3.4)) * 0.5 * shakeAmp;
        box.position.set(baseX + jx, baseY + jy, baseZ + jz);

        const boxPulse = 1 + Math.sin(t * (5 + wp * 10)) * 0.06 * wp;
        box.scale.set(dimX * boxPulse, dimY * boxPulse, dimZ * boxPulse);

        const flashStrobe = 0.5 + 0.5 * Math.sin(t * (6 + wp * 24));
        box.material.opacity = (0.05 + wp * 0.4) * flashStrobe;
    });

    return (
        <>
            <group ref={lightGroupRef}>
                {Array.from({ length: MAX_SLICE_LIGHTS }, (_, i) => (
                    <pointLight key={i} intensity={0} distance={30} decay={2} castShadow={false} />
                ))}
            </group>
            {/* Black outline ring — slightly larger than the colorful ring, drawn first so
                it rims the bright ring with a defined edge instead of bleeding into the background. */}
            <mesh ref={borderRef} visible={false} renderOrder={1}>
                <torusGeometry args={[1, 0.05, RADIAL_SEGS, TUBULAR_SEGS]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.8} depthWrite={false} />
            </mesh>
            {/* Rainbow spinning ring — geometry set imperatively in useFrame to scale with cube size */}
            <mesh ref={ringRef} visible={false} renderOrder={2}>
                <torusGeometry args={[1, 0.04, RADIAL_SEGS, TUBULAR_SEGS]} />
                <meshBasicMaterial vertexColors transparent opacity={0.9}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Hazard box — hugs the threatened layer's volume and flashes/shakes/pulses;
                position/scale/opacity driven imperatively in useFrame. */}
            <mesh ref={hazardBoxRef} visible={false} renderOrder={3}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ff2d3d" transparent opacity={0} side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}

// ─── Thunk Comic Effect ───────────────────────────────────────────────────────
// Comic-book THUNK text + coloured orb burst at the worm cut point.
const MAX_THUNK_ORBS = 10;
const _thunkDummy = new THREE.Object3D();
const _thunkCol = new THREE.Color();

function ThunkEffect({ thunkRef }) {
    const groupRef = useRef();
    const divRef = useRef();
    const orbMeshRef = useRef();
    const animTRef = useRef(0);
    const activeRef = useRef(false);
    const durationRef = useRef(1.4); // seconds — 1.4 for WORM!, 4.2 for WORM'D
    const orbStateRef = useRef({ positions: [], velocities: [], colors: [] });

    useFrame((_, delta) => {
        const pending = thunkRef.current;
        if (pending?.active) {
            pending.active = false;
            activeRef.current = true;
            animTRef.current = 0;
            // Support custom text (e.g. countdown "WORM!" vs collision "WORM'D")
            const text = pending.text ?? "WORM'D";
            if (divRef.current) divRef.current.textContent = text;
            // WORM'D lingers 3× longer so players have time to read it
            durationRef.current = text === "WORM'D" ? 4.2 : 1.4;
            const [px, py, pz] = pending.pos;
            if (groupRef.current) {
                groupRef.current.position.set(px, py, pz);
                groupRef.current.visible = true;
            }
            const st = orbStateRef.current;
            const colors = pending.colors?.length ? pending.colors : ['#ffdd44', '#ff8800', '#ff4444'];
            st.positions = [];
            st.velocities = [];
            st.colors = colors;
            for (let i = 0; i < MAX_THUNK_ORBS; i++) {
                st.positions.push([px, py, pz]);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                const spd = 1.8 + Math.random() * 2.2;
                st.velocities.push([
                    Math.sin(phi) * Math.cos(theta) * spd,
                    Math.sin(phi) * Math.sin(theta) * spd,
                    Math.cos(phi) * spd,
                ]);
            }
        }

        if (!activeRef.current) {
            const mesh = orbMeshRef.current;
            if (mesh) {
                _thunkDummy.scale.setScalar(0);
                _thunkDummy.updateMatrix();
                for (let i = 0; i < MAX_THUNK_ORBS; i++) mesh.setMatrixAt(i, _thunkDummy.matrix);
                mesh.instanceMatrix.needsUpdate = true;
            }
            return;
        }

        animTRef.current += delta;
        const t = Math.min(animTRef.current / durationRef.current, 1);

        // Animate HTML text scale + fade
        if (divRef.current) {
            const scale = t < 0.15 ? (t / 0.15) * 1.5 : t < 0.4 ? 1.5 - ((t - 0.15) / 0.25) * 0.5 : 1.0;
            const opacity = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
            divRef.current.style.transform = `scale(${scale})`;
            divRef.current.style.opacity = String(opacity);
            divRef.current.style.display = 'block';
        }

        // Animate orb burst
        const mesh = orbMeshRef.current;
        if (mesh) {
            const st = orbStateRef.current;
            const et = animTRef.current;
            for (let i = 0; i < MAX_THUNK_ORBS; i++) {
                const [vx, vy, vz] = st.velocities[i] || [0, 0, 0];
                const fade = Math.max(0, 1 - et / 0.75);
                _thunkDummy.position.set(
                    st.positions[i][0] + vx * et,
                    st.positions[i][1] + vy * et,
                    st.positions[i][2] + vz * et,
                );
                _thunkDummy.scale.setScalar(fade * 0.11);
                _thunkDummy.updateMatrix();
                mesh.setMatrixAt(i, _thunkDummy.matrix);
                _thunkCol.set(st.colors[i % st.colors.length] || '#ffdd44');
                mesh.setColorAt(i, _thunkCol);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }

        if (animTRef.current >= durationRef.current) {
            activeRef.current = false;
            if (groupRef.current) groupRef.current.visible = false;
            if (divRef.current) divRef.current.style.display = 'none';
        }
    });

    return (
        <>
            <group ref={groupRef} visible={false}>
                <Html center distanceFactor={10}>
                    <div ref={divRef} style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: '54px',
                        fontWeight: 900,
                        color: '#ffdd00',
                        textShadow: '-3px -3px 0 #cc2200, 3px -3px 0 #cc2200, -3px 3px 0 #cc2200, 3px 3px 0 #cc2200',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-2px',
                        transformOrigin: 'center',
                        display: 'none',
                    }}>
                        WORM&apos;D
                    </div>
                    {/* text is overwritten imperatively via divRef.current.textContent */}
                </Html>
            </group>
            <instancedMesh ref={orbMeshRef} args={[undefined, undefined, MAX_THUNK_ORBS]} frustumCulled={false}>
                <sphereGeometry args={[1, 6, 6]} />
                <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
}

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, onRotate, _onHeal, onAnimatedShuffle }) {
    const worm = useWormCrawler(size, cubies);

    // ── Game phase + scramble state ────────────────────────────────────────────
    // gameModePhaseRef: 'scrambling'|'spawning'|'countdown'|'active'|'finalHealing'|'solved'
    const gameModePhaseRef  = useRef('scrambling');
    const scrambleSeqRef    = useRef([]);   // [{axis,dir,sliceIndex}] × SCRAMBLE_STEPS
    const inverseQueueRef   = useRef([]);   // remaining inverse moves (consumed each rotation)
    const spawnTimerRef     = useRef(0);    // seconds elapsed in spawning entrance animation
    const countdownTimerRef = useRef(0);    // seconds elapsed in countdown phase
    const countdownStepRef  = useRef(-1);   // last store-synced step (avoids redundant setState)
    const finalHealCheckTimer = useRef(0);  // throttle: scan for active tunnels every 0.5s

    // Reactive phase for conditional JSX rendering — only changes on phase transitions
    const wormGamePhase = useGameStore(s => s.wormGamePhase ?? 'scrambling');
    const wormPhaseReactive = useGameStore(s => s.wormPhase ?? 'crawling');

    // ── Auto-rotation hazard state ─────────────────────────────────────────────
    const autoTimerRef      = useRef(0);
    const pendingRotRef     = useRef(null);   // {axis,dir,sliceIndex} during warning window
    const warningProgressRef = useRef(0);     // 0→1 through warning window
    const thunkRef = useRef({ active: false, pos: [0, 0, 0], colors: [] });

    useEffect(() => {
        setWormTurnCallback(worm.queueTurn);
        return () => { setWormTurnCallback(null); };
    }, [worm.queueTurn]);

    // Build a fresh scramble whenever a new run starts (or on first mount).
    useEffect(() => {
        const generateScramble = () => {
            const axes = ['col', 'row', 'depth'];
            // Standard scramble-generator rule (as used by WCA-style scramblers): never turn
            // the same layer (axis + sliceIndex) twice in a row. Without this, a random pick
            // can re-select the same layer immediately — most visibly when the direction also
            // flips, which just turns the previous move straight back (clockwise then
            // counterclockwise cancelling out to nothing).
            const seq = [];
            let prevAxis = null;
            let prevSlice = null;
            for (let i = 0; i < SCRAMBLE_STEPS; i++) {
                let axis, sliceIndex;
                do {
                    axis = axes[Math.floor(Math.random() * 3)];
                    sliceIndex = Math.floor(Math.random() * size);
                } while (axis === prevAxis && sliceIndex === prevSlice);
                seq.push({ axis, dir: Math.random() < 0.5 ? 1 : -1, sliceIndex, wormScramble: true });
                prevAxis = axis;
                prevSlice = sliceIndex;
            }
            scrambleSeqRef.current  = seq;
            // Inverse = reversed sequence with each dir flipped
            inverseQueueRef.current = [...seq].reverse().map(m => ({ ...m, dir: -m.dir }));

            // Reset all phase state
            gameModePhaseRef.current  = 'scrambling';
            spawnTimerRef.current     = 0;
            countdownTimerRef.current = 0;
            countdownStepRef.current  = -1;
            autoTimerRef.current      = 0;
            pendingRotRef.current     = null;
            warningProgressRef.current = 0;
            // Freeze the worm until the countdown completes
            useGameStore.setState({ wormGamePhase: 'scrambling', wormCountdownStep: null, wormPaused: true });

            // Play all 15 moves through the shared animated-shuffle pipeline:
            // fast 0.12s power2.out animations (no back-easing overshoot → no black layers),
            // properly sequenced, not counted as player moves.
            // When done, go to 'spawning' so the worm can emerge before the countdown.
            onAnimatedShuffle(seq, () => {
                gameModePhaseRef.current = 'spawning';
                spawnTimerRef.current    = 0;
                useGameStore.setState({ wormGamePhase: 'spawning', wormCountdownStep: null });
            });
        };

        // Run immediately so the first game (where initWormMode fires before this
        // component mounts) gets a valid scramble — not just on future runId changes.
        generateScramble();

        const unsub = useGameStore.subscribe(s => s.wormRunId, generateScramble);
        return unsub;
    }, [size, onAnimatedShuffle]);

    useFrame((_, delta) => {
        worm.tick(delta);

        // While a slice the worm sits on is mid-rotation during live play, ride it so the
        // worm visually turns with the cube rather than snapping into place only when the
        // rotation commits. Only meaningful on the surface (crawling); tunnel phases aren't
        // anchored to a slice, and other game phases position the worm themselves.
        if (gameModePhaseRef.current === 'active' && worm.phase.current === 'crawling') {
            rideLiveRotation(worm);
        }

        const store = useGameStore.getState();

        // ── Phase: scrambling ──────────────────────────────────────────────────
        // Moves are sequenced by startAnimatedShuffle (called from generateScramble).
        // Here we only track the worm's visual position so it rides along with each
        // rotating slice instead of staying frozen in world space.
        if (gameModePhaseRef.current === 'scrambling') {
            if (liveRotation.active) {
                // The worm is frozen during the scramble, so tick() didn't refresh
                // headInterpPos — seed it from the flat tile position before riding the slice.
                const { x, y, z, dirKey } = worm.pos.current;
                const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
                worm.headInterpPos.current.set(wp[0], wp[1], wp[2]);
                rideLiveRotation(worm);
            }
            return;
        }

        // ── Phase: spawning — worm wiggles out of the face center ─────────────
        if (gameModePhaseRef.current === 'spawning') {
            spawnTimerRef.current += delta;
            const t = Math.min(spawnTimerRef.current / SPAWN_DURATION, 1);
            // Damped spring: shoots out of the face then settles
            const bounce = Math.sin(t * Math.PI * 2.4) * Math.exp(-t * 4.0) * 0.4;
            const { x, y, z, dirKey } = worm.pos.current;
            const norm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            worm.headInterpPos.current.set(wp[0], wp[1], wp[2]).addScaledVector(norm, WORM_LIFT + bounce);
            if (t >= 1) {
                gameModePhaseRef.current  = 'countdown';
                countdownTimerRef.current = 0;
                countdownStepRef.current  = -1;
                useGameStore.setState({ wormGamePhase: 'countdown', wormCountdownStep: 3 });
                countdownStepRef.current  = 0;
            }
            return;
        }

        // ── Phase: countdown ──────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'countdown') {
            countdownTimerRef.current += delta;
            const step = Math.floor(countdownTimerRef.current / COUNTDOWN_STEP_DURATION);
            if (step !== countdownStepRef.current) {
                countdownStepRef.current = step;
                if      (step === 0) useGameStore.setState({ wormCountdownStep: 3 });
                else if (step === 1) useGameStore.setState({ wormCountdownStep: 2 });
                else if (step === 2) useGameStore.setState({ wormCountdownStep: 1 });
                else if (step === 3) {
                    // 'go' beat — HUD displays WORM! in the purple-glow countdown style.
                    // No separate ThunkEffect pop here; the HUD text IS the cool WORM display.
                    useGameStore.setState({ wormCountdownStep: 'go' });
                } else if (step >= 4) {
                    // Countdown done — release the worm
                    gameModePhaseRef.current = 'active';
                    autoTimerRef.current = 0;
                    pendingRotRef.current = null;
                    warningProgressRef.current = 0;
                    useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
                }
            }
            return;
        }

        // ── Phase: solved ──────────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'solved') return;

        // ── Phase: finalHealing — all rotations done, heal remaining tunnels ───
        if (gameModePhaseRef.current === 'finalHealing') {
            if (!store.wormAlive) return;
            // Throttle the expensive tunnel scan to once every 0.5 s
            finalHealCheckTimer.current += delta;
            if (finalHealCheckTimer.current >= 0.5) {
                finalHealCheckTimer.current = 0;
                const liveState = useGameStore.getState();
                const remaining = getActiveTunnels(
                    liveState.cubies,
                    size,
                    getManifoldMap(liveState.cubies, size, liveState.rotationEpoch)
                );
                if (remaining.length === 0) {
                    gameModePhaseRef.current = 'solved';
                    const bodyOrbs = useGameStore.getState().wormBodyTiles ?? 0;
                    // 2× multiplier: reward for clearing all tunnels before the clock ran out
                    if (bodyOrbs > 0) useGameStore.getState().earnCoins(bodyOrbs * EARN_ORB_COLLECT * 2);
                    // Freeze the worm — game is over; publish final time for WinnerScreen
                    useGameStore.setState({ wormGamePhase: 'solved', wormPaused: true, wormTimeAlive: Math.floor(worm.timeAliveRef.current) });
                }
            }
            return;
        }

        // ── Phase: active — inverse-rotation hazard ────────────────────────────
        if (!store.wormAlive || store.wormPaused) return;

        // Pause the rotation hazard entirely while the worm is inside a wormhole: freeze the
        // clock and the warning beam so nothing charges or fires until it emerges (crawling).
        if (worm.phase.current !== 'crawling') return;

        autoTimerRef.current += delta;
        const warningStart = ACTIVE_ROTATE_INTERVAL - AUTO_ROTATE_WARNING;

        // Arm warning with the NEXT inverse move (peek, don't dequeue yet)
        if (autoTimerRef.current >= warningStart && !pendingRotRef.current) {
            if (inverseQueueRef.current.length === 0) {
                // All inverse moves exhausted — enter final healing phase.
                // Wormhole spawning is now blocked (checked in worm.tick).
                // Game ends only when the player heals all remaining tunnels.
                gameModePhaseRef.current = 'finalHealing';
                finalHealCheckTimer.current = 0.5; // check immediately next frame batch
                pendingRotRef.current = null;
                warningProgressRef.current = 0;
                useGameStore.setState({ wormGamePhase: 'finalHealing' });
                return;
            }
            pendingRotRef.current = inverseQueueRef.current[0]; // peek
        }

        // Update warning progress (0→1)
        if (pendingRotRef.current) {
            const elapsed = autoTimerRef.current - warningStart;
            warningProgressRef.current = Math.min(1, Math.max(0, elapsed / AUTO_ROTATE_WARNING));
        }

        // Fire rotation at the fixed 10-second mark
        if (autoTimerRef.current >= ACTIVE_ROTATE_INTERVAL && pendingRotRef.current) {
            // Delay if mid-tunnel
            if (worm.phase.current !== 'crawling') {
                autoTimerRef.current = ACTIVE_ROTATE_INTERVAL - 1.5;
                return;
            }

            const { axis, dir, sliceIndex } = pendingRotRef.current;
            inverseQueueRef.current.shift(); // now dequeue

            // Hit detection
            const hit = checkWormHitBySlice(worm, axis, sliceIndex);
            if (hit) {
                const histEntry = hit.type === 'cut'
                    ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE)
                    : null;
                const hitPos = histEntry
                    ? histEntry.pos.toArray()
                    : worm.headInterpPos.current.toArray();
                const cutColors = worm.orbPickupColorsRef.current.slice(0, 5);
                thunkRef.current = {
                    active: true,
                    pos: hitPos,
                    colors: cutColors.length ? cutColors : ['#ffdd44', '#ff8800'],
                };
                if (hit.type === 'death') {
                    worm.killWorm({ reason: 'slice-rotation', axis, sliceIndex });
                } else {
                    cutWormTail(worm, hit.cutTrailIdx);
                }
            }

            if (onRotate) onRotate(axis, dir, sliceIndex);

            // Reset for next cycle (fixed interval — no randomisation)
            pendingRotRef.current = null;
            warningProgressRef.current = 0;
            autoTimerRef.current = 0;
        }
    });

    const wormInTunnel = wormPhaseReactive === 'windup' || wormPhaseReactive === 'entering' || wormPhaseReactive === 'tunnel' || wormPhaseReactive === 'exiting' || wormPhaseReactive === 'windout';
    const wormAlive = wormGamePhase !== 'scrambling';

    return (
        <>
            <WormChaseCamera worm={worm} size={size} />
            <WormSwipeControls onTurn={worm.queueTurn} worm={worm} />
            <TunnelInteriorView worm={worm} size={size} />
            {/* Always mounted — each component handles its own dissolve via worm.phase.current */}
            {wormAlive && <WormTrail worm={worm} size={size} />}
            {wormAlive && <WormBody worm={worm} size={size} />}
            {wormAlive && <GlowWormAura worm={worm} />}
            {wormAlive && <WormFace worm={worm} size={size} />}
            {wormAlive && <PortalGlow worm={worm} size={size} />}
            {wormAlive && <TunnelPortalFX worm={worm} size={size} />}
            {!wormInTunnel && <WormholeRings
                cubies={cubies}
                size={size}
                worm={worm}
                voidTunnelKeysRef={worm.voidTunnelKeysRef}
                tunnelUseCountsRef={worm.tunnelUseCountsRef}
            />}
            <TunnelHealProgress size={size} />
            <HeartBurstSystem worm={worm} size={size} />
            <OrbFlashSystem worm={worm} />
            <PowerupOrbs size={size} />
            <SliceWarningLights pendingRotRef={pendingRotRef} warningProgressRef={warningProgressRef} size={size} cubies={cubies} />
            <ThunkEffect thunkRef={thunkRef} />
            <CollisionGlow size={size} />
        </>
    );
}

// ─── Collision Glow ───────────────────────────────────────────────────────────
// Renders pulsing glowing spheres at the self-collision head + body tile so the
// player can examine exactly where they died after minimising the death card.
// Reads from the Zustand store imperatively (no React state → no re-render cost).
function CollisionGlow({ size }) {
    const colMeshRef  = useRef();
    const headMeshRef = useRef();
    const cachedRef   = useRef(null);
    const lastDetailsRef = useRef(null);

    useFrame(({ clock }) => {
        const col  = colMeshRef.current;
        const head = headMeshRef.current;
        if (!col || !head) return;

        const st      = useGameStore.getState();
        const details = st.wormDeathDetails;
        const active  = !!(details?.reason === 'self-collision' && !st.wormAlive);

        if (!active) {
            col.visible  = false;
            head.visible = false;
            if (cachedRef.current !== null) cachedRef.current = null;
            return;
        }

        // Cache world positions once per death event
        if (cachedRef.current === null || lastDetailsRef.current !== details) {
            lastDetailsRef.current = details;
            cachedRef.current = {};
            const LIFT = 0.08; // raise slightly off tile surface

            if (details.collisionTile) {
                const [tx, ty, tz, dk] = details.collisionTile.split(',');
                const [wx, wy, wz] = getStickerWorldPos(Number(tx), Number(ty), Number(tz), dk, size, 0);
                const n = FACE_NORMALS[dk] ?? FACE_NORMALS.PZ;
                cachedRef.current.colPos  = new THREE.Vector3(wx + n.x * LIFT, wy + n.y * LIFT, wz + n.z * LIFT);
            }
            if (details.headTile) {
                const [tx, ty, tz, dk] = details.headTile.split(',');
                const [wx, wy, wz] = getStickerWorldPos(Number(tx), Number(ty), Number(tz), dk, size, 0);
                const n = FACE_NORMALS[dk] ?? FACE_NORMALS.PZ;
                cachedRef.current.headPos = new THREE.Vector3(wx + n.x * LIFT, wy + n.y * LIFT, wz + n.z * LIFT);
            }
        }

        const t     = clock.elapsedTime;
        const pulse = 0.55 + 0.45 * Math.sin(t * 4.5);
        const R     = 0.28; // glow sphere radius (world units, ~1 tile)

        if (cachedRef.current.colPos) {
            col.visible = true;
            col.position.copy(cachedRef.current.colPos);
            col.scale.setScalar(R * (0.75 + 0.5 * pulse));
            col.material.opacity = 0.5 + 0.45 * pulse;
        } else {
            col.visible = false;
        }

        if (cachedRef.current.headPos) {
            head.visible = true;
            head.position.copy(cachedRef.current.headPos);
            head.scale.setScalar(R * (0.75 + 0.5 * (1 - pulse))); // opposite phase
            head.material.opacity = 0.4 + 0.35 * (1 - pulse);
        } else {
            head.visible = false;
        }
    });

    return (
        <>
            {/* Body tile that was hit — red */}
            <mesh ref={colMeshRef} visible={false} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#ff1a1a" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Head tile at moment of collision — orange */}
            <mesh ref={headMeshRef} visible={false} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#ff8800" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}
