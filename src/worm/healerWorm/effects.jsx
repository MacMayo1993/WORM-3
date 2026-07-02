// src/worm/healerWorm/effects.jsx
// Small self-contained visual effects: glow aura, portal glow, orb pickup flash,
// the THUNK cut burst, and the post-death collision examine glow.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { WORM_LIFT, FACE_NORMALS } from './constants.js';
import { OrbCollectEffect } from '../ParityOrb.jsx';
import { getSkin } from '../wormCosmeticsData.js';

// ─── Glow Worm Aura ───────────────────────────────────────────────────────────
// Pulsing point light that follows the Glow Worm's head.
export function GlowWormAura({ worm }) {
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


// ─── Thunk Comic Effect ───────────────────────────────────────────────────────
// Comic-book THUNK text + coloured orb burst at the worm cut point.
const MAX_THUNK_ORBS = 10;
const _thunkDummy = new THREE.Object3D();
const _thunkCol = new THREE.Color();

export function ThunkEffect({ thunkRef }) {
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
                        fontFamily: "'Impact', 'Arial Black', sans-serif",
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


// ─── Collision Glow ───────────────────────────────────────────────────────────
// Renders pulsing glowing spheres at the self-collision head + body tile so the
// player can examine exactly where they died after minimising the death card.
// Reads from the Zustand store imperatively (no React state → no re-render cost).
export function CollisionGlow({ size }) {
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
