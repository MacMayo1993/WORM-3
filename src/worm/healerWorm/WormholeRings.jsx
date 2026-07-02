// src/worm/healerWorm/WormholeRings.jsx
// Spinning neon rings + void/critical dressing (bubbles, sparks, caution tape)
// at every flipped tile.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getTunnelLookup } from '../tunnelRegistry.js';
import { FACE_NORMALS, WORMHOLE_MAX_TRAVERSALS } from './constants.js';

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

export function WormholeRings({ cubies, size, worm, voidTunnelKeysRef, tunnelUseCountsRef }) {
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

    // All flipped surface positions, augmented with the canonical tunnel key so
    // WormholeRings can tell live vs void without re-running manifold logic per frame.
    // The positions scan the debounced snapshot (throttle is decorative-only); the
    // tunnelKey annotation reads the SHARED live registry — never build tunnel data
    // from the lagged snapshot (see tunnelRegistry.js contract).
    const allPositions = React.useMemo(() => {
        const live = useGameStore.getState();
        const tunnelLookup = getTunnelLookup(live.cubies, size, live.rotationEpoch);

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
                            tunnelKey: tunnelLookup.get(`${x},${y},${z},${dk}`)?.tunnelKey ?? null,
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
