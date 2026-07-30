// src/worm/healerWorm/orbSystems.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split).
import { useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerSafe } from '../../game/cubeState.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { ensureOrbContrast, getAntipodalOrbColor, readLiveTile } from '../wormHelpers.js';
import { FACE_NORMALS, SPECIAL_HOVER_HEIGHT, SPECIAL_FADE_TIME, ORB_ATTRACTION_FX_DURATION, MAX_ORB_ATTRACTION_FX, ORB_HOVER_HEIGHT, ORB_ELEVATED_HOVER_HEIGHT } from './constants.js';
import { getSpecialDef } from './specialDefs.js';
import { prefersReducedMotion } from '../../utils/device.js';
import ParityOrbs, { OrbCollectEffect } from '../ParityOrb.jsx';

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
// Each orb uses the antipodal color of the manifold it sits on, keeping it distinct
// from its host tile, and follows that tile through cube rotations.
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
            const manifoldColor = ensureOrbContrast((faceId && faceColors[faceId]) ?? '#22ff88');
            const color = getAntipodalOrbColor(faceId, faceColors);
            // Orbs on flipped tiles hover above the surface — worm must jump to collect
            const elevated = !!(sticker && sticker.curr !== sticker.orig);
            // ParityOrb uses `color` for the dominant gem and `antipodalColor` for
            // its Möbius accent; invert that old pairing so the gem contrasts with
            // the manifold while retaining the host color as a small visual link.
            return { ...p, color, antipodalColor: manifoldColor, elevated };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orbSignature, faceColors]);

    return <ParityOrbs orbs={orbs} size={size} isGlowWorm={wormCharacter === 'glow'} />;
}

// ─── Special power-up orbs (rocket / magnet) ─────────────────────────────────
// These hover clear of the surface and carry their own silhouette rather than the
// parity orb's gem, so a special is identifiable at a glance from across the cube.
// A shrinking ring counts down the last seconds of the orb's life.

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
    // Countdown ring — scales down as the orb's lifetime runs out.
    timer: new THREE.TorusGeometry(0.34, 0.022, 8, 32),
    rocketBeacon: new THREE.ConeGeometry(0.42, 0.72, 3, 1, true),
    magnetField: new THREE.TorusGeometry(0.48, 0.018, 8, 40),
};

const _spPos = new THREE.Vector3();
const _spNorm = new THREE.Vector3();
const _spUp = new THREE.Vector3(0, 1, 0);
const _spQuat = new THREE.Quaternion();

function SpecialOrb({ special, size }) {
    const groupRef = useRef();
    const spinRef = useRef();
    const lightRef = useRef();
    const timerRef = useRef();
    const reducedRef = useRef(prefersReducedMotion());
    const look = getSpecialDef(special.type);

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

        // Expiry urgency over the tail of the lifetime. `ttl` is mutated in place by
        // the sim (see spawnSpecial), so this reads a live countdown with no store
        // traffic. `life` is the whole lifetime, so the ring reads as a real clock.
        const ttl = special.ttl ?? SPECIAL_FADE_TIME;
        const life = special.maxTtl || SPECIAL_FADE_TIME;
        const fade = ttl >= SPECIAL_FADE_TIME ? 1 : Math.max(0, ttl / SPECIAL_FADE_TIME);
        // Blink accelerates as it runs out, but never below FADE_FLOOR: an orb you can
        // barely see is harder to collect, which is the opposite of the intent — the
        // cue should say "hurry", not "good luck".
        const FADE_FLOOR = 0.45;
        // Reduced motion keeps the information (the orb dims, the ring closes) but
        // drops the flicker, which is the part that is actually uncomfortable.
        const blink = (fade < 1 && !reducedRef.current)
            ? 0.72 + 0.28 * Math.sin(t * (6 + (1 - fade) * 16))
            : 1;
        const alpha = Math.max(FADE_FLOOR, fade) * blink;
        // Specials are deliberately much larger than parity gems. Their silhouettes,
        // not a shared glowing sphere, should be the first thing the player reads.
        group.scale.setScalar(1.28 + 0.12 * Math.max(FADE_FLOOR, fade));
        group.traverse((o) => {
            if (o.material && o.material.transparent) o.material.opacity = (o.userData.baseOpacity ?? 1) * alpha;
        });
        if (lightRef.current) lightRef.current.intensity = 1.2 * Math.max(FADE_FLOOR, fade);

        // Countdown ring: full circle at spawn, closing to nothing at expiry. Set
        // after the traverse above, which would otherwise overwrite its opacity.
        if (timerRef.current) {
            const remaining = Math.max(0, Math.min(1, ttl / life));
            timerRef.current.scale.setScalar(0.25 + 0.75 * remaining);
            timerRef.current.rotation.z = -t * 0.8;
            timerRef.current.material.opacity = 0.7 * alpha;
        }
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

            {special.type === 'rocket' ? (
                /* Tall triangular exhaust beacon: points along the rocket and cannot
                   be confused with the round orbit rings on parity orbs. */
                <mesh geometry={_specialGeos.rocketBeacon} position={[0, -0.36, 0]} rotation={[0, 0, Math.PI]} ref={tag(0.34)}>
                    <meshBasicMaterial color="#ff5a16" transparent opacity={0.34} wireframe depthWrite={false} toneMapped={false} />
                </mesh>
            ) : (
                /* Two perpendicular cyan field loops give the magnet a wide, unmistakable
                   crosshair footprint instead of another compact floating gem. */
                <group>
                    <mesh geometry={_specialGeos.magnetField} rotation={[Math.PI / 2, 0, 0]} ref={tag(0.55)}>
                        <meshBasicMaterial color={look.color} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
                    </mesh>
                    <mesh geometry={_specialGeos.magnetField} rotation={[0, Math.PI / 2, 0]} ref={tag(0.4)}>
                        <meshBasicMaterial color={look.accent} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
                    </mesh>
                </group>
            )}

            {/* Lifetime ring — shrinks toward the orb as its time runs out. */}
            <mesh ref={timerRef} geometry={_specialGeos.timer} rotation={[Math.PI / 2, 0, 0]}>
                <meshBasicMaterial color={look.accent} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
            </mesh>

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

// ─── Magnet attraction FX ────────────────────────────────────────────────────
// The magnet banks an orb the instant it is in range, which on its own reads as
// several orbs blinking out of existence at once. These streaks show where each one
// went: a bead flies from the orb's tile to the worm over ORB_ATTRACTION_FX_DURATION,
// chasing the head's live position so it always lands on the worm rather than on the
// spot the worm used to be. The gameplay reward already happened — this is only the
// explanation of it.
//
// Slots are pooled and driven entirely from useFrame: a sweep collecting a dozen
// orbs costs zero React renders and allocates nothing.

const _mfxGeos = {
    // Sized to read like the parity gem it stands in for (shell 0.21, inner glow 0.30),
    // not the dim 0.075 speck it used to be — a big reason the pull was easy to miss.
    bead: new THREE.SphereGeometry(0.18, 12, 10),
    field: new THREE.TorusGeometry(0.62, 0.018, 8, 40),
};
const _mfxHead = new THREE.Vector3();

export function MagnetFX({ worm }) {
    const beadRefs = useRef([]);
    const ringRef = useRef();
    // Under reduced motion the beads stay put and simply fade where the orb was —
    // the pickup is still explained, without anything flying across the screen.
    const reducedRef = useRef(prefersReducedMotion());
    const slots = useRef(
        Array.from({ length: MAX_ORB_ATTRACTION_FX }, () => ({
            active: false, t: 0,
            from: new THREE.Vector3(),
        }))
    );
    const pulseRef = useRef(0);

    useFrame((state, delta) => {
        const queue = worm.pendingOrbAttractionsRef?.current;
        // Drain newly collected orbs into free slots.
        while (queue && queue.length > 0) {
            const next = queue.shift();
            let slotIndex = -1;
            for (let k = 0; k < slots.current.length; k++) {
                if (!slots.current[k].active) { slotIndex = k; break; }
            }
            if (slotIndex === -1) break;
            const slot = slots.current[slotIndex];
            slot.active = true;
            slot.t = 0;
            slot.from.fromArray(next.from);
            // Lift the origin to where the gem actually floated — orbs on flipped tiles
            // hover much higher. Lift along the tile's FACE normal (the same axis-aligned
            // normal ParityOrb's BOB_NORMALS uses to place the gem), NOT the radial
            // direction of the world position: for an orb off the face centre those two
            // diverge, and normalising slot.from would shove the streak's start sideways
            // off the gem — worst near corners, where the large elevated lift magnifies it.
            // Baked in once here so the per-frame flight loop stays allocation-free.
            const faceNormal = FACE_NORMALS[next.dirKey] ?? FACE_NORMALS.PZ;
            slot.from.addScaledVector(faceNormal, next.elevated ? ORB_ELEVATED_HOVER_HEIGHT : ORB_HOVER_HEIGHT);
            const mesh = beadRefs.current[slotIndex];
            if (mesh) {
                mesh.visible = true;
                mesh.material.color.set(next.color);
            }
            pulseRef.current = 1;
        }

        _mfxHead.copy(worm.headInterpPos.current);

        for (let i = 0; i < slots.current.length; i++) {
            const slot = slots.current[i];
            const mesh = beadRefs.current[i];
            if (!mesh) continue;
            if (!slot.active) { mesh.visible = false; continue; }

            slot.t += delta / ORB_ATTRACTION_FX_DURATION;
            if (slot.t >= 1) {
                slot.active = false;
                mesh.visible = false;
                continue;
            }
            const t = slot.t;
            // Ease-out: the gem leaves the tile at once and rushes into the worm, so it
            // reads as the magnet yanking it in rather than a speck fading on the spot.
            // Reduced motion keeps it parked where the orb was and simply fades.
            const e = reducedRef.current ? 0 : t * (2 - t);
            mesh.position.lerpVectors(slot.from, _mfxHead, e);
            // Hold full brightness through most of the flight, then fade as the worm
            // swallows it — the streak stays legible the whole way in.
            mesh.material.opacity = Math.min(1, 2.4 * (1 - t));
            mesh.scale.setScalar(1 - 0.5 * t);
        }

        // Field ring around the head while the magnet is up, pulsing on each catch.
        const magnetT = worm.magnetT?.current ?? 0;
        if (ringRef.current) {
            const on = magnetT > 0;
            ringRef.current.visible = on;
            if (on) {
                pulseRef.current = Math.max(0, pulseRef.current - delta * 3);
                ringRef.current.position.copy(_mfxHead);
                if (!reducedRef.current) {
                    ringRef.current.rotation.x = state.clock.elapsedTime * 0.6;
                    ringRef.current.rotation.y = state.clock.elapsedTime * 0.9;
                    ringRef.current.scale.setScalar(1 + pulseRef.current * 0.28);
                }
                // Fade the ring out over the buff's last second so it doesn't just vanish.
                ringRef.current.material.opacity = 0.28 * Math.min(1, magnetT) + pulseRef.current * 0.35;
            }
        }
    });

    const magnetColor = getSpecialDef('magnet').color;

    return (
        <>
            {slots.current.map((_, i) => (
                <mesh
                    key={i}
                    ref={el => { beadRefs.current[i] = el; }}
                    geometry={_mfxGeos.bead}
                    visible={false}
                >
                    <meshBasicMaterial
                        transparent opacity={1} depthWrite={false}
                        blending={THREE.AdditiveBlending} toneMapped={false}
                    />
                </mesh>
            ))}
            <mesh ref={ringRef} geometry={_mfxGeos.field} visible={false}>
                <meshBasicMaterial
                    color={magnetColor} transparent opacity={0.28} depthWrite={false}
                    blending={THREE.AdditiveBlending} toneMapped={false}
                />
            </mesh>
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
        const look = getSpecialDef(pending.type);
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
// Follows the same pendingRef + useFrame polling pattern as HealBurstSystem.
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
