// src/worm/healerWorm/WormTrail.jsx
// Painted slime trail: fading brush-stroke daubs along the tiles the worm has visited.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { SURFACE_OFFSET } from '../../utils/constants.js';
import { FACE_NORMALS, BODY_BALL_SPACING } from './constants.js';
import { getSkin } from '../wormCosmeticsData.js';
import { liveCubies } from '../liveCubies.js';
import { ttAt } from '../circularBuffers.js';

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


// ─── Worm Trail ───────────────────────────────────────────────────────────────
// Renders a fading, brush-stroke-shaped daub at each tile the worm has visited —
// newest = bright + wide, oldest = dim + thin. Index 0 of tileTrail is the tile the
// head is currently moving INTO (pushed the instant a step begins, before the head's
// smooth interpolation has caught up), so it is used only as a stretch target for
// index 1's daub and is never rendered itself — this keeps the trail entirely behind
// the head instead of flashing a disc out in front of it.
export function WormTrail({ worm, size: _size }) {
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
