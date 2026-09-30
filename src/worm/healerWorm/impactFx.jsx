// src/worm/healerWorm/impactFx.jsx
// The hit beats: the WORM'D shout (ThunkEffect), the tail that pops off the cube
// when a hazard severs it (SeveredTail), and the self-collision marker
// (CollisionGlow). The timing, scatter and sampling live in ./wormdFx.js.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { getSkin } from '../wormCosmeticsData.js';
import { DISPLAY_FONT, HEADING_FONT } from '../../utils/uiTheme.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { FACE_NORMALS, WORM_BODY_RADIUS } from './constants.js';
import {
    wormdStyle, wormdLetterInto, wormdShakeInto, wormdBurstInto, wormdRingInto, starburstPoints,
    seedSparks, sparkOffsetInto, seedFromPosition, seededRandom, SPARK_LIFE,
    MAX_SEVERED_PIECES, severedPieceInto, severedBeadColor, SEVERED_TOTAL,
} from './wormdFx.js';

// ─── WORM'D ───────────────────────────────────────────────────────────────────
// A comic-book shout at the hit: a spiky starburst punches out, the word's
// letters slam down one after another, a caption names what happened, a
// shockwave races across the struck face and sparks spray off it and fall.
//
// Trigger by writing thunkRef.current = { active:true, pos, kind, colors? }.
// `kind` picks the look from WORMD_STYLES (cut, sliced, blasted, bite, void …);
// `colors` are the carried orbs, sprayed as sparks when there are any.
const MAX_THUNK_SPARKS = 22;
const _thunkDummy = new THREE.Object3D();
const _thunkCol = new THREE.Color();
const _sparkOff = [0, 0, 0];
const _letter = { scale: 1, rot: 0, y: 0, opacity: 1 };
const _shake = { x: 0, y: 0 };
const _burst = { scale: 1, rot: 0, opacity: 1 };
const _ring = { visible: false, scale: 1, opacity: 1 };
const _ringNormal = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const STARBURST = starburstPoints(14, 7);

// The struck face's outward normal: the dominant axis of the impact point.
function faceNormalOf(pos, out) {
    const [x, y, z] = pos;
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if (ax >= ay && ax >= az) return out.set(Math.sign(x) || 1, 0, 0);
    if (ay >= az) return out.set(0, Math.sign(y) || 1, 0);
    return out.set(0, 0, Math.sign(z) || 1);
}

function buildLetters(wordEl, word, style) {
    wordEl.textContent = '';
    const spans = [];
    for (const ch of word) {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.display = 'inline-block';
        span.style.color = style.fill;
        span.style.webkitTextStroke = `2px ${style.ink}`;
        span.style.textShadow = `0 5px 0 ${style.ink}, 0 0 18px rgba(0,0,0,0.35)`;
        span.style.transformOrigin = '50% 80%';
        span.style.willChange = 'transform, opacity';
        wordEl.appendChild(span);
        spans.push(span);
    }
    return spans;
}

export function ThunkEffect({ thunkRef }) {
    const groupRef = useRef();
    const rootRef = useRef();
    const wordRef = useRef();
    const subRef = useRef();
    const burstRef = useRef();
    const burstPolyRef = useRef();
    const sparkMeshRef = useRef();
    const ringRef = useRef();
    const lettersRef = useRef([]);
    const styleRef = useRef(wormdStyle('cut'));
    const animTRef = useRef(0);
    const activeRef = useRef(false);
    const reducedRef = useRef(false);
    const sparksRef = useRef({ list: [], colors: [], count: 0, origin: [0, 0, 0] });

    useFrame((_, rawDelta) => {
        const pending = thunkRef.current;
        if (pending?.active) {
            pending.active = false;
            activeRef.current = true;
            animTRef.current = 0;
            reducedRef.current = prefersReducedMotion();
            const style = wormdStyle(pending.kind ?? (pending.text === "WORM'D" ? 'sliced' : 'cut'));
            styleRef.current = style;
            if (wordRef.current) lettersRef.current = buildLetters(wordRef.current, style.word, style);
            if (subRef.current) {
                subRef.current.textContent = style.sub;
                subRef.current.style.background = style.ink;
            }
            if (burstPolyRef.current) {
                burstPolyRef.current.setAttribute('fill', style.burst);
                burstPolyRef.current.setAttribute('stroke', style.ink);
            }
            if (rootRef.current) rootRef.current.style.fontSize = style.fatal ? '60px' : '48px';
            const pos = pending.pos ?? [0, 0, 0];
            if (groupRef.current) {
                groupRef.current.position.fromArray(pos);
                groupRef.current.visible = true;
            }
            faceNormalOf(pos, _ringNormal);
            if (ringRef.current) {
                ringRef.current.position.fromArray(pos).addScaledVector(_ringNormal, 0.02);
                ringRef.current.quaternion.setFromUnitVectors(_zAxis, _ringNormal);
                ringRef.current.material.color.set(style.fill);
            }
            const sp = sparksRef.current;
            sp.colors = pending.colors?.length ? pending.colors : style.sparks;
            sp.count = reducedRef.current ? 0 : style.fatal ? MAX_THUNK_SPARKS : 14;
            sp.origin[0] = pos[0]; sp.origin[1] = pos[1]; sp.origin[2] = pos[2];
            seedSparks(sp.list, sp.count, _ringNormal.toArray(), seedFromPosition(pos));
        }

        const mesh = sparkMeshRef.current;
        if (!activeRef.current) {
            if (mesh && mesh.count !== 0) mesh.count = 0;
            return;
        }

        // Hold with the game's pause, like every other hit effect.
        const delta = useGameStore.getState().wormPaused && useGameStore.getState().wormAlive ? 0 : Math.min(rawDelta, 0.05);
        animTRef.current += delta;
        const t = animTRef.current;
        const style = styleRef.current;
        const reducedMotion = reducedRef.current;
        const opts = { duration: style.duration, fatal: style.fatal, reducedMotion };

        if (rootRef.current) {
            wormdShakeInto(_shake, t, opts);
            rootRef.current.style.display = 'block';
            rootRef.current.style.transform = `translate(${_shake.x.toFixed(1)}px, ${_shake.y.toFixed(1)}px)`;
        }
        const letters = lettersRef.current;
        for (let i = 0; i < letters.length; i++) {
            wormdLetterInto(_letter, t, i, letters.length, opts);
            letters[i].style.opacity = _letter.opacity.toFixed(3);
            letters[i].style.transform = `translateY(${_letter.y.toFixed(1)}px) rotate(${_letter.rot.toFixed(1)}deg) scale(${_letter.scale.toFixed(3)})`;
        }
        if (burstRef.current) {
            wormdBurstInto(_burst, t, opts);
            burstRef.current.style.opacity = _burst.opacity.toFixed(3);
            burstRef.current.style.transform = `translate(-50%, -50%) rotate(${_burst.rot.toFixed(1)}deg) scale(${_burst.scale.toFixed(3)})`;
        }
        if (subRef.current) {
            // The caption stamps in once the word has landed.
            const land = letters.length * 0.045 + 0.18;
            const k = reducedMotion ? 1 : Math.min(1, Math.max(0, (t - land) / 0.14));
            wormdLetterInto(_letter, t, 0, 1, opts);
            subRef.current.style.opacity = (k * _letter.opacity).toFixed(3);
            subRef.current.style.transform = `rotate(-3deg) scale(${(1.6 - 0.6 * k).toFixed(3)})`;
        }

        const ring = ringRef.current;
        if (ring) {
            wormdRingInto(_ring, t, opts);
            ring.visible = _ring.visible;
            ring.scale.setScalar(_ring.scale);
            ring.material.opacity = _ring.opacity;
        }

        if (mesh) {
            const sp = sparksRef.current;
            const life = Math.min(1, t / SPARK_LIFE);
            mesh.count = life < 1 ? sp.count : 0;
            for (let i = 0; i < mesh.count; i++) {
                const spark = sp.list[i];
                sparkOffsetInto(_sparkOff, spark, t);
                _thunkDummy.position.set(sp.origin[0] + _sparkOff[0], sp.origin[1] + _sparkOff[1], sp.origin[2] + _sparkOff[2]);
                _thunkDummy.scale.setScalar(spark.size * (1 - life * life));
                _thunkDummy.updateMatrix();
                mesh.setMatrixAt(i, _thunkDummy.matrix);
                _thunkCol.set(sp.colors[i % sp.colors.length] || '#ffdd44');
                mesh.setColorAt(i, _thunkCol);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }

        if (t >= style.duration) {
            activeRef.current = false;
            if (groupRef.current) groupRef.current.visible = false;
            if (rootRef.current) rootRef.current.style.display = 'none';
            if (ring) ring.visible = false;
        }
    });

    return (
        <>
            <group ref={groupRef} visible={false}>
                <Html center distanceFactor={10} wrapperClass="capture-scene-label" zIndexRange={[40, 0]}>
                    <div ref={rootRef} style={{
                        position: 'relative', display: 'none', pointerEvents: 'none', userSelect: 'none',
                        whiteSpace: 'nowrap', textAlign: 'center', fontSize: '48px',
                    }}>
                        <svg ref={burstRef} viewBox="0 0 200 120" aria-hidden="true" style={{
                            position: 'absolute', left: '50%', top: '46%', width: '7.2em', height: '4.3em',
                            transform: 'translate(-50%, -50%)', overflow: 'visible', opacity: 0,
                        }}>
                            <polygon ref={burstPolyRef} points={STARBURST} fill="#ff5a36" stroke="#b3120a" strokeWidth="5" strokeLinejoin="round" />
                        </svg>
                        <div ref={wordRef} style={{
                            position: 'relative', fontFamily: DISPLAY_FONT, fontWeight: 900, letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }} />
                        <div ref={subRef} style={{
                            position: 'relative', display: 'inline-block', marginTop: '0.18em', padding: '0.12em 0.55em',
                            fontFamily: HEADING_FONT, fontWeight: 800, fontSize: '0.3em', letterSpacing: '0.14em',
                            color: '#fffbe8', borderRadius: '0.3em', opacity: 0,
                        }} />
                    </div>
                </Html>
            </group>
            <mesh ref={ringRef} visible={false} frustumCulled={false} renderOrder={5}>
                <ringGeometry args={[0.82, 1, 48]} />
                <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <instancedMesh ref={sparkMeshRef} args={[undefined, undefined, MAX_THUNK_SPARKS]} frustumCulled={false}>
                <icosahedronGeometry args={[1, 0]} />
                <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </instancedMesh>
        </>
    );
}

// ─── Severed tail ─────────────────────────────────────────────────────────────
// The beads a hazard cuts off do not just vanish: they hold for a beat, then pop
// off the cube in a ripple from the cut to the tip, flash, hop off the face and
// tumble away under gravity. Capture happens BEFORE cutWormTail trims history
// (see captureSeveredTail in HealerWormMode); this only replays the snapshot.
//
// Trigger by writing severedRef.current = { active:true, pieces:[{pos,normal,bead}], count, orbColors }.
const _sevDummy = new THREE.Object3D();
const _sevCol = new THREE.Color();
const _sevWhite = new THREE.Color('#ffffff');
const _sevPose = { x: 0, y: 0, z: 0, scale: 1, flash: 0 };

export function SeveredTail({ severedRef }) {
    const meshRef = useRef();
    const stateRef = useRef({ active: false, t: 0, pieces: [], count: 0, reduced: false });
    const skinId = useGameStore(s => s.wormSkin ?? 'slime');
    const baseColor = useMemo(() => getSkin(skinId).body, [skinId]);

    useFrame((_, rawDelta) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const st = stateRef.current;
        const pending = severedRef.current;
        if (pending?.active) {
            pending.active = false;
            st.active = pending.count > 0;
            st.t = 0;
            st.reduced = prefersReducedMotion();
            st.count = Math.min(pending.count, MAX_SEVERED_PIECES);
            const rand = seededRandom(seedFromPosition(pending.pieces[0]?.pos));
            for (let i = 0; i < st.count; i++) {
                const src = pending.pieces[i];
                const piece = st.pieces[i] ?? (st.pieces[i] = { pos: [0, 0, 0], normal: [0, 0, 0], spin: [0, 0, 0], rank: 0, color: new THREE.Color() });
                piece.pos[0] = src.pos[0]; piece.pos[1] = src.pos[1]; piece.pos[2] = src.pos[2];
                piece.normal[0] = src.normal[0]; piece.normal[1] = src.normal[1]; piece.normal[2] = src.normal[2];
                piece.rank = st.count > 1 ? i / (st.count - 1) : 0;
                piece.spin[0] = (rand() - 0.5) * 1.4; piece.spin[1] = (rand() - 0.5) * 1.4; piece.spin[2] = (rand() - 0.5) * 1.4;
                piece.color.set(severedBeadColor(src.bead, pending.orbColors, baseColor));
            }
        }
        if (!st.active) {
            if (mesh.count !== 0) mesh.count = 0;
            return;
        }
        const store = useGameStore.getState();
        st.t += store.wormPaused && store.wormAlive ? 0 : Math.min(rawDelta, 0.05);
        mesh.count = st.count;
        for (let i = 0; i < st.count; i++) {
            const piece = st.pieces[i];
            severedPieceInto(_sevPose, piece, st.t, st.reduced);
            _sevDummy.position.set(_sevPose.x, _sevPose.y, _sevPose.z);
            _sevDummy.scale.setScalar(Math.max(0, _sevPose.scale) * WORM_BODY_RADIUS * (1 - piece.rank * 0.35));
            _sevDummy.updateMatrix();
            mesh.setMatrixAt(i, _sevDummy.matrix);
            _sevCol.copy(piece.color).lerp(_sevWhite, _sevPose.flash * 0.8);
            mesh.setColorAt(i, _sevCol);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (st.t >= SEVERED_TOTAL) {
            st.active = false;
            mesh.count = 0;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SEVERED_PIECES]} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial roughness={0.35} metalness={0.05} />
        </instancedMesh>
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
