import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, Text } from '@react-three/drei';
import { preloadFont } from 'troika-three-text';
import * as THREE from 'three';
// Bundled Bungee for the 3D face-plate labels. Troika (drei's Text) parses
// woff/ttf but not woff2, so point it at the woff build.
import bungeeWoffUrl from '@fontsource/bungee/files/bungee-latin-400-normal.woff';

// Warm troika's glyph atlas for the mode labels at module load so the first
// face's label renders instantly instead of popping in a frame late.
preloadFont(
  { font: bungeeWoffUrl, characters: 'WORMCUBESTORYCHAOSRANDE' },
  () => {}
);
import { makeCubies } from '../../game/cubeState.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import { ALL_TILE_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { bodyMaterialProps, pickCubeletViewStyle, LED_EDGE_MODES, PER_CUBELET_VIEW_STYLES } from '../../3d/cubeViewStyles.js';
import { updateSharedTime, getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import { vibrate } from '../../utils/audio.js';
import { warmDemoAssets } from '../../utils/preloadAssets.js';
import MenuFlipWave from './MenuFlipWave.jsx';
import MenuTileOverlay from './MenuTileOverlay.jsx';
import { ANTIPODAL_COLOR, DIR_TO_COLOR, RUBIKS_FACE_COLORS, readableInk } from '../../utils/constants.js';
import { UI_FONT, DISPLAY_FONT, NIGHT_BORDER, Z, UI_GOLD } from '../../utils/uiTheme.js';
import { TOUCH_TARGET } from '../ui/Button.jsx';

// ─── Randomizable style state — re-picked every time the user taps the cube ──
// biome is now included so its face palette appears in the rotation.
const _SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'custom');
const _TILE_KEYS   = ALL_TILE_STYLE_KEYS;

// Mutable state — rerandomizeMenuStyle() reassigns all three.
let _menuSchemeKey  = _SCHEME_KEYS[Math.floor(Math.random() * _SCHEME_KEYS.length)];
let _menuFaceStyles = {};
for (let f = 1; f <= 6; f++) {
  _menuFaceStyles[f] = _TILE_KEYS[Math.floor(Math.random() * _TILE_KEYS.length)];
}
let MENU_FACE_COLORS = COLOR_SCHEMES[_menuSchemeKey] ?? COLOR_SCHEMES['classic']; // { 1: hex, 2: hex, ... }
// Seed for the per-cubelet whole-cube view styles (chrome, neon, gap, lego, …),
// mirroring Random Mode. Re-rolled on every cube tap so the styles reshuffle each time.
let _menuViewEpoch = Math.floor(Math.random() * 1e9);

// Called by RotatingBlackCube after a direct cube-tap shake.
// Also available externally so tests / storybook can reset state.
function rerandomizeMenuStyle() {
  _menuSchemeKey  = _SCHEME_KEYS[Math.floor(Math.random() * _SCHEME_KEYS.length)];
  MENU_FACE_COLORS = COLOR_SCHEMES[_menuSchemeKey] ?? COLOR_SCHEMES['classic'];
  for (let f = 1; f <= 6; f++) {
    _menuFaceStyles[f] = _TILE_KEYS[Math.floor(Math.random() * _TILE_KEYS.length)];
  }
  _menuViewEpoch = Math.floor(Math.random() * 1e9);
}

// Callback set by ShufflingCube so RotatingBlackCube can trigger a re-scramble
// + re-render without prop drilling through multiple layers.
let _triggerStyleRefresh = null;

import {
  setCarouselActive,
  setCarouselFace,
  getCarouselFace,
  subscribeCarouselActive,
  isCarouselActive,
  requestModeDive,
  consumeModeDive,
} from './menuCarouselState.js';

// ─── Carousel-active flag ─────────────────────────────────────────────────────
// menuCarouselState.js is the only home for it: every useFrame consumer here,
// in MenuFlipWave and in MenuWormParticle reads isCarouselActive(). A second
// copy of the flag in this module could fall out of step with the shared one
// and leave the selector's face plates up on a free-spinning cube.

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

// ─── Menu cube view-style geometry (mirrors Random Mode's per-cubelet styles) ──
const MENU_VIEW_STYLES = PER_CUBELET_VIEW_STYLES;

// Lego: one detailed stud per face — tapered body, embossed ring, center pip.
// The face group's +Y axis is rotated to the outward normal; the stud builds up +Y.
const MENU_STUD_BODY_GEO = [0.17, 0.18, 0.13, 22];
const MENU_STUD_RING_GEO = [0.12, 0.019, 8, 24];
const MENU_STUD_PIP_GEO = [0.046, 0.046, 0.045, 16];
const MENU_LEGO_FACE = {
  PZ: { pos: [0, 0, 0.47], rot: [Math.PI / 2, 0, 0] },
  NZ: { pos: [0, 0, -0.47], rot: [-Math.PI / 2, 0, 0] },
  PX: { pos: [0.47, 0, 0], rot: [0, 0, -Math.PI / 2] },
  NX: { pos: [-0.47, 0, 0], rot: [0, 0, Math.PI / 2] },
  PY: { pos: [0, 0.47, 0], rot: [0, 0, 0] },
  NY: { pos: [0, -0.47, 0], rot: [Math.PI, 0, 0] }
};
function MenuLegoStud({ dir, color }) {
  const t = MENU_LEGO_FACE[dir];
  if (!t) return null;
  return (
    <group position={t.pos} rotation={t.rot}>
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={MENU_STUD_BODY_GEO} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0} />
      </mesh>
      <mesh position={[0, 0.132, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={MENU_STUD_RING_GEO} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0} />
      </mesh>
      <mesh position={[0, 0.143, 0]}>
        <cylinderGeometry args={MENU_STUD_PIP_GEO} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0} />
      </mesh>
    </group>
  );
}

const ShuffleCubie = React.memo(({ cubie, hideStickers = false }) => {
  const cx = cubie.x - 1, cy = cubie.y - 1, cz = cubie.z - 1;
  // Each cubelet wears its own whole-cube view style, same as Random Mode.
  const vmode = pickCubeletViewStyle(cubie.x, cubie.y, cubie.z, _menuViewEpoch, MENU_VIEW_STYLES);
  // While the six-faces selector presents its mode plates, drop the stickers,
  // overlays, and studs: some tile styles draw discs that render in the
  // transparent pass and bleed through the plates as stray dots. The bare dark
  // cubie boxes stay so the cube keeps its silhouette behind the plates.
  const isWire = vmode === 'wireframe' || hideStickers;
  const isLego = vmode === 'lego';
  const showEdges = LED_EDGE_MODES.has(vmode);
  const contentScale = vmode === 'gap' ? 0.82 : 1;
  const bmp = bodyMaterialProps(vmode);
  const edgeColor = MENU_FACE_COLORS[1] ?? '#7df9ff';
  return (
    <group position={[cx, cy, cz]}>
      <group scale={contentScale}>
        <mesh>
          <boxGeometry args={[0.93, 0.93, 0.93]} />
          <meshStandardMaterial
            color={bmp.color}
            roughness={bmp.roughness}
            metalness={bmp.metalness}
            envMapIntensity={bmp.envMapIntensity}
            transparent={!!bmp.transparent}
            opacity={bmp.opacity ?? 1}
            emissive={bmp.emissive ?? '#000000'}
            emissiveIntensity={bmp.emissiveIntensity ?? 0}
          />
          {showEdges && <Edges color={edgeColor} />}
        </mesh>

        {/* Stickers — hidden in wireframe */}
        {!isWire && STICKER_CFG.map(({ dir, pos, rot }) => {
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

        {/* Lego stud on each face */}
        {isLego && !hideStickers && STICKER_CFG.map(({ dir }) => {
          const sticker = cubie.stickers?.[dir];
          if (!sticker) return null;
          const colorHex = MENU_FACE_COLORS[sticker.curr] ?? '#888888';
          return <MenuLegoStud key={`stud-${dir}`} dir={dir} color={colorHex} />;
        })}
      </group>
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
  // Drop the cube's stickers/overlays while the six-faces selector presents
  // its mode plates (prevents disc-drawing tile styles bleeding through them).
  const [hideStickers, setHideStickers] = useState(isCarouselActive());
  useEffect(() => subscribeCarouselActive(setHideStickers), []);
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
  // The shared Canvas clock keeps advancing while a game is running, even
  // though this menu subtree is unmounted. Initialise against the first menu
  // frame rather than an absolute 2.5-second timestamp so a returning menu
  // does not immediately resume a long-overdue worm/rotation cycle.
  const nextSpawnAt      = useRef(null);

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
      nextSpawnAt.current = null;
      setStyleVersion(v => v + 1);
    };
    return () => { _triggerStyleRefresh = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    if (isCarouselActive()) return;
    const t = clock.elapsedTime;
    if (nextSpawnAt.current === null) nextSpawnAt.current = t + INITIAL_WORM_DELAY;
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
        <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} hideStickers={hideStickers} />
      ))}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => (
          <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} hideStickers={hideStickers} />
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
    if (!groupRef.current) return;
    // Hide the mascot while the six-faces selector owns the cube.
    if (isCarouselActive()) {
      groupRef.current.visible = false;
      return;
    }
    if (!groupRef.current.visible) groupRef.current.visible = true;
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
    const freq = isWiggle ? 8.5 : 3.0;
    const ampX = isWiggle ? 0.27 : 0.22;
    const ampZ = isWiggle ? 0.13 : 0.11;

    const hx = Math.sin(t * freq) * ampX;
    // Second harmonic on Z gives an organic figure-8 path so the body always has curvature to follow
    const hz = Math.sin(t * freq * 0.55 + 1.0) * ampZ + Math.sin(t * freq * 0.37 + 2.1) * ampZ * 0.45;

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

    // ── Body segments: path position + squash/stretch + vertical body-wave ───
    const bodyRefs = [seg1Ref, seg2Ref, seg3Ref, tailRef];
    bodyRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const pos     = _samplePath(path, (i + 1) * _SEG_SPACING);
      const segSpeed = speed * Math.max(0.35, 1 - i * 0.18);
      const stretch  = 1 + Math.min(segSpeed * 0.25, 0.25);
      const squash   = 1 / Math.sqrt(stretch);
      // Traveling wave ripples down the spine — phase advances per segment
      const yWave   = Math.sin(t * freq - (i + 1) * 0.55) * (isWiggle ? 0.04 : 0.018);
      ref.current.position.set(pos.x, _SEG_Y[i + 1] + yWave, pos.z);
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
      : Math.sin(t * freq * 0.28) * 0.045 + Math.sin(t * freq * 0.17 + 1.3) * 0.02);
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

// ─── Six-faces mode selector: face plates + presentation targets ──────────────
// While the carousel is open, each mode's plate covers its cube face and the
// cube slerps so the active mode's face looks at the camera. Plate rotations
// and cube target orientations are chosen together so every label reads
// upright when its face is presented.
const MODE_FACE_CFG = {
  PZ: { pos: [0, 0, 1.56], rot: [0, 0, 0] },
  NZ: { pos: [0, 0, -1.56], rot: [0, Math.PI, 0] },
  PX: { pos: [1.56, 0, 0], rot: [0, Math.PI / 2, 0] },
  NX: { pos: [-1.56, 0, 0], rot: [0, -Math.PI / 2, 0] },
  PY: { pos: [0, 1.56, 0], rot: [-Math.PI / 2, 0, 0] },
  NY: { pos: [0, -1.56, 0], rot: [Math.PI / 2, 0, 0] },
};
const FACE_TARGET_QUAT = {
  PZ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
  NZ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),
  PX: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)),
  NX: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
  PY: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
  NY: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
};
const _wobbleEuler = new THREE.Euler();
const _wobbleQ = new THREE.Quaternion();
const _presentQ = new THREE.Quaternion();
const DIVE_DURATION = 0.6; // seconds — PLAY accelerates the face into the camera

// ─── Menu cube scale ─────────────────────────────────────────────────────────
// The idle menu cube renders 20% smaller than it used to: at full size it
// crowded the wordmark above it and ran under the START pill below, leaving no
// air anywhere in the frame. Dollying the camera back would have done the same
// job optically — the backdrop is a panorama at infinity, so pulling back only
// shrinks the cube — but the mode carousel borrows this same camera, and its
// cube is presenting a face and wants the frame. Scaling the group instead
// keeps that one untouched.
//
// The three idle poses stay in proportion to each other; only their common
// factor moved. Carousel and dive scales are deliberately not derived from
// these.
const MENU_CUBE_ZOOM = 0.8;
const MENU_REST_SCALE = 1.022 * MENU_CUBE_ZOOM;
const MENU_PRESS_SCALE = 0.968 * MENU_CUBE_ZOOM; // finger down on the cube
const MENU_SHAKE_SCALE = 0.950 * MENU_CUBE_ZOOM; // the shake that precedes play

// Bevel overlay: a top-left highlight and bottom-right shadow baked into a
// transparent texture, layered over the tile so the inset face reads as a
// raised, chamfered cube sticker lit from the upper-left.
function makeBevelTexture() {
  if (typeof document === 'undefined') return null;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const edge = s * 0.16;
  const strip = (grad, x, y, w, h) => { ctx.fillStyle = grad; ctx.fillRect(x, y, w, h); };
  let g = ctx.createLinearGradient(0, 0, 0, edge);          // top highlight
  g.addColorStop(0, 'rgba(255,255,255,0.60)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  strip(g, 0, 0, s, edge);
  g = ctx.createLinearGradient(0, 0, edge, 0);              // left highlight
  g.addColorStop(0, 'rgba(255,255,255,0.40)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  strip(g, 0, 0, edge, s);
  g = ctx.createLinearGradient(0, s, 0, s - edge);          // bottom shadow
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  strip(g, 0, s - edge, s, edge);
  g = ctx.createLinearGradient(s, 0, s - edge, 0);          // right shadow
  g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  strip(g, s - edge, 0, edge, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Gloss overlay: a soft elliptical sheen near the top of the tile, blended
// additively so the sticker looks glossy/wet without hiding the pattern.
function makeGlossTexture() {
  if (typeof document === 'undefined') return null;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(s * 0.5, s * 0.26, s * 0.04, s * 0.5, s * 0.3, s * 0.62);
  g.addColorStop(0, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.11)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Renders a beveled, glossy topographic-style tile on every cube face, with the
// mode LABEL on all six faces so the words wrap the whole cube. Fully opaque,
// depth-writing tiles occlude the faces behind them, so only the words on
// visible faces read — hidden faces are naturally masked by the front tile.
const ModeFacePlates = React.forwardRef((_props, rootRef) => {
  // Visibility is owned by RotatingBlackCube's frame loop (not React state, and
  // not a second useFrame here): the same frame that decides to present a mode
  // face turns the plates on. Two independent readers of the carousel flag
  // could disagree, and a frame with the plates up but the cube still in its
  // free-spin pose is the glitch — labels sliced by neighbouring plates on a
  // cube drifting off centre.
  const bevelTex = useMemo(() => makeBevelTexture(), []);
  const glossTex = useMemo(() => makeGlossTexture(), []);
  return (
    <group ref={rootRef} visible={false}>
      {CAROUSEL_MODES.map((m) => {
        const cfg = MODE_FACE_CFG[m.face];
        return (
          <group key={m.id} position={cfg.pos} rotation={cfg.rot}>
            {/* Dark bevel frame */}
            <mesh renderOrder={30}>
              <planeGeometry args={[3.12, 3.12]} />
              <meshBasicMaterial color="#070a18" />
            </mesh>
            {/* Mode color plate — topographic contour tile style */}
            <mesh position={[0, 0, 0.01]} renderOrder={31}>
              <planeGeometry args={[2.94, 2.94]} />
              <primitive object={getTileStyleMaterial('topographic', m.tileColor)} attach="material" />
            </mesh>
            {/* Bevel: top-left highlight / bottom-right shadow around the inset tile */}
            {bevelTex && (
              <mesh position={[0, 0, 0.018]} renderOrder={32}>
                <planeGeometry args={[2.94, 2.94]} />
                <meshBasicMaterial map={bevelTex} transparent depthWrite={false} toneMapped={false} />
              </mesh>
            )}
            {/* Gloss: soft sheen highlight across the upper face */}
            {glossTex && (
              <mesh position={[0, 0, 0.022]} renderOrder={33}>
                <planeGeometry args={[2.94, 2.94]} />
                <meshBasicMaterial map={glossTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
              </mesh>
            )}
            {/* Label on every face — the mode words wrap the whole cube */}
            <Text
              position={[0, 0, 0.03]}
              font={bungeeWoffUrl}
              fontSize={m.label.length > 5 ? 0.58 : 0.74}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#141631"
              renderOrder={34}
            >
              {m.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
});
ModeFacePlates.displayName = 'ModeFacePlates';

// ─── Rotating cube + worm mascot — exported for App.jsx's shared Canvas ───────
export const RotatingBlackCube = ({ onCubeClick, onFlip }) => {
  const cubeRef = useRef();
  const shaking = useRef(false);
  const shakeStart = useRef(0);
  const shakeIsExternalRef = useRef(false); // true = START button, false = direct tap
  const cubeTargetScale = useRef(MENU_REST_SCALE);
  const cubeCurrentScale = useRef(MENU_REST_SCALE);
  const onCubeClickRef = useRef(onCubeClick);
  onCubeClickRef.current = onCubeClick;
  // R3F's clock belongs to the persistent Canvas, not the menu. Keep a menu
  // epoch so returning from a long play session restarts the idle cube motion
  // instead of sampling an arbitrary point far along its animation path.
  const menuClockStart = useRef(null);
  const carouselWasActive = useRef(false);

  // ModeFacePlates is always mounted; this loop owns its visibility so the
  // plates and the cube's pose can never disagree.
  const platesRef = useRef();
  const diveRef = useRef(null); // { t, onComplete, done } during a PLAY dive

  useFrame((state, delta) => {
    if (!cubeRef.current) return;
    const elapsedTime = state.clock.elapsedTime;
    if (menuClockStart.current === null) menuClockStart.current = elapsedTime;
    const t = elapsedTime - menuClockStart.current;

    // One read per frame, shared by the pose below and the plates: the mode
    // plates are only ever on in a frame that also presents a mode face.
    const carouselActive = isCarouselActive();
    if (platesRef.current) platesRef.current.visible = carouselActive;

    if (carouselActive) {
      updateSharedTime(t);
      // Present the active mode's face: slerp toward its target orientation
      // with a slow breathing wobble so the cube stays alive while parked.
      const face = getCarouselFace() || 'PZ';
      _wobbleEuler.set(
        -0.13 + Math.sin(t * 0.9) * 0.035,
        0.20 + Math.sin(t * 0.7 + 1.7) * 0.045,
        0
      );
      _wobbleQ.setFromEuler(_wobbleEuler);
      _presentQ.multiplyQuaternions(_wobbleQ, FACE_TARGET_QUAT[face] ?? FACE_TARGET_QUAT.PZ);
      cubeRef.current.quaternion.slerp(_presentQ, 1 - Math.exp(-6 * delta));

      // Lift the cube clear of the info panel/PLAY button below. On portrait
      // (phone) screens the cube renders much larger and the panel eats more of
      // the viewport, so raise it further and shrink it a touch there.
      const portrait = state.size.height > state.size.width;
      // On portrait (phone) the presented mode cube sits higher with a large empty
      // gap below it, so drop it down into that space and size it up ~10%.
      const presentY = portrait ? 1.75 : 1.2;
      const presentScale = portrait ? 0.79 : 1.0;

      // The selector can open after the cube has been off-screen for a long
      // game. Snap to the requested face on entry instead of showing a frame
      // from the idle spin and slowly slerping across the viewport.
      if (!carouselWasActive.current) {
        cubeRef.current.quaternion.copy(_presentQ);
        cubeCurrentScale.current = 1.022 * presentScale;
        cubeTargetScale.current = cubeCurrentScale.current;
        cubeRef.current.scale.setScalar(cubeCurrentScale.current);
      }
      carouselWasActive.current = true;
      cubeRef.current.position.set(0, presentY + Math.sin(t * 0.8) * 0.045, 0);

      // PLAY dive: the presented face accelerates into the camera.
      if (!diveRef.current) {
        const req = consumeModeDive();
        if (req) diveRef.current = { t: 0, onComplete: req.onComplete, done: false };
      }
      if (diveRef.current) {
        const dive = diveRef.current;
        dive.t += delta;
        const p = Math.min(1, dive.t / DIVE_DURATION);
        cubeRef.current.scale.setScalar((1.022 + Math.pow(p, 3) * 7.5) * presentScale);
        if (p >= 1 && !dive.done) {
          dive.done = true;
          // Launching a mode runs a lot of app code. If it throws, it must not
          // take the rest of the frame loop's subscribers down with it.
          try {
            dive.onComplete?.();
          } catch (err) {
            console.error('[MainMenu] mode dive completion failed', err);
          }
        }
      } else {
        cubeCurrentScale.current += (1.022 * presentScale - cubeCurrentScale.current) * Math.min(1, delta * 10);
        cubeRef.current.scale.setScalar(cubeCurrentScale.current);
      }
      return;
    }

    carouselWasActive.current = false;

    // Carousel closed — clear any finished dive so idle animation resumes clean.
    if (diveRef.current) {
      diveRef.current = null;
      cubeCurrentScale.current = MENU_REST_SCALE;
      cubeTargetScale.current = MENU_REST_SCALE;
      cubeRef.current.scale.setScalar(MENU_REST_SCALE);
    }
    updateSharedTime(t);

    if (_externalShakeNeeded && !shaking.current) {
      _externalShakeNeeded = false;
      shakeIsExternalRef.current = true;
      shaking.current = true;
      shakeStart.current = Date.now();
      cubeTargetScale.current = MENU_SHAKE_SCALE;
    }

    cubeCurrentScale.current += (cubeTargetScale.current - cubeCurrentScale.current) * Math.min(1, delta * 18);
    cubeRef.current.scale.setScalar(cubeCurrentScale.current);

    if (shaking.current) {
      const elapsed = Date.now() - shakeStart.current;
      if (elapsed > 540) {
        shaking.current = false;
        cubeTargetScale.current = MENU_REST_SCALE;
        cubeRef.current.position.set(0, 0.45, 0);
        if (shakeIsExternalRef.current) {
          shakeIsExternalRef.current = false;
          _onShakeComplete?.();
        } else {
          vibrate(20);
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
  const handleCubeDown = () => { cubeTargetScale.current = MENU_PRESS_SCALE; };
  const handleCubeUp = () => { if (!shaking.current) cubeTargetScale.current = MENU_REST_SCALE; };

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
        {/* Always mounted (no mount-timing flash); the frame loop above shows
            the plates only on frames where it presents a mode face. */}
        <ModeFacePlates ref={platesRef} />
      </group>
    </>
  );
};

// ─── Mode carousel constants ──────────────────────────────────────────────────

// Six modes, six faces: each mode lives on the cube face whose canonical color
// matches its tileColor (red PZ, green NX, white PY, orange NZ, blue PX,
// yellow NY). Swiping the carousel rotates the live 3D menu cube to present
// that mode's face; PLAY dives through the face into the mode.
/**
 * Each mode owns a cube face, and its carousel colour is simply that face's
 * sticker colour — no longer a hand-picked hex per mode.
 *
 * The hand-picked set had drifted off the cube it is meant to represent: STORE
 * sat on PY, which is the WHITE face, but was rendering teal; and the red and
 * orange modes were #ef4444/#f97316, only ~25 degrees of hue apart at the same
 * lightness, so the two read as a pair of reds rather than as red and orange.
 * Deriving from RUBIKS_FACE_COLORS makes the carousel a picture of the cube,
 * and makes a wrong colour impossible to introduce by hand.
 *
 * `ink` is computed from the fill's luminance, which matters now that two faces
 * are light: every mode previously hardcoded white type, which on the yellow
 * face was already weak and on the new white face would have been invisible.
 */
const withFaceColor = (mode) => {
  const tileColor = RUBIKS_FACE_COLORS[DIR_TO_COLOR[mode.face]];
  return { ...mode, tileColor, textColor: readableInk(tileColor) };
};

const CAROUSEL_MODES = [
  {
    id: 'worm', label: 'WORM', face: 'NX',
    desc: 'Steer a worm across a living cube and heal it one tile at a time.',
    controls: ['Steer the worm with cursor or touch', 'Every tile it crosses gets healed', 'Eat orbs to grow — and to earn points', 'Touch a dead tile and the run ends'],
    cta: 'PLAY',
  },
  {
    id: 'freeplay', label: 'CUBE', face: 'NY',
    desc: "A real Rubik's cube, built how you like it. No timer, no objective.",
    controls: ['Any size from 2×2 up to 7×7', 'Your palette, your tiles, your world', 'Drag a face edge to turn a slice', 'Tap a tile to send it through the cube'],
    cta: 'PLAY',
  },
  {
    id: 'cube', label: 'STORY', face: 'PX',
    desc: 'Ten chapters, daycare to the singularity, one new trick at a time.',
    controls: ['Ten chapters, each unlocking the next', 'One new idea per chapter', 'Mobi walks you in before every one', 'Beat par to take all three stars'],
    cta: 'PLAY',
  },
  {
    id: 'chaos', label: 'CHAOS', face: 'NZ',
    desc: 'The cube flips itself apart. Bet on how long you last.',
    controls: ['Tiles start flipping on their own', 'Stake Parity Points before you start', 'Pick your chaos level, 1 to 5', 'Last pair standing ends the run'],
    cta: 'PLAY',
  },
  {
    id: 'random', label: 'RANDOM', face: 'PZ',
    desc: 'The cube redecorates itself mid-solve. Try to keep up.',
    controls: ['New palette every 15 seconds', 'Tiles and cubelets morph as you play', 'Same puzzle, never the same twice', 'Solving through the churn is the point'],
    cta: 'PLAY',
  },
  {
    id: 'store', label: 'STORE', face: 'PY',
    desc: 'Turn Parity Points into worm skins, hats, palettes, and tiles.',
    controls: ['Collect orbs in Worm mode to earn', 'Win a Chaos bet for a bigger purse', 'Skins, hats, palettes, and tile styles', 'Everything you buy works in every mode'],
    cta: 'OPEN STORE',
  },
].map(withFaceColor);

// Non-mode destinations live in a small utility row under the carousel — they
// are not game modes and do not occupy cube faces.
const UTILITY_MODES = [
  { id: 'how-to-play', label: 'How to Play' },
  { id: 'learn-to-solve', label: 'Learn to Solve' },
];

const LAST_MODE_KEY = 'worm3_last_mode_id';

// ─── Mode carousel overlay ───────────────────────────────────────────────────
// Clean, single-card implementation. No overlapping absolutely-positioned tiles,
// no CSS transform transitions on positioned elements → no GPU compositor ordering
// issues on mobile Chrome.

export const ModeCarousel = ({ onBack, onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onStore, onComingSoon, onHowToPlay, onLearnToSolve }) => {
  // Open on the last-played mode so returning players are one tap from their game.
  const [activeIndex, setActiveIndex] = useState(() => {
    try {
      const idx = CAROUSEL_MODES.findIndex(m => m.id === localStorage.getItem(LAST_MODE_KEY));
      return idx >= 0 ? idx : 0;
    } catch { return 0; }
  });
  const [show, setShow] = useState(true);
  const [diving, setDiving] = useState(false);
  const touchStartX = useRef(null);
  const mouseStartX = useRef(null);
  const animatingRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  const timerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const divingRef = useRef(false);
  const N = CAROUSEL_MODES.length;
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    // A dive left in the mailbox by a previous session — PLAY pressed while the
    // frame loop was paused (backgrounded tab), so the fallback timer launched
    // the mode and nothing ever consumed the request — would otherwise fire the
    // instant this selector opens and blow the cube up to dive scale.
    consumeModeDive();
    setCarouselActive(true);
    setCarouselFace(CAROUSEL_MODES[activeIndexRef.current].face);
    return () => {
      setCarouselActive(false);
      setCarouselFace(null);
      consumeModeDive();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  // Rotate the live cube to the active mode's face; remember the pick.
  useEffect(() => {
    setCarouselFace(CAROUSEL_MODES[activeIndex].face);
    try { localStorage.setItem(LAST_MODE_KEY, CAROUSEL_MODES[activeIndex].id); } catch { /* storage unavailable */ }
  }, [activeIndex]);

  const navigate = useCallback((dir) => {
    if (animatingRef.current || divingRef.current) return;
    animatingRef.current = true;
    setShow(false);
    timerRef.current = setTimeout(() => {
      setActiveIndex(i => (i + dir + N) % N);
      setShow(true);
      animatingRef.current = false;
    }, 150);
  }, [N]);

  const selectIndex = useCallback((target) => {
    if (animatingRef.current || divingRef.current || target === activeIndexRef.current) return;
    animatingRef.current = true;
    setShow(false);
    timerRef.current = setTimeout(() => {
      setActiveIndex(target);
      setShow(true);
      animatingRef.current = false;
    }, 150);
  }, []);

  const launch = useCallback((id) => {
    if (id === 'cube')             onCubeSelect?.();
    else if (id === 'worm')        onWormSelect?.();
    else if (id === 'chaos')       onChaos?.();
    else if (id === 'freeplay')    onFreeplay?.();
    else if (id === 'random')      onRandom?.();
    else if (id === 'store')       onStore?.();
    else if (id === 'coming-soon') onComingSoon?.();
    else if (id === 'how-to-play') onHowToPlay?.();
    else if (id === 'learn-to-solve') onLearnToSolve?.();
  }, [onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onStore, onComingSoon, onHowToPlay, onLearnToSolve]);

  // PLAY: dive through the presented face, then launch. The 3D cube consumes
  // the dive request and fires the callback when the face fills the screen;
  // a fallback timer launches anyway if the canvas is unavailable.
  const handlePlay = useCallback(() => {
    if (divingRef.current) return;
    divingRef.current = true;
    setDiving(true);
    vibrate(18);
    const id = CAROUSEL_MODES[activeIndexRef.current].id;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      launch(id);
    };
    requestModeDive(fire);
    fallbackTimerRef.current = setTimeout(fire, 850);
  }, [launch]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Enter') handlePlay();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [navigate, handlePlay, onBack]);

  const mode = CAROUSEL_MODES[activeIndex];
  const opacity = show ? 1 : 0;

  const arrowStyle = {
    background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.30)',
    borderRadius: '50%', width: '44px', height: '44px', flexShrink: 0,
    color: '#fff', fontSize: '24px', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
    pointerEvents: 'auto',
  };

  const swipeHandlers = {
    onTouchStart: e => { touchStartX.current = e.touches[0].clientX; },
    onTouchEnd: e => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) > 40) { e.preventDefault(); navigate(delta < 0 ? 1 : -1); }
    },
    onMouseDown: e => { mouseStartX.current = e.clientX; },
    onMouseUp: e => {
      if (mouseStartX.current === null) return;
      const delta = e.clientX - mouseStartX.current;
      mouseStartX.current = null;
      if (Math.abs(delta) > 40) navigate(delta < 0 ? 1 : -1);
    },
    onMouseLeave: () => { mouseStartX.current = null; },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z.MENU, overflowY: 'auto' }}>

      {/* Edge vignette only — the center stays clear so the live 3D cube
          (rotating to the active mode's face) reads through the overlay. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 38%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 36%, rgba(2,3,10,0.50) 74%, rgba(2,3,10,0.85) 100%)',
      }} />

      <style>{`
        .mc-arrow:active { background: rgba(255,255,255,0.22) !important; }
        .mc-play:active  { opacity: 0.80 !important; transform: scale(0.98) !important; }
        /* 30px tall on their own padding — raised to the 44px floor without
           changing their width or type. */
        .mc-pill         { min-height: 44px; }
        .mc-pill:hover   { filter: brightness(1.14); }
        .mc-pill:active  { transform: scale(0.97); }
        .mc-cube-window { height: min(47vh, 415px); }
        @media (max-width: 600px) {
          .mc-cube-window { height: min(45vh, 395px); }
        }
      `}</style>

      {/* Scroll column — DOM fades out during the PLAY dive so the cube face
          filling the screen is the only thing left on it. */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minHeight: '100%', boxSizing: 'border-box',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        paddingLeft: '12px', paddingRight: '12px',
        opacity: diving ? 0 : 1,
        transition: 'opacity 420ms ease',
        pointerEvents: diving ? 'none' : 'auto',
      }}>

        <p style={{ margin: '0 0 6px', fontSize: 'clamp(10px, 3vw, 13px)', fontWeight: 900, letterSpacing: '0.24em', textTransform: 'uppercase', color: UI_GOLD, fontFamily: UI_FONT, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          Choose your mode
        </p>

        {/* Cube window — transparent stage for the live 3D cube behind this
            overlay. Swipe here (or use the arrows) to rotate the cube from
            face to face; every mode owns one of the six faces. */}
        <div
          {...swipeHandlers}
          className="mc-cube-window"
          style={{
            position: 'relative', width: 'min(560px, 96vw)',
            flexShrink: 0,
            userSelect: 'none', touchAction: 'pan-y',
          }}
        >
          <button type="button" className="mc-arrow" aria-label="Previous mode" onClick={() => navigate(-1)}
            style={{ ...arrowStyle, position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)' }}>&lsaquo;</button>
          <button type="button" className="mc-arrow" aria-label="Next mode" onClick={() => navigate(1)}
            style={{ ...arrowStyle, position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)' }}>&rsaquo;</button>
        </div>

        {/* Face map — one colored tile per cube face, tap to jump */}
        {/* The gap moves onto the buttons as transparent padding so the tap
            targets tile edge to edge instead of leaving 8px dead gutters
            between 12px dots. The coloured bar inside is unchanged, so the
            row looks identical — it is only the hit area that grows. */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginTop: 0 }}>
          {CAROUSEL_MODES.map((m, i) => (
            <button
              key={m.id} type="button" aria-label={`Show ${m.label} mode`} title={m.label}
              onClick={() => selectIndex(i)}
              className="ui-focusable"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: TOUCH_TARGET, padding: '0 4px',
                background: 'none', border: 'none', borderRadius: '8px',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: i === activeIndex ? '26px' : '12px', height: '12px',
                  borderRadius: '4px',
                  background: m.tileColor,
                  // No dimming at all. 0.45 pushed every inactive dot toward the
                  // scene behind it — the yellow face read as mustard, red and
                  // orange collapsed into one brown, and the white face came out
                  // grey, which is the one colour that cannot survive being
                  // faded. The active dot is already marked by width and glow,
                  // so opacity was carrying no load the shape was not.
                  opacity: 1,
                  boxShadow: i === activeIndex ? `0 0 10px ${m.tileColor}` : 'none',
                  transition: 'width 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease',
                }}
              />
            </button>
          ))}
        </div>

        {/* Mode info panel */}
        <div style={{ width: 'min(400px, 94vw)', marginTop: '10px', opacity, transition: 'opacity 150ms ease' }}>
          <div style={{
            borderRadius: '16px',
            background: 'linear-gradient(180deg, rgba(34,42,26,0.94), rgba(20,26,15,0.96))',
            border: `1px solid ${NIGHT_BORDER}`,
            padding: '14px 18px', position: 'relative', overflow: 'hidden',
          }} aria-label={`${mode.label} mode details`}>
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${mode.tileColor}, transparent 78%)` }} />
            {/* The one-line hook: what this mode actually is, in plain sentence
                case. The bullets below are the details, not the pitch. */}
            <p style={{ margin: 0, textAlign: 'center', fontSize: 'clamp(12px, 3.2vw, 13.5px)', lineHeight: 1.45, color: 'rgba(255,253,242,0.72)', fontFamily: UI_FONT, fontWeight: 500 }}>
              {mode.desc}
            </p>
            <div style={{ marginTop: '14px' }}>
              {mode.controls.map((ctrl, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', margin: '6px 0', alignItems: 'flex-start' }}>
                  <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '2px', background: mode.tileColor, boxShadow: `0 0 6px ${mode.tileColor}`, marginTop: '5px', flexShrink: 0 }} />
                  <span style={{ fontSize: 'clamp(10.5px, 2.8vw, 12px)', fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.5, textTransform: 'uppercase', color: 'rgba(255,253,242,0.86)', fontFamily: UI_FONT }}>{ctrl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ width: 'min(400px, 94vw)', marginTop: '12px' }}>
          <button
            type="button" className="mc-play" onClick={handlePlay}
            style={{
              display: 'block', width: '100%', padding: '15px', borderRadius: '100px',
              border: '1.5px solid rgba(255,255,255,0.55)',
              background: mode.tileColor, color: mode.textColor,
              fontWeight: 800, fontSize: '14px', letterSpacing: '0.22em',
              textTransform: 'uppercase', cursor: 'pointer', fontFamily: DISPLAY_FONT,
              boxShadow: '0 2px 16px rgba(0,0,0,0.30)',
              transition: 'opacity 160ms ease, transform 100ms ease, background 200ms ease',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
          >{mode.cta || 'PLAY'}</button>

          {/* Utility row — destinations that are not game modes. The pills carry
              the active mode's colour (a translucent fill + solid rim of
              mode.tileColor) so they read as the same system as the PLAY button
              above, just quieter. */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
            {UTILITY_MODES.map((u) => (
              <button
                key={u.id} type="button" className="mc-pill" onClick={() => launch(u.id)}
                style={{
                  background: `${mode.tileColor}26`, border: `1.5px solid ${mode.tileColor}`,
                  borderRadius: '100px', padding: '8px 18px',
                  color: PILL_INK, fontSize: '11.5px', fontWeight: 700,
                  letterSpacing: '0.08em', cursor: 'pointer', fontFamily: MENU_FONT,
                  transition: 'filter 160ms ease, background 160ms ease',
                  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}
              >{u.label}</button>
            ))}
            <button
              type="button" className="mc-pill" onClick={onBack}
              style={{
                background: `${mode.tileColor}26`, border: `1.5px solid ${mode.tileColor}`,
                borderRadius: '100px', padding: '8px 18px',
                color: PILL_INK, fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '0.08em', cursor: 'pointer', fontFamily: MENU_FONT,
                transition: 'filter 160ms ease, background 160ms ease',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >Back</button>
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── Start button ─────────────────────────────────────────────────────────────
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScYKKOXc6c3vdqpmWWv0J3lMd90-GOfp0TxxxHelxjIjMdrvw/viewform';

const MenuStartButton = ({ visible, onClick, onDemo }) => {
  // On phones the cluster sat ~120px off the bottom, leaving a big dead gap.
  // Drop it near the bottom in portrait; keep the roomier desktop spacing.
  const [portrait, setPortrait] = React.useState(
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  React.useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const padBottom = portrait
    ? 'max(40px, env(safe-area-inset-bottom, 40px))'
    : 'max(120px, env(safe-area-inset-bottom, 120px))';
  return (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: padBottom,
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    gap: '14px',
    zIndex: 4,
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(16px)',
    transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
    pointerEvents: 'all',
  }}>
    <button
      type="button"
      className="worm-tactile-btn"
      onClick={onClick}
    >
      START
      <span className="worm-cta-glyph" aria-hidden="true">&#9654;</span>
    </button>
    {onDemo && (
      <button
        type="button"
        onClick={onDemo}
        // Warm the demo's desert env map the instant the player signals intent,
        // so it's cached by the time the demo scene mounts.
        onPointerEnter={warmDemoAssets}
        onPointerDown={warmDemoAssets}
        // Secondary action — the same green as START (one action colour), but
        // dropped down it, so START stays the loud CTA. Surface, rim, bevel and
        // press live in .worm-menu-cta-secondary; anything set here would
        // outrank the class and silently disable it.
        className="worm-menu-cta-secondary"
        style={{
          fontSize: '15px',
          fontWeight: 800,
          fontFamily: UI_FONT,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >Start Demo</button>
    )}
    <button
      type="button"
      className="worm-menu-cta-secondary"
      onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
      // Same green family as START, smallest of the three so the hierarchy is
      // START → Start Demo → Give Feedback while all read as one action colour.
      style={{
        // Quietest of the three — ranked by type size, not by opacity: fading
        // the element fades its rim too, and on a glass sheet the rim is what
        // separates the pill from the scene showing through it.
        fontSize: '13px',
        fontWeight: 700,
        fontFamily: UI_FONT,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >Give Feedback</button>
  </div>
  );
};

// The utility pills are a 15%-alpha tint of the mode colour over the live
// scene, i.e. they are dark whatever the mode is — so their ink is fixed light
// rather than mode.textColor. textColor answers "what reads on a tile FILLED
// with this colour", which is the opposite question, and following it here put
// near-black type on a dark backdrop the moment the white face was added.
const PILL_INK = 'rgba(255, 253, 242, 0.92)';

const MENU_FONT = UI_FONT;
const menuStyles = {
  titleWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
    paddingLeft: '16px', paddingRight: '16px',
    zIndex: 4,
    transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
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
        <span className="worm-title-letter" style={{ '--bounce-delay': '0s', color: '#ef4444', '--glow': 'rgba(239,68,68,0.55)' }}>W</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.15s', color: '#f97316', '--glow': 'rgba(249,115,22,0.55)' }}>O</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.30s', color: '#22c55e', '--glow': 'rgba(34,197,94,0.55)' }}>R</span>
        <span className="worm-title-letter" style={{ '--bounce-delay': '0.45s', color: '#3b82f6', '--glow': 'rgba(59,130,246,0.55)' }}>M</span>
      </div>
      <div className="worm-cube-sup">
        <div className="worm-cube-inner">
          <div className="worm-cube-face worm-cube-face--front">3</div>
          <div className="worm-cube-face worm-cube-face--right">3</div>
          <div className="worm-cube-face worm-cube-face--top">3</div>
          <div className="worm-cube-face worm-cube-face--back">3</div>
          <div className="worm-cube-face worm-cube-face--left">3</div>
          <div className="worm-cube-face worm-cube-face--bottom">3</div>
        </div>
      </div>
    </div>
    {/* One line of eyebrow type, ruled on both sides. It fills the gap between
        the wordmark and the cube and answers the question a first-time player
        actually has: what is the cube in front of me doing? */}
    <div className="worm-menu-tagline">Flip through the cube</div>
  </div>
);

// ─── Backdrop ─────────────────────────────────────────────────────────────────
// The menu draws over whatever environment the 3D scene happened to load, and
// those backdrops are bright, busy and mid-tone — the same range the wordmark,
// the cube and the CTAs live in, which is why nothing separated from anything.
// This stages the shot: a warm key light behind the cube, a vignette that drops
// the corners, and a scrim at each end to seat the title and the button stack.
// Purely presentational, and pointer-transparent, so the cube underneath keeps
// its tap-to-restyle and shake-to-play behaviour.
const MenuBackdrop = ({ visible }) => (
  <div
    className="worm-menu-backdrop"
    aria-hidden="true"
    style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.9s ease'
    }}
  >
    <div className="worm-menu-stagelight" />
    <div className="worm-menu-vignette" />
    <div className="worm-menu-scrim-top" />
    <div className="worm-menu-scrim-bottom" />
  </div>
);


// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({
  onPlay: _onPlay, onLevels: _onLevels, onFreeplay: _onFreeplay, onRandom: _onRandom, onCoop: _onCoop, onTeach: _onTeach,
  onSettings: _onSettings, onBiome: _onBiome, onDisparity: _onDisparity,
  onWormHealer: _onWormHealer, onHolonomy: _onHolonomy, onMerge: _onMerge,
  onStore: _onStore, onComingSoon: _onComingSoon, onMobiusCubelet: _onMobiusCubelet, onOpenModeSelect,
  onDemo,
}) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t3 = setTimeout(() => setBottomVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    _onShakeComplete = () => onOpenModeSelect?.();
    return () => { _onShakeComplete = null; };
  }, [onOpenModeSelect]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999, pointerEvents: 'none' }}>
      <MenuBackdrop visible={titleVisible} />
      <MenuTitleCard visible={titleVisible} />
      <MenuStartButton visible={bottomVisible} onClick={() => { _externalShakeNeeded = true; }} onDemo={onDemo} />
    </div>
  );
};

export default MainMenu;
