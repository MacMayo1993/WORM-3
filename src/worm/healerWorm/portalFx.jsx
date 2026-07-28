// src/worm/healerWorm/portalFx.jsx
import { useRef, useMemo } from 'react';
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
// A wormhole's defining property is that it is an OPENING, and until now nothing
// on either tile ever opened. Entry and exit were both dressed with stacks of
// spinning torus rings drawn on top of a solid, unbroken sticker — decoration
// sitting on a closed surface, and a large part of why the traversal moments read
// as cluttered rather than dramatic.
//
// Both tiles now punch an actual hole: an iris that irises open into a dark
// throat with a lit cut edge and rings receding down it. That replaces all three
// former ring layers (entry vortex, exit vortex, and the exit mouth) — the hole
// says "portal" on its own, so the decoration that was standing in for it is gone.
//
// The exit burst survives as the one-shot impact when the worm breaks out; it is
// punctuation, not a persistent layer.
const _fxPos = new THREE.Vector3();
const _fxNormal = new THREE.Vector3();
const _fxQuat = new THREE.Quaternion();
const _fxRingUp = new THREE.Vector3(0, 0, 1); // ring/disc geometry lies in XY → flat normal is +Z

/**
 * Overall traversal progress, 0 at the wind-up spiral to 1 as the worm clears the
 * exit hole. The per-phase progress value restarts at 0 each phase, so on its own
 * it cannot say how close the worm is to surfacing. Same mapping WormChaseCamera
 * uses for tunnelState.t, so the holes charge in step with the ride.
 */
function traversalProgress(phase, prog) {
    const p = Math.min(1, Math.max(0, prog ?? 0));
    if (phase === 'windup') return 0;
    if (phase === 'entering') return p * 0.33;
    if (phase === 'tunnel') return 0.33 + p * 0.34;
    if (phase === 'exiting') return 0.67 + p * 0.33;
    return 1;
}

// Radius of a fully open hole. The sticker is 0.88 across, so this is the largest
// circle that stays inside the tile.
const HOLE_R = 0.44;

const holeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Opaque on purpose: this stands in for the tile surface it replaces, so it has to
// occlude the sticker underneath rather than tint it.
const holeFragmentShader = `
  uniform vec3  uColor;
  uniform float uOpen;    // 0 = closed, 1 = fully open
  uniform float uCharge;  // 0→1, how close the worm is to this end
  uniform float uTime;
  varying vec2  vUv;

  void main() {
    vec2  p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > uOpen) discard;               // the aperture itself

    float d = r / max(uOpen, 0.0001);     // 0 at the centre of the hole, 1 at the cut edge

    // Looking down a shaft: near-black deep in, picking up the tunnel's colour
    // toward the mouth. This is what makes it read as depth rather than a
    // black sticker.
    vec3 col = mix(vec3(0.012, 0.012, 0.022), uColor * 0.5, pow(d, 2.6));

    // The cut edge catches light — the single strongest "this is a hole" cue.
    float rim = smoothstep(0.86, 1.0, d);
    col += uColor * rim * (1.3 + uCharge * 1.8);

    // A few rings receding down the throat, drifting inward. Deliberately faint:
    // these replace four spinning torus rings that used to sit on the surface.
    float rings = smoothstep(0.87, 1.0, fract(d * 3.0 - uTime * 0.5)) * 0.16 * (1.0 - d);
    col += uColor * rings;

    // Glow from something arriving.
    col += uColor * uCharge * 0.35 * (1.0 - d);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function useHoleUniforms(color) {
    return useMemo(() => ({
        uColor:  { value: new THREE.Color(color) },
        uOpen:   { value: 0 },
        uCharge: { value: 0 },
        uTime:   { value: 0 },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
}

export function TunnelPortalFX({ worm, size }) {
    const colors = useGameStore(s => s.wormActiveTunnelColors);
    const entryColor = colors?.entryColor ?? '#33ddff';
    const exitColor = colors?.exitColor ?? '#ff8833';

    const entryHoleRef = useRef();
    const exitHoleRef = useRef();
    const entryOpenRef = useRef(0);
    const exitOpenRef = useRef(0);
    const burstRef = useRef();
    const burstFlashRef = useRef();
    const burstTRef = useRef(-1);   // -1 idle, else 0..1 burst progress
    const firedRef = useRef(false); // one-shot guard per traversal

    const entryUniforms = useHoleUniforms(entryColor);
    const exitUniforms = useHoleUniforms(exitColor);

    useFrame((_state, delta) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        const prog = worm.tunnelProgress.current;

        entryUniforms.uTime.value += delta;
        exitUniforms.uTime.value += delta;
        entryUniforms.uColor.value.set(entryColor);
        exitUniforms.uColor.value.set(exitColor);

        // Both holes are open for the whole traversal — the pair is one point in
        // RP2, and the worm is inside it the entire time. They are only DRAWN in
        // the phases where the camera is outside and the cube body is visible:
        // through 'tunnel' and 'exiting' the body is hidden and the camera is
        // within the shaft, so a disc pinned to a tile would just be a slab
        // floating in the middle of the ride.
        const openTarget = tunnel && phase !== 'crawling' ? 1 : 0;
        const drawable = !!tunnel && (phase === 'windup' || phase === 'entering' || phase === 'windout');

        const trip = traversalProgress(phase, prog);
        entryOpenRef.current += (openTarget - entryOpenRef.current) * Math.min(1, delta * 7);
        exitOpenRef.current += (openTarget - exitOpenRef.current) * Math.min(1, delta * 7);

        // ── Entry hole ────────────────────────────────────────────────────────
        const eh = entryHoleRef.current;
        if (eh) {
            eh.visible = drawable && entryOpenRef.current > 0.02;
            if (eh.visible) {
                const ewp = getStickerWorldPos(tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, size, 0);
                _fxNormal.copy(FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY);
                _fxPos.set(ewp[0], ewp[1], ewp[2]).addScaledVector(_fxNormal, 0.012);
                _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
                eh.position.copy(_fxPos);
                eh.quaternion.copy(_fxQuat);
                entryUniforms.uOpen.value = entryOpenRef.current;
                // Hottest as the worm goes in, cooling as it travels away.
                entryUniforms.uCharge.value = Math.max(0, 1 - trip * 2.0);
            }
        }

        // ── Exit hole ─────────────────────────────────────────────────────────
        const xh = exitHoleRef.current;
        if (xh) {
            xh.visible = drawable && exitOpenRef.current > 0.02;
            if (xh.visible) {
                const xwp = getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0);
                _fxNormal.copy(FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY);
                _fxPos.set(xwp[0], xwp[1], xwp[2]).addScaledVector(_fxNormal, 0.012);
                _fxQuat.setFromUnitVectors(_fxRingUp, _fxNormal);
                xh.position.copy(_fxPos);
                xh.quaternion.copy(_fxQuat);
                exitUniforms.uOpen.value = exitOpenRef.current;
                // Builds as the worm approaches, so the arrival is telegraphed.
                exitUniforms.uCharge.value = Math.pow(trip, 2.0);
            }
        }

        // ── Exit burst (spat out) ──────────────────────────────────────────────
        // Fire once, the instant the head breaks out of the exit mouth.
        if (phase === 'exiting' && tunnel && !firedRef.current && prog > 0.55) {
            firedRef.current = true;
            burstTRef.current = 0;
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
            {/* Entry hole — the tile opens and the worm goes down it */}
            <mesh ref={entryHoleRef} visible={false}>
                <circleGeometry args={[HOLE_R, 48]} />
                <shaderMaterial
                    uniforms={entryUniforms}
                    vertexShader={holeVertexShader}
                    fragmentShader={holeFragmentShader}
                    toneMapped={false}
                />
            </mesh>

            {/* Exit hole — held open, brightening as the worm nears the surface */}
            <mesh ref={exitHoleRef} visible={false}>
                <circleGeometry args={[HOLE_R, 48]} />
                <shaderMaterial
                    uniforms={exitUniforms}
                    vertexShader={holeVertexShader}
                    fragmentShader={holeFragmentShader}
                    toneMapped={false}
                />
            </mesh>

            {/* Exit shockwave ring — the one-shot impact, kept */}
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
