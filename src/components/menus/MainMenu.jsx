import CarouselWorm from './CarouselWorm.jsx';
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
import MenuGridGlow from './MenuGridGlow.jsx';
import { ANTIPODAL_COLOR, DIR_TO_COLOR, RUBIKS_FACE_COLORS, readableInk } from '../../utils/constants.js';
import { UI_FONT, DISPLAY_FONT, PAPER_SHEET, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BORDER, PAPER_BORDER_SOFT, PAPER_BG_MUTED, Z } from '../../utils/uiTheme.js';
import { TOUCH_TARGET } from '../ui/Button.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import { progressManager } from '../../levels/ProgressManager.js';

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
  setCarouselStage,
  getCarouselStage,
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

  // The grid glow is split the same way the cubies are, so the light on a
  // turning slice rides with it inside sliceGroupRef instead of staying behind
  // on the rest frame. `rotating` is one object for the length of a turn, so
  // these rebuild once per turn rather than per frame.
  const staticGlowFilter = useMemo(() => {
    if (!rotating) return undefined; // whole cube
    const prop = AX_PROP[rotating.ax], sl = rotating.sl;
    return (x, y, z) => ({ x, y, z })[prop] !== sl;
  }, [rotating]);
  const sliceGlowFilter = useMemo(() => {
    if (!rotating) return null;
    const prop = AX_PROP[rotating.ax], sl = rotating.sl;
    return (x, y, z) => ({ x, y, z })[prop] === sl;
  }, [rotating]);

  return (
    <>
      {staticCubies.map(c => (
        <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} hideStickers={hideStickers} />
      ))}
      {/* The teaching rim, standing still — see MenuGridGlow. Off while the
          carousel presents its mode plates, for the same reason the stickers
          are: nothing should draw over the plates. */}
      {!hideStickers && <MenuGridGlow size={3} includeCubie={staticGlowFilter} />}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => (
          <ShuffleCubie key={`${c.x}-${c.y}-${c.z}-${styleVersion}`} cubie={c} hideStickers={hideStickers} />
        ))}
        {!hideStickers && sliceGlowFilter && <MenuGridGlow size={3} includeCubie={sliceGlowFilter} />}
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

// ─── Idle spin ───────────────────────────────────────────────────────────────
// The cube pirouettes on its own corner: its (1,1,1) body diagonal is aimed
// down +Z at the camera, and it turns about that diagonal at a steady rate.
// Three faces meet at the corner pointed at the player, which is the pose that
// shows the tile grid off best — the light coming out of the seams reads as
// three lit planes rather than one flat one.
//
// A pirouette on a fixed axis would only ever show those three faces, so the
// axis itself drifts: a slow yaw carries it right around, and a slow nod tips
// it, which walks the cube through its other corners and brings every face
// past the camera in turn. The drift is deliberately several times slower than
// the spin — it is the thing you notice second, not a return of the old tumble.
//
// Composition is drift ∘ spin ∘ align, applied by premultiplying outward.
// Everything here is module-level so the frame loop allocates nothing.
const _DIAG_AXIS = new THREE.Vector3(0, 0, 1);
const _DIAG_ALIGN_Q = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(1, 1, 1).normalize(),
  new THREE.Vector3(0, 0, 1)
);
const _spinQ = new THREE.Quaternion();
const _driftEuler = new THREE.Euler();
const _driftQ = new THREE.Quaternion();
const DIAG_SPIN_RATE = 0.32; // rad/s — a full turn in roughly twenty seconds
const DRIFT_YAW_RATE = 0.075; // rad/s — the spin axis comes right around in ~84s
const DRIFT_NOD_RATE = 0.043; // rad/s — and tips, on a period that does not
const DRIFT_NOD_AMP = 0.60; //   divide the yaw's, so the pose never quite repeats

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

// ─── Contact shadow ──────────────────────────────────────────────────────────
// The mode face is 3.12 world units across, so half a cube is 1.56 — that is
// how far below the centre the cube's bottom edge sits when a face is squared
// up to the camera. The pool then drops a little further so it reads as ground
// the cube is above rather than as a skirt welded to it, and spreads wider than
// the cube so the falloff has somewhere to go.
const CUBE_HALF = 1.56;
const SHADOW_DROP = 0.14;
const SHADOW_SPREAD = 3.5;
const SHADOW_SQUASH = 0.30;
// How much of the grown stage is kept clear beneath the cube, in CSS pixels, so
// the pool has somewhere to be. Read as a lift applied to the cube.
const SHADOW_BAND_PX = 26;
// Fraction of the stage's spare height the cube actually takes. The rest is what
// keeps it off the dots below it.
const STAGE_GAIN_DAMPING = 0.62;

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

// Contact shadow: a soft dark pool the presented cube sits on. Without it the
// cube floats in front of whatever photograph the scene picked, with nothing
// under it — which is what made the space below read as a hole rather than as
// deliberate air. A radial falloff, squashed into an ellipse by the mesh scale.
function makeContactShadowTexture() {
  if (typeof document === 'undefined') return null;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  // Two inner stops rather than one: a single linear falloff reads as a grey
  // disc with a hard-ish rim, and a shadow wants a dense core that gives out
  // well before the edge of its own geometry.
  g.addColorStop(0.00, 'rgba(0,0,0,0.46)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.30)');
  g.addColorStop(0.70, 'rgba(0,0,0,0.08)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
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

// Renders a beveled, glossy solid-color tile on every cube face, with the
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
            {/* Mode color plate — plain Rubik’s-style sticker */}
            <mesh position={[0, 0, 0.01]} renderOrder={31}>
              <planeGeometry args={[2.94, 2.94]} />
              <meshBasicMaterial color={m.tileColor} />
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
  // The contact shadow is a sibling of the cube group, not a child: it must stay
  // flat on the floor while the cube above it tumbles.
  const shadowRef = useRef();
  const contactShadowTex = useMemo(() => makeContactShadowTexture(), []);
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
      let presentY = portrait ? 1.75 : 1.2;
      let presentScale = portrait ? 0.79 : 1.0;

      // Grow into whatever height the DOM stage actually claimed. The overlay
      // measures itself and posts { height, baseline } (see menuCarouselState);
      // scaling by their ratio means a stage that did not grow reproduces the
      // framing above exactly, and only genuine free space changes anything.
      //
      // The stage's top edge is pinned by the header, so all of its growth
      // happens below: its centre drops by half the gain, and the cube follows
      // it down rather than drifting up out of its own window.
      const stage = getCarouselStage();
      const worldPerPx = state.viewport.height / state.size.height;
      if (stage && stage.baseline > 0 && stage.height > stage.baseline) {
        // Damped, not one-for-one. The cube's bottom edge already sat right on
        // the face-colour dots at the old size, so handing it every pixel of the
        // gain walks it straight through them — and leaves nothing underneath
        // for the shadow that is supposed to ground it.
        const gain = Math.min(stage.height / stage.baseline, MAX_STAGE_GROWTH);
        const damped = 1 + (gain - 1) * STAGE_GAIN_DAMPING;
        presentScale *= damped;
        const grownPx = stage.baseline * (damped - 1);
        presentY -= (grownPx / 2) * worldPerPx;
      }
      // Float the cube just clear of the stage floor so the contact shadow has a
      // band to live in. Without this the pool renders behind the description
      // card, where it grounds nothing.
      presentY += SHADOW_BAND_PX * worldPerPx;

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

      // Park the contact shadow under the cube. It tracks the cube's settled
      // scale rather than its bobbing Y, so the pool stays put on the floor and
      // the cube reads as rising off it instead of dragging it along.
      if (shadowRef.current) {
        const settled = cubeCurrentScale.current;
        shadowRef.current.visible = true;
        shadowRef.current.position.set(0, presentY - CUBE_HALF * settled - SHADOW_DROP * settled, -0.2);
        shadowRef.current.scale.set(SHADOW_SPREAD * settled, SHADOW_SPREAD * SHADOW_SQUASH * settled, 1);
      }

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
    if (shadowRef.current) shadowRef.current.visible = false;

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
    // Reserve real space for the mobile heading and action stack. This is only
    // the idle home pose; the carousel/dive paths above keep their own framing.
    const { width, height } = state.size;
    const landscape = width > height && height <= 600;
    const heroTop = landscape ? 130 : height <= 740 ? 130 : 200;
    const heroBottom = landscape ? height - 16 : height - 320;
    const heroHeight = Math.max(64, heroBottom - heroTop);
    const homeScale = Math.min(1, heroHeight / (height * 4 / state.viewport.height));
    cubeRef.current.scale.setScalar(cubeCurrentScale.current * homeScale);
    const screenX = landscape ? -0.26 * state.viewport.width : 0;
    const screenY = (0.5 - (heroTop + heroBottom) / (2 * height)) * state.viewport.height;
    const basis = state.camera.matrixWorld.elements;
    const homeX = basis[0] * screenX + basis[4] * screenY;
    const homeY = basis[1] * screenX + basis[5] * screenY;
    const homeZ = basis[2] * screenX + basis[6] * screenY;

    if (shaking.current) {
      const elapsed = Date.now() - shakeStart.current;
      if (elapsed > 540) {
        shaking.current = false;
        cubeTargetScale.current = MENU_REST_SCALE;
        cubeRef.current.position.set(homeX, homeY, homeZ);
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
        cubeRef.current.position.x = homeX + Math.sin(t * 42) * intensity;
        cubeRef.current.position.y = homeY + Math.sin(t * 37 + 1) * intensity * 0.5;
        cubeRef.current.position.z = homeZ + Math.sin(t * 31 + 2) * intensity * 0.3;
      }
    } else {
      // A steady turn about the body diagonal, on an axis that itself drifts —
      // see the idle-spin constants. Replaces the old compound Euler wobble,
      // which tumbled the cube and never held a pose long enough for the lit
      // grid to read.
      _spinQ.setFromAxisAngle(_DIAG_AXIS, t * DIAG_SPIN_RATE);
      _driftEuler.set(Math.sin(t * DRIFT_NOD_RATE) * DRIFT_NOD_AMP, t * DRIFT_YAW_RATE, 0);
      _driftQ.setFromEuler(_driftEuler);
      cubeRef.current.quaternion.copy(_DIAG_ALIGN_Q).premultiply(_spinQ).premultiply(_driftQ);
      cubeRef.current.position.set(homeX, homeY, homeZ);
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
      {/* Ground for the presented cube. Outside the cube group on purpose: as a
          child it would inherit the tumble and swing up the wall. Hidden on
          every frame that is not presenting a mode face.
          renderOrder stays positive: a negative one draws the pool before the
          opaque backdrop, which then paints straight over it. */}
      {contactShadowTex && (
        <mesh ref={shadowRef} visible={false} renderOrder={20}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={contactShadowTex}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
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

// `desc` says what the mode is; `how` says how it ends, which is the question a
// one-liner kept leaving open ("solve it your way" — and then what?). `chips`
// are the two facts worth knowing before committing: how big the cube gets, and
// what kind of session it is.
const CAROUSEL_MODES = [
  {
    id: 'worm', label: 'WORM', face: 'NX',
    desc: 'Steer your worm through tunnels to heal the cube.',
    how: 'Heal every flipped tile before the worm runs out of room.',
    chips: ['2×2 – Mega', 'Arcade'],
    cta: 'PLAY',
  },
  {
    id: 'freeplay', label: 'CUBE', face: 'NY',
    desc: "Solve a cube your way, with no time limit.",
    how: 'Done when all six faces show a single colour.',
    chips: ['2×2 – 7×7', 'Relaxed'],
    cta: 'PLAY',
  },
  {
    id: 'cube', label: 'STORY', face: 'PX',
    // No chapter count in the copy: it said "ten" while the campaign has had
    // twelve for some time. The chip carries the number now, derived from the
    // level data (see chipsFor) so it cannot drift again.
    desc: 'Learn one new trick at a time, chapter by chapter.',
    how: 'Clear a chapter to unlock the next one.',
    chips: ['Campaign', 'Guided'],
    cta: 'PLAY',
  },
  {
    id: 'chaos', label: 'CHAOS', face: 'NZ',
    desc: 'Predict the last surviving pair as the cube flips itself.',
    how: 'Back the pair that outlasts the rest to win Parity Points.',
    chips: ['2×2 – 7×7', 'Wager'],
    cta: 'PLAY',
  },
  {
    id: 'random', label: 'RANDOM', face: 'PZ',
    desc: 'Solve a cube that changes its look as you play.',
    how: 'Same goal as CUBE — the colours keep moving under you.',
    chips: ['2×2 – 7×7', 'Twist'],
    cta: 'PLAY',
  },
  {
    id: 'store', label: 'STORE', face: 'PY',
    desc: 'Spend Parity Points on worms, skins, and tile styles.',
    how: 'Earn points by playing; everything you buy is yours for good.',
    chips: ['No cube', 'Cosmetic'],
    cta: 'OPEN STORE',
  },
].map(withFaceColor);

const LAST_MODE_KEY = 'worm3_last_mode_id';

// ─── Per-mode stats ──────────────────────────────────────────────────────────
// What the card can honestly say about your history with a mode.
//
// Almost nothing is recorded per mode anywhere in the game: STORY has real
// progress through ProgressManager, STORE has the wallet and your purchases,
// and every other mode has only the play count this menu itself keeps (see
// modesSlice's modePlays). So rather than invent a stat line per mode, each one
// reports whichever of those it actually has, and a mode you have never opened
// says so instead of showing a row of zeroes.
const RELATIVE_DAY = [
  [0, 'Today'],
  [1, 'Yesterday'],
];
const lastPlayedLabel = (ts, now = Date.now()) => {
  if (!ts) return null;
  const days = Math.floor((now - ts) / 86400000);
  if (days < 0) return 'Today';           // clock moved backwards; do not say "-3d ago"
  for (const [n, label] of RELATIVE_DAY) if (days === n) return label;
  if (days < 7) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 7)}w ago`;
  return 'A while ago';
};

/**
 * Two short facts for a mode's card, or an empty list when there is nothing
 * true to say yet.
 *
 * @param mode     the CAROUSEL_MODES entry
 * @param ctx      { plays, story: { completed, total, stars }, points, owned }
 * @returns        [{ label, value }] — at most two
 */
/**
 * The mode's chips, with any count resolved against live data rather than
 * hardcoded. STORY is the one that needs it — its chapter count is level data,
 * and the description used to state it from memory and be wrong.
 */
export function chipsFor(mode, ctx) {
  if (mode.id === 'cube' && ctx?.story?.total > 0) {
    return [`${ctx.story.total} chapters`, ...mode.chips.slice(1)];
  }
  return mode.chips;
}

export function modeStatItems(mode, ctx) {
  const play = ctx.plays?.[mode.id];
  const stats = [];

  if (mode.id === 'cube') {
    stats.push({ label: 'Chapters', value: `${ctx.story.completed}/${ctx.story.total}` });
    if (ctx.story.stars > 0) stats.push({ label: 'Stars', value: `${ctx.story.stars}★` });
    return stats;
  }

  if (mode.id === 'store') {
    stats.push({ label: 'Balance', value: `${ctx.points.toLocaleString()} PP` });
    if (ctx.owned > 0) stats.push({ label: 'Owned', value: String(ctx.owned) });
    return stats;
  }

  if (!play) return [];
  stats.push({ label: 'Played', value: play.plays === 1 ? 'Once' : `${play.plays}×` });
  const last = lastPlayedLabel(play.lastPlayed);
  if (last) stats.push({ label: 'Last', value: last });
  return stats;
}

// ─── Cube stage sizing ───────────────────────────────────────────────────────
// The height the cube window gets before it is allowed to grow. These are the
// values the stylesheet used to hold; they moved into JS so the DOM measurement
// and the 3D cube's scale are driven by one source of truth rather than by a
// media query one side cannot read.
const stageBaselineFor = (w, h) => (w <= 600 ? Math.min(0.45 * h, 395) : Math.min(0.47 * h, 415));
// A ceiling on how far the stage may stretch. Without it a very tall, narrow
// window would hand the cube the whole column and crowd the controls it is
// supposed to be giving room to.
const MAX_STAGE_GROWTH = 1.45;

// ─── Mode carousel overlay ───────────────────────────────────────────────────
// Clean, single-card implementation. No overlapping absolutely-positioned tiles,
// no CSS transform transitions on positioned elements → no GPU compositor ordering
// issues on mobile Chrome.

export const ModeCarousel = ({ onBack, onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onStore, onComingSoon }) => {
  // Open on the last-played mode so returning players are one tap from their game.
  const [activeIndex, setActiveIndex] = useState(() => {
    try {
      const idx = CAROUSEL_MODES.findIndex(m => m.id === localStorage.getItem(LAST_MODE_KEY));
      return idx >= 0 ? idx : 0;
    } catch { return 0; }
  });
  const [show, setShow] = useState(true);
  const [diving, setDiving] = useState(false);

  // Stats for the card. STORY's progress lives outside the store in
  // ProgressManager, so it is read once on open rather than subscribed to —
  // nothing can complete a chapter while this overlay is up.
  const modePlays = useGameStore(s => s.modePlays);
  const parityPoints = useGameStore(s => s.parityPoints);
  const ownedItems = useGameStore(s => s.ownedItems);
  const recordModePlay = useGameStore(s => s.recordModePlay);
  // STORY's progress lives outside the store, in ProgressManager. Read once on
  // open rather than subscribed to: nothing can complete a chapter while this
  // overlay is up. A static import costs nothing here — useLevelSystem already
  // puts the level catalogue on the initial route — and reading it synchronously
  // avoids the chip visibly changing from its placeholder a frame later.
  const storyProgress = useMemo(() => {
    try {
      const summary = progressManager.getProgressSummary();
      return { completed: summary.completedLevels, total: summary.totalLevels, stars: summary.totalStars };
    } catch {
      return { completed: 0, total: 0, stars: 0 };
    }
  }, []);

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
  }, [onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onStore, onComingSoon]);

  // PLAY: dive through the presented face, then launch. The 3D cube consumes
  // the dive request and fires the callback when the face fills the screen;
  // a fallback timer launches anyway if the canvas is unavailable.
  const handlePlay = useCallback(() => {
    if (divingRef.current) return;
    divingRef.current = true;
    setDiving(true);
    vibrate(18);
    const id = CAROUSEL_MODES[activeIndexRef.current].id;
    recordModePlay(id);
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      launch(id);
    };
    requestModeDive(fire);
    fallbackTimerRef.current = setTimeout(fire, 850);
  }, [launch, recordModePlay]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('button, a, input, select, textarea'))) handlePlay();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [navigate, handlePlay, onBack]);

  // The stage measures itself and posts its height to the cube behind it. A
  // ResizeObserver rather than a resize listener: the height is flex-derived, so
  // it also changes when something else in the column grows (a longer mode
  // description, a stat row appearing), not only when the window resizes.
  const stageRef = useRef(null);
  const [stageBaseline, setStageBaseline] = useState(
    () => stageBaselineFor(window.innerWidth, window.innerHeight)
  );
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const publish = () => {
      const baseline = stageBaselineFor(window.innerWidth, window.innerHeight);
      setStageBaseline(baseline);
      setCarouselStage({ height: el.getBoundingClientRect().height, baseline });
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      // Leave no stale height behind: the cube reads this on its next carousel
      // frame, and a measurement from a closed overlay is not a stage.
      setCarouselStage(null);
    };
  }, []);

  const mode = CAROUSEL_MODES[activeIndex];
  const modeChips = useMemo(() => chipsFor(mode, { story: storyProgress }), [mode, storyProgress]);
  const statItems = useMemo(
    () => modeStatItems(mode, {
      plays: modePlays,
      story: storyProgress,
      points: parityPoints ?? 0,
      owned: ownedItems?.length ?? 0,
    }),
    [mode, modePlays, storyProgress, parityPoints, ownedItems]
  );
  const opacity = show ? 1 : 0;

  const arrowStyle = {
    background: PAPER_SHEET, border: `1.5px solid ${PAPER_BORDER}`,
    borderRadius: '50%', width: '48px', height: '48px', flexShrink: 0,
    color: PAPER_TEXT, fontSize: '24px', lineHeight: 1,
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
        background: 'radial-gradient(circle at 50% 38%, rgba(245,240,232,0) 0%, rgba(245,240,232,0) 36%, rgba(245,240,232,0.78) 74%, rgba(245,240,232,0.97) 100%)',
      }} />

      <style>{`
        .mc-arrow:active { background: #ede8df !important; }
        .mc-play:active  { opacity: 0.80 !important; transform: scale(0.98) !important; }
        /* Keep utility actions comfortable to tap on phones. */
        .mc-pill         { min-height: 48px; }
        .mc-pill:hover   { filter: brightness(1.14); }
        .mc-pill:active  { transform: scale(0.97); }
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: 'min(560px, 100%)', minHeight: 48 }}>
            <button
              type="button" className="mc-pill" onClick={onBack}
              style={{
                background: PAPER_SHEET, border: `1.5px solid ${PAPER_BORDER}`,
                borderRadius: '100px', padding: '8px 18px',
                color: PAPER_TEXT, fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '0.08em', cursor: 'pointer', fontFamily: MENU_FONT,
                transition: 'filter 160ms ease, background 160ms ease',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >Back</button>
        <p style={{ margin: 0, fontSize: 'clamp(10px, 3vw, 13px)', fontWeight: 900, letterSpacing: '0.24em', textTransform: 'uppercase', color: PAPER_TEXT, fontFamily: UI_FONT, background: PAPER_SHEET, border: `1px solid ${PAPER_BORDER}`, borderRadius: '100px', padding: '8px 16px' }}>
          Choose your mode
        </p>
        </div>

        {/* Cube window — transparent stage for the live 3D cube behind this
            overlay. Swipe here (or use the arrows) to rotate the cube from
            face to face; every mode owns one of the six faces. */}
        <div
          {...swipeHandlers}
          ref={stageRef}
          className="mc-cube-window"
          style={{
            position: 'relative', width: 'min(560px, 96vw)',
            // The stage used to be a fixed height that refused to shrink, so a
            // tall viewport's leftover pixels fell past it and pooled as dead
            // space above PLAY. Growing into that space is what turns the gap
            // into a bigger cube. The old height stays as the floor, so nothing
            // about a short screen changes.
            flex: '1 1 auto', minHeight: stageBaseline, maxHeight: stageBaseline * MAX_STAGE_GROWTH,
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
                  // faded. The active dot is already marked by width and outline,
                  // so opacity was carrying no load the shape was not.
                  opacity: 1,
                  boxShadow: i === activeIndex ? `0 0 0 2px ${PAPER_TEXT}` : `0 0 0 1px ${PAPER_BORDER}`,
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
            background: PAPER_SHEET,
            border: `1px solid ${PAPER_BORDER}`,
            padding: '14px 18px', position: 'relative', overflow: 'hidden',
          }} aria-label={`${mode.label} mode details`}>
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${mode.tileColor}, transparent 78%)` }} />
            {/* What the mode is. */}
            <p style={{ margin: 0, textAlign: 'center', fontSize: 'clamp(12.5px, 3.4vw, 14.5px)', lineHeight: 1.4, color: PAPER_TEXT, fontFamily: UI_FONT, fontWeight: 600 }}>
              {mode.desc}
            </p>
            {/* …and how it ends, which the one-liner alone always left open. */}
            <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 'clamp(11.5px, 3vw, 12.5px)', lineHeight: 1.45, color: PAPER_TEXT_MUTED, fontFamily: UI_FONT, fontWeight: 500 }}>
              {mode.how}
            </p>

            {/* The two facts worth knowing before committing to a session. */}
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {modeChips.map((chip) => (
                <span key={chip} style={{
                  fontFamily: UI_FONT, fontSize: '10.5px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: PAPER_TEXT_MUTED, background: PAPER_BG_MUTED,
                  border: `1px solid ${PAPER_BORDER_SOFT}`, borderRadius: '100px',
                  padding: '4px 10px', whiteSpace: 'nowrap',
                }}>{chip}</span>
              ))}
            </div>

            {/* Your history with this mode, when there is any. A mode you have
                never opened shows nothing rather than a row of zeroes — see
                modeStatItems for why that is most of them. */}
            {statItems.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 22,
                marginTop: 10, paddingTop: 10, borderTop: `1px solid ${PAPER_BORDER_SOFT}`,
              }}>
                {statItems.map((stat) => (
                  <div key={stat.label} style={{ textAlign: 'center', minWidth: 0 }}>
                    <div style={{
                      fontFamily: UI_FONT, fontSize: '9.5px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT,
                    }}>{stat.label}</div>
                    <div style={{
                      fontFamily: UI_FONT, fontSize: '14px', fontWeight: 800,
                      color: PAPER_TEXT, marginTop: 2, whiteSpace: 'nowrap',
                    }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom action area grows into the available space on tall phones. */}
        <div style={{ width: 'min(400px, 94vw)', marginTop: 'auto', paddingTop: 12 }}>
          <CarouselWorm disabled={diving} />
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
    gap: '11px',
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
          fontSize: '12px',
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
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: UI_FONT,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >Give Feedback</button>
  </div>
  );
};

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
