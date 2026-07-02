// src/worm/healerWorm/healEffects.jsx
// Heal feedback: heart bursts on healed tunnels and the per-tunnel deposit progress labels.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { findStickerByStableKey } from '../wormLogic.js';
import { buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { FACE_NORMALS, HEAL_COST } from './constants.js';
import { isMobile as _isMobile } from '../../utils/device.js';
import { liveCubies } from '../liveCubies.js';

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
export function HeartBurstSystem({ worm, size }) {
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

export function TunnelHealProgress({ size }) {
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
                            fontFamily: "'Arial Rounded MT Bold', 'Nunito', Arial, sans-serif",
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
