import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCubies } from '../../game/cubeState.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { updateSharedTime, getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import MenuFlipWave from './MenuFlipWave.jsx';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';

// ─── Random scheme + tile style, picked once per page load ────────────────────
const _SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'biome' && k !== 'custom');
const _TILE_KEYS = [...CLASSIC_STYLE_KEYS, ...ANTIPODAL_STYLE_KEYS, ...LIVING_STYLE_KEYS];
const _menuSchemeKey = _SCHEME_KEYS[Math.floor(Math.random() * _SCHEME_KEYS.length)];
const _menuFaceStyles = {};
for (let f = 1; f <= 6; f++) {
  _menuFaceStyles[f] = _TILE_KEYS[Math.floor(Math.random() * _TILE_KEYS.length)];
}
const MENU_FACE_COLORS = COLOR_SCHEMES[_menuSchemeKey]; // { 1: hex, 2: hex, ... }

const FACE_COLOR = {
  PX: '#3b82f6', NX: '#22c55e',
  PZ: '#ef4444', NZ: '#f97316',
  PY: '#eeeeee', NY: '#eab308',
};
const FACE_KEYS = Object.keys(FACE_COLOR);

// ─── Shared pulse state — written by FacePulses (WebGL), read by ScreenGlow (DOM) ──
// Per-face rawP values (0→1) so all 6 colors are always independently visible.
const _pulsePerFace = { PX: 0, NX: 0, PY: 0, NY: 0, PZ: 0, NZ: 0 };

// Screen-edge gradient per face: each face maps to the screen region it faces.
// PZ/NZ (front/back) use left/right edges since they have no top-bottom screen axis.
const FACE_SCREEN_GRADIENT = {
  PY: c => `radial-gradient(ellipse 120% 55% at 50% 0%,   ${c} 0%, transparent 68%)`,
  NY: c => `radial-gradient(ellipse 120% 55% at 50% 100%, ${c} 0%, transparent 68%)`,
  PX: c => `radial-gradient(ellipse 55% 120% at 100% 50%, ${c} 0%, transparent 68%)`,
  NX: c => `radial-gradient(ellipse 55% 120% at 0%   50%, ${c} 0%, transparent 68%)`,
  PZ: c => `radial-gradient(ellipse 55% 120% at 12%  50%, ${c} 0%, transparent 68%)`,
  NZ: c => `radial-gradient(ellipse 55% 120% at 88%  50%, ${c} 0%, transparent 68%)`,
};

// DOM overlay — reads _pulsePerFace via rAF and updates div opacity directly (no React state)
const ScreenGlow = () => {
  const divRefs = useRef({});
  useEffect(() => {
    let raf;
    // Track previous per-face values to skip no-op DOM writes
    const prev = { PX: -1, NX: -1, PY: -1, NY: -1, PZ: -1, NZ: -1 };
    const tick = () => {
      FACE_KEYS.forEach(face => {
        const rawP = _pulsePerFace[face];
        if (rawP === prev[face]) return;
        prev[face] = rawP;
        const el = divRefs.current[face];
        if (!el) return;
        const bell = rawP < 0.30 ? rawP / 0.30 : (1 - rawP) / 0.70;
        el.style.opacity = String(Math.max(0, bell) * 0.22);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      {FACE_KEYS.map(face => (
        <div
          key={face}
          ref={el => { divRefs.current[face] = el; }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
            opacity: 0, willChange: 'opacity',
            background: FACE_SCREEN_GRADIENT[face](FACE_COLOR[face]),
          }}
        />
      ))}
    </>
  );
};


// ─── Carousel-active flag — set by MainMenu, read by all useFrame hooks ────────
// Plain module-level variable: no React state needed, just a synchronous gate.
let _carouselActive = false;

// ─── Shuffling cube — live Rubik's slice animation ────────────────────────────
const STICKER_CFG = [
  { dir: 'PX', pos: [0.501, 0, 0],   rot: [0,  Math.PI / 2, 0] },
  { dir: 'NX', pos: [-0.501, 0, 0],  rot: [0, -Math.PI / 2, 0] },
  { dir: 'PY', pos: [0,  0.501, 0],  rot: [-Math.PI / 2, 0, 0] },
  { dir: 'NY', pos: [0, -0.501, 0],  rot: [ Math.PI / 2, 0, 0] },
  { dir: 'PZ', pos: [0, 0,  0.501],  rot: [0, 0, 0] },
  { dir: 'NZ', pos: [0, 0, -0.501],  rot: [0, Math.PI, 0] },
];
const ALL_MOVES    = ['col', 'row', 'depth'].flatMap(ax => [0, 1, 2].flatMap(sl => [1, -1].map(d => ({ ax, sl, d }))));
// Per-flip-pair safe axis: middle slice of the PERPENDICULAR axis does not contain any
// face center of the flipped pair. e.g. PZ center is at z=2, so depth sl=1 (z=1) is safe.
const FLIP_PAIR_SAFE_AX = {
  PZ: 'depth', NZ: 'depth',
  PX: 'col',   NX: 'col',
  PY: 'row',   NY: 'row',
};
// Maps axis name → cubie coordinate property (for flat-array slice filtering)
const AX_PROP = { col: 'x', row: 'y', depth: 'z' };
const ANIM_DUR = 0.50;
const PAUSE_DUR = 0.80;
const easeIO = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// Antipodal center-sticker pairs used for the sporadic menu flips.
// Positions are in ShufflingCube local space (cubies centred at –1/0/+1,
// sticker planes sit 0.501 beyond that, so surface ≈ ±1.501).
const MENU_FLIP_PAIRS = [
  [
    { dir: 'PZ', cubie: [1, 1, 2], pos: [0, 0,  1.501], rot: [0, 0, 0] },
    { dir: 'NZ', cubie: [1, 1, 0], pos: [0, 0, -1.501], rot: [0, Math.PI, 0] },
  ],
  [
    { dir: 'PX', cubie: [2, 1, 1], pos: [ 1.501, 0, 0], rot: [0,  Math.PI / 2, 0] },
    { dir: 'NX', cubie: [0, 1, 1], pos: [-1.501, 0, 0], rot: [0, -Math.PI / 2, 0] },
  ],
  [
    { dir: 'PY', cubie: [1, 2, 1], pos: [0,  1.501, 0], rot: [-Math.PI / 2, 0, 0] },
    { dir: 'NY', cubie: [1, 0, 1], pos: [0, -1.501, 0], rot: [ Math.PI / 2, 0, 0] },
  ],
];
const MENU_FLIP_INTERVAL = 3.0;
const MENU_FLIP_JITTER   = 0.6;

const ShuffleCubie = React.memo(({ cubie }) => {
  const cx = cubie.x - 1, cy = cubie.y - 1, cz = cubie.z - 1;
  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry args={[0.93, 0.93, 0.93]} />
        <meshStandardMaterial color="#1c1c30" roughness={0.55} metalness={0.4} emissive="#0d0d1e" emissiveIntensity={0.6} />
      </mesh>
      {STICKER_CFG.map(({ dir, pos, rot }) => {
        const sticker = cubie.stickers?.[dir];
        if (!sticker) return null;
        const colorHex = MENU_FACE_COLORS[sticker.curr] ?? '#888888';
        return (
          <group key={dir} position={pos} rotation={rot}>
            <mesh>
              <planeGeometry args={[0.80, 0.80]} />
              <primitive attach="material" object={getTileStyleMaterial(_menuFaceStyles[sticker.curr] || 'solid', colorHex)} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});
ShuffleCubie.displayName = 'ShuffleCubie';

const ShufflingCube = () => {
  const [cubeState, setCubeState] = useState(() => {
    let cubies = makeCubies(3);
    for (let i = 0; i < 18; i++) {
      const m = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
      cubies = rotateSliceCubies(cubies, 3, m.ax, m.sl, m.d);
    }
    return { cubies, rotating: null };
  });

  const [flipWaves, setFlipWaves] = useState([]);
  const flipWavesRef = useRef([]);
  flipWavesRef.current = flipWaves;
  const cubeStateRef = useRef(cubeState);
  cubeStateRef.current = cubeState;
  const sliceGroupRef = useRef();
  const nextMoveAt  = useRef(0);   // independent rotation timer
  const nextFlipAt  = useRef(3.0); // first flip after 3 s so the cube settles first
  const flipIdRef   = useRef(0);

  useFrame(({ clock }) => {
    if (_carouselActive) return;
    const t = clock.elapsedTime;
    const { rotating, cubies } = cubeStateRef.current;

    // Slice rotation animation
    if (rotating) {
      const progress = Math.min((t - rotating.startT) / ANIM_DUR, 1);
      const angle = easeIO(progress) * (Math.PI / 2) * rotating.d;
      if (sliceGroupRef.current) {
        sliceGroupRef.current.rotation.set(
          rotating.ax === 'col'   ? angle : 0,
          rotating.ax === 'row'   ? angle : 0,
          rotating.ax === 'depth' ? angle : 0,
        );
      }
      if (progress >= 1) {
        const newCubies = rotateSliceCubies(cubies, 3, rotating.ax, rotating.sl, rotating.d);
        nextMoveAt.current = t + PAUSE_DUR;
        setCubeState({ cubies: newCubies, rotating: null });
      }
    } else if (t >= nextMoveAt.current) {
      // Continuous rotation — safe axis only while a worm wave is active so the
      // spawned face center tile doesn't move under the worm during its animation.
      const wave = flipWavesRef.current[0];
      const m = wave
        ? { ax: wave.safeAx, sl: 1, d: Math.random() < 0.5 ? 1 : -1 }
        : ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
      setCubeState(prev => ({ ...prev, rotating: { ...m, startT: t } }));
    }

    // Sporadic antipodal flip — fires on a timer regardless of active waves so worms
    // keep spawning continuously. Multiple waves are allowed concurrently.
    if (!rotating && t >= nextFlipAt.current) {
      nextFlipAt.current = t + MENU_FLIP_INTERVAL + (Math.random() * 2 - 1) * MENU_FLIP_JITTER;

      const pair = MENU_FLIP_PAIRS[Math.floor(Math.random() * MENU_FLIP_PAIRS.length)];
      const [sA, sB] = pair;
      const [ax, ay, az] = sA.cubie;
      const [bx, by, bz] = sB.cubie;
      const stA = cubies[ax][ay][az].stickers[sA.dir];
      const stB = cubies[bx][by][bz].stickers[sB.dir];

      // Append new wave so concurrent waves are allowed (multiple worm pairs on screen).
      const safeAx = FLIP_PAIR_SAFE_AX[sA.dir];
      const wid = ++flipIdRef.current;
      setFlipWaves(prev => [...prev, {
        id: wid,
        safeAx,
        startTime: t,
        origins: [
          { position: sA.pos, rotation: sA.rot, color: MENU_FACE_COLORS[stA.curr], id: `${wid}a` },
          { position: sB.pos, rotation: sB.rot, color: MENU_FACE_COLORS[stB.curr], id: `${wid}b` },
        ],
      }]);

      // Rotate the safe slice (computed above) coincident with the flip
      const m = { ax: safeAx, sl: 1, d: Math.random() < 0.5 ? 1 : -1 };
      const newCubies = cubies.map((plane, xi) =>
        plane.map((row, yi) =>
          row.map((cubie, zi) => {
            if (xi === ax && yi === ay && zi === az) {
              return { ...cubie, stickers: { ...cubie.stickers, [sA.dir]: { ...stA, curr: ANTIPODAL_COLOR[stA.curr] } } };
            }
            if (xi === bx && yi === by && zi === bz) {
              return { ...cubie, stickers: { ...cubie.stickers, [sB.dir]: { ...stB, curr: ANTIPODAL_COLOR[stB.curr] } } };
            }
            return cubie;
          })
        )
      );
      setCubeState({ rotating: { ...m, startT: t }, cubies: newCubies });
    }
  });

  const { cubies, rotating } = cubeState;
  // makeCubies returns a 3D array [x][y][z]; flatten to a list of 27 cubie objects.
  const flatCubies = cubies.flat(2);
  const axProp = rotating ? AX_PROP[rotating.ax] : null;
  const staticCubies = rotating ? flatCubies.filter(c => c[axProp] !== rotating.sl) : flatCubies;
  const sliceCubies = rotating ? flatCubies.filter(c => c[axProp] === rotating.sl) : [];

  return (
    <>
      {staticCubies.map(c => <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} />)}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} />)}
      </group>
      {flipWaves.map(wave => (
        <MenuFlipWave
          key={wave.id}
          origins={wave.origins}
          startTime={wave.startTime}
          onComplete={() => setFlipWaves(prev => prev.filter(w => w.id !== wave.id))}
        />
      ))}
    </>
  );
};

// ─── MenuWorm — round-blob worm mascot emerging from the cube's top face ──────
const _SEG_Y         = [0.80, 0.55, 0.33, 0.15, 0.00]; // all segs above cube surface
const _SEG_R         = [0.24, 0.22, 0.21, 0.20, 0.18];   // uniform blobs, gentle taper
const _SEG_COL       = ['#3be08a', '#2fd47e', '#24be72', '#1aa862', '#129650'];
const _PATH_MIN_DIST = 0.004;
const _SEG_SPACING   = 0.22;
const _MAX_PATH_LEN  = 4 * 0.22 + 0.15;
const _BLINK_DUR     = 0.13;

function _samplePath(path, behindDist) {
  if (path.length === 0) return { x: 0, z: 0 };
  const headArc   = path[path.length - 1].arc;
  const targetArc = headArc - behindDist;
  if (targetArc <= path[0].arc) return { x: path[0].x, z: path[0].z };
  let lo = 0, hi = path.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].arc <= targetArc) lo = mid; else hi = mid;
  }
  const p0 = path[lo], p1 = path[hi];
  const frac = p1.arc === p0.arc ? 0 : (targetArc - p0.arc) / (p1.arc - p0.arc);
  return { x: p0.x + (p1.x - p0.x) * frac, z: p0.z + (p1.z - p0.z) * frac };
}

const MenuWorm = ({ onWormClick }) => {
  const groupRef   = useRef();
  const headRef    = useRef();   // outer group: position + rotation
  const headMeshRef = useRef();  // sphere only: squash/stretch (eyes excluded)
  const seg1Ref    = useRef();
  const seg2Ref    = useRef();
  const seg3Ref    = useRef();
  const tailRef    = useRef();

  const eyeLRef   = useRef();
  const eyeRRef   = useRef();
  const pupilLRef = useRef();
  const pupilRRef = useRef();
  const blinkT            = useRef(-1);
  const nextBlink         = useRef(-1);
  const pupilTargetScale  = useRef(1.0);
  const pupilCurrentScale = useRef(1.0);

  const wiggling     = useRef(false);
  const wiggleStart  = useRef(0);
  const targetScale  = useRef(0.70);
  const currentScale = useRef(0.70);
  const callbackRef  = useRef(onWormClick);
  callbackRef.current = onWormClick;

  const pathBuf   = useRef([{ x: 0, z: 0, arc: 0 }]);
  const prevHead  = useRef({ x: 0, z: 0 });
  const smoothPtr = useRef({ x: 0, y: 0 });

  useFrame(({ clock, pointer }, delta) => {
    if (_carouselActive || !groupRef.current) return;
    const t = clock.elapsedTime;

    // Initialize blink timer on first frame
    if (nextBlink.current < 0) nextBlink.current = t + 3.5;

    if (wiggling.current && Date.now() - wiggleStart.current > 720) {
      wiggling.current = false;
      targetScale.current = 0.70;
      pupilTargetScale.current = 1.0;
      callbackRef.current?.();
    }

    smoothPtr.current.x += (pointer.x - smoothPtr.current.x) * Math.min(1, delta * 5);
    smoothPtr.current.y += (pointer.y - smoothPtr.current.y) * Math.min(1, delta * 5);

    const isWiggle = wiggling.current;
    const freq = isWiggle ? 8.5 : 1.6;
    const ampX = isWiggle ? 0.27 : 0.16;
    const ampZ = isWiggle ? 0.13 : 0.07;

    const hx = Math.sin(t * freq) * ampX;
    const hz = Math.sin(t * freq * 0.55 + 1.0) * ampZ;

    // ── Distance-based path recording ──────────────────────────────────────
    const prev = prevHead.current;
    const dx = hx - prev.x, dz = hz - prev.z;
    const stepDist = Math.sqrt(dx * dx + dz * dz);
    const path = pathBuf.current;
    if (stepDist >= _PATH_MIN_DIST) {
      path.push({ x: hx, z: hz, arc: path[path.length - 1].arc + stepDist });
      prevHead.current = { x: hx, z: hz };
      const headArc = path[path.length - 1].arc;
      const minKeep = headArc - _MAX_PATH_LEN;
      let trim = 0;
      while (trim < path.length - 1 && path[trim + 1].arc < minKeep) trim++;
      if (trim > 0) path.splice(0, trim);
    }

    // ── Head position + tilt + cursor blend ────────────────────────────────
    const vx    = Math.cos(t * freq) * freq * ampX;
    const vz    = Math.cos(t * freq * 0.55 + 1.0) * freq * 0.55 * ampZ;
    const speed = Math.sqrt(vx * vx + vz * vz);

    if (headRef.current) {
      headRef.current.position.set(hx, _SEG_Y[0], hz);
      headRef.current.rotation.z = -Math.atan2(vx, 2.0) * 0.55 - smoothPtr.current.x * 0.20;
      headRef.current.rotation.x =  Math.atan2(vz, 2.0) * 0.40 + smoothPtr.current.y * 0.14;
    }
    // Squash/stretch on sphere only — eyes/antennae stay round
    if (headMeshRef.current) {
      const stretch = 1 + Math.min(speed * 0.40, 0.30);
      const squash  = 1 / Math.sqrt(stretch);
      headMeshRef.current.scale.set(squash, stretch, squash);
    }

    // ── Body segments: path position + squash/stretch ────────────────────────
    const bodyRefs = [seg1Ref, seg2Ref, seg3Ref, tailRef];
    bodyRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const pos     = _samplePath(path, (i + 1) * _SEG_SPACING);
      const segSpeed = speed * Math.max(0.35, 1 - i * 0.18);
      const stretch  = 1 + Math.min(segSpeed * 0.25, 0.25);
      const squash   = 1 / Math.sqrt(stretch);
      ref.current.position.set(pos.x, _SEG_Y[i + 1], pos.z);
      ref.current.scale.set(squash, stretch, squash);
    });

    // ── Blinking ────────────────────────────────────────────────────────────
    if (blinkT.current >= 0) {
      blinkT.current = Math.min(1, blinkT.current + delta / _BLINK_DUR);
      const openness = 1 - Math.sin(blinkT.current * Math.PI);
      if (eyeLRef.current) eyeLRef.current.scale.y = Math.max(0.05, openness);
      if (eyeRRef.current) eyeRRef.current.scale.y = Math.max(0.05, openness);
      if (blinkT.current >= 1) {
        blinkT.current = -1;
        if (eyeLRef.current) eyeLRef.current.scale.y = 1;
        if (eyeRRef.current) eyeRRef.current.scale.y = 1;
        nextBlink.current = t + 2.5 + Math.random() * 3.5;
      }
    } else if (t >= nextBlink.current) {
      blinkT.current = 0;
    }

    // ── Pupil dilation ──────────────────────────────────────────────────────
    pupilCurrentScale.current += (pupilTargetScale.current - pupilCurrentScale.current) * Math.min(1, delta * 10);
    if (pupilLRef.current) pupilLRef.current.scale.setScalar(pupilCurrentScale.current);
    if (pupilRRef.current) pupilRRef.current.scale.setScalar(pupilCurrentScale.current);

    // ── Group bob + master scale ────────────────────────────────────────────
    groupRef.current.position.y = 1.45 + (isWiggle
      ? Math.abs(Math.sin(t * 14)) * 0.20
      : Math.sin(t * 1.5) * 0.06);
    currentScale.current += (targetScale.current - currentScale.current) * Math.min(1, delta * 16);
    groupRef.current.scale.setScalar(currentScale.current);
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (wiggling.current) return;
    wiggling.current = true;
    wiggleStart.current = Date.now();
    targetScale.current = 0.826;
    pupilTargetScale.current = 1.8;   // dilate on excitation
  };
  const handlePointerDown = (e) => { e.stopPropagation(); targetScale.current = 0.581; };
  const handlePointerUp   = (e) => { e.stopPropagation(); if (!wiggling.current) targetScale.current = 0.70; };

  return (
    <group
      ref={groupRef}
      position={[0, 1.45, 0]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <group ref={headRef}>
        {/* Sphere only gets squash/stretch — eyes and antennae stay round */}
        <mesh ref={headMeshRef}>
          <sphereGeometry args={[_SEG_R[0], 16, 12]} />
          <meshPhysicalMaterial
            color={_SEG_COL[0]} roughness={0.28} metalness={0.0}
            emissive={_SEG_COL[0]} emissiveIntensity={0.20}
            clearcoat={0.70} clearcoatRoughness={0.12}
          />
        </mesh>
        {/* Eyes */}
        <mesh ref={eyeLRef} position={[-0.10, 0.14, 0.22]}>
          <sphereGeometry args={[0.068, 10, 10]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.10, 0.14, 0.22]}>
          <sphereGeometry args={[0.068, 10, 10]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
        <mesh ref={pupilLRef} position={[-0.10, 0.145, 0.268]}>
          <sphereGeometry args={[0.036, 8, 8]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.5} />
        </mesh>
        <mesh ref={pupilRRef} position={[0.10, 0.145, 0.268]}>
          <sphereGeometry args={[0.036, 8, 8]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.5} />
        </mesh>
        {/* Smile */}
        <mesh position={[0, -0.04, 0.235]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.065, 0.018, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#0d2410" roughness={0.6} />
        </mesh>
        {/* Antennae */}
        <mesh position={[-0.13, 0.30, 0.10]} rotation={[0, 0, 0.32]}>
          <cylinderGeometry args={[0.013, 0.009, 0.28, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} roughness={0.5} />
        </mesh>
        <mesh position={[0.13, 0.30, 0.10]} rotation={[0, 0, -0.32]}>
          <cylinderGeometry args={[0.013, 0.009, 0.28, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} roughness={0.5} />
        </mesh>
        <mesh position={[-0.165, 0.41, 0.10]}>
          <sphereGeometry args={[0.026, 6, 6]} />
          <meshStandardMaterial color="#b0ffda" emissive="#40ff99" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.165, 0.41, 0.10]}>
          <sphereGeometry args={[0.026, 6, 6]} />
          <meshStandardMaterial color="#b0ffda" emissive="#40ff99" emissiveIntensity={0.7} />
        </mesh>
      </group>

      {/* ── Body segments — smooth round blobs ───────────────────────────── */}
      <mesh ref={seg1Ref}>
        <sphereGeometry args={[_SEG_R[1], 16, 12]} />
        <meshPhysicalMaterial
          color={_SEG_COL[1]} roughness={0.30} metalness={0.0}
          emissive={_SEG_COL[1]} emissiveIntensity={0.16}
          clearcoat={0.60} clearcoatRoughness={0.15}
        />
      </mesh>
      <mesh ref={seg2Ref}>
        <sphereGeometry args={[_SEG_R[2], 16, 12]} />
        <meshPhysicalMaterial
          color={_SEG_COL[2]} roughness={0.32} metalness={0.0}
          emissive={_SEG_COL[2]} emissiveIntensity={0.14}
          clearcoat={0.55} clearcoatRoughness={0.18}
        />
      </mesh>
      <mesh ref={seg3Ref}>
        <sphereGeometry args={[_SEG_R[3], 14, 10]} />
        <meshPhysicalMaterial
          color={_SEG_COL[3]} roughness={0.34} metalness={0.0}
          emissive={_SEG_COL[3]} emissiveIntensity={0.12}
          clearcoat={0.50} clearcoatRoughness={0.20}
        />
      </mesh>
      <mesh ref={tailRef}>
        <sphereGeometry args={[_SEG_R[4], 12, 8]} />
        <meshPhysicalMaterial
          color={_SEG_COL[4]} roughness={0.36} metalness={0.0}
          emissive={_SEG_COL[4]} emissiveIntensity={0.10}
          clearcoat={0.45} clearcoatRoughness={0.22}
        />
      </mesh>

      {/* Soft glow halo */}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.52, 10, 10]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ─── Rotating cube + worm mascot — exported for App.jsx's shared Canvas ───────
export const RotatingBlackCube = ({ onCubeClick }) => {
  const cubeRef = useRef();
  const shaking = useRef(false);
  const shakeStart = useRef(0);
  const cubeTargetScale = useRef(0.808);
  const cubeCurrentScale = useRef(0.808);
  const onCubeClickRef = useRef(onCubeClick);
  onCubeClickRef.current = onCubeClick;

  useFrame((state, delta) => {
    if (_carouselActive || !cubeRef.current) return;
    const t = state.clock.elapsedTime;
    updateSharedTime(t);

    cubeCurrentScale.current += (cubeTargetScale.current - cubeCurrentScale.current) * Math.min(1, delta * 18);
    cubeRef.current.scale.setScalar(cubeCurrentScale.current);

    if (shaking.current) {
      const elapsed = Date.now() - shakeStart.current;
      if (elapsed > 540) {
        shaking.current = false;
        cubeTargetScale.current = 0.808;
        cubeRef.current.position.set(0, 0.45, 0);
        onCubeClickRef.current?.();
      } else {
        const intensity = 0.10 * (1 - elapsed / 540);
        cubeRef.current.position.x = Math.sin(t * 42) * intensity;
        cubeRef.current.position.y = 0.45 + Math.sin(t * 37 + 1) * intensity * 0.5;
        cubeRef.current.position.z = Math.sin(t * 31 + 2) * intensity * 0.3;
      }
    } else {
      // Compound rotation shows all 6 faces over time
      cubeRef.current.rotation.y = t * 0.20 + Math.sin(t * 0.09) * 0.55;
      cubeRef.current.rotation.x = Math.sin(t * 0.13) * 0.48;
      cubeRef.current.rotation.z = Math.sin(t * 0.07) * 0.18;
      cubeRef.current.position.set(0, 0.45, 0);
    }
  });

  const handleCubeClick = (e) => {
    e.stopPropagation();
    if (shaking.current) return;
    shaking.current = true;
    shakeStart.current = Date.now();
  };
  const handleCubeDown = () => { cubeTargetScale.current = 0.765; };
  const handleCubeUp = () => { if (!shaking.current) cubeTargetScale.current = 0.808; };

  return (
    <>
      <group
        ref={cubeRef}
        position={[0, 0.45, 0]}
        onClick={handleCubeClick}
        onPointerDown={handleCubeDown}
        onPointerUp={handleCubeUp}
        onPointerLeave={handleCubeUp}
      >
        <ShufflingCube />
      </group>
    </>
  );
};

// ─── Mode carousel constants ──────────────────────────────────────────────────
const RAINBOW_GRADIENT = 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)';

const CAROUSEL_MODES = [
  { id: 'cube',        label: 'CUBE',        color: '#3b82f6', desc: "Classic Rubik's cube solving with full setup wizard." },
  { id: 'worm',        label: 'WORM',        color: '#22c55e', desc: 'Co-op worm healer mode on a living antipodal cube.' },
  { id: 'chaos',       label: 'CHAOS',       color: '#f97316', desc: 'Antipodal flip survival with betting and chaos tuning.' },
  { id: 'freeplay',    label: 'FREE PLAY',   color: '#a855f7', desc: 'Unlimited customization — your cube, your rules.' },
  { id: 'random',      label: 'RANDOM',      color: '#eab308', desc: 'Randomized style cycling every 15 seconds.' },
  { id: 'coming-soon', label: 'COMING SOON', color: '#60a5fa', desc: 'Story, Holonomy, Biome, Merge — arriving soon.' },
  { id: 'how-to-play', label: 'HOW TO PLAY', color: '#ef4444', desc: 'Learn the rules and mechanics of WORM³.' },
];

// ─── Mode carousel overlay ────────────────────────────────────────────────────
const ModeCarousel = ({ onBack, onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onComingSoon, onHowToPlay }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);
  const N = CAROUSEL_MODES.length;

  useEffect(() => {
    _carouselActive = true;
    return () => { _carouselActive = false; };
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft')  setActiveIndex(i => (i - 1 + N) % N);
      if (e.key === 'ArrowRight') setActiveIndex(i => (i + 1) % N);
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBack, N]);

  const navigate = (dir) => setActiveIndex(i => (i + dir + N) % N);

  const handlePlay = () => {
    const id = CAROUSEL_MODES[activeIndex].id;
    if (id === 'cube')        onCubeSelect?.();
    else if (id === 'worm')        onWormSelect?.();
    else if (id === 'chaos')       onChaos?.();
    else if (id === 'freeplay')    onFreeplay?.();
    else if (id === 'random')      onRandom?.();
    else if (id === 'coming-soon') onComingSoon?.();
    else if (id === 'how-to-play') onHowToPlay?.();
  };

  const prevIdx = (activeIndex - 1 + N) % N;
  const nextIdx = (activeIndex + 1) % N;
  const active = CAROUSEL_MODES[activeIndex];
  const prev   = CAROUSEL_MODES[prevIdx];
  const next   = CAROUSEL_MODES[nextIdx];

  const arrowBtn = (onClick, label) => (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', flexShrink: 0,
        color: 'rgba(200,220,255,0.70)', fontSize: '24px', lineHeight: 1, fontWeight: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 160ms ease, border-color 160ms ease',
        fontFamily: MENU_FONT,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.26)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
    >{label}</button>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 8px', pointerEvents: 'all',
        background: 'rgba(4,6,18,0.97)',
        backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
      }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) > 50) navigate(delta < 0 ? 1 : -1);
      }}
    >
      <MenuBackgroundOrbs />

      {/* Content sits above the orbs */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}>
      <p style={{
        margin: '0 0 28px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.30em',
        textTransform: 'uppercase', color: 'rgba(160,185,255,0.40)', fontFamily: MENU_FONT,
      }}>Choose your mode</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '620px', justifyContent: 'center', perspective: '1000px' }}>
        {arrowBtn(() => navigate(-1), '‹')}

        {/* Previous card */}
        <button
          onClick={() => navigate(-1)}
          style={{
            flexShrink: 0, width: '100px', minHeight: '200px', borderRadius: '18px',
            border: `1px solid ${prev.color}1a`, background: `${prev.color}07`,
            cursor: 'pointer', padding: '16px 10px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            transform: 'rotateY(30deg) scale(0.76)', opacity: 0.25, pointerEvents: 'auto',
            transition: 'all 300ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 900, color: prev.color, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: MENU_FONT, textAlign: 'center' }}>{prev.label}</span>
        </button>

        {/* Active card */}
        <div style={{
          flexShrink: 0, width: 'min(260px, 68vw)', minHeight: '290px', borderRadius: '22px',
          border: `1.5px solid ${active.color}50`,
          background: `linear-gradient(160deg, ${active.color}16 0%, rgba(6,10,24,0.86) 100%)`,
          boxShadow: `0 0 56px ${active.color}24, 0 20px 56px rgba(0,0,0,0.52)`,
          padding: '28px 20px 22px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '10px',
          transition: 'border-color 350ms ease, box-shadow 350ms ease',
        }}>
          <div style={{
            fontSize: 'clamp(34px,8vw,56px)', fontWeight: 900, letterSpacing: '0.06em',
            lineHeight: 1, textAlign: 'center', fontFamily: MENU_FONT,
            color: active.color, textShadow: `0 0 28px ${active.color}55`,
            transition: 'color 350ms ease, text-shadow 350ms ease',
          }}>{active.label}</div>
          <p style={{
            margin: 0, fontSize: '12px', lineHeight: 1.55, textAlign: 'center',
            color: 'rgba(200,220,255,0.55)', fontFamily: MENU_FONT, maxWidth: '200px',
          }}>{active.desc}</p>
          <button
            onClick={handlePlay}
            style={{
              marginTop: '6px', padding: '11px 28px', borderRadius: '100px',
              border: `1px solid ${active.color}70`, background: `${active.color}1e`,
              color: active.color, fontWeight: 800, letterSpacing: '0.18em',
              fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
              fontFamily: MENU_FONT, transition: 'background 160ms ease, box-shadow 160ms ease',
              boxShadow: `0 0 18px ${active.color}1e`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${active.color}36`; e.currentTarget.style.boxShadow = `0 0 28px ${active.color}40`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${active.color}1e`; e.currentTarget.style.boxShadow = `0 0 18px ${active.color}1e`; }}
          >PLAY</button>
        </div>

        {/* Next card */}
        <button
          onClick={() => navigate(1)}
          style={{
            flexShrink: 0, width: '100px', minHeight: '200px', borderRadius: '18px',
            border: `1px solid ${next.color}1a`, background: `${next.color}07`,
            cursor: 'pointer', padding: '16px 10px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            transform: 'rotateY(-30deg) scale(0.76)', opacity: 0.25, pointerEvents: 'auto',
            transition: 'all 300ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 900, color: next.color, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: MENU_FONT, textAlign: 'center' }}>{next.label}</span>
        </button>

        {arrowBtn(() => navigate(1), '›')}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '22px', alignItems: 'center' }}>
        {CAROUSEL_MODES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              width: i === activeIndex ? '20px' : '6px', height: '6px',
              borderRadius: '100px', border: 'none', cursor: 'pointer', padding: 0,
              background: i === activeIndex ? active.color : 'rgba(255,255,255,0.18)',
              transition: 'width 300ms cubic-bezier(0.34,1.56,0.64,1), background 300ms ease',
              boxShadow: i === activeIndex ? `0 0 8px ${active.color}88` : 'none',
            }}
          />
        ))}
      </div>

      <button
        onClick={onBack}
        style={{
          marginTop: '24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '100px', padding: '8px 20px', color: 'rgba(180,200,255,0.50)',
          fontSize: '12px', fontWeight: 600, letterSpacing: '0.10em', cursor: 'pointer',
          fontFamily: MENU_FONT, transition: 'border-color 160ms ease, color 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.26)'; e.currentTarget.style.color = 'rgba(200,220,255,0.78)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(180,200,255,0.50)'; }}
      >← Back</button>
      </div>{/* end content wrapper */}
    </div>
  );
};

// ─── Start button ─────────────────────────────────────────────────────────────
const MenuStartButton = ({ visible, onClick }) => (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 'max(48px, env(safe-area-inset-bottom, 48px))',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(16px)',
    transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
    pointerEvents: 'all',
  }}>
    <div style={{
      padding: '2.5px', borderRadius: '100px',
      background: RAINBOW_GRADIENT,
      boxShadow: '0 0 48px rgba(120,100,255,0.30), 0 0 96px rgba(60,60,200,0.14)',
    }}>
      <button
        onClick={onClick}
        style={{
          display: 'block', background: 'rgba(6,10,24,0.88)', borderRadius: '100px', border: 'none',
          padding: 0, cursor: 'pointer',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span style={{
          display: 'block', padding: '18px 72px',
          fontSize: 'clamp(22px, 5vw, 34px)', fontWeight: 900, letterSpacing: '0.22em',
          fontFamily: MENU_FONT,
          background: RAINBOW_GRADIENT,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>START</span>
      </button>
    </div>
  </div>
);

const MENU_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const menuStyles = {
  titleWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
    paddingLeft: '16px', paddingRight: '16px',
    transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
  },
  titleCard: {
    display: 'inline-block',
    background: 'rgba(6,10,24,0.72)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    borderRadius: '24px',
    padding: '18px 28px 16px',
    border: '1px solid rgba(120,160,255,0.14)',
    boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.10)',
  },
};

const MenuTitleCard = ({ visible }) => (
  <div style={{
    ...menuStyles.titleWrap,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-18px)',
  }}>
    <div style={menuStyles.titleCard}>
      <h1 style={{
        margin: 0, fontSize: 'clamp(54px,13vw,96px)', fontWeight: 900,
        letterSpacing: '0.1em', lineHeight: 1, fontFamily: "'Courier New', monospace",
        background: 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        textAlign: 'center',
      }}>
        WORM<sup style={{ fontSize: '0.42em', verticalAlign: 'super', WebkitTextFillColor: 'transparent' }}>3</sup>
      </h1>
    </div>
  </div>
);


// ─── Ambient background orbs ─────────────────────────────────────────────────
const ORB_DEFS = [
  { color: '#3b82f6', top: '-18%',  left: '-12%',  size: '58vmax', anim: 'orbDrift1 30s ease-in-out infinite alternate',          opacity: 0.30 },
  { color: '#a855f7', bottom: '-22%',right: '-16%', size: '62vmax', anim: 'orbDrift2 36s ease-in-out infinite alternate',          opacity: 0.24 },
  { color: '#f97316', top: '15%',   right: '-18%',  size: '46vmax', anim: 'orbDrift3 24s ease-in-out infinite alternate',          opacity: 0.18 },
  { color: '#22c55e', bottom: '8%', left: '-14%',   size: '42vmax', anim: 'orbDrift1 28s ease-in-out infinite alternate-reverse',  opacity: 0.15 },
  { color: '#eab308', top: '44%',   left: '28%',    size: '36vmax', anim: 'orbDrift2 40s ease-in-out infinite alternate',          opacity: 0.11 },
];

const MenuBackgroundOrbs = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
    {ORB_DEFS.map((orb, i) => (
      <div key={i} style={{
        position: 'absolute',
        width: orb.size, height: orb.size,
        top: orb.top, left: orb.left, bottom: orb.bottom, right: orb.right,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
        filter: 'blur(72px)',
        opacity: orb.opacity,
        animation: orb.anim,
      }} />
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({
  onPlay: _onPlay, onLevels, onFreeplay, onRandom, onCoop: _onCoop, onTeach,
  onSettings: _onSettings, onBiome: _onBiome, onDisparity,
  onWormHealer, onHolonomy: _onHolonomy, onMerge: _onMerge,
  onStore: _onStore, onComingSoon, onMobiusCubelet: _onMobiusCubelet,
}) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t3 = setTimeout(() => setBottomVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999, overflow: 'hidden', pointerEvents: 'none' }}>
      <MenuBackgroundOrbs />
      <ScreenGlow />
      <MenuTitleCard visible={titleVisible} />
      {showCarousel ? (
        <ModeCarousel
          onBack={() => setShowCarousel(false)}
          onCubeSelect={onLevels}
          onWormSelect={onWormHealer}
          onChaos={onDisparity}
          onFreeplay={onFreeplay}
          onRandom={onRandom}
          onComingSoon={onComingSoon}
          onHowToPlay={onTeach}
        />
      ) : (
        <MenuStartButton visible={bottomVisible} onClick={() => setShowCarousel(true)} />
      )}
    </div>
  );
};

export default MainMenu;
