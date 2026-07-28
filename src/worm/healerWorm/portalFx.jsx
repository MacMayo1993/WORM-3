// src/worm/healerWorm/portalFx.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { FACE_NORMALS } from './constants.js';

// Pre-allocated scratch vector for PortalGlow
const _glowPos = new THREE.Vector3();

// ─── Portal indicator (glows when on a flipped tile) ─────────────────────────
export function PortalGlow({ worm, size }) {
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

/**
 * Overall traversal progress, 0 at the wind-up spiral to 1 as the worm clears the
 * exit hole. The per-phase progress value restarts at 0 each phase, so on its own
 * it cannot say how close the worm is to surfacing. Same mapping WormChaseCamera
 * uses for tunnelState.t, so the exit mouth charges in step with the ride.
 */
function traversalProgress(phase, prog) {
    const p = Math.min(1, Math.max(0, prog ?? 0));
    if (phase === 'windup') return 0;
    if (phase === 'entering') return p * 0.33;
    if (phase === 'tunnel') return 0.33 + p * 0.34;
    if (phase === 'exiting') return 0.67 + p * 0.33;
    return 1;
}

export function TunnelPortalFX({ worm, size }) {
    const colors = useGameStore(s => s.wormActiveTunnelColors);
    const entryColor = colors?.entryColor ?? '#33ddff';
    const exitColor = colors?.exitColor ?? '#ff8833';

    const vortexRef = useRef();
    const vortexRingRefs = useRef([]);
    const exitVortexRef = useRef();
    const exitVortexRingRefs = useRef([]);
    const exitMouthRef = useRef();
    const exitMouthIrisRef = useRef();
    const exitMouthGlowRef = useRef();
    const exitMouthArcRefs = useRef([]);
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

        // ── Exit mouth (held open for the whole traversal) ────────────────────
        // The destination tile used to have nothing on it until 'windout': the exit
        // vortex only ran at the very end and the burst was a one-shot. For the whole
        // dive and ride it looked like an ordinary tile, so there was no sign the worm
        // was still inside a wormhole, and no clue where it was going to surface.
        // This marks it as an open, active hole from the moment the trip starts, and
        // charges up as the worm approaches so the arrival is telegraphed.
        const mouth = exitMouthRef.current;
        if (mouth) {
            const showMouth = !!tunnel && (
                phase === 'windup' || phase === 'entering' || phase === 'tunnel' || phase === 'exiting'
            );
            mouth.visible = showMouth;
            if (showMouth) {
                const xwp = getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0);
                _fxNormal.copy(FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY);
                // Just proud of the sticker so it reads as sitting on the tile without
                // z-fighting against it.
                _fxPos.set(xwp[0], xwp[1], xwp[2]).addScaledVector(_fxNormal, 0.06);
                _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
                mouth.position.copy(_fxPos);
                mouth.quaternion.copy(_fxQuat);

                const trip = traversalProgress(phase, prog);
                // Idle breathing the whole time, plus a rising charge as the worm nears.
                const breathe = 0.5 + 0.5 * Math.sin(t * 3.4);
                const charge = Math.pow(trip, 2.2);          // stays low, then ramps late
                const imminent = Math.pow(Math.max(0, (trip - 0.6) / 0.4), 2); // last stretch only

                if (exitMouthIrisRef.current) {
                    // The iris widens as the worm approaches — the hole opening up for it.
                    const s = 0.82 + charge * 0.5 + breathe * 0.06;
                    exitMouthIrisRef.current.scale.setScalar(s);
                    exitMouthIrisRef.current.rotation.z = t * 0.9;
                    if (exitMouthIrisRef.current.material) {
                        exitMouthIrisRef.current.material.opacity = 0.35 + breathe * 0.18 + charge * 0.4;
                    }
                }
                if (exitMouthGlowRef.current) {
                    exitMouthGlowRef.current.scale.setScalar(0.7 + charge * 0.55 + breathe * 0.05);
                    if (exitMouthGlowRef.current.material) {
                        // Bright enough late that the tile visibly announces the arrival.
                        exitMouthGlowRef.current.material.opacity = 0.12 + charge * 0.3 + imminent * 0.35;
                    }
                }
                // Counter-rotating arcs: cheap way to read as "spinning up" rather than
                // a static decal stuck on the face.
                for (let i = 0; i < exitMouthArcRefs.current.length; i++) {
                    const a = exitMouthArcRefs.current[i];
                    if (!a) continue;
                    const dir = i % 2 === 0 ? 1 : -1;
                    a.rotation.z = dir * (t * (1.4 + i * 0.5) + charge * 6);
                    a.scale.setScalar(1.05 + i * 0.16 + charge * 0.35);
                    if (a.material) a.material.opacity = 0.20 + charge * 0.35 + breathe * 0.08;
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

            {/* Exit mouth — held open on the destination tile for the whole traversal,
                so the tile stays visibly an active wormhole until the worm is out. */}
            <group ref={exitMouthRef} visible={false}>
                {/* Iris rim */}
                <mesh ref={exitMouthIrisRef}>
                    <torusGeometry args={[0.40, 0.045, 8, 36]} />
                    <meshBasicMaterial color={exitColor} transparent opacity={0}
                        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </mesh>
                {/* Throat glow — the hole itself */}
                <mesh ref={exitMouthGlowRef} position={[0, 0, -0.01]}>
                    <circleGeometry args={[0.40, 32]} />
                    <meshBasicMaterial color={exitColor} transparent opacity={0}
                        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </mesh>
                {/* Counter-rotating arcs */}
                {[0, 1].map(i => (
                    <mesh key={i} ref={el => (exitMouthArcRefs.current[i] = el)}>
                        <torusGeometry args={[0.50, 0.022, 6, 28, Math.PI * 1.15]} />
                        <meshBasicMaterial color={exitColor} transparent opacity={0}
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
