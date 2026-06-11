import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCubies } from '../../game/cubeState.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { updateSharedTime, getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import MenuFlipWave from './MenuFlipWave.jsx';
import MenuTileOverlay from './MenuTileOverlay.jsx';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';

// ─── Randomizable style state — re-picked every time the user taps the cube ──
// biome is now included so its face palette appears in the rotation.
const _SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'custom');
const _TILE_KEYS   = [...CLASSIC_STYLE_KEYS, ...ANTIPODAL_STYLE_KEYS, ...LIVING_STYLE_KEYS];

// Mutable state — rerandomizeMenuStyle() reassigns all three.
let _menuSchemeKey  = _SCHEME_KEYS[Math.floor(Math.random() * _SCHEME_KEYS.length)];
let _menuFaceStyles = {};
for (let f = 1; f <= 6; f++) {
  _menuFaceStyles[f] = _TILE_KEYS[Math.floor(Math.random() * _TILE_KEYS.length)];
}
let MENU_FACE_COLORS = COLOR_SCHEMES[_menuSchemeKey] ?? COLOR_SCHEMES['classic']; // { 1: hex, 2: hex, ... }

// Called by RotatingBlackCube after a direct cube-tap shake.
// Also available externally so tests / storybook can reset state.
function rerandomizeMenuStyle() {
  _menuSchemeKey  = _SCHEME_KEYS[Math.floor(Math.random() * _SCHEME_KEYS.length)];
  MENU_FACE_COLORS = COLOR_SCHEMES[_menuSchemeKey] ?? COLOR_SCHEMES['classic'];
  for (let f = 1; f <= 6; f++) {
    _menuFaceStyles[f] = _TILE_KEYS[Math.floor(Math.random() * _TILE_KEYS.length)];
  }
}

// Callback set by ShufflingCube so RotatingBlackCube can trigger a re-scramble
// + re-render without prop drilling through multiple layers.
let _triggerStyleRefresh = null;

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


import { setCarouselActive } from './menuCarouselState.js';

// ─── Carousel-active flag — set by MainMenu, read by all useFrame hooks ────────
// Shared via menuCarouselState.js so MenuFlipWave / MenuWormParticle can gate
// their useFrame loops without creating a circular import.
let _carouselActive = false; // kept for the local reads below; setCarouselActive syncs the shared module

// ─── Cube-shake bridge — Start button triggers 3D shake remotely ─────────────
let _externalShakeNeeded = false;
// ─── Post-shake callback — MainMenu registers this to open the carousel ───────
let _onShakeComplete = null;

// ─── Shuffling cube — live Rubik's slice animation ────────────────────────────
const STICKER_CFG = [
  { dir: 'PX', pos: [0.501, 0, 0],   rot: [0,  Math.PI / 2, 0] },
  { dir: 'NX', pos: [-0.501, 0, 0],  rot: [0, -Math.PI / 2, 0] },
  { dir: 'PY', pos: [0,  0.501, 0],  rot: [-Math.PI / 2, 0, 0] },
  { dir: 'NY', pos: [0, -0.501, 0],  rot: [ Math.PI / 2, 0, 0] },
  { dir: 'PZ', pos: [0, 0,  0.501],  rot: [0, 0, 0] },
  { dir: 'NZ', pos: [0, 0, -0.501],  rot: [0, Math.PI, 0] },
];
// Only middle-slice moves (sl=1) — worms always go through center face tiles
const MIDDLE_MOVES = ['col', 'row', 'depth'].flatMap(ax => [1, -1].map(d => ({ ax, sl: 1, d })));
// Maps axis name → cubie coordinate property (for flat-array slice filtering)
const AX_PROP   = { col: 'x', row: 'y', depth: 'z' };
const ANIM_DUR  = 0.55;  // slice rotation animation duration
const PAUSE_DUR = 1.20;  // pause after rotation before next worm spawns
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
const INITIAL_WORM_DELAY = 2.5; // seconds before the very first worm spawns

const ShuffleCubie = React.memo(({ cubie }) => {
  const cx = cubie.x - 1, cy = cubie.y - 1, cz = cubie.z - 1;
  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry args={[0.93, 0.93, 0.93]} />
        <meshStandardMaterial color="#1c1c30" roughness={0.28} metalness={0.72} emissive="#0d0d1e" emissiveIntensity={0.6} />
      </mesh>
      {STICKER_CFG.map(({ dir, pos, rot }) => {
        const sticker = cubie.stickers?.[dir];
        if (!sticker) return null;
        const colorHex      = MENU_FACE_COLORS[sticker.curr] ?? '#888888';
        const antiColorHex  = MENU_FACE_COLORS[ANTIPODAL_COLOR[sticker.curr]] ?? '#888888';
        // Show the full tile overlay stack on stickers that a worm has passed through.
        // curr !== orig means this sticker has been flipped an odd number of times.
        const isFlipped = sticker.curr !== sticker.orig;
        return (
          <group key={dir} position={pos} rotation={rot}>
            <mesh renderOrder={10}>
              <planeGeometry args={[0.80, 0.80]} />
              <primitive attach="material" object={getTileStyleMaterial(_menuFaceStyles[sticker.curr] || 'solid', colorHex)} />
            </mesh>
            {isFlipped && (
              <MenuTileOverlay colorHex={colorHex} antiColorHex={antiColorHex} />
            )}
          </group>
        );
      })}
    </group>
  );
});
ShuffleCubie.displayName = 'ShuffleCubie';

const ShufflingCube = ({ onFlip }) => {
  const [cubeState, setCubeState] = useState(() => {
    // Pre-scramble with middle-slice moves to get an interesting initial state
    let cubies = makeCubies(3);
    for (let i = 0; i < 12; i++) {
      const m = MIDDLE_MOVES[Math.floor(Math.random() * MIDDLE_MOVES.length)];
      cubies = rotateSliceCubies(cubies, 3, m.ax, m.sl, m.d);
    }
    return { cubies, rotating: null };
  });

  const [flipWaves, setFlipWaves] = useState([]);
  const [styleVersion, setStyleVersion] = useState(0);
  const cubeStateRef = useRef(cubeState);
  cubeStateRef.current = cubeState;
  const sliceGroupRef = useRef();
  const flipIdRef = useRef(0);

  // ── Sequential pipeline ──────────────────────────────────────────────────────
  // 'idle'     → waiting for nextSpawnAt, then spawns a worm
  // 'worm'     → worm is active, cube is still; wormCompleted ref gates the next step
  // 'rotating' → playing the middle-slice rotation animation
  const pipelineRef      = useRef('idle');
  const wormCompletedRef = useRef(false);
  const nextSpawnAt      = useRef(INITIAL_WORM_DELAY);

  // Called by MenuFlipWave when the worm animation finishes
  const handleWormComplete = useCallback(() => {
    wormCompletedRef.current = true;
  }, []);

  // Register the style-refresh callback so RotatingBlackCube can trigger a full
  // re-scramble + re-render after the user taps the cube directly.
  useEffect(() => {
    _triggerStyleRefresh = () => {
      // Re-scramble cubies so newly picked colors look intentional, not leftover.
      let cubies = makeCubies(3);
      for (let i = 0; i < 12; i++) {
        const m = MIDDLE_MOVES[Math.floor(Math.random() * MIDDLE_MOVES.length)];
        cubies = rotateSliceCubies(cubies, 3, m.ax, m.sl, m.d);
      }
      setCubeState({ cubies, rotating: null });
      setFlipWaves([]);
      pipelineRef.current = 'idle';
      nextSpawnAt.current = INITIAL_WORM_DELAY;
      setStyleVersion(v => v + 1);
    };
    return () => { _triggerStyleRefresh = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    if (_carouselActive) return;
    const t = clock.elapsedTime;
    const { rotating, cubies } = cubeStateRef.current;

    // ── Slice rotation animation ─────────────────────────────────────────────
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
        nextSpawnAt.current = t + PAUSE_DUR;
        pipelineRef.current = 'idle';
        setCubeState({ cubies: newCubies, rotating: null });
      }
      return; // don't advance pipeline while animating
    }

    // ── Pipeline state machine ────────────────────────────────────────────────
    if (pipelineRef.current === 'idle' && t >= nextSpawnAt.current) {
      // Pick a random antipodal pair and spawn a worm
      const pair = MENU_FLIP_PAIRS[Math.floor(Math.random() * MENU_FLIP_PAIRS.length)];
      const [sA, sB] = pair;
      const [ax, ay, az] = sA.cubie;
      const [bx, by, bz] = sB.cubie;
      const stA = cubies[ax][ay][az].stickers[sA.dir];
      const stB = cubies[bx][by][bz].stickers[sB.dir];

      // Flip the two center sticker colors
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

      const wid = ++flipIdRef.current;
      const wave = {
        id: wid,
        startTime: t,
        origins: [
          { position: sA.pos, rotation: sA.rot, color: MENU_FACE_COLORS[stA.curr] },
          { position: sB.pos, rotation: sB.rot, color: MENU_FACE_COLORS[stB.curr] },
        ],
      };

      wormCompletedRef.current = false;
      pipelineRef.current = 'worm';
      setCubeState({ cubies: newCubies, rotating: null });
      setFlipWaves([wave]);
      onFlip?.();
    }

    if (pipelineRef.current === 'worm' && wormCompletedRef.current) {
      // Worm fully retreated — start the middle-slice rotation
      wormCompletedRef.current = false;
      pipelineRef.current = 'rotating';
      const m = MIDDLE_MOVES[Math.floor(Math.random() * MIDDLE_MOVES.length)];
      setCubeState(prev => ({ ...prev, rotating: { ...m, startT: t } }));
      setFlipWaves([]);
    }
  });

  const { cubies, rotating } = cubeState;
  const flatCubies = cubies.flat(2);
  const axProp = rotating ? AX_PROP[rotating.ax] : null;
  const staticCubies = rotating ? flatCubies.filter(c => c[axProp] !== rotating.sl) : flatCubies;
  const sliceCubies  = rotating ? flatCubies.filter(c => c[axProp] === rotating.sl) : [];

  return (
    <>
      {staticCubies.map(c => (
        <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} />
      ))}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => (
          <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} />
        ))}
      </group>
      {flipWaves.map(wave => (
        <MenuFlipWave
          key={wave.id}
          origins={wave.origins}
          startTime={wave.startTime}
          onComplete={handleWormComplete}
        />
      ))}
    </>
  );
};

// ─── MenuWorm — round-blob worm mascot emerging from the cube's top face ──────
const _SEG_Y         = [0.80, 0.55, 0.33, 0.15, 0.00]; // all segs above cube surface
const _SEG_R         = [0.20, 0.185, 0.175, 0.165, 0.15];   // slimmer taper
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

export const MenuWorm = ({ onWormClick }) => {
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
      headRef.current.rotation.z = -Math.atan2(vx, 2.0) * 0.18 - smoothPtr.current.x * 0.10;
      headRef.current.rotation.x =  Math.atan2(vz, 2.0) * 0.15 + smoothPtr.current.y * 0.08;
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
          <meshStandardMaterial
            color={_SEG_COL[0]} roughness={0.55} metalness={0.0}
            emissive={_SEG_COL[0]} emissiveIntensity={1.1}
          />
          {/* BackSide outline */}
          <mesh scale={1.14}>
            <sphereGeometry args={[_SEG_R[0], 16, 12]} />
            <meshBasicMaterial color="#06001a" side={THREE.BackSide} />
          </mesh>
        </mesh>
        {/* Eyes — standard material for wet-glass emissive sclera */}
        <mesh ref={eyeLRef} position={[-0.10, 0.14, 0.22]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color="#ffffff" emissive="#c8e8ff" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.10, 0.14, 0.22]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color="#ffffff" emissive="#c8e8ff" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        <mesh ref={pupilLRef} position={[-0.10, 0.145, 0.275]}>
          <sphereGeometry args={[0.042, 8, 8]} />
          <meshStandardMaterial color="#050510" metalness={0.7} roughness={0.0} />
        </mesh>
        <mesh ref={pupilRRef} position={[0.10, 0.145, 0.275]}>
          <sphereGeometry args={[0.042, 8, 8]} />
          <meshStandardMaterial color="#050510" metalness={0.7} roughness={0.0} />
        </mesh>
        {/* Glints — asymmetric offsets give the alive single-light-source look */}
        <mesh position={[-0.117, 0.160, 0.285]}>
          <sphereGeometry args={[0.010, 5, 5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.90} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh position={[0.083, 0.160, 0.285]}>
          <sphereGeometry args={[0.010, 5, 5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.90} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        {/* Smile */}
        <mesh position={[0, -0.04, 0.235]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.065, 0.020, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#041a0a" emissive="#0a3a14" emissiveIntensity={0.8} roughness={0.4} />
        </mesh>
        {/* Antennae */}
        <mesh position={[-0.13, 0.30, 0.10]} rotation={[0, 0, 0.32]}>
          <cylinderGeometry args={[0.013, 0.009, 0.28, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} emissive={_SEG_COL[0]} emissiveIntensity={0.60} roughness={0.4} />
        </mesh>
        <mesh position={[0.13, 0.30, 0.10]} rotation={[0, 0, -0.32]}>
          <cylinderGeometry args={[0.013, 0.009, 0.28, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} emissive={_SEG_COL[0]} emissiveIntensity={0.60} roughness={0.4} />
        </mesh>
        <mesh position={[-0.165, 0.41, 0.10]}>
          <sphereGeometry args={[0.026, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive={_SEG_COL[0]} emissiveIntensity={3.5} roughness={0.1} />
        </mesh>
        <mesh position={[0.165, 0.41, 0.10]}>
          <sphereGeometry args={[0.026, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive={_SEG_COL[0]} emissiveIntensity={3.5} roughness={0.1} />
        </mesh>
      </group>

      {/* ── Body segments — smooth round blobs ───────────────────────────── */}
      <mesh ref={seg1Ref}>
        <sphereGeometry args={[_SEG_R[1], 16, 12]} />
        <meshStandardMaterial color={_SEG_COL[1]} roughness={0.55} metalness={0.0} emissive={_SEG_COL[1]} emissiveIntensity={0.95} />
        <mesh scale={1.14}>
          <sphereGeometry args={[_SEG_R[1], 16, 12]} />
          <meshBasicMaterial color="#06001a" side={THREE.BackSide} />
        </mesh>
      </mesh>
      <mesh ref={seg2Ref}>
        <sphereGeometry args={[_SEG_R[2], 16, 12]} />
        <meshStandardMaterial color={_SEG_COL[2]} roughness={0.55} metalness={0.0} emissive={_SEG_COL[2]} emissiveIntensity={0.85} />
        <mesh scale={1.14}>
          <sphereGeometry args={[_SEG_R[2], 16, 12]} />
          <meshBasicMaterial color="#06001a" side={THREE.BackSide} />
        </mesh>
      </mesh>
      <mesh ref={seg3Ref}>
        <sphereGeometry args={[_SEG_R[3], 14, 10]} />
        <meshStandardMaterial color={_SEG_COL[3]} roughness={0.55} metalness={0.0} emissive={_SEG_COL[3]} emissiveIntensity={0.75} />
        <mesh scale={1.14}>
          <sphereGeometry args={[_SEG_R[3], 14, 10]} />
          <meshBasicMaterial color="#06001a" side={THREE.BackSide} />
        </mesh>
      </mesh>
      <mesh ref={tailRef}>
        <sphereGeometry args={[_SEG_R[4], 12, 8]} />
        <meshStandardMaterial color={_SEG_COL[4]} roughness={0.55} metalness={0.0} emissive={_SEG_COL[4]} emissiveIntensity={0.65} />
        <mesh scale={1.14}>
          <sphereGeometry args={[_SEG_R[4], 12, 8]} />
          <meshBasicMaterial color="#06001a" side={THREE.BackSide} />
        </mesh>
      </mesh>

      {/* Two-layer glow halo — tight bright core + wide soft envelope */}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.34, 10, 10]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.58, 10, 10]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ─── Rotating cube + worm mascot — exported for App.jsx's shared Canvas ───────
export const RotatingBlackCube = ({ onCubeClick, onFlip }) => {
  const cubeRef = useRef();
  const shaking = useRef(false);
  const shakeStart = useRef(0);
  const shakeIsExternalRef = useRef(false); // true = START button, false = direct tap
  const cubeTargetScale = useRef(1.022);
  const cubeCurrentScale = useRef(1.022);
  const onCubeClickRef = useRef(onCubeClick);
  onCubeClickRef.current = onCubeClick;

  useFrame((state, delta) => {
    if (_carouselActive || !cubeRef.current) return;
    const t = state.clock.elapsedTime;
    updateSharedTime(t);

    if (_externalShakeNeeded && !shaking.current) {
      _externalShakeNeeded = false;
      shakeIsExternalRef.current = true;
      shaking.current = true;
      shakeStart.current = Date.now();
      cubeTargetScale.current = 0.950;
    }

    cubeCurrentScale.current += (cubeTargetScale.current - cubeCurrentScale.current) * Math.min(1, delta * 18);
    cubeRef.current.scale.setScalar(cubeCurrentScale.current);

    if (shaking.current) {
      const elapsed = Date.now() - shakeStart.current;
      if (elapsed > 540) {
        shaking.current = false;
        cubeTargetScale.current = 1.022;
        cubeRef.current.position.set(0, 0.45, 0);
        if (shakeIsExternalRef.current) {
          shakeIsExternalRef.current = false;
          _onShakeComplete?.();
        } else {
          rerandomizeMenuStyle();
          _triggerStyleRefresh?.();
        }
      } else {
        const intensity = 0.10 * (1 - elapsed / 540);
        cubeRef.current.position.x = Math.sin(t * 42) * intensity;
        cubeRef.current.position.y = 0.45 + Math.sin(t * 37 + 1) * intensity * 0.5;
        cubeRef.current.position.z = Math.sin(t * 31 + 2) * intensity * 0.3;
      }
    } else {
      // Compound rotation shows all 6 faces over time
      cubeRef.current.rotation.y = t * 0.24 + Math.sin(t * 0.108) * 0.55;
      cubeRef.current.rotation.x = Math.sin(t * 0.156) * 0.48;
      cubeRef.current.rotation.z = Math.sin(t * 0.084) * 0.18;
      cubeRef.current.position.set(0, 0.45, 0);
    }
  });

  const handleCubeClick = (e) => {
    e.stopPropagation();
    if (shaking.current) return;
    shaking.current = true;
    shakeStart.current = Date.now();
  };
  const handleCubeDown = () => { cubeTargetScale.current = 0.968; };
  const handleCubeUp = () => { if (!shaking.current) cubeTargetScale.current = 1.022; };

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
        <ShufflingCube onFlip={onFlip} />
      </group>
    </>
  );
};

// ─── Mode carousel constants ──────────────────────────────────────────────────
const RAINBOW_GRADIENT = 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)';

// ─── Heptagonal prism geometry ───────────────────────────────────────────────
const PRISM_FACE_ANGLE = 360 / 7; // ≈ 51.43° between adjacent faces
const PRISM_W = 180;              // face width px
const PRISM_H = 200;              // face height px
const PRISM_R = Math.round(PRISM_W / (2 * Math.tan(Math.PI / 7))); // ≈ 187px

// tileColor matches the game's 6 face colors; textColor ensures contrast on the tile
const CAROUSEL_MODES = [
  {
    id: 'cube', label: 'CUBE', tileColor: '#3b82f6', textColor: '#fff',
    desc: "Classic Rubik's cube solving with full setup wizard.",
    controls: ['Drag face edges to rotate slices', 'Tap a tile to toggle Flip mode', 'Undo moves with the undo button', 'Hit Shuffle to scramble and start'],
  },
  {
    id: 'worm', label: 'WORM', tileColor: '#22c55e', textColor: '#fff',
    desc: 'Co-op worm healer mode on a living antipodal cube.',
    controls: ['Worm follows your cursor or touch', 'Healed tiles restore the cube face', 'Collect orbs scattered across faces', 'Avoid flipped chaos tiles'],
  },
  {
    id: 'chaos', label: 'CHAOS', tileColor: '#f97316', textColor: '#fff',
    desc: 'Antipodal flip survival with betting and chaos tuning.',
    controls: ['Tiles flip automatically over time', 'Bet Parity Points before the round', 'Set chaos level 1–5 in the wizard', 'Survive until the last tile falls'],
  },
  {
    id: 'freeplay', label: 'FREE PLAY', tileColor: '#eab308', textColor: 'rgba(0,0,0,0.80)',
    desc: 'Unlimited customization — your cube, your rules.',
    controls: ['Pick cube size 2×2 through 5×5', 'Choose color scheme and tile style', 'Solve at your own pace', 'No time limit or win condition'],
  },
  {
    id: 'random', label: 'RANDOM', tileColor: '#ef4444', textColor: '#fff',
    desc: 'Randomized style cycling every 15 seconds.',
    controls: ['Color scheme changes every 15 s', 'Cube and tiles transform live', 'Keep solving through the shifts', 'Style variety makes every run fresh'],
  },
  {
    id: 'coming-soon', label: 'COMING SOON', tileColor: '#e8e8e0', textColor: 'rgba(0,0,0,0.70)',
    desc: 'Story, Holonomy, Biome, Merge — arriving soon.',
    controls: ['Story: 10-level campaign with cutscenes', 'Holonomy: loop visualization mode', 'Biome: city face-specific environments', 'Merge: block-merging puzzle variant'],
  },
  {
    id: 'how-to-play', label: 'HOW TO PLAY', tileColor: '#a855f7', textColor: '#fff',
    desc: 'Learn the rules and mechanics of WORM³.',
    controls: ['Step-by-step algorithm teaching', 'Learn F, R, U and slice moves', 'Practice one layer at a time', 'Hints and solution previews'],
  },
];

// ─── How-to-play mini tutorial ───────────────────────────────────────────────

const HOW_TO_PLAY_STEPS = [
  {
    title: 'Welcome to WORM³',
    lines: [
      "A Rubik's Cube puzzle built on real projective plane topology.",
      'Opposite faces are linked — flip one sticker and its antipodal partner changes too.',
      'Solve the cube while managing wormhole connections across all six faces.',
    ],
  },
  {
    title: 'Antipodal Pairs',
    lines: [
      'Red ↔ Orange  ·  Green ↔ Blue  ·  White ↔ Yellow',
      'Each face is permanently paired with the face directly across from it.',
      'Small dot on a sticker = its original color before any flips.',
    ],
  },
  {
    title: 'Wormhole Tunnels',
    lines: [
      'Flip any sticker and a glowing tunnel appears connecting it to its partner.',
      'Tunnels grow thicker and spark with electricity as flips accumulate.',
      'Tally marks on each sticker count its total wormhole journeys.',
      'Press T to toggle tunnel visibility on or off.',
    ],
  },
  {
    title: 'Basic Controls',
    lines: [
      'Drag anywhere on the canvas — rotate the cube freely 360°',
      'Drag on a sticker — twist that row, column, or depth slice',
      'Hold Shift + drag on a face — rotate the entire face CW / CCW',
      'Mobile: tap and drag for all interactions, full touch support',
    ],
  },
  {
    title: 'Flipping Stickers',
    lines: [
      'Press G or tap Flip to toggle Flip Mode — then tap any sticker',
      'Right-click (desktop) or long-press (mobile) to flip without Flip Mode',
      'Press F to flip the sticker under the keyboard cursor',
    ],
  },
  {
    title: 'Visual Modes',
    lines: [
      'Press V to cycle: Classic → Grid → Sudokube → Colors',
      'Classic: solid face colors  ·  Grid: manifold IDs (M1-001)',
      'Sudokube: Latin square numbers  ·  Colors: custom palette',
      'X — explode view  ·  T — tunnels  ·  N — flat net panel',
    ],
  },
  {
    title: 'Chaos (Disparity) Mode',
    lines: [
      'Press C or tap Chaos to toggle Disparity Mode.',
      'Flipped stickers spread instability to their neighbors over time.',
      'Level 1–5: occasional cascades → deep-manifold surges.',
      'AUTO: cube rotates automatically based on instability level.',
    ],
  },
  {
    title: 'Keyboard Shortcuts',
    lines: [
      'Arrow Keys — cursor  ·  W/S — column  ·  A/D — row  ·  Q/E — face',
      'G — flip mode  ·  F — flip at cursor  ·  C — chaos  ·  V — visual mode',
      'X — explode  ·  T — tunnels  ·  N — net panel',
      'H or ? — help  ·  Esc — close menus',
    ],
  },
  {
    title: 'Victory Conditions',
    lines: [
      'Classic: all six faces show a single uniform color',
      'Sudokube: valid Latin squares on all faces (no repeats per row/col)',
      'Ultimate: Classic AND Sudokube simultaneously',
      'WORM³: solve after every sticker has traveled through a wormhole at least once',
    ],
  },
];

const HowToPlayMini = ({ tileColor }) => {
  const [tutStep, setTutStep] = useState(0);
  const total = HOW_TO_PLAY_STEPS.length;
  const cur = HOW_TO_PLAY_STEPS[tutStep];
  return (
    <div style={{ padding: '1.5px', borderRadius: '18px', background: '#0c0c1a', boxShadow: '0 8px 24px rgba(0,0,0,0.40)' }}>
      <div style={{
        borderRadius: '16.5px',
        background: 'rgba(4,6,20,0.92)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
        padding: '14px 16px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
          <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: tileColor, fontFamily: MENU_FONT }}>{cur.title}</p>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.40)', fontFamily: MENU_FONT }}>{tutStep + 1} / {total}</span>
        </div>
        {cur.lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: '7px', margin: '4px 0', alignItems: 'flex-start' }}>
            <span style={{ color: tileColor, fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>·</span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'rgba(230,238,255,0.82)', fontFamily: MENU_FONT }}>{line}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            type="button"
            disabled={tutStep === 0}
            onClick={() => setTutStep(t => t - 1)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: '100px', color: tutStep === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
              fontSize: '14px', width: '28px', height: '28px', cursor: tutStep === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MENU_FONT,
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
          >‹</button>
          <button
            type="button"
            disabled={tutStep === total - 1}
            onClick={() => setTutStep(t => t + 1)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: '100px', color: tutStep === total - 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
              fontSize: '14px', width: '28px', height: '28px', cursor: tutStep === total - 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MENU_FONT,
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
          >›</button>
        </div>
      </div>
    </div>
  );
};

// ─── Cube-tile card sub-components ───────────────────────────────────────────

// Fills its container — animation classes applied to the wrapper div
const TileCardFace = ({ mode }) => (
  <div style={{
    width: '100%', height: '100%', boxSizing: 'border-box',
    background: '#0c0c1a', padding: '7px', borderRadius: '20px',
  }}>
    <div style={{
      background: mode.tileColor, borderRadius: '14px',
      width: '100%', height: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
      position: 'relative', overflow: 'hidden',
      boxShadow: ['inset 0 -6px 16px rgba(0,0,0,0.45)', 'inset 4px 4px 14px rgba(255,255,255,0.22)', 'inset -3px -3px 10px rgba(0,0,0,0.28)'].join(', '),
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '14px', pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, transparent 48%, rgba(0,0,0,0.14) 100%)' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', fontSize: 'clamp(26px,7vw,42px)', fontWeight: 900, lineHeight: 1, letterSpacing: '0.05em', fontFamily: "'Bungee', cursive", color: mode.textColor, textShadow: '0 2px 6px rgba(0,0,0,0.40)' }}>{mode.label}</div>
      <p style={{ position: 'relative', zIndex: 1, margin: 0, maxWidth: '160px', textAlign: 'center', fontSize: '11px', lineHeight: 1.45, fontFamily: MENU_FONT, color: mode.textColor === '#fff' ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.56)' }}>{mode.desc}</p>
    </div>
  </div>
);

// ─── Mode carousel overlay ────────────────────────────────────────────────────
const ModeCarousel = ({ onBack, onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onComingSoon, onHowToPlay }) => {
  const [activeIndex, setActiveIndex] = useState(0);   // logical index — dots + handlePlay
  const [displayIndex, setDisplayIndex] = useState(0); // visual index — colors + content
  const [rotationAngle, setRotationAngle] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [infoVisible, setInfoVisible] = useState(true);
  const [pendingTileColor, setPendingTileColor] = useState(CAROUSEL_MODES[0].tileColor);
  const touchStartX = useRef(null);
  const mouseStartX = useRef(null);
  const spinTimer = useRef(null);
  const fadeTimer = useRef(null);
  const activeIndexRef = useRef(0);
  const animatingRef = useRef(false);
  const N = CAROUSEL_MODES.length;

  activeIndexRef.current = activeIndex;

  useEffect(() => {
    _carouselActive = true;
    setCarouselActive(true);
    return () => {
      _carouselActive = false;
      setCarouselActive(false);
      if (spinTimer.current) clearTimeout(spinTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  const commitDisplay = useCallback((newDisplayIndex) => {
    setDisplayIndex(newDisplayIndex);
    setImgError(false);
    setImgLoaded(false);
    setInfoVisible(true);
    animatingRef.current = false;
  }, []);

  const navigate = useCallback((dir) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    if (spinTimer.current) clearTimeout(spinTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    const newIdx = (activeIndexRef.current + dir + N) % N;
    setPendingTileColor(CAROUSEL_MODES[newIdx].tileColor);
    setRotationAngle(a => a - dir * PRISM_FACE_ANGLE);
    setActiveIndex(newIdx);
    setInfoVisible(false);
    spinTimer.current = setTimeout(() => {
      commitDisplay(newIdx);
    }, 540);
  }, [N, commitDisplay]);

  const selectIndex = useCallback((targetIndex) => {
    if (animatingRef.current) return;
    const curr = activeIndexRef.current;
    if (targetIndex === curr) return;
    const forwardSteps = (targetIndex - curr + N) % N;
    const backwardSteps = (curr - targetIndex + N) % N;
    const steps = Math.min(forwardSteps, backwardSteps);
    const dir = forwardSteps <= backwardSteps ? 1 : -1;
    animatingRef.current = true;
    if (spinTimer.current) clearTimeout(spinTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setPendingTileColor(CAROUSEL_MODES[targetIndex].tileColor);
    setRotationAngle(a => a - dir * steps * PRISM_FACE_ANGLE);
    setActiveIndex(targetIndex);
    setInfoVisible(false);
    spinTimer.current = setTimeout(() => {
      commitDisplay(targetIndex);
    }, 540);
  }, [N, commitDisplay]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, onBack]);

  const handlePlay = useCallback(() => {
    const id = CAROUSEL_MODES[activeIndexRef.current].id;
    if (id === 'cube')             onCubeSelect?.();
    else if (id === 'worm')        onWormSelect?.();
    else if (id === 'chaos')       onChaos?.();
    else if (id === 'freeplay')    onFreeplay?.();
    else if (id === 'random')      onRandom?.();
    else if (id === 'coming-soon') onComingSoon?.();
    else if (id === 'how-to-play') onHowToPlay?.();
  }, [onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onComingSoon, onHowToPlay]);

  const active = CAROUSEL_MODES[displayIndex]; // drives panel colors + info content

  const arrowStyle = {
    background: 'rgba(0,0,0,0.42)', border: '1.5px solid rgba(255,255,255,0.65)',
    borderRadius: '50%', width: '42px', height: '42px', cursor: 'pointer', flexShrink: 0,
    color: '#fff', fontSize: '26px', lineHeight: 1, fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.40)',
    transition: 'background 140ms ease, border-color 140ms ease, transform 100ms ease',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        pointerEvents: 'auto',
      }}
    >
      {/* Backdrop layer: full-screen blur + dark overlay — kept separate from the
          scroll layer so backdrop-filter never shares an element with overflow:auto,
          which causes Chrome to mis-size the compositing layer to content height. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(4,6,18,0.97)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      }} />

      {/* Scroll layer: handles overflow and flex layout */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflowY: 'auto', zIndex: 1,
      }}>
      <MenuBackgroundOrbs />
      <style>{`
        .mode-arrow-btn:active { background: rgba(255,255,255,0.22) !important; transform: scale(0.90) !important; }
        .mode-play-btn:active  { opacity: 0.80; transform: scale(0.98); }
      `}</style>

      {/* ── Unified rainbow-bordered panel ── */}
      <div style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        width: 'min(390px, 96vw)',
        marginTop: 'max(20px, env(safe-area-inset-top, 20px))',
        marginBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        padding: '2px', borderRadius: '28px',
        background: '#0c0c1a',
        boxShadow: `0 24px 64px rgba(0,0,0,0.65)`,
        transition: 'box-shadow 540ms ease',
      }}>
        <div style={{
          borderRadius: '26px',
          backgroundColor: pendingTileColor,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -8px 28px rgba(0,0,0,0.18)',
          transition: 'background-color 540ms ease',
        }}>

          {/* ── Carousel section ── */}
          <div style={{ padding: '22px 10px 14px' }}>
            <p style={{
              margin: '0 0 18px', textAlign: 'center',
              fontSize: '9px', fontWeight: 800, letterSpacing: '0.30em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontFamily: "'Bungee', cursive",
            }}>Choose your mode</p>

            {/* Card row — swipe (touch) + drag (mouse) + arrow buttons */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', userSelect: 'none' }}
              onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                if (touchStartX.current === null) return;
                const delta = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) > 40) navigate(delta < 0 ? 1 : -1);
              }}
              onMouseDown={e => { mouseStartX.current = e.clientX; }}
              onMouseUp={e => {
                if (mouseStartX.current === null) return;
                const delta = e.clientX - mouseStartX.current;
                mouseStartX.current = null;
                if (Math.abs(delta) > 40) navigate(delta < 0 ? 1 : -1);
              }}
              onMouseLeave={() => { mouseStartX.current = null; }}
            >
              <button
                type="button"
                className="mode-arrow-btn"
                aria-label="Previous mode"
                onClick={() => navigate(-1)}
                style={arrowStyle}
              >‹</button>

              {/* 7-face heptagonal prism — all modes connected as one solid object */}
              <div style={{ perspective: '700px', flexShrink: 0, width: `${PRISM_W}px`, height: `${PRISM_H}px` }}>
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${rotationAngle}deg)`,
                  transition: 'transform 540ms cubic-bezier(0.25, 0, 0.35, 1)',
                  willChange: 'transform',
                }}>
                  {CAROUSEL_MODES.map((mode, i) => (
                    <div key={mode.id} style={{
                      position: 'absolute', inset: 0,
                      transform: `rotateY(${i * PRISM_FACE_ANGLE}deg) translateZ(${PRISM_R}px)`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}>
                      <TileCardFace mode={mode} />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mode-arrow-btn"
                aria-label="Next mode"
                onClick={() => navigate(1)}
                style={arrowStyle}
              >›</button>
            </div>

            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: '7px', marginTop: '16px', alignItems: 'center', justifyContent: 'center' }}>
              {CAROUSEL_MODES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show ${CAROUSEL_MODES[i].label} mode`}
                  onClick={() => selectIndex(i)}
                  style={{
                    width: i === activeIndex ? '20px' : '6px', height: '6px',
                    borderRadius: '100px', border: 'none', cursor: 'pointer', padding: 0,
                    background: i === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.30)',
                    transition: 'width 300ms cubic-bezier(0.34,1.56,0.64,1), background 300ms ease',
                    boxShadow: i === activeIndex ? '0 0 8px rgba(255,255,255,0.55)' : 'none',
                    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Thin divider ── */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.22)', margin: '0 14px' }} />

          {/* ── Info section ── */}
          <div style={{ padding: '14px 14px 0', opacity: infoVisible ? 1 : 0, transition: 'opacity 160ms ease', pointerEvents: infoVisible ? 'auto' : 'none' }}>

            {/* Screenshot card or how-to-play mini widget */}
            {active.id === 'how-to-play' ? (
              <HowToPlayMini tileColor={active.tileColor} />
            ) : (
              <div style={{ padding: '1.5px', borderRadius: '18px', background: '#0c0c1a', boxShadow: '0 8px 24px rgba(0,0,0,0.40)' }}>
                <div style={{
                  borderRadius: '16.5px', overflow: 'hidden',
                  background: 'rgba(4,6,20,0.88)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
                }}>
                  <div style={{
                    width: '100%', aspectRatio: '16/9',
                    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(14,18,42,0.95), rgba(4,6,20,0.98))',
                    overflow: 'hidden',
                  }}>
                    {!imgError && (
                      <img
                        key={active.id}
                        src={`${import.meta.env.BASE_URL}images/modes/${active.id}.jpg`}
                        alt={`${active.label} gameplay`}
                        style={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          objectFit: 'cover', display: 'block',
                          opacity: imgLoaded ? 1 : 0,
                          transition: 'opacity 200ms ease',
                        }}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgError(true)}
                      />
                    )}
                    {imgError && (
                      <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: MENU_FONT }}>
                        screenshot coming soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* How-to-play card — dark glass inside the colored panel */}
            <div style={{ marginTop: '10px', padding: '2px', borderRadius: '18px', background: '#0c0c1a' }}>
              <div style={{
                padding: '14px 16px 16px', borderRadius: '16px',
                background: '#ffffff',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)', fontFamily: MENU_FONT }}>How to play</p>
                {active.controls.map((ctrl, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', margin: '5px 0', alignItems: 'flex-start' }}>
                    <span style={{ color: '#0c0c1a', fontSize: '14px', flexShrink: 0, lineHeight: 1.5 }}>·</span>
                    <span style={{ fontSize: '13px', lineHeight: 1.55, color: '#1a1a2e', fontFamily: MENU_FONT }}>{ctrl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div style={{ padding: '14px 14px max(16px, env(safe-area-inset-bottom, 16px))' }}>
            <button
              type="button"
              className="mode-play-btn"
              onClick={handlePlay}
              style={{
                display: 'block', width: '100%', padding: '16px', borderRadius: '100px',
                border: '1.5px solid rgba(255,255,255,0.55)',
                background: 'rgba(0,0,0,0.28)',
                color: '#fff', fontWeight: 800, fontSize: '14px', letterSpacing: '0.22em',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Bungee', cursive",
                boxShadow: '0 2px 16px rgba(0,0,0,0.30)',
                transition: 'background 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.42)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.80)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.28)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)'; }}
            >PLAY →</button>

            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'block', margin: '10px auto 0',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: '100px', padding: '9px 28px',
                color: 'rgba(255,255,255,0.60)', fontSize: '12px', fontWeight: 600,
                letterSpacing: '0.10em', cursor: 'pointer', fontFamily: MENU_FONT,
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)'; e.currentTarget.style.color = 'rgba(255,255,255,0.90)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; }}
            >← Back</button>
          </div>

        </div>
      </div>
      </div>{/* end scroll layer */}
    </div>,
    document.body
  );
};

// ─── Start button ─────────────────────────────────────────────────────────────
const MenuStartButton = ({ visible, onClick }) => (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 'max(120px, env(safe-area-inset-bottom, 120px))',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(16px)',
    transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
    pointerEvents: 'all',
  }}>
    <button
      type="button"
      className="worm-tactile-btn"
      onClick={onClick}
    >START</button>
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

export const MenuTitleCard = ({ visible }) => (
  <div style={{
    ...menuStyles.titleWrap,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-18px)',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ display: 'flex', transform: 'skewX(-5deg)' }}>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0s', color: '#ef4444' }}>W</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.15s', color: '#f97316' }}>O</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.30s', color: '#22c55e' }}>R</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.45s', color: '#3b82f6' }}>M</span>
      </div>
      <div className="worm-cube-sup">
        <div className="worm-cube-inner">
          <div className="worm-cube-face worm-cube-face--front">3</div>
          <div className="worm-cube-face worm-cube-face--right">3</div>
          <div className="worm-cube-face worm-cube-face--top">3</div>
          <div className="worm-cube-face worm-cube-face--back" />
          <div className="worm-cube-face worm-cube-face--left">3</div>
          <div className="worm-cube-face worm-cube-face--bottom" />
        </div>
      </div>
    </div>
  </div>
);


// ─── Ambient background orbs ─────────────────────────────────────────────────
const ORB_DEFS = [
  { color: '#3b82f6', top: '-18%',  left: '-12%',  size: '58vmax', anim: 'orbDrift1 30s ease-in-out infinite alternate',          opacity: 0.36 },
  { color: '#a855f7', bottom: '-22%',right: '-16%', size: '62vmax', anim: 'orbDrift2 36s ease-in-out infinite alternate',          opacity: 0.28 },
  { color: '#f97316', top: '15%',   right: '-18%',  size: '46vmax', anim: 'orbDrift3 24s ease-in-out infinite alternate',          opacity: 0.20 },
  { color: '#22c55e', bottom: '8%', left: '-14%',   size: '42vmax', anim: 'orbDrift1 28s ease-in-out infinite alternate-reverse',  opacity: 0.17 },
  { color: '#eab308', top: '44%',   left: '28%',    size: '36vmax', anim: 'orbDrift2 40s ease-in-out infinite alternate',          opacity: 0.13 },
  { color: '#7dd3fc', bottom: '18%',right: '22%',   size: '52vmax', anim: 'orbDrift3 44s ease-in-out infinite alternate-reverse',  opacity: 0.18 },
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
  onPlay: _onPlay, onLevels: _onLevels, onFreeplay, onRandom, onCoop: _onCoop, onTeach,
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

  useEffect(() => {
    _onShakeComplete = () => setShowCarousel(true);
    return () => { _onShakeComplete = null; };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999, pointerEvents: 'none' }}>
      <MenuBackgroundOrbs />
      <ScreenGlow />
      <MenuTitleCard visible={titleVisible} />
      {showCarousel ? (
        <ModeCarousel
          onBack={() => setShowCarousel(false)}
          onCubeSelect={onFreeplay}
          onWormSelect={onWormHealer}
          onChaos={onDisparity}
          onFreeplay={onFreeplay}
          onRandom={onRandom}
          onComingSoon={onComingSoon}
          onHowToPlay={onTeach}
        />
      ) : (
        <MenuStartButton visible={bottomVisible} onClick={() => { _externalShakeNeeded = true; }} />
      )}
    </div>
  );
};

export default MainMenu;
