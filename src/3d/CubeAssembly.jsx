import React, { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TrackballControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import Cubie from './Cubie.jsx';
import VoidCore from './VoidCore.jsx';
// DragGuide removed - real-time rotation provides visual feedback
import CursorHighlight from '../components/overlays/CursorHighlight.jsx';
import SolveHighlight from '../components/overlays/SolveHighlight.jsx';
import WormholeNetwork from '../manifold/WormholeNetwork.jsx';
import ChaosWave from '../manifold/ChaosWave.jsx';
import FlipPropagationWave from '../manifold/FlipPropagationWave.jsx';
import { vibrate } from '../utils/audio.js';
import { updateSharedTime, updateSharedTremor, updateSharedSpin, updateDiceRoll, setDiceCellState, warmUpDefaultStyles } from './styles/TileStyleMaterials.jsx';
import { StickerInstanceProvider } from './StickerInstances.jsx';
import StickerAnimationDriver from './StickerAnimationDriver.jsx';
import CameraFlipKick from './CameraFlipKick.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { liveRotations, setLiveWave, setPlaneAngle } from '../worm/liveRotations.js';
import { liveCubies } from '../worm/liveCubies.js';
import { healSticker } from '../game/cubeState.js';
import { getSliceLinearIndices, forEachSliceCoordinate, MEGA_SIZE } from '../game/sliceIndex.js';
import { MAX_WAVE_PLANES } from '../game/rotationWave.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid, getManifoldNeighbors } from '../game/manifoldLogic.js';
import { EARN_DISPARITY_TILE_RESTORE } from '../utils/economyConstants.js';
import { pruneExpiredFx } from '../utils/transientFx.js';

// Reusable axis vectors and quaternion (allocated once, never recreated)
const _axisCol = new THREE.Vector3(1, 0, 0);
const _axisRow = new THREE.Vector3(0, 1, 0);
const _axisDepth = new THREE.Vector3(0, 0, 1);
const _rotQuat = new THREE.Quaternion();

// Scratch vectors for getBasis() — pre-allocated to avoid GC pressure during drag events.
const _basisF = new THREE.Vector3();
const _basisR = new THREE.Vector3();
const _basisU = new THREE.Vector3();
// Scratch vectors for mapSwipe() — avoids per-call allocations.
const _swipe = new THREE.Vector3();
const _projected = new THREE.Vector3();
const _rotAxis = new THREE.Vector3();
// Scratch objects for normalFromEvent() — avoids a Matrix3/Matrix4 allocation
// on every pointer-down event (the resulting Vector3 must stay an owned clone;
// see comment at its usage site).
const _normalMat3 = new THREE.Matrix3();
const _identityMat4 = new THREE.Matrix4();

// Pre-allocated pool for live drag base positions/rotations.
// A rotated slice holds size² cubies, so the pool is sized for the largest cube
// any mode can build — the Mega Worm 15², not the 7² the standard tiers stop at.
// The fill loop below also bounds-checks against this, because the previous
// version silently indexed past a 49-slot pool and threw on `.copy()` of
// undefined the moment anything larger reached it.
const _MAX_SLICE = MEGA_SIZE * MEGA_SIZE;
const _dragPosPool = Array.from({ length: _MAX_SLICE }, () => new THREE.Vector3());
const _dragRotPool = Array.from({ length: _MAX_SLICE }, () => new THREE.Quaternion());
const _dragBasePositions = new Map();
const _dragBaseRotations = new Map();

// Pre-allocated resting-pose snapshot for an animated rotation wave: up to three
// parallel planes of size² cubies each. Allocated once at module load rather than
// per wave — a hazard turn every ten seconds that minted 675 Vector3s and 675
// Quaternions would be a steady GC drip through a whole run.
const _MAX_WAVE_CUBIES = MAX_WAVE_PLANES * _MAX_SLICE;
const _wavePosPool = Array.from({ length: _MAX_WAVE_CUBIES }, () => new THREE.Vector3());
const _waveRotPool = Array.from({ length: _MAX_WAVE_CUBIES }, () => new THREE.Quaternion());

// Mobile detection
const isTouchDevice = typeof window !== 'undefined' && (
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia('(pointer: coarse)').matches
);

// Drag threshold - small for immediate response
const DRAG_THRESHOLD = isTouchDevice ? 8 : 5;

// Max camera distance per cube size — defined once at module scope to avoid
// creating a new object literal on every CubeAssembly render.
const MAX_DISTANCE_BY_SIZE = { 2: 28, 3: 28, 4: 38, 5: 52, 6: 68, 7: 85 };

// Pixels of drag to complete a 90° rotation
const PIXELS_PER_90DEG = 100;

const CubeAssembly = React.memo(({
  // `animState` is still passed by GameScene for other consumers; this component
  // reads the authoritative `animWave` from the store instead.
  size, cubies, onMove, onTapFlip, animState: _animState, onAnimComplete,
  onCascadeComplete, manifoldMap,
  onSelectTile, onClearTileSelection, onFlipWaveComplete,
  solveHighlights,
  onFaceRotationMode,
}) => {
  // ── State from store (batched with useShallow to reduce subscription count) ──
  const {
    explosionFactor,
    cascades,
    cursor,
    showCursor,
    flipMode,
    flipWaveOrigins,
    handsMode,
    wormHealerMode,
    wormTunnelActive,
    wormExitRideActive,
    wormholeBodyHidden,
    isBiomeMode,
    rotationEpoch,
    animWave,
    settings,
    _chaosLevel,
    cameraOrbitRequest,
    cameraOrbitDir,
  } = useGameStore(
    useShallow(s => ({
      explosionFactor: s.explosionT,
      cascades: s.cascades,
      cursor: s.cursor,
      showCursor: s.showCursor,
      flipMode: s.flipMode,
      flipWaveOrigins: s.flipWaveOrigins,
      handsMode: s.handsMode,
      wormHealerMode: s.wormHealerMode,
      // Hide the exterior cube ONLY during the immersive 'tunnel' beat (camera rides inside the
      // hollow cube on the Möbius ribbon). During windup/entering the camera watches the
      // entry hole from OUTSIDE, so the cube must stay visible to see the worm get sucked in.
      wormTunnelActive: s.wormHealerMode && s.wormPhase === 'tunnel',
      // The camera also rides inside the cube for the whole 'exiting' phase (the trip back up
      // the exit arm), but unlike 'tunnel' we still want the per-cubie groups mounted so the
      // antipodal back-face stickers render — only the opaque solid body needs to disappear so
      // it stops occluding them from the inside.
      wormExitRideActive: s.wormHealerMode && s.wormPhase === 'exiting',
      // Hides the solid cube body (and unrelated interaction overlays) so it doesn't z-fight
      // with TunnelInteriorView's coincident antipodal stickers.
      // Deliberately does NOT cover WormholeNetwork/VoidCore below — the Möbius ribbons and the
      // void-core swirl are the wormhole's own visual and must stay visible through the trip.
      //
      // Scoped to the phases where the camera is actually INSIDE. This used to include
      // 'entering', which contradicted the wormTunnelActive comment three lines up ("the camera
      // watches the entry hole from OUTSIDE, so the cube must stay visible") and was the reason
      // the near walls vanished mid-dive: the real cube was hidden while TunnelInteriorView drew
      // the interior, so from outside you saw straight through to the far inner walls.
      wormholeBodyHidden: s.wormHealerMode && (s.wormPhase === 'tunnel' || s.wormPhase === 'exiting'),
      isBiomeMode: s.settings?.biomeMode?.enabled,
      rotationEpoch: s.rotationEpoch,
      // The wave in flight: 1–3 parallel same-axis planes. The `animState` prop is
      // the single-plane view of the same event, non-null only for a one-plane
      // wave, so this is the authoritative source for the transform loop.
      animWave: s.animWave,
      settings: s.settings,
      _chaosLevel: s.chaosLevel,
      cameraOrbitRequest: s.cameraOrbitRequest,
      cameraOrbitDir: s.cameraOrbitDir,
    }))
  );
  const cubieRefs = useRef([]);
  // Expose cubie refs + size to ParityOrbs so orbs can read live cubie transforms each frame.
  liveCubies.refs = cubieRefs.current;
  liveCubies.size = size;
  const controlsRef = useRef();
  const controlsEnabledRef = useRef(true); // Track controls state with ref for immediate updates
  const cubeGroupRef = useRef(null);
  const gsapAnimRef = useRef(null);
  const animProgressRef = useRef({ value: 0 });
  const { camera, gl } = useThree();
  const [dragStart, setDragStart] = useState(null);
  const dragStartRef = useRef(null); // Ref version for immediate access in listeners
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  // Live drag rotation state - tracks real-time rotation as user drags
  const liveDragRef = useRef(null); // { axis, sliceIndex, angle, dir, basePositions, baseRotations }
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const skipNextAnimRef = useRef(false); // Skip animState animation after live drag

  // Pre-computed set of ref indices that belong to the current animation slice.
  // Computed ONCE when animation starts from the canonical grid positions,
  // so it's immune to floating-point drift from incremental rotations.
  const sliceIndicesRef = useRef(null);

  // ── Rotation-wave animation state ───────────────────────────────────────────
  // `waveIdRef` is the "have I set this wave up yet" latch; the index lists and
  // resting-pose snapshots below are rebuilt only when it changes.
  const waveIdRef = useRef(null);
  const waveIndicesRef = useRef(null);
  const waveBaseRef = useRef(null);
  // The frame loop runs at priority −1 and must see the wave React committed
  // this frame, not the one captured when the callback was created.
  const animWaveRef = useRef(animWave);
  animWaveRef.current = animWave;

  // Park the live bridge without disturbing the completed-wave holdover, which
  // consumers positioned from React state are still reading for a frame or two.
  const resetLiveWaveIdle = useCallback(() => {
    if (liveRotations.active) {
      liveRotations.active = false;
      liveRotations.count = 0;
      liveRotations.axis = null;
      liveRotations.bySlice.fill(-1);
    }
    if (liveRotations.completedFrames > 0) liveRotations.completedFrames--;
  }, []);

  const getBasis = () => {
    camera.getWorldDirection(_basisF).normalize();
    _basisR.crossVectors(camera.up, _basisF).normalize();
    _basisU.crossVectors(_basisF, _basisR).normalize();
    return { right: _basisR, upScreen: _basisU };
  };

  // Result is stored in dragData.n and read across the full pointermove gesture
  // (not consumed immediately), so it must be an owned Vector3, not shared scratch.
  // This only runs once per pointer-down, not per frame, so the allocation is cheap.
  const normalFromEvent = e => {
    const n = (e?.face?.normal || new THREE.Vector3(0, 0, 1)).clone();
    _normalMat3.getNormalMatrix(e?.object?.matrixWorld ?? _identityMat4);
    n.applyNormalMatrix(_normalMat3).normalize();
    return n;
  };

  const sgn = v => v >= 0 ? 1 : -1;

  const mapSwipe = (faceN, dx, dy, isFaceTwist = false) => {
    // If face twist mode, rotate around the face normal itself
    if (isFaceTwist) {
      const ax = Math.abs(faceN.x), ay = Math.abs(faceN.y), az = Math.abs(faceN.z);
      const m = Math.max(ax, ay, az);
      let axis, twistDir;
      if (m === ax) { axis = 'col'; twistDir = -sgn(faceN.x) * sgn(dx); } // Flipped
      else if (m === ay) { axis = 'row'; twistDir = -sgn(faceN.y) * sgn(-dy); } // Flipped
      else { axis = 'depth'; twistDir = -sgn(faceN.z) * sgn(dx); } // Flipped
      return { axis, dir: twistDir };
    }
    // Normal slice rotation
    const { right, upScreen } = getBasis();
    _swipe.set(0, 0, 0).addScaledVector(right, dx).addScaledVector(upScreen, dy);
    _projected.copy(_swipe).projectOnPlane(faceN);
    if (_projected.lengthSq() < 1e-6) return null;
    _rotAxis.crossVectors(_projected, faceN).normalize();
    const ra = _rotAxis;
    const ax = Math.abs(ra.x), ay = Math.abs(ra.y), az = Math.abs(ra.z);
    if (ax >= ay && ax >= az) return { axis: 'col', dir: sgn(ra.x) };
    if (ay >= ax && ay >= az) return { axis: 'row', dir: sgn(ra.y) };
    return { axis: 'depth', dir: sgn(ra.z) };
  };

  const dirFromNormal = n => {
    const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)], m = Math.max(...a);
    if (m === a[0]) return n.x >= 0 ? 'PX' : 'NX';
    if (m === a[1]) return n.y >= 0 ? 'PY' : 'NY';
    return n.z >= 0 ? 'PZ' : 'NZ';
  };

  // Stable callback ref pattern: avoids recreating the function on every render,
  // which would defeat React.memo on all Cubie children.
  const prevAnimStateRef = useRef(null); // tracks last frame's wave for transition detection
  const prevRotationEpochRef = useRef(rotationEpoch);
  const flipModeRef = useRef(flipMode);
  flipModeRef.current = flipMode;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onTapFlipRef = useRef(onTapFlip);
  onTapFlipRef.current = onTapFlip;
  const onSelectTileRef = useRef(onSelectTile);
  onSelectTileRef.current = onSelectTile;
  const onFaceRotationModeRef = useRef(onFaceRotationMode);
  onFaceRotationModeRef.current = onFaceRotationMode;
  const onClearTileSelectionRef = useRef(onClearTileSelection);
  onClearTileSelectionRef.current = onClearTileSelection;
  const handsModeRef = useRef(handsMode);
  handsModeRef.current = handsMode;

  const onPointerDown = useCallback(({ pos, worldPos, event }) => {
    // Any wave in flight blocks input, single-plane or not.
    if (animWaveRef.current) return;
    if (gsapAnimRef.current) return;

    // Get the native event - R3F wraps it
    const nativeEvent = event.nativeEvent || event;

    // Get coordinates - try multiple sources for compatibility
    let screenX, screenY;
    if (nativeEvent.touches && nativeEvent.touches.length > 0) {
      screenX = nativeEvent.touches[0].clientX;
      screenY = nativeEvent.touches[0].clientY;
    } else if (nativeEvent.clientX !== undefined) {
      screenX = nativeEvent.clientX;
      screenY = nativeEvent.clientY;
    } else if (event.clientX !== undefined) {
      screenX = event.clientX;
      screenY = event.clientY;
    } else {
      // Fallback to pointer coordinates from R3F event
      screenX = event.pointer?.x * window.innerWidth / 2 + window.innerWidth / 2;
      screenY = -event.pointer?.y * window.innerHeight / 2 + window.innerHeight / 2;
    }

    // Prevent default to stop touch scrolling and other gestures
    if (nativeEvent.preventDefault) nativeEvent.preventDefault();
    if (event.stopPropagation) event.stopPropagation();

    // Immediately clear any tile selection UI when touching the cube
    if (onClearTileSelectionRef.current) onClearTileSelectionRef.current();

    const n = normalFromEvent(event);

    // Reject hits that don't land on the outer face for the computed direction.
    // When the worm camera is inside the cube (tunnel traversal), R3F's ray can
    // intersect the back face of an outer cubie mesh, producing an inward-pointing
    // normal and therefore the wrong dirKey. Checking that the cubie's grid position
    // actually sits on the surface for that direction is a robust guard against this.
    const s = sizeRef.current;
    const dirKey = dirFromNormal(n);
    const isOuterFace = (
      (dirKey === 'PX' && pos.x === s - 1) ||
      (dirKey === 'NX' && pos.x === 0) ||
      (dirKey === 'PY' && pos.y === s - 1) ||
      (dirKey === 'NY' && pos.y === 0) ||
      (dirKey === 'PZ' && pos.z === s - 1) ||
      (dirKey === 'NZ' && pos.z === 0)
    );
    if (!isOuterFace) return;

    const dragData = {
      pos, worldPos, event,
      screenX,
      screenY,
      n,
      shiftKey: nativeEvent.shiftKey || event.shiftKey,
      isRightClick: (nativeEvent.button === 2) || (event.button === 2)
    };

    dragStartRef.current = dragData; // Set ref immediately for listeners
    setDragStart(dragData);
    longPressTriggeredRef.current = false;

    // Disable camera controls immediately so TrackballControls never processes this touch.
    // If controls stay enabled through pointerdown, THREE.TrackballControls adds the pointer
    // to its internal _pointers array. When we later disable mid-drag, its onPointerUp never
    // runs to clean up, leaving a stale entry. On the next touch THREE sees 2 pointers and
    // enters zoom mode instead of orbit mode — breaking every subsequent rotation gesture.
    controlsEnabledRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, []);


  // Set up global move/up listeners once - use refs for immediate access
  useEffect(() => {
    const getClientCoords = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };

    const move = e => {
      const ds = dragStartRef.current;
      if (!ds) return;
      e.preventDefault();
      const { clientX, clientY } = getClientCoords(e);
      const dx = clientX - ds.screenX, dy = clientY - ds.screenY;
      const dist = Math.hypot(dx, dy);

      if (dist > DRAG_THRESHOLD && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Start live drag if threshold exceeded
      if (!liveDragRef.current && dist >= DRAG_THRESHOLD) {
        {
          // Standalone Disparity mode auto-shuffles and is played by healing tiles,
          // not manual turns, so block manual rotation there. Story levels are
          // always solved with real turns and flips (they no longer use chaos), so
          // never block rotation while a story level is active.
          const _cs = useGameStore.getState();
          if (_cs.chaosLevel > 0 && !_cs.currentLevelData) return;
        }
        if (gsapAnimRef.current) return;
        const m = mapSwipe(ds.n, dx, dy, ds.shiftKey);
        if (m) {
          if (onClearTileSelectionRef.current) onClearTileSelectionRef.current();
          const sliceIndex = ds.pos[m.axis === 'col' ? 'x' : m.axis === 'row' ? 'y' : 'z'];
          // Slice membership comes straight from the shared index helper — no
          // size³ walk, and the same definition the logical rotation uses.
          const sliceIndices = new Set(getSliceLinearIndices(sizeRef.current, m.axis, sliceIndex));
          _dragBasePositions.clear();
          _dragBaseRotations.clear();
          let _poolIdx = 0;
          sliceIndices.forEach(idx => {
            const g = cubieRefs.current[idx];
            // The pool is sized for the largest cube any mode builds; the guard is
            // here so an unexpected size degrades to "some cubies don't drag"
            // rather than throwing inside a pointer handler.
            if (g && _poolIdx < _MAX_SLICE) {
              _dragPosPool[_poolIdx].copy(g.position);
              _dragRotPool[_poolIdx].copy(g.quaternion);
              _dragBasePositions.set(idx, _dragPosPool[_poolIdx]);
              _dragBaseRotations.set(idx, _dragRotPool[_poolIdx]);
              _poolIdx++;
            }
          });
          // mappingDir encodes camera/face correction only (not drag direction).
          // dir from mapSwipe flips sign with the drag direction, so multiplying
          // it by the drag displacement would make both directions snap the same way.
          // Normalise it out: mappingDir = dir * sign(initial_drag_in_dominant_axis).
          const isDomHoriz = Math.abs(dx) >= Math.abs(dy);
          const mappingDir = isDomHoriz ? m.dir * Math.sign(dx) : m.dir * Math.sign(-dy);
          liveDragRef.current = {
            axis: m.axis, sliceIndex, sliceIndices, basePositions: _dragBasePositions, baseRotations: _dragBaseRotations,
            startDx: dx, startDy: dy, dir: m.dir, mappingDir
          };
          sliceIndicesRef.current = sliceIndices;
          // Belt-and-suspenders: also disable here in case the ref was stale at pointerdown.
          controlsEnabledRef.current = false;
          if (controlsRef.current) controlsRef.current.enabled = false;
        }
      }

      // Update angle during live drag
      if (liveDragRef.current) {
        const ld = liveDragRef.current;
        // Use mappingDir (camera/face correction only) so that opposite drag
        // directions produce opposite angles rather than the same sign.
        const dragDist = Math.abs(dx) > Math.abs(dy)
          ? (dx - ld.startDx) * ld.mappingDir
          : (ld.startDy - dy) * ld.mappingDir;  // Flip Y since screen Y is inverted
        ld.angle = (dragDist / PIXELS_PER_90DEG) * (Math.PI / 2);
      }
    };

    const up = e => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        dragStartRef.current = null;
        setDragStart(null);
        controlsEnabledRef.current = true; if (controlsRef.current) controlsRef.current.enabled = true;
        return;
      }

      const ds = dragStartRef.current;
      if (!ds) return;

      // Handle live drag release
      if (liveDragRef.current) {
        const ld = liveDragRef.current;
        const currentAngle = ld.angle || 0;
        const quarterTurn = Math.PI / 2;

        // Calculate how many quarter turns to snap to (round to nearest)
        const quarterTurns = Math.round(currentAngle / quarterTurn);
        const shouldComplete = quarterTurns !== 0;

        if (shouldComplete) {
          const savedPos = ds.pos;
          const savedAxis = ld.axis;
          const numTurns = Math.abs(quarterTurns);
          const gameDir = quarterTurns > 0 ? 1 : -1;
          const targetAngle = quarterTurns * quarterTurn;

          // Single-turn: signal the animState useEffect to skip its own GSAP anim,
          // Single-turn: signal the animState useEffect to skip its own GSAP anim,
          // since we are handling the visual here and will call onMove on complete.
          if (numTurns === 1) skipNextAnimRef.current = true;

          // GSAP animates ld.angle only — useFrame remains the single cubie writer,
          // so there is no conflict between two systems touching g.position/quaternion.
          // Duration is proportional to the remaining angle, not the total turn count.
          const remaining = Math.abs(targetAngle - currentAngle);
          const snapDuration = Math.max(0.06, (remaining / quarterTurn) * 0.15);
          gsapAnimRef.current = gsap.to(ld, {
            angle: targetAngle,
            duration: snapDuration,
            ease: 'power3.out',
            onComplete: () => {
              gsapAnimRef.current = null;

              // Write final rotated positions imperatively to Three.js objects NOW,
              // before clearing liveDragRef. This ensures there is zero gap frames
              // between "liveDragRef cleared" and "useLayoutEffect commits new cubies".
              // useFrame at priority -1 will no longer touch these cubies (liveDragRef
              // is about to be null), and useLayoutEffect will overwrite with the same
              // correct grid positions once the new cubies land.
              const ld = liveDragRef.current;
              if (ld) {
                const worldAxis =
                  ld.axis === 'col' ? _axisCol :
                    ld.axis === 'row' ? _axisRow :
                      _axisDepth;
                ld.sliceIndices.forEach(idx => {
                  const g = cubieRefs.current[idx];
                  if (g && ld.basePositions.has(idx)) {
                    const basePos = ld.basePositions.get(idx);
                    const baseRot = ld.baseRotations.get(idx);
                    g.position.copy(basePos).applyAxisAngle(worldAxis, ld.angle);
                    g.quaternion.copy(baseRot);
                    _rotQuat.setFromAxisAngle(worldAxis, ld.angle);
                    g.quaternion.premultiply(_rotQuat);
                  }
                });
              }

              liveDragRef.current = null;
              sliceIndicesRef.current = null;
              resetLiveRotation();
              // trigger onMove (which now always sets animState for 1 turn).
              onMoveRef.current(savedAxis, gameDir, savedPos, numTurns);
            }
          });
        } else {
          // Snap back to zero — proportional duration so a tiny overswing snaps back fast.
          const snapBackDuration = Math.max(0.06, (Math.abs(currentAngle) / quarterTurn) * 0.15);
          gsapAnimRef.current = gsap.to(ld, {
            angle: 0,
            duration: snapBackDuration,
            ease: 'power3.out',
            onComplete: () => {
              gsapAnimRef.current = null;
              liveDragRef.current = null;
              sliceIndicesRef.current = null;
              resetLiveRotation();
            }
          });
        }
        dragStartRef.current = null;
        setDragStart(null);
        controlsEnabledRef.current = true; if (controlsRef.current) controlsRef.current.enabled = true;
        return;
      }

      // Handle tap
      const { clientX, clientY } = getClientCoords(e);
      const dx = clientX - ds.screenX, dy = clientY - ds.screenY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        if (flipModeRef.current) {
          const { x, y, z } = ds.pos;
          const dirKey = dirFromNormal(ds.n);
          const store = useGameStore.getState();

          // Disparity chaos mode: tapping a flipped tile wave-heals outward.
          // Wave 0 = tapped tile (fires immediately), wave N = tiles N steps away
          // on the same face. Each wave heals + pops its cubies outward.
          if (store.chaosLevel > 0) {
            const liveCubs = store.cubies;
            const tapped = liveCubs[x]?.[y]?.[z]?.stickers[dirKey];
            if (tapped && tapped.curr !== tapped.orig) {
              // Build manifold map once from the snapshot so antipodal lookups are fast.
              const manifoldMap = buildManifoldGridMap(liveCubs, size);
              // BFS over the MANIFOLD neighbourhood (not just the tapped face) so the
              // heal follows damage across seams onto adjacent sides — chaos chains
              // spread cross-face, so a face-only heal left orphaned damage on the
              // neighbouring faces it had jumped to. Key visited state per sticker
              // (x,y,z,dirKey) since corner cubies host multiple stickers.
              const waves = [[{ x, y, z, dirKey }]];
              const visited = new Set([`${x},${y},${z},${dirKey}`]);
              let frontier = [{ x, y, z, dirKey }];
              while (frontier.length > 0) {
                const nextFrontier = [];
                const wave = [];
                for (const cur of frontier) {
                  for (const n of getManifoldNeighbors(cur.x, cur.y, cur.z, cur.dirKey, size)) {
                    const key = `${n.x},${n.y},${n.z},${n.dirKey}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    const ns = liveCubs[n.x]?.[n.y]?.[n.z]?.stickers?.[n.dirKey];
                    if (ns && ns.curr !== ns.orig) { wave.push(n); nextFrontier.push(n); }
                  }
                }
                if (wave.length > 0) waves.push(wave);
                frontier = nextFrontier;
              }
              const totalHealed = waves.reduce((s, w) => s + w.length, 0);
              // Award score up-front so the counter updates on tap.
              useGameStore.setState((s) => ({ disparityParityScore: s.disparityParityScore + totalHealed * EARN_DISPARITY_TILE_RESTORE }));
              waves.forEach((tiles, waveIdx) => {
                const fire = () => {
                  const now = performance.now();
                  let updated = useGameStore.getState().cubies;
                  const pops = {};
                  for (const t of tiles) {
                    // Heal the tapped tile — the cubie-pop (below) is the only feedback:
                    // the tile simply springs back to its true color. No white particle
                    // burst / seal overlay here; that read as a white tile slapped over
                    // the sticker and broke immersion.
                    const st = liveCubs[t.x]?.[t.y]?.[t.z]?.stickers?.[t.dirKey];
                    updated = healSticker(updated, size, t.x, t.y, t.z, t.dirKey);
                    pops[`${t.x},${t.y},${t.z}`] = { startMs: now, durationMs: 500 };
                    // Heal its antipodal pair — same logical sticker on the opposite face.
                    if (st) {
                      const anti = findAntipodalStickerByGrid(manifoldMap, st, size);
                      if (anti) {
                        updated = healSticker(updated, size, anti.x, anti.y, anti.z, anti.dirKey);
                        pops[`${anti.x},${anti.y},${anti.z}`] = { startMs: now, durationMs: 500 };
                      }
                    }
                  }
                  useGameStore.setState((s) => ({ cubies: updated, cubiePops: { ...pruneExpiredFx(s.cubiePops, now), ...pops } }));
                };
                if (waveIdx === 0) fire(); else setTimeout(fire, waveIdx * 130);
              });
              return;
            }
          }

          onTapFlipRef.current(ds.pos, dirKey);
        } else if (onSelectTileRef.current) {
          onSelectTileRef.current(ds.pos, dirFromNormal(ds.n));
        }
      }

      dragStartRef.current = null;
      setDragStart(null);
      controlsEnabledRef.current = true; if (controlsRef.current) controlsRef.current.enabled = true;
    };

    // Use pointer events only - they handle mouse, touch, and pen uniformly
    // Adding both pointer and touch events causes double-firing on touch devices
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []); // Run once - use refs for all state

  // Lock camera to Home Grip POV when hands mode is enabled
  useEffect(() => {
    if (handsMode) {
      camera.position.set(0, 1.2, 10);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      // Reset TrackballControls target so it doesn't fight the lock
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.reset();
      }
    }
  }, [handsMode, camera]);

  // Flush TrackballControls internal state when worm mode activates so its
  // damping momentum doesn't fight the WormChaseCamera on the first frames.
  useEffect(() => {
    if (wormHealerMode && controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.reset();
    }
  }, [wormHealerMode]);

  // Programmatic camera orbit for mobile view-rotation buttons.
  // Rotates the camera position 45° around the world Y axis so the user can
  // inspect all sides of the cube without needing empty canvas space to drag.
  const prevCameraOrbitRequestRef = useRef(cameraOrbitRequest);
  useEffect(() => {
    if (cameraOrbitRequest === prevCameraOrbitRequestRef.current) return;
    prevCameraOrbitRequestRef.current = cameraOrbitRequest;
    if (!cameraOrbitDir || handsMode) return;
    const angle = cameraOrbitDir === 'cw' ? -Math.PI / 4 : Math.PI / 4;
    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) controlsRef.current.update();
  }, [cameraOrbitRequest, cameraOrbitDir, handsMode, camera]);

  // Store refs for values accessed in useFrame to avoid stale closures
  const onAnimCompleteRef = useRef(onAnimComplete);
  onAnimCompleteRef.current = onAnimComplete;
  const explosionFactorRef = useRef(explosionFactor);
  explosionFactorRef.current = explosionFactor;

  // Pre-compile default tile style shaders on mount to prevent first-use stalls.
  // warmUpDefaultStyles calls renderer.compile() which triggers GLSL compilation
  // before any user interaction, eliminating the ~200 ms hitch on first style pick.
  useEffect(() => {
    const fc = resolveColors(settings, settings?.biomeMode?.faceAssignment);
    const colors = fc ? Object.values(fc) : [];
    if (colors.length === 0) return;
    // Also warm the per-face styles currently equipped so the first flip of
    // each face never pays a material-creation/compile stall mid-game.
    const equippedStyles = Object.values(settings?.manifoldStyles ?? {});
    warmUpDefaultStyles(gl, camera, colors, equippedStyles);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional one-shot on mount

  // Camera auto-zoom: push camera out while explosion animates so the cube stays in view.
  // Once ef settles (animation complete) we stop overriding the camera so the user
  // can freely scroll/pinch to zoom. The auto-push also runs in reverse during collapse
  // so the camera smoothly returns to the pre-explosion distance.
  const preExplodeDist = useRef(0);
  const wasExploding = useRef(false);
  const prevEfRef2 = useRef(0);

  // Spin-energy tracking for reactive tile styles (orbChamber): derive the
  // rotation's angular speed from liveRotation.angle frame-to-frame, feed it to
  // the shared `spin` uniform with a fast attack / slow decay so the tiles keep
  // jostling briefly after the turn settles.
  const spinEnergyRef = useRef(0);
  const prevRotAngleRef = useRef(0);
  const wasRotActiveRef = useRef(false);
  const prevSpinTimeRef = useRef(0);
  const latchedSpinAxisRef = useRef(0);
  const latchedSpinSliceRef = useRef(0);

  // Per-cell dice-roll state: a data texture (R = roll count) indexed by grid
  // cell, bumped for the rotating slice on every turn. The dice style folds it
  // into its face hash so a cell that a tile revisits never repeats its face,
  // while non-rotated cells hold. Rebuilt when the cube size changes.
  const cellRollTexRef = useRef(null);
  const cellRollDataRef = useRef(null);
  useEffect(() => {
    const w = size * size, h = size;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255; // opaque
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    cellRollDataRef.current = data;
    cellRollTexRef.current = tex;
    setDiceCellState(tex, size, (size - 1) / 2);
    return () => tex.dispose();
  }, [size]);


  useFrame(() => {
    const ef = explosionFactorRef.current;
    const isExploding = ef > 0;

    // Capture camera distance the frame explosion starts
    if (isExploding && !wasExploding.current) {
      preExplodeDist.current = camera.position.length();
    }
    wasExploding.current = isExploding;

    // Only override the camera while ef is actively animating (changing > 0.001 per frame).
    // When ef is stable (fully open or fully closed), hands off — user controls zoom freely.
    const efAnimating = Math.abs(ef - prevEfRef2.current) > 0.001;
    prevEfRef2.current = ef;

    if (preExplodeDist.current > 0 && efAnimating) {
      const explosionMultiplier = size >= 4 ? 1.53 : 1.8;
      const zoomFactor = 1 + ef * explosionMultiplier * 0.55;
      const targetDist = preExplodeDist.current * zoomFactor;
      const currentDist = camera.position.length();

      if (Math.abs(currentDist - targetDist) > 0.05) {
        camera.position.setLength(currentDist + (targetDist - currentDist) * 0.1);
      }

      // Done collapsing — clear saved distance so we stop nudging the camera
      if (ef === 0 && Math.abs(currentDist - preExplodeDist.current) < 0.1) {
        camera.position.setLength(preExplodeDist.current);
        preExplodeDist.current = 0;
      }
    }
  }); // Default priority 0: drei's TrackballControls runs at -1, so we naturally run after it

  // Track the previous animation progress for incremental rotation
  const prevProgressRef = useRef(0);

  // Start the GSAP tween when a new wave arrives.
  //
  // Keyed on the wave, not on `animState`: a two- or three-plane wave leaves
  // `animState` null by design, so keying on it would leave multi-plane waves
  // with no tween at all — the cube would jump to its committed state with no
  // animation and the worm would never get to ride the turn.
  useEffect(() => {
    if (!animWave) {
      // Reset progress refs when animation ends
      animProgressRef.current.value = 0;
      prevProgressRef.current = 0;
      waveIdRef.current = null;
      waveIndicesRef.current = null;
      waveBaseRef.current = null;
      return;
    }

    // Skip animation if this came from a drag commit (visual already at target)
    if (skipNextAnimRef.current) {
      skipNextAnimRef.current = false;
      // Reset progress refs so the -1 useFrame doesn't apply a stale delta
      animProgressRef.current.value = 0;
      prevProgressRef.current = 0;

      // Immediately complete without animation - handleAnimComplete clears animState
      vibrate(14);
      onAnimCompleteRef.current();
      return;
    }

    // Kill any existing animation
    if (gsapAnimRef.current) {
      gsapAnimRef.current.kill();
    }

    // Reset progress for new animation
    animProgressRef.current.value = 0;
    prevProgressRef.current = 0;

    // Use GSAP to animate the progress value with snappy easing
    // Hands mode and shuffle moves use faster, crisper animations
    const isHands = handsModeRef.current;
    const isShuffle = !!animWave?.isShuffle;
    const isWormScramble = !!animWave?.wormScramble;
    // The worm-mode opening scramble plays at the exact same speed/ease as a normal
    // in-game turn (not the snappy hands/shuffle speed), so each move reads clearly
    // instead of blurring past.
    const isFast = (isHands || isShuffle) && !isWormScramble;
    // Worm-mode hazard rotations (the auto inverse-turns that grind through the worm)
    // run far slower than a normal turn so the slice menacingly creeps through instead
    // of snapping — the slow execution itself is the "looming danger" payoff after the
    // warning beam counts down. The opening scramble and normal cube solving keep
    // their standard timing.
    const isWormHazard = !isFast && !isWormScramble && useGameStore.getState().wormHealerMode;
    const baseDuration = isFast ? 0.12 : 0.35;
    gsapAnimRef.current = gsap.to(animProgressRef.current, {
      value: 1,
      duration: isWormHazard ? baseDuration * 4.0 : baseDuration,
      ease: isFast ? "power2.out" : "back.out(1.4)",
      onComplete: () => {
        gsapAnimRef.current = null;
        sliceIndicesRef.current = null;
        waveIdRef.current = null;
        waveIndicesRef.current = null;
        waveBaseRef.current = null;
        resetLiveRotation();
        vibrate(isFast ? 8 : 14);
        onAnimCompleteRef.current();
      }
    });

    return () => {
      if (gsapAnimRef.current) {
        gsapAnimRef.current.kill();
        gsapAnimRef.current = null;
      }
    };
  }, [animWave]);

  // Priority -2: earliest possible hook — detects state changes (via rotationEpoch)
  // or animState transitions and snaps all cubies to their grid positions
  // before any other useFrame runs.
  //
  // Why this is necessary: StickerPlane writes instanceColorRef.current in the
  // React render body (not a useLayoutEffect), so in React 18 concurrent mode the
  // colour ref can be updated by a speculative render before the commit that
  // carries CubeAssembly's position-reset useLayoutEffect. Without this guard
  // StickerInstances (priority 0) would sample the new colour with the still-rotated
  // matrixWorld, producing a one-frame flash of new colours at wrong positions.

  useFrame(() => {
    // Tracks the wave, not `animState` — a multi-plane wave leaves `animState`
    // null, so watching that would miss the end of every multi-plane rotation and
    // skip the snap-to-grid this guard exists to perform.
    const wasAnimating = prevAnimStateRef.current !== null;
    const nowAnimating = animWaveRef.current !== null;
    const epochChanged = rotationEpoch !== prevRotationEpochRef.current;

    prevAnimStateRef.current = animWaveRef.current;
    prevRotationEpochRef.current = rotationEpoch;

    // Snap if we just finished an animation OR if the logical state jumped (drag snap)
    if ((wasAnimating && !nowAnimating) || epochChanged) {
      const explosionMultiplier = size >= 4 ? 1.53 : 1.8;
      const expansionFactor = 1 + explosionFactorRef.current * explosionMultiplier;
      for (let idx = 0; idx < positionCache.length; idx++) {
        const g = cubieRefs.current[idx];
        if (!g) continue;
        g.position.set(
          positionCache[idx][0] * expansionFactor,
          positionCache[idx][1] * expansionFactor,
          positionCache[idx][2] * expansionFactor
        );
        g.rotation.set(0, 0, 0);
      }
    }
  }, -2);

  // useFrame applies live drag rotation and GSAP-driven animations.
  // Priority -1: runs before all priority-0 subscribers (StickerPlane animations
  // and StickerInstanceProvider matrix sampling) so that cubieRef positions and
  // quaternions are fully updated before StickerInstances reads matrixWorld.
  useFrame((state) => {
    // Update shared time uniform for animated tile styles
    updateSharedTime(state.clock.elapsedTime);
    // Pre-compute tremor surge once so all StickerPlane instances read a shared
    // value instead of each independently running 3×sin + pow + max per frame.
    updateSharedTremor(state.clock.elapsedTime);

    // Derive spin energy from the rotation in progress (reads liveRotation as
    // filled by the previous frame — one-frame lag is imperceptible). Angular
    // speed is normalized so a brisk quarter-turn saturates the effect; energy
    // attacks instantly and decays smoothly so orbChamber balls keep bouncing
    // for a moment after the layer settles.
    {
      const now = state.clock.elapsedTime;
      const dt = Math.max(1e-3, now - prevSpinTimeRef.current);
      prevSpinTimeRef.current = now;
      const rotActive = liveRotations.active;
      // Plane 0's sweep stands in for the whole wave here: every plane shares an
      // axis and a tween, so they build spin energy at the same rate.
      const leadAngle = rotActive ? liveRotations.planes[0].angle : 0;
      let angSpeed = 0;
      if (rotActive && wasRotActiveRef.current) {
        angSpeed = Math.abs(leadAngle - prevRotAngleRef.current) / dt;
      }
      prevRotAngleRef.current = leadAngle;
      // Dice: on the frame a turn begins, bump the roll count of every cell in
      // every rotating slice so their dice re-roll to a fresh face and a returning
      // cell never repeats. Non-rotated cells are untouched → they hold.
      if (rotActive && !wasRotActiveRef.current && cellRollDataRef.current) {
        const data = cellRollDataRef.current;
        const n = size;
        const ax = liveRotations.axis;
        for (let p = 0; p < liveRotations.count; p++) {
          const si = liveRotations.planes[p].sliceIndex;
          forEachSliceCoordinate(n, ax, si, (cx, cy, cz) => {
            const off = (cz * (n * n) + cx + cy * n) * 4;
            data[off] = (data[off] + 1) & 255;
          });
        }
        cellRollTexRef.current.needsUpdate = true;
      }
      wasRotActiveRef.current = rotActive;
      // ~6 rad/s (a fast quarter-turn) → full energy.
      const target = rotActive ? Math.min(1, angSpeed / 6) : 0;
      const e = spinEnergyRef.current;
      spinEnergyRef.current = e < target ? target : e * 0.95;

      // Latch which slice is turning (world coord along its axis) while active,
      // and hold it through the energy decay so the just-moved tiles keep
      // jostling. Cubie centers sit at (index - k) * expansionFactor; the slice's
      // axis coordinate is invariant under its own rotation, so this identifies
      // exactly the tiles that moved.
      if (rotActive) {
        latchedSpinAxisRef.current =
          liveRotations.axis === 'row' ? 1 : liveRotations.axis === 'depth' ? 2 : 0;
        const kCenter = (size - 1) / 2;
        const expMult = size >= 4 ? 1.53 : 1.8;
        const exp = 1 + explosionFactorRef.current * expMult;
        // The shader latch carries one slice coordinate, so a multi-plane wave
        // jostles the tiles of its first plane. Extending the uniform to three
        // slices is cosmetic-only and belongs with the Mega renderer work.
        latchedSpinSliceRef.current = (liveRotations.planes[0].sliceIndex - kCenter) * exp;
      }
      updateSharedSpin(spinEnergyRef.current, latchedSpinAxisRef.current, latchedSpinSliceRef.current);
      updateDiceRoll(dt, spinEnergyRef.current);
    }


    // Apply live drag rotation - instant, follows finger
    if (liveDragRef.current && liveDragRef.current.basePositions) {
      const ld = liveDragRef.current;
      const worldAxis = ld.axis === 'col' ? _axisCol : ld.axis === 'row' ? _axisRow : _axisDepth;
      const angle = ld.angle || 0;

      ld.sliceIndices.forEach(idx => {
        const g = cubieRefs.current[idx];
        if (g && ld.basePositions.has(idx)) {
          const basePos = ld.basePositions.get(idx);
          const baseRot = ld.baseRotations.get(idx);
          // Apply rotation from base position (not incremental)
          g.position.copy(basePos).applyAxisAngle(worldAxis, angle);
          g.quaternion.copy(baseRot);
          _rotQuat.setFromAxisAngle(worldAxis, angle);
          g.quaternion.premultiply(_rotQuat);
        }
      });
      // A finger drags exactly one slice, so a drag is always a one-plane wave.
      // Re-seeding only when the slice changes keeps the per-frame cost to the
      // single angle write.
      if (liveRotations.count !== 1 || liveRotations.planes[0].sliceIndex !== ld.sliceIndex || liveRotations.axis !== ld.axis) {
        setLiveWave(-1, ld.axis, [{ sliceIndex: ld.sliceIndex, dir: 1, numTurns: 1 }]);
      }
      setPlaneAngle(0, angle);
      return; // Skip wave processing during live drag
    }

    // Handle GSAP snap animation (completing rotation after release).
    //
    // The wave is authoritative; `animState` is only its single-plane shadow. A
    // wave of two or three parallel planes has no meaningful `animState`, so
    // reading that instead would animate nothing at all.
    const wave = animWaveRef.current;
    if (!wave) { resetLiveWaveIdle(); return; }

    const worldAxis = wave.axis === 'col' ? _axisCol : wave.axis === 'row' ? _axisRow : _axisDepth;
    const planes = wave.rotations;

    // On wave start, cache each plane's cubie indices and snapshot its resting
    // pose. Rotating from a snapshot every frame (rather than accumulating a
    // per-frame delta) means three planes advancing at different rates can't
    // drift apart, and a dropped frame costs nothing.
    if (waveIdRef.current !== wave.id) {
      waveIdRef.current = wave.id;
      waveIndicesRef.current = planes.map(p => getSliceLinearIndices(size, wave.axis, p.sliceIndex));
      let poolIdx = 0;
      waveBaseRef.current = waveIndicesRef.current.map(indices => {
        const basePos = new Map();
        const baseRot = new Map();
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          const g = cubieRefs.current[idx];
          if (!g || poolIdx >= _MAX_WAVE_CUBIES) continue;
          _wavePosPool[poolIdx].copy(g.position);
          _waveRotPool[poolIdx].copy(g.quaternion);
          basePos.set(idx, _wavePosPool[poolIdx]);
          baseRot.set(idx, _waveRotPool[poolIdx]);
          poolIdx++;
        }
        return { basePos, baseRot };
      });
      setLiveWave(wave.id, wave.axis, planes);
    }

    const currentProgress = animProgressRef.current.value;
    prevProgressRef.current = currentProgress;

    const bases = waveBaseRef.current;
    for (let p = 0; p < planes.length; p++) {
      const plane = planes[p];
      // A plane may lag the wave by a fraction of the tween. Every plane still
      // reaches 1 at the same moment, so the logical commit stays atomic however
      // the sweeps are staggered.
      const delay = plane.delay ?? 0;
      const t = delay > 0 && delay < 1
        ? Math.min(1, Math.max(0, (currentProgress - delay) / (1 - delay)))
        : currentProgress;
      const angle = t * (Math.PI / 2) * (plane.numTurns ?? 1) * plane.dir;
      setPlaneAngle(p, angle);

      const indices = waveIndicesRef.current[p];
      const base = bases?.[p];
      if (!indices || !base) continue;
      _rotQuat.setFromAxisAngle(worldAxis, angle);
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const g = cubieRefs.current[idx];
        if (!g) continue;
        const bp = base.basePos.get(idx);
        const br = base.baseRot.get(idx);
        if (!bp) continue;
        g.position.copy(bp).applyAxisAngle(worldAxis, angle);
        g.quaternion.copy(br);
        g.quaternion.premultiply(_rotQuat);
      }
    }
  }, -1);

  // Stable ref callbacks so that passing ref={fn} doesn't defeat React.memo on Cubie.
  // We create one callback per index, memoized by size.
  const maxCubies = size * size * size;
  const cubieRefCallbacks = useMemo(() => {
    return Array.from({ length: maxCubies }, (_, idx) => (el) => {
      cubieRefs.current[idx] = el;
    });
  }, [maxCubies]);

  const k = (size - 1) / 2;

  // Cache position arrays so they're stable references across cubies updates.
  // Always use regular grid-centered positions: mirror mode only changes box
  // *dimensions* (handled per-cubie in Cubie.jsx), not the lattice positions.
  // This keeps the animation applyAxisAngle math correct — a 90° turn of
  // [x-k, y-k, z-k] always lands exactly on another valid lattice slot.
  const positionCache = useMemo(() => {
    const cache = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
      cache.push([x - k, y - k, z - k]);
    }
    return cache;
  }, [size, k]);

  const items = useMemo(() => {
    // Guard against size/cubies mismatch during size transitions
    if (cubies.length !== size) return [];
    const arr = []; let i = 0;
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
      arr.push({ key: i, pos: positionCache[i], cubie: cubies[x][y][z] });
      i++;
    }
    return arr;
  }, [cubies, size, positionCache]);

  // Reset cubie positions/rotations when animation ends or cubies change.
  // Uses useLayoutEffect so the reset happens BEFORE the browser paints,
  // preventing a 1-frame glitch where cubies show new colors at old positions.
  useLayoutEffect(() => {
    if (!animWave) {
      sliceIndicesRef.current = null;
      // Reduce explosion distance by 15% for larger cubes (4x4, 5x5)
      const explosionMultiplier = size >= 4 ? 1.53 : 1.8;
      const expansionFactor = 1 + explosionFactor * explosionMultiplier;
      items.forEach((it, idx) => {
        const g = cubieRefs.current[idx];
        if (g) {
          g.position.set(
            it.pos[0] * expansionFactor,
            it.pos[1] * expansionFactor,
            it.pos[2] * expansionFactor
          );
          g.rotation.set(0, 0, 0);
        }
      });
    }
  }, [animWave, items, explosionFactor]);

  return (
    <StickerInstanceProvider>
      <StickerAnimationDriver />
      <group ref={cubeGroupRef}>
        <WormholeNetwork
          manifoldMap={manifoldMap}
          cubieRefs={cubieRefs.current}
        />
        {/* VoidCore: swirling wormhole-color rings at the cube's hollow center */}
        <VoidCore />
        {/* Solid body + interaction overlays only — hidden for the whole tunnel traversal so they
            don't z-fight with TunnelInteriorView, while the Möbius ribbons and VoidCore above stay visible. */}
        <group visible={!wormholeBodyHidden}>
          {!isBiomeMode && cascades.map(c =>
            c?.from && c?.to ? (
              <ChaosWave
                key={c.id}
                from={c.from}
                to={c.to}
                crossFace={c.crossFace}
                onComplete={() => onCascadeComplete(c.id)}
              />
            ) : null
          )}
          {flipWaveOrigins && flipWaveOrigins.length > 0 && (
            <FlipPropagationWave
              origins={flipWaveOrigins}
              onComplete={onFlipWaveComplete}
            />
          )}
          {!wormTunnelActive && <group>
            {items.map((it, idx) => {
              // Skip the center cubie on odd-sized cubes — VoidCore occupies that space
              const isCenterVoid = size % 2 !== 0 &&
                it.pos[0] === 0 && it.pos[1] === 0 && it.pos[2] === 0;
              if (isCenterVoid) return null;
              // Skip fully interior cubies — they are never visible from any camera angle.
              // pos is in centered coords; a cubie is interior when all axes are strictly
              // between -(size-1)/2 and +(size-1)/2 (i.e. it touches no face).
              const half = (size - 1) / 2;
              if (Math.abs(it.pos[0]) < half && Math.abs(it.pos[1]) < half && Math.abs(it.pos[2]) < half) return null;
              return (
                <Cubie
                  key={it.key}
                  ref={cubieRefCallbacks[idx]}
                  position={it.pos}
                  cubie={it.cubie}
                  size={size}
                  wormMode={wormHealerMode}
                  hideBody={wormExitRideActive}
                  onPointerDown={onPointerDown}
                />
              );
            })}
          </group>}
          {showCursor && cursor && (
            <CursorHighlight />
          )}
          {solveHighlights && solveHighlights.length > 0 && (
            <SolveHighlight
              highlights={solveHighlights}
            />
          )}
          {/* DragGuide removed - real-time cube rotation provides visual feedback */}
          <TrackballControls
            ref={controlsRef}
            noPan={true}
            noZoom={handsMode && explosionFactor === 0}
            noRotate={handsMode ? true : false}
            minDistance={5}
            maxDistance={MAX_DISTANCE_BY_SIZE[size] || 28}
            enabled={!wormHealerMode && (!handsMode || explosionFactor > 0) && !animWave && !dragStart && controlsEnabledRef.current && !wormTunnelActive}
            staticMoving={false}
            dynamicDampingFactor={isTouchDevice ? 0.15 : 0.08}
            rotateSpeed={isTouchDevice ? 0.8 : 1.2}
          />
          {/* Micro-kicks the camera along the flipped tile's normal on each flip. */}
          <CameraFlipKick controlsRef={controlsRef} />
        </group>
      </group>
    </StickerInstanceProvider>
  );
});

export default CubeAssembly;
