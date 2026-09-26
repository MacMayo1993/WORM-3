import { PadProvider, FlipPadOffset } from '../../3d/PadSprings.jsx';
import WormWordmark from '../branding/WormWordmark.jsx';
import '../ui/screenDesign.css';
import './liveCubeCarousel.css';
import './mainMenuKeys.css';
import { fitCarouselCube, carouselTurnScale } from './fitCarouselCube.js';
import { PlayerLevelBadge } from '../../progression/ProgressWidgets.jsx';
import { MENU_FLIP_PAIRS, flipMenuCenters } from './menuCenterPortals.js';
import { carouselPlateGeometry } from './carouselPlateGeometry.js';
import CubeGlowWorm from './CubeGlowWorm.jsx';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { preloadFont } from 'troika-three-text';
import * as THREE from 'three';
// Bundled Bungee for the 3D face-plate labels. Troika (drei's Text) parses
// woff/ttf but not woff2, so point it at the woff build.
import bungeeWoffUrl from '@fontsource/bungee/files/bungee-latin-400-normal.woff';

// Warm troika's glyph atlas for the mode labels at module load so the first
// face's label renders instantly instead of popping in a frame late.
preloadFont(
  { font: bungeeWoffUrl, characters: 'WORMFLIPCUBETEACHOSRND' },
  () => {}
);
import { makeCubies } from '../../game/cubeState.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { updateSharedTime } from '../../3d/styles/TileStyleMaterials.jsx';
import { STICKER_OFFSET, createCubieGeometry, createStickerGeometry, rubiksFinish } from '../../3d/rubiksPiece.js';
import { isMobile, prefersReducedMotion } from '../../utils/device.js';
import { vibrate } from '../../utils/audio.js';
import { warmDemoAssets } from '../../utils/preloadAssets.js';
import { MenuPortalScene, MenuPortalAnchor } from './MenuPortalScene.jsx';
import MenuFlipWave from './MenuFlipWave.jsx';
import MenuTileOverlay from './MenuTileOverlay.jsx';
import { ANTIPODAL_COLOR, DIR_TO_COLOR, RUBIKS_CLASSIC, RUBIKS_FACE_COLORS, readableInk } from '../../utils/constants.js';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import { useGameStore } from '../../hooks/useGameStore.js';

// ─── The opening's cube ────────────────────────────────────────────────────────
// The menu cube is the one that lands in the opening (IntroScene): black plastic
// cubies and glossy stickers in the classic colours, built from the same parts
// (rubiksPiece.js). One body geometry, one sticker geometry and a material per
// colour serve all 27 cubies; they live as long as the app does.
const PIECE = { body: createCubieGeometry(), sticker: createStickerGeometry() };
// The menu lights the cube with its photo panorama, and a bright street scene
// in full would wash the gloss out of it; damped, the colours stay the opening's.
const FINISH = rubiksFinish(isMobile);
const PLASTIC = new FINISH.Material({ ...FINISH.plastic, envMapIntensity: 0.25 });
const STICKER_MATS = Object.fromEntries(Object.entries(RUBIKS_FACE_COLORS)
  .map(([id, hex]) => [id, new FINISH.Material({ ...FINISH.sticker, color: hex, envMapIntensity: 0.18 })]));

// ─── Tap to flip ──────────────────────────────────────────────────────────────
// Tapping the cube flips every sticker over to its antipodal colour in a wave —
// the move the opening's cube makes after it lands — and the next tap turns them
// back. Timing matches the opening's flip (introMotion.js). Purely visual: the
// cubies' own colours, and so the worm portals, are untouched.
const FLIP_TIME = 0.42; // one sticker's turn, seconds
const FLIP_SPREAD = 0.9; // how long the wave takes to cross the cube
const FLIP_LIFT = 0.32; // how far a sticker pops off its face mid-turn
const menuFlip = { inverted: false, from: false, startT: -Infinity };
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth01 = v => { const p = clamp01(v); return p * p * (3 - 2 * p); };
/** The face colour a sticker shows: its own, or its antipode while the cube is flipped. */
const shownColor = (id, inverted = menuFlip.inverted) => (inverted ? ANTIPODAL_COLOR[id] : id);
const shownHex = id => RUBIKS_FACE_COLORS[shownColor(id)] ?? '#888888';
/** When the wave reaches a sticker: 0 at the cube's top-left, 1 at its bottom-right. */
const flipWaveOrder = (x, y, z) => clamp01(((1.5 - y) / 3) * 0.7 + ((x + z * 0.5 + 1.5) / 3) * 0.3);
function startMenuFlip(now) {
  menuFlip.from = menuFlip.inverted;
  menuFlip.inverted = !menuFlip.inverted;
  // Reduced motion: the colours change in place, with no wave.
  menuFlip.startT = prefersReducedMotion() ? now - FLIP_SPREAD - FLIP_TIME : now;
}

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
  presentMenuCube,
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
const O = STICKER_OFFSET;
const STICKER_CFG = [
  { dir: 'PX', pos: [O, 0, 0],  rot: [0,  Math.PI / 2, 0] },
  { dir: 'NX', pos: [-O, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { dir: 'PY', pos: [0,  O, 0], rot: [-Math.PI / 2, 0, 0] },
  { dir: 'NY', pos: [0, -O, 0], rot: [ Math.PI / 2, 0, 0] },
  { dir: 'PZ', pos: [0, 0,  O], rot: [0, 0, 0] },
  { dir: 'NZ', pos: [0, 0, -O], rot: [0, Math.PI, 0] },
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
// mouths use the shared domed-sticker offset in menuCenterPortals.js).

const INITIAL_WORM_DELAY = 2.5; // seconds before the very first worm spawns

const ShuffleCubie = React.memo(({ cubie, hideStickers = false }) => {
  const cx = cubie.x - 1, cy = cubie.y - 1, cz = cubie.z - 1;
  const stickersRef = useRef(cubie.stickers);
  stickersRef.current = cubie.stickers;
  // Per face: the group a sticker turns in, its mesh (whose material is its
  // colour), and the portal overlay riding on it, if a worm has been through.
  const turns = useRef({});
  const meshes = useRef({});
  const overlays = useRef({});
  const settledFor = useRef(null);

  // The tap's flip wave. Idle frames return at once; each wave is played out
  // here and then settled exactly once.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime - menuFlip.startT;
    const running = t >= 0 && t < FLIP_SPREAD + FLIP_TIME;
    if (!running && settledFor.current === menuFlip.startT) return;
    for (const { dir, pos } of STICKER_CFG) {
      const turn = turns.current[dir], mesh = meshes.current[dir], sticker = stickersRef.current?.[dir];
      if (!turn || !mesh || !sticker) continue;
      const p = running ? smooth01((t - flipWaveOrder(cx + pos[0], cy + pos[1], cz + pos[2]) * FLIP_SPREAD) / FLIP_TIME) : 1;
      // The sticker is a two-sided slab, so a half turn lands it face up again.
      turn.rotation.x = p < 1 ? Math.PI * p : 0;
      turn.position.z = FLIP_LIFT * Math.sin(Math.PI * p);
      // The colour changes edge-on, halfway through the turn — sticker and
      // portal glow together, since neither re-renders for a flip.
      const shown = shownColor(sticker.curr, p >= 0.5 ? menuFlip.inverted : menuFlip.from);
      mesh.material = STICKER_MATS[shown];
      overlays.current[dir]?.setColors(RUBIKS_FACE_COLORS[shown], RUBIKS_FACE_COLORS[ANTIPODAL_COLOR[shown]]);
    }
    if (!running) settledFor.current = menuFlip.startT;
  }, -0.35);

  return (
    <group position={[cx, cy, cz]}>
      <mesh geometry={PIECE.body} material={PLASTIC} />
      {/* While the six-faces selector presents its mode plates the stickers go,
          so nothing draws over the plates; the black cubies keep the silhouette. */}
      {!hideStickers && STICKER_CFG.map(({ dir, pos, rot }) => {
        const sticker = cubie.stickers?.[dir];
        if (!sticker) return null;
        const shown = shownColor(sticker.curr);
        // A worm has passed through this sticker (flipped an odd number of times):
        // it wears the portal overlay, just above the sticker's dome.
        const isFlipped = sticker.curr !== sticker.orig;
        return (
          <FlipPadOffset key={dir} meta={sticker} size={3} pos={pos} rot={rot}>
            <group position={pos} rotation={rot}>
              <group ref={el => { turns.current[dir] = el; }}>
                <mesh ref={el => { meshes.current[dir] = el; }} geometry={PIECE.sticker} material={STICKER_MATS[shown]} />
                {isFlipped && (
                  <MenuPortalAnchor dir={dir}>
                    <MenuTileOverlay ref={el => { overlays.current[dir] = el; }}
                      colorHex={RUBIKS_FACE_COLORS[shown]} antiColorHex={RUBIKS_FACE_COLORS[ANTIPODAL_COLOR[shown]]} />
                  </MenuPortalAnchor>
                )}
              </group>
            </group>
          </FlipPadOffset>
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
    return { cubies: flipMenuCenters(cubies), rotating: null };
  });

  const [flipWaves, setFlipWaves] = useState([]);
  // Drop the cube's stickers/overlays while the six-faces selector presents
  // its mode plates, so nothing draws over them.
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
  const wormCompletedRef = useRef(0);
  // The shared Canvas clock keeps advancing while a game is running, even
  // though this menu subtree is unmounted. Initialise against the first menu
  // frame rather than an absolute 2.5-second timestamp so a returning menu
  // does not immediately resume a long-overdue worm/rotation cycle.
  const nextSpawnAt      = useRef(null);

  // Called by MenuFlipWave when the worm animation finishes
  const handleWormComplete = useCallback(() => {
    wormCompletedRef.current += 1;
  }, []);

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
      const newCubies = flipMenuCenters(cubies);
      const waves = [{
        id: ++flipIdRef.current,
        startTime: t,
        origins: MENU_FLIP_PAIRS.flat().map(face => {
          const [x, y, z] = face.cubie;
          return { dir: face.dir, position: face.pos, rotation: face.rot,
            color: shownHex(newCubies[x][y][z].stickers[face.dir].curr) };
        }),
      }];

      wormCompletedRef.current = 0;
      pipelineRef.current = 'worm';
      setCubeState({ cubies: newCubies, rotating: null });
      setFlipWaves(waves);
      onFlip?.();
    }

    if (pipelineRef.current === 'worm' && wormCompletedRef.current === 1) {
      // All six tails have retreated — start the middle-slice rotation
      wormCompletedRef.current = 0;
      pipelineRef.current = 'rotating';
      const m = MIDDLE_MOVES[Math.floor(Math.random() * MIDDLE_MOVES.length)];
      setCubeState(prev => ({ ...prev, rotating: { ...m, startT: t } }));
      setFlipWaves([]);
    }
  }, -1);

  const { cubies, rotating } = cubeState;
  const flatCubies = cubies.flat(2);
  const axProp = rotating ? AX_PROP[rotating.ax] : null;
  const staticCubies = rotating ? flatCubies.filter(c => c[axProp] !== rotating.sl) : flatCubies;
  const sliceCubies  = rotating ? flatCubies.filter(c => c[axProp] === rotating.sl) : [];

  return (
    <MenuPortalScene>
    <PadProvider profile="menu" paused={hideStickers}>
      {staticCubies.map(c => (
        <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} hideStickers={hideStickers} />
      ))}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => (
          <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} hideStickers={hideStickers} />
        ))}
      </group>
      {flipWaves.map(wave => (
        <MenuFlipWave
          key={wave.id}
          origins={wave.origins}
          characterCycle={wave.id}
          startTime={wave.startTime}
          onComplete={handleWormComplete}
        />
      ))}
    </PadProvider>
    </MenuPortalScene>
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
const FACE_TARGETS = Object.values(FACE_TARGET_QUAT);
const _parkedQ = new THREE.Quaternion();
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
// Home-screen cube scale. The carousel instead fits its measured stage.
const MENU_CUBE_GROWTH = 1.05;
const MENU_BUTTON_LIFT_PX = 24;
const MENU_CUBE_ZOOM = 0.8 * MENU_CUBE_GROWTH;
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
const _stageLook = new THREE.Matrix4();
const _stageViewQ = new THREE.Quaternion();
const _stageCenter = new THREE.Vector3();

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

// Renders a beveled, glossy solid-color tile on every cube face, with a
// centered display title. Fully opaque,
// depth-writing tiles occlude the faces behind them, so only the words on
// visible faces read — hidden faces are naturally masked by the front tile.
const ModeFacePlates = React.forwardRef((_props, rootRef) => {
  const enamelRefs = useRef({});
  const faceColors = useMemo(() => Object.fromEntries(CAROUSEL_MODES.map(m => [m.face, new THREE.Color(m.tileColor)])), []);
  const targetColor = useMemo(() => new THREE.Color(), []);
  useFrame((_state, delta) => {
    if (!isCarouselActive()) return;
    const selected = getCarouselFace() || 'PZ';
    for (const [face, material] of Object.entries(enamelRefs.current)) {
      if (!material) continue;
      targetColor.copy(faceColors[face]).multiplyScalar(face === selected ? 1 : 0.72);
      material.color.lerp(targetColor, 1 - Math.exp(-8 * delta));
      material.roughness = face === selected ? 0.3 : 0.55;
      material.clearcoat = face === selected ? 1 : 0.25;
    }
  });
  // Visibility is owned by RotatingBlackCube's frame loop (not React state, and
  // not a second useFrame here): the same frame that decides to present a mode
  // face turns the plates on. Two independent readers of the carousel flag
  // could disagree, and a frame with the plates up but the cube still in its
  // free-spin pose is the glitch — labels sliced by neighbouring plates on a
  // cube drifting off centre.
  return (
    <group ref={rootRef} visible={false}>
      {CAROUSEL_MODES.map((m) => {
        const cfg = MODE_FACE_CFG[m.face];
        return (
          <group key={m.id} position={cfg.pos} rotation={cfg.rot}>
            {/* Graphite chassis, a fine metal reveal, and a beveled enamel insert. */}
            <mesh position={[0, 0, -0.045]} renderOrder={30}>
              <boxGeometry args={[3.12, 3.12, 0.07]} />
              <meshPhysicalMaterial color="#172030" metalness={0.65} roughness={0.32} clearcoat={0.45} envMapIntensity={0.35} />
            </mesh>
            <mesh geometry={carouselPlateGeometry} scale={[1.025, 1.025, 1]} position={[0, 0, -0.008]} renderOrder={30}>
              <meshPhysicalMaterial color="#667389" metalness={0.8} roughness={0.26} envMapIntensity={0.45} />
            </mesh>
            <mesh geometry={carouselPlateGeometry} renderOrder={31}>
              <meshPhysicalMaterial ref={material => { enamelRefs.current[m.face] = material; }} color={m.tileColor} metalness={0.08} roughness={0.3}
                clearcoat={1} clearcoatRoughness={0.2} envMapIntensity={0.3} />
            </mesh>
            {/* Center the title on the plain face. Longer names step down in
                size so every mode, including FLIP CUBE, fits on one line. */}
            <Text
              position={[0, 0, 0.055]}
              font={bungeeWoffUrl}
              fontSize={m.label.length > 6 ? 0.42 : m.label.length > 5 ? 0.48 : 0.62}
              maxWidth={2.5}
              color={m.textColor}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor={m.textColor === '#fffdf2' ? '#162035' : '#f4f1e8'}
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
  const shufflingRef = useRef();
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
    presentMenuCube(shufflingRef.current, platesRef.current, carouselActive);

    if (carouselActive) {
      updateSharedTime(t);
      // Fit the physical cube to the transparent DOM stage, including scrolling
      // disclosures and landscape layouts. Both use the measured rectangle.
      const fit = fitCarouselCube(state.camera, state.size, getCarouselStage());
      const presentY = fit.y;
      const presentScale = fit.scale;
      _stageCenter.set(fit.x, fit.y, 0);
      _stageLook.lookAt(state.camera.position, _stageCenter, state.camera.up);
      _stageViewQ.setFromRotationMatrix(_stageLook);
      // Present the active mode's face: slerp toward its target orientation
      // with a slow breathing wobble so the cube stays alive while parked.
      const face = getCarouselFace() || 'PZ';
      _wobbleEuler.set(
        0.18 + Math.sin(t * 0.65) * 0.018,
        0.30 + Math.sin(t * 0.5 + 1.7) * 0.022,
        0
      );
      _wobbleQ.setFromEuler(_wobbleEuler);
      _presentQ.multiplyQuaternions(_wobbleQ, FACE_TARGET_QUAT[face] ?? FACE_TARGET_QUAT.PZ);
      _presentQ.premultiply(_stageViewQ);
      cubeRef.current.quaternion.slerp(_presentQ, 1 - Math.exp(-6 * delta));

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
      cubeRef.current.position.set(fit.x, presentY + Math.sin(t * 0.8) * 0.025, 0);

      // Park the contact shadow under the cube. It tracks the cube's settled
      // scale rather than its bobbing Y, so the pool stays put on the floor and
      // the cube reads as rising off it instead of dragging it along.
      if (shadowRef.current) {
        const settled = cubeCurrentScale.current;
        shadowRef.current.visible = true;
        shadowRef.current.position.set(fit.x, presentY - CUBE_HALF * settled - SHADOW_DROP * settled, -0.2);
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
        // Ease back while turning between faces so the wider mid-turn
        // silhouette stays on a phone screen; parked, it is full size.
        cubeCurrentScale.current += (1.022 * presentScale - cubeCurrentScale.current) * Math.min(1, delta * 10);
        // Ease back while between faces so the wider mid-turn silhouette stays
        // on a phone screen. Measured from this frame's pose (nearest parked
        // face), so the shrink moves in lockstep with the rotation.
        let fromFace = Math.PI;
        if (fit.turnPullback) for (const target of FACE_TARGETS) {
          _parkedQ.multiplyQuaternions(_wobbleQ, target).premultiply(_stageViewQ);
          fromFace = Math.min(fromFace, cubeRef.current.quaternion.angleTo(_parkedQ));
        }
        cubeRef.current.scale.setScalar(cubeCurrentScale.current * carouselTurnScale(fromFace, fit.turnPullback));
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
          startMenuFlip(elapsedTime);
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
        <group ref={shufflingRef}>
          <ShufflingCube onFlip={onFlip} />
        </group>
        {/* Always mounted (no mount-timing flash); the frame loop above shows
            the plates only on frames where it presents a mode face. */}
        <ModeFacePlates ref={platesRef} />
        <CubeGlowWorm />
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

// The title and chips identify the mode; the disclosure explains its rules.
const CAROUSEL_MODES = [
  {
    id: 'worm', label: 'WORM', face: 'NX',
    how: 'Steer, collect orbs, and use tunnels to heal flipped tiles.',
    chips: ['2×2 – Mega', 'Arcade'],
    cta: 'PLAY',
  },
  {
    id: 'freeplay', label: 'FLIP CUBE', face: 'NY',
    how: 'Make each face one color.',
    chips: ['2×2 – 10×10', 'Relaxed'],
    cta: 'PLAY',
  },
  {
    id: 'cube', label: 'TEACH', face: 'PX',
    how: 'Learn to solve a cube, one move at a time.',
    chips: ['3×3', 'Step by step'],
    cta: 'PLAY',
  },
  {
    id: 'chaos', label: 'CHAOS', face: 'NZ',
    how: 'Back the pair that outlasts the rest to win Parity Points.',
    chips: ['2×2 – 10×10', 'Wager'],
    cta: 'PLAY',
  },
  {
    id: 'random', label: 'RANDOM', face: 'PZ',
    how: 'Solve all six faces. The palette and tile style change every 10 seconds.',
    chips: ['2×2 – 10×10', 'Twist'],
    cta: 'PLAY',
  },
  {
    id: 'store', label: 'STORE', face: 'PY',
    how: 'Spend Parity Points on palettes, styles, and worm equipment.',
    chips: ['No cube', 'Cosmetic'],
    cta: 'OPEN STORE',
  },
].map(withFaceColor);

const LAST_MODE_KEY = 'worm3_last_mode_id';

// ─── Per-mode stats ──────────────────────────────────────────────────────────
// What the card can honestly say about your history with a mode.
//
// Teach shows its method; Store shows the wallet; other modes show recorded plays.
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

// Campaign stars are deliberately not presented as Teach progress.
export function chipsFor(mode, _ctx) {
  return mode.chips;
}

export function modeStatItems(mode, ctx) {
  const play = ctx.plays?.[mode.id];
  const stats = [];

  if (mode.id === 'cube') return [{ label: 'Method', value: 'Beginner 3×3' }];

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

// ─── Mode carousel overlay ───────────────────────────────────────────────────
// Controls frame the live cube. The stage has no DOM artwork or opaque panel.
export const ModeCarousel = ({ onBack, onCubeSelect, onWormSelect, onChaos, onFreeplay, onRandom, onStore, onComingSoon, onSettings }) => {
  // Open on the last-played mode so returning players are one tap from their game.
  const [activeIndex, setActiveIndex] = useState(() => {
    try {
      const idx = CAROUSEL_MODES.findIndex(m => m.id === localStorage.getItem(LAST_MODE_KEY));
      return idx >= 0 ? idx : 0;
    } catch { return 0; }
  });
  const [show, setShow] = useState(true);
  const [diving, setDiving] = useState(false);

  const modePlays = useGameStore(s => s.modePlays);
  const parityPoints = useGameStore(s => s.parityPoints);
  const ownedItems = useGameStore(s => s.ownedItems);
  const recordModePlay = useGameStore(s => s.recordModePlay);
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
    if (animatingRef.current || divingRef.current) return;
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
      if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('button, a, input, select, textarea, summary, [contenteditable="true"]'))) handlePlay();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [navigate, handlePlay, onBack]);

  // A stage's location can move without its size changing (e.g. a disclosure
  // opened in landscape), so observe the column too, and publish on scrolling.
  const stageRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const publish = () => {
      const { left, top, width, height } = el.getBoundingClientRect();
      setCarouselStage({ left, top, width, height });
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    ro.observe(el.parentElement);
    window.addEventListener('resize', publish);
    window.addEventListener('scroll', publish, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      window.removeEventListener('scroll', publish, true);
      setCarouselStage(null);
    };
  }, []);

  const mode = CAROUSEL_MODES[activeIndex];
  const modeChips = useMemo(() => chipsFor(mode), [mode]);
  const statItems = useMemo(
    () => modeStatItems(mode, {
      plays: modePlays,
      points: parityPoints ?? 0,
      owned: ownedItems?.length ?? 0,
    }),
    [mode, modePlays, parityPoints, ownedItems]
  );
  const opacity = show ? 1 : 0;

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

  const actionLabel = mode.id === 'cube' ? 'Learn to solve' : mode.id === 'store' ? 'Open store' : `Play ${mode.label}`;

  return (
    <div className="live-carousel" style={{ zIndex: Z.MENU, '--mode-accent': mode.tileColor, '--mode-ink': mode.textColor }}>
      <div className="live-carousel-layout" style={{ opacity: diving ? 0 : 1, pointerEvents: diving ? 'none' : 'auto' }} inert={diving ? '' : undefined}>
        <header className="lc-header">
          <button type="button" className="lc-icon-button" aria-label="Back to main menu" onClick={onBack}>‹</button>
          <WormWordmark />
          {onSettings && <button type="button" className="lc-icon-button" aria-label="Settings" onClick={onSettings}>
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="3" />
            </svg>
          </button>}
        </header>
        <h1 className="lc-heading">Choose your mode</h1>

        <div {...swipeHandlers} ref={stageRef} className="mc-cube-window" role="group" aria-label="Rotating cube mode selector">
          <span className="lc-sr-only" role="status" aria-live="polite">{mode.label} mode, {activeIndex + 1} of {N}</span>
          <button type="button" className="lc-icon-button lc-previous" aria-label="Previous mode" disabled={!show || diving} onClick={() => navigate(-1)}>‹</button>
          <button type="button" className="lc-icon-button lc-next" aria-label="Next mode" disabled={!show || diving} onClick={() => navigate(1)}>›</button>
        </div>

        <div className="lc-footer">
          <nav className="lc-face-map" aria-label="Game modes">
            {CAROUSEL_MODES.map((m, i) => (
              <button key={m.id} type="button" aria-label={`Show ${m.label} mode`} aria-current={i === activeIndex ? 'true' : undefined}
                title={m.label} onClick={() => selectIndex(i)} disabled={!show || diving} style={{ '--face-color': m.tileColor }}>
                <span />
              </button>
            ))}
          </nav>
          <p className="lc-swipe-hint">Swipe the cube to explore</p>
          <article className="lc-info" aria-label={`${mode.label} mode details`} style={{ opacity }}>
            <div className="lc-facts">{modeChips.map(chip => <span key={chip}>{chip}</span>)}</div>
            <details key={mode.id}>
              <summary>{mode.id === 'store' ? 'GEAR & REWARDS' : 'HOW TO PLAY'}</summary>
              <p>{mode.how}</p>
              {statItems.length > 0 && <div className="lc-history">{statItems.map(stat => <div key={stat.label}><strong>{stat.value}</strong><small>{stat.label}</small></div>)}</div>}
            </details>
          </article>
          <button type="button" className="lc-play menu-key" onClick={handlePlay} disabled={!show || diving}>
            <span className="menu-key-face">
              <span className="menu-key-emblem" aria-hidden="true"><MenuCubeGlyph /></span>
              <span className="menu-key-label">{actionLabel}</span>
              <span className="menu-key-arrow" aria-hidden="true">→</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Start button ─────────────────────────────────────────────────────────────
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScYKKOXc6c3vdqpmWWv0J3lMd90-GOfp0TxxxHelxjIjMdrvw/viewform';

// The opening's cube in miniature: three visible faces (white top, red front,
// blue right), nine stickers each, on black plastic.
const MenuCubeGlyph = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M16 2 29 9.5v13L16 30 3 22.5v-13Z" fill="#141416" stroke="#141416" strokeWidth="1.2" strokeLinejoin="round" />
    {[
      { transform: 'matrix(1.444 .833 -1.444 .833 16 2)', color: RUBIKS_CLASSIC.white },
      { transform: 'matrix(1.444 .833 0 1.444 3 9.5)', color: RUBIKS_CLASSIC.red },
      { transform: 'matrix(1.444 -.833 0 1.444 16 17)', color: RUBIKS_CLASSIC.blue },
    ].map(face => (
      <g key={face.color} transform={face.transform} fill={face.color}>
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={(i % 3) * 3 + 0.23} y={Math.floor(i / 3) * 3 + 0.23}
            width="2.54" height="2.54" rx="0.36" />
        ))}
      </g>
    ))}
  </svg>
);

// The keys' sticker colours, straight from the cube's palette (mainMenuKeys.css).
const MENU_KEY_COLORS = {
  '--menu-green': RUBIKS_CLASSIC.green,
  '--menu-blue': RUBIKS_CLASSIC.blue,
  '--menu-yellow': RUBIKS_CLASSIC.yellow,
  '--menu-white': RUBIKS_CLASSIC.white,
};
const PLAY_FLIP_MS = 520;

const MenuStartButton = ({ visible, onClick, onDemo }) => {
  // Lift the action cluster while retaining portrait/desktop and safe-area spacing.
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
  // Play's sticker flips over while the cube shakes before the mode selector opens.
  const [playFlipping, setPlayFlipping] = React.useState(false);
  const flipTimer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(flipTimer.current), []);
  const handlePlay = () => {
    setPlayFlipping(true);
    clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => setPlayFlipping(false), PLAY_FLIP_MS);
    onClick?.();
  };
  return (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: `calc(${padBottom} + ${MENU_BUTTON_LIFT_PX}px)`,
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    gap: '11px',
    zIndex: 4,
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(16px)',
    transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
    pointerEvents: visible ? 'auto' : 'none',
  }} inert={visible ? undefined : ''}>
    <div className="worm-menu-actions" style={MENU_KEY_COLORS}>
    <PlayerLevelBadge />
    <button
      type="button"
      className={`menu-key menu-key--play${playFlipping ? ' is-flipping' : ''}`}
      onClick={handlePlay}
    >
      <span className="menu-key-face">
        <span className="menu-key-emblem"><MenuCubeGlyph /></span>
        <span className="menu-key-label">Play</span>
        <span className="menu-key-arrow" aria-hidden="true">→</span>
      </span>
    </button>
    <div className="worm-menu-utilities">
      {onDemo && <button type="button" onClick={onDemo}
        onPointerEnter={warmDemoAssets} onPointerDown={warmDemoAssets}
        className="menu-key menu-key--small">
        <span className="menu-key-face"><span aria-hidden="true">▷</span>Demo</span>
      </button>}
      <button type="button" className="menu-key menu-key--small"
        onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}>
        <span className="menu-key-face">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h16v12H10l-6 4V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          Feedback
        </span>
      </button>
    </div>
    </div>
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
    <WormWordmark menu animated />
    {/* One line of eyebrow type, ruled on both sides. It fills the gap between
        the wordmark and the cube and answers the question a first-time player
        actually has: what is the cube in front of me doing? */}

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
  onPlay: _onPlay, onLevels: _onLevels, onFreeplay: _onFreeplay, onRandom: _onRandom, onTeach: _onTeach,
  onSettings: _onSettings, onBiome: _onBiome, onDisparity: _onDisparity,
  onWormHealer: _onWormHealer,
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
