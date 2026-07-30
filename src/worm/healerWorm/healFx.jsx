// src/worm/healerWorm/healFx.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { findStickerByStableKey } from '../wormLogic.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { isMobile as _isMobile } from '../../utils/device.js';
import { UI_FONT } from '../../utils/uiTheme.js';
import { liveCubies } from '../liveCubies.js';
import { FACE_NORMALS, HEAL_COST } from './constants.js';

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
// emergence shockwave; tile flip and cubie-pop feedback is driven by applyHeal.
export function HealBurstSystem({ worm, size }) {
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
                <HealBurst3D
                    key={burst.id}
                    wp={burst.wp}
                    normal={burst.normal}
                    onDone={() => setBursts(prev => prev.filter(b => b.id !== burst.id))}
                />
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
