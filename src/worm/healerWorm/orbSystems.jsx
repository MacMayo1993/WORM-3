// src/worm/healerWorm/orbSystems.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split).
import { useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerSafe } from '../../game/cubeState.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { ensureOrbContrast, readLiveTile } from '../wormHelpers.js';
import { FACE_NORMALS, SPECIAL_HOVER_HEIGHT, SPECIAL_FADE_TIME } from './constants.js';
import ParityOrbs, { OrbCollectEffect } from '../ParityOrb.jsx';

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
// Each orb inherits the color of the sticker tile it sits on and follows
// that tile through cube rotations. Rendered using the shared ParityOrbs component.
export function PowerupOrbs({ size }) {
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

// ─── Special power-up orbs (rocket / magnet) ─────────────────────────────────
// These hover well clear of the surface — the worm has to be airborne to claim one —
// and they carry their own silhouette rather than the parity orb's gem, so a special
// is identifiable at a glance from across the cube.

const SPECIAL_LOOK = {
    rocket: { color: '#ff9d2e', accent: '#fff1cf' },
    magnet: { color: '#38e0ff', accent: '#ff5a6e' },
};

// Shared geometry — one set for every special ever spawned (at most one is on the
// board at a time, but the cost is paid once for the whole session either way).
const _specialGeos = {
    body: new THREE.CapsuleGeometry(0.1, 0.18, 6, 14),
    nose: new THREE.ConeGeometry(0.1, 0.17, 14),
    fin: new THREE.BoxGeometry(0.025, 0.1, 0.1),
    arc: new THREE.TorusGeometry(0.15, 0.052, 10, 22, Math.PI),
    tip: new THREE.BoxGeometry(0.104, 0.075, 0.104),
    halo: new THREE.TorusGeometry(0.3, 0.012, 8, 30),
    glow: new THREE.SphereGeometry(0.36, 16, 12),
};

const _spPos = new THREE.Vector3();
const _spNorm = new THREE.Vector3();
const _spUp = new THREE.Vector3(0, 1, 0);
const _spQuat = new THREE.Quaternion();

function SpecialOrb({ special, size }) {
    const groupRef = useRef();
    const spinRef = useRef();
    const lightRef = useRef();
    const look = SPECIAL_LOOK[special.type] ?? SPECIAL_LOOK.rocket;

    useFrame((state) => {
        const group = groupRef.current;
        if (!group) return;

        // Anchor to the live cubie mesh so the orb rides a mid-rotation slice, exactly
        // like the worm's own head does; fall back to grid math before the meshes exist.
        if (!readLiveTile(special, _spPos, _spNorm)) {
            const wp = getStickerWorldPos(special.x, special.y, special.z, special.dirKey, size, 0);
            _spPos.set(wp[0], wp[1], wp[2]);
            _spNorm.copy(FACE_NORMALS[special.dirKey] ?? FACE_NORMALS.PZ);
        }

        const t = state.clock.elapsedTime;
        const bob = Math.sin(t * 2.2) * 0.06;
        group.position.copy(_spPos).addScaledVector(_spNorm, SPECIAL_HOVER_HEIGHT + bob);
        // Stand the orb up off its face — +Y local becomes the surface normal.
        _spQuat.setFromUnitVectors(_spUp, _spNorm);
        group.quaternion.copy(_spQuat);
        if (spinRef.current) spinRef.current.rotation.y = t * 1.6;

        // Despawn fade over the tail of the lifetime. `ttl` is mutated in place by the
        // sim (see spawnSpecial), so this reads a live countdown with no store traffic.
        const ttl = special.ttl ?? SPECIAL_FADE_TIME;
        const fade = ttl >= SPECIAL_FADE_TIME ? 1 : Math.max(0, ttl / SPECIAL_FADE_TIME);
        // Blink faster as it runs out so an expiring orb reads as urgent, not just dim.
        const blink = fade < 1 ? 0.55 + 0.45 * Math.sin(t * (6 + (1 - fade) * 14)) : 1;
        const alpha = fade * blink;
        group.scale.setScalar(0.9 + 0.1 * fade);
        group.traverse((o) => {
            if (o.material && o.material.transparent) o.material.opacity = (o.userData.baseOpacity ?? 1) * alpha;
        });
        if (lightRef.current) lightRef.current.intensity = 1.2 * fade;
    });

    // Tag each material with its design opacity so the fade above scales from it
    // rather than clobbering the per-material values.
    const tag = (v) => (mesh) => { if (mesh) mesh.userData.baseOpacity = v; };

    return (
        <group ref={groupRef}>
            <group ref={spinRef}>
                {special.type === 'rocket' ? (
                    <>
                        <mesh geometry={_specialGeos.body} ref={tag(1)}>
                            <meshStandardMaterial
                                color={look.color} emissive={look.color} emissiveIntensity={1.1}
                                roughness={0.25} metalness={0.3} transparent opacity={1} toneMapped={false}
                            />
                        </mesh>
                        <mesh geometry={_specialGeos.nose} position={[0, 0.21, 0]} ref={tag(1)}>
                            <meshStandardMaterial
                                color={look.accent} emissive={look.accent} emissiveIntensity={1.4}
                                roughness={0.2} metalness={0.2} transparent opacity={1} toneMapped={false}
                            />
                        </mesh>
                        {[0, 1, 2].map((i) => (
                            <mesh
                                key={i}
                                geometry={_specialGeos.fin}
                                position={[Math.cos((i * 2 * Math.PI) / 3) * 0.1, -0.13, Math.sin((i * 2 * Math.PI) / 3) * 0.1]}
                                rotation={[0, -(i * 2 * Math.PI) / 3, 0]}
                                ref={tag(1)}
                            >
                                <meshStandardMaterial
                                    color={look.accent} emissive={look.accent} emissiveIntensity={0.9}
                                    roughness={0.3} transparent opacity={1} toneMapped={false}
                                />
                            </mesh>
                        ))}
                    </>
                ) : (
                    <>
                        {/* Horseshoe magnet: a half-torus standing on two pole tips. */}
                        <mesh geometry={_specialGeos.arc} position={[0, 0.02, 0]} ref={tag(1)}>
                            <meshStandardMaterial
                                color={look.color} emissive={look.color} emissiveIntensity={1.1}
                                roughness={0.25} metalness={0.4} transparent opacity={1} toneMapped={false}
                            />
                        </mesh>
                        {[-1, 1].map((s) => (
                            <mesh key={s} geometry={_specialGeos.tip} position={[s * 0.15, -0.02, 0]} ref={tag(1)}>
                                <meshStandardMaterial
                                    color={look.accent} emissive={look.accent} emissiveIntensity={1.2}
                                    roughness={0.3} metalness={0.2} transparent opacity={1} toneMapped={false}
                                />
                            </mesh>
                        ))}
                    </>
                )}
            </group>

            {/* Halo ring flat against the face + a soft aura, so the orb is findable
                from an oblique camera angle where the silhouette is edge-on. */}
            <mesh geometry={_specialGeos.halo} rotation={[Math.PI / 2, 0, 0]} ref={tag(0.55)}>
                <meshBasicMaterial color={look.color} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh geometry={_specialGeos.glow} ref={tag(0.14)}>
                <meshBasicMaterial
                    color={look.color} transparent opacity={0.14} side={THREE.BackSide}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
                />
            </mesh>
            <pointLight ref={lightRef} color={look.color} intensity={1.2} distance={3.2} decay={2} />
        </group>
    );
}

export function SpecialOrbs({ size }) {
    const specials = useGameStore(s => s.wormSpecials);
    if (!specials || specials.length === 0) return null;
    return (
        <>
            {specials.map(sp => <SpecialOrb key={sp.id} special={sp} size={size} />)}
        </>
    );
}

// Burst played where a special was claimed — fires for every character (unlike the
// glow worm's orb bloom below), since claiming one is a rare, deliberate moment.
export function SpecialFlashSystem({ worm }) {
    const [flashes, setFlashes] = useState([]);

    useFrame(() => {
        const pending = worm.pendingSpecialFlashRef.current;
        if (!pending) return;
        worm.pendingSpecialFlashRef.current = null;
        const look = SPECIAL_LOOK[pending.type] ?? SPECIAL_LOOK.rocket;
        setFlashes(prev => [...prev, { id: Date.now() + Math.random(), pos: pending.pos, color: look.color }]);
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

// Watches for orb pickups by the glow worm and renders a color bloom at the collect point.
// Follows the same pendingRef + useFrame polling pattern as HeartBurstSystem.
export function OrbFlashSystem({ worm }) {
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
