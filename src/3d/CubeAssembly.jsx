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
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { liveCubies } from '../worm/liveCubies.js';
import { collectHealWave, healTilePair, isHealable } from '../game/chaosHeal.js';
import { buildManifoldGridMap } from '../game/manifoldLogic.js';
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
// Mega Mode supports size 15, so a rotated slice can contain up to 15² = 225 cubies.
const _MAX_SLICE = 225;
const _dragPosPool = Array.from({ length: _MAX_SLICE }, () => new THREE.Vector3());
const _dragRotPool = Array.from({ length: _MAX_SLICE }, () => new THREE.Quaternion());
const _dragBasePositions = new Map();
const _dragBaseRotations = new Map();

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
const MAX_DISTANCE_BY_SIZE = { 2: 28, 3: 28, 4: 38, 5: 52, 6: 68, 7: 85, 15: 175 };

// Pixels of drag to complete a 90° rotation
const PIXELS_PER_90DEG = 100;

const CubeAssembly = React.memo(({
  size, cubies, onMove, onTapFlip, animState, onAnimComplete,
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

  // Mega Mode only: the chassis boxes beneath each rotating plane spin in lock-step
  // with that plane (in ITS own direction — the two hazard planes turn opposite
  // ways) so the swept side-stickers always stay in front of their black backing.
  // One group ref per rotating plane; their quaternions are written every frame by
  // the priority -1 useFrame. megaChassisRef mirrors the current chassis descriptor
  // so that frame loop can read the per-band directions without a stale closure.
  const megaBandRefs = useRef([]);
  const megaChassisRef = useRef(null);
  // Per-cubie-index turn direction for the active animation (a slice pair can turn
  // its two planes in opposite directions), built alongside sliceIndicesRef.
  const sliceDirByIdxRef = useRef(null);

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
  const animStateRef = useRef(animState);
  animStateRef.current = animState;
  const prevAnimStateRef = useRef(null); // tracks last frame's animState for transition detection
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
    if (animStateRef.current) return;
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

  // Mega replaces 1,178 individual body meshes with one chassis. Convert a hit
  // on that box back into the same grid coordinate a Cubie would have supplied,
  // retaining tile taps and slice drags without rebuilding per-cubie hit meshes.
  const onMegaChassisPointerDown = useCallback((event) => {
    if (!cubeGroupRef.current || !event.point || !event.face?.normal) return;
    const s = sizeRef.current;
    const k = (s - 1) / 2;
    const local = cubeGroupRef.current.worldToLocal(event.point.clone());
    const clampIndex = value => Math.max(0, Math.min(s - 1, Math.round(value + k)));
    const pos = {
      x: clampIndex(local.x),
      y: clampIndex(local.y),
      z: clampIndex(local.z),
    };
    const n = event.face.normal;
    if (Math.abs(n.x) > 0.5) pos.x = n.x > 0 ? s - 1 : 0;
    else if (Math.abs(n.y) > 0.5) pos.y = n.y > 0 ? s - 1 : 0;
    else pos.z = n.z > 0 ? s - 1 : 0;
    onPointerDown({ pos, worldPos: event.point, event });
  }, [onPointerDown]);


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
          const sliceIndices = new Set();
          const n = sizeRef.current * sizeRef.current * sizeRef.current;
          for (let idx = 0; idx < n; idx++) {
            const z = idx % sizeRef.current;
            const y = Math.floor(idx / sizeRef.current) % sizeRef.current;
            const x = Math.floor(idx / (sizeRef.current * sizeRef.current));
            if ((m.axis === 'col' && x === sliceIndex) ||
              (m.axis === 'row' && y === sliceIndex) ||
              (m.axis === 'depth' && z === sliceIndex)) {
              sliceIndices.add(idx);
            }
          }
          _dragBasePositions.clear();
          _dragBaseRotations.clear();
          let _poolIdx = 0;
          sliceIndices.forEach(idx => {
            const g = cubieRefs.current[idx];
            if (g) {
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
            const flipCap = selectEffectiveFlipCap(store);
            const tapped = liveCubs[x]?.[y]?.[z]?.stickers[dirKey];
            if (isHealable(tapped, flipCap)) {
              // Build manifold map once from the snapshot so antipodal lookups are fast.
              const manifoldMap = buildManifoldGridMap(liveCubs, size);
              // BFS over the MANIFOLD neighbourhood (not just the tapped face) so the
              // heal follows damage across seams onto adjacent sides — chaos chains
              // spread cross-face, so a face-only heal left orphaned damage on the
              // neighbouring faces it had jumped to. Dead tiles neither heal nor
              // conduct the wave: see collectHealWave.
              const waves = collectHealWave(liveCubs, size, { x, y, z, dirKey }, flipCap);
              waves.forEach((tiles, waveIdx) => {
                const fire = () => {
                  const now = performance.now();
                  const live = useGameStore.getState();
                  const cap = selectEffectiveFlipCap(live);
                  let updated = live.cubies;
                  const pops = {};
                  let healed = 0;
                  for (const t of tiles) {
                    // Re-check against the CURRENT cube, not the tap-time snapshot:
                    // later waves fire up to a second after the tap, and a tile the
                    // chaos worker capped in the meantime is a tombstone now. Healing
                    // it here would resurrect it on the render thread only, leaving a
                    // healthy-looking tile the simulation had already buried.
                    // healTilePair applies the same guard to the antipodal partner.
                    const step = healTilePair(updated, size, manifoldMap, t, cap);
                    if (!step.healed.length) continue;
                    updated = step.cubies;
                    // The cubie-pop is the only feedback: the tile simply springs
                    // back to its true color. No white particle burst / seal overlay
                    // here; that read as a white tile slapped over the sticker and
                    // broke immersion.
                    for (const h of step.healed) {
                      pops[`${h.x},${h.y},${h.z}`] = { startMs: now, durationMs: 500 };
                    }
                    healed++;
                  }
                  if (healed === 0) return;
                  useGameStore.setState((s) => ({
                    cubies: updated,
                    cubiePops: { ...pruneExpiredFx(s.cubiePops, now), ...pops },
                    disparityParityScore: s.disparityParityScore + healed * EARN_DISPARITY_TILE_RESTORE,
                  }));
                  // The chaos worker simulates on its own private copy of the cube.
                  // Push this edit to it, or it keeps spreading damage the player
                  // just paid to clear and its death ledger drifts away from the
                  // board the player is looking at.
                  useGameStore.getState().requestChaosResync();
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

  // Start GSAP animation when animState changes
  useEffect(() => {
    if (!animState) {
      // Reset progress refs when animation ends
      animProgressRef.current.value = 0;
      prevProgressRef.current = 0;
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
    const isShuffle = !!animState?.isShuffle;
    const isWormScramble = !!animState?.wormScramble;
    // The worm-mode opening scramble now plays fast (like hands/shuffle): 20 parallel
    // pair-moves would drag if each ran at full in-game turn length, so they snap
    // through crisply to get the player into the game sooner.
    const isFast = isHands || isShuffle;
    // Worm-mode hazard rotations (the auto inverse-turns that grind through the worm)
    // run far slower than a normal turn so the planes menacingly creep through instead
    // of snapping — the slow execution itself is the "looming danger" payoff after the
    // warning beam counts down. Only the live hazard turns qualify (not the fast
    // opening scramble, not normal solving).
    const isWormHazard = !isFast && !isWormScramble && useGameStore.getState().wormHealerMode;
    const baseDuration = isFast ? 0.12 : 0.35;
    gsapAnimRef.current = gsap.to(animProgressRef.current, {
      value: 1,
      duration: isWormHazard ? baseDuration * 4.0 : baseDuration,
      ease: isFast ? "power2.out" : "back.out(1.4)",
      onComplete: () => {
        gsapAnimRef.current = null;
        sliceIndicesRef.current = null;
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
  }, [animState]);

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
    const wasAnimating = prevAnimStateRef.current !== null;
    const nowAnimating = animStateRef.current !== null;
    const epochChanged = rotationEpoch !== prevRotationEpochRef.current;

    prevAnimStateRef.current = animStateRef.current;
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
      const rotActive = liveRotation.active;
      let angSpeed = 0;
      if (rotActive && wasRotActiveRef.current) {
        angSpeed = Math.abs(liveRotation.angle - prevRotAngleRef.current) / dt;
      }
      prevRotAngleRef.current = rotActive ? liveRotation.angle : 0;
      // Dice: on the frame a turn begins, bump the roll count of every cell in
      // the rotating slice so their dice re-roll to a fresh face and a returning
      // cell never repeats. Non-rotated cells are untouched → they hold.
      if (rotActive && !wasRotActiveRef.current && cellRollDataRef.current) {
        const data = cellRollDataRef.current;
        const n = size;
        const ax = liveRotation.axis;
        const si = liveRotation.sliceIndex;
        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            let cx, cy, cz;
            if (ax === 'col') { cx = si; cy = a; cz = b; }
            else if (ax === 'row') { cx = a; cy = si; cz = b; }
            else { cx = a; cy = b; cz = si; }
            const off = (cz * (n * n) + cx + cy * n) * 4;
            data[off] = (data[off] + 1) & 255;
          }
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
          liveRotation.axis === 'row' ? 1 : liveRotation.axis === 'depth' ? 2 : 0;
        const kCenter = (size - 1) / 2;
        const expMult = size >= 4 ? 1.53 : 1.8;
        const exp = 1 + explosionFactorRef.current * expMult;
        latchedSpinSliceRef.current = (liveRotation.sliceIndex - kCenter) * exp;
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
      liveRotation.active = true;
      liveRotation.axis = ld.axis;
      liveRotation.sliceIndex = ld.sliceIndex;
      liveRotation.angle = angle;
      return; // Skip animState processing during live drag
    }

    // Handle GSAP snap animation (completing rotation after release)
    if (!animState) { liveRotation.active = false; return; }

    const { axis, dir, sliceIndex } = animState;
    const animatedSlices = animState.sliceIndices?.length ? animState.sliceIndices : [sliceIndex];
    // Per-plane directions (parallel to animatedSlices). A worm hazard turn spins two
    // non-adjacent planes in OPPOSITE directions, so each cubie must rotate by its own
    // plane's direction rather than a single shared `dir`.
    const animatedDirs = animState.sliceDirs?.length ? animState.sliceDirs : animatedSlices.map(() => dir);
    const worldAxis = axis === 'col' ? _axisCol : axis === 'row' ? _axisRow : _axisDepth;

    // On animation start, pre-compute each in-slice ref index → its plane direction.
    if (!sliceIndicesRef.current) {
      const indices = new Set();
      const dirByIdx = new Map();
      const n = size * size * size;
      for (let idx = 0; idx < n; idx++) {
        const z = idx % size;
        const y = Math.floor(idx / size) % size;
        const x = Math.floor(idx / (size * size));
        const coord = axis === 'col' ? x : axis === 'row' ? y : z;
        const li = animatedSlices.indexOf(coord);
        if (li !== -1) { indices.add(idx); dirByIdx.set(idx, animatedDirs[li]); }
      }
      sliceIndicesRef.current = indices;
      sliceDirByIdxRef.current = dirByIdx;
    }

    // Calculate incremental rotation from GSAP progress
    const currentProgress = animProgressRef.current.value;
    const animTurns = animState.numTurns ?? 1;
    const quarterTurns = (Math.PI / 2) * animTurns;
    const baseAngle = currentProgress * quarterTurns; // unsigned; each plane applies its own sign
    liveRotation.active = true;
    liveRotation.axis = axis;
    liveRotation.sliceIndex = sliceIndex;
    liveRotation.angle = baseAngle * dir; // anchor plane's signed angle (the one the worm rides)
    // Mega: spin each band chassis with its own plane so it backs the rotating tiles
    // (in the right direction) instead of the static full box occluding them.
    const mc = megaChassisRef.current;
    if (mc && !mc.rest && mc.bands) {
      for (let bi = 0; bi < mc.bands.length; bi++) {
        const bg = megaBandRefs.current[bi];
        if (bg) bg.quaternion.setFromAxisAngle(worldAxis, baseAngle * mc.bands[bi].dir);
      }
    }
    const deltaProgress = currentProgress - prevProgressRef.current;
    prevProgressRef.current = currentProgress;

    const dRot = deltaProgress * quarterTurns;

    // Apply rotation only to cubies in the slice, each by its own plane direction.
    const sliceSet = sliceIndicesRef.current;
    const dirByIdx = sliceDirByIdxRef.current;
    if (sliceSet && Math.abs(dRot) > 0.0001) {
      sliceSet.forEach(idx => {
        const g = cubieRefs.current[idx];
        if (!g) return;
        const sdir = dirByIdx?.get(idx) ?? dir;
        g.position.applyAxisAngle(worldAxis, dRot * sdir);
        g.rotateOnWorldAxis(worldAxis, dRot * sdir);
      });
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
    if (!animState) {
      sliceIndicesRef.current = null;
      sliceDirByIdxRef.current = null;
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
  }, [animState, items, explosionFactor]);

  // ── Mega Mode chassis geometry ────────────────────────────────────────────
  // A single 15×15 shell would cost >1,100 individual rounded bodies, so Mega
  // backs its sticker grid with one dark box instead. At rest that box is fine,
  // but a static box CANNOT back a *rotating* slice: its corners reach
  // √2·(size/2) ≈ 10.5 from centre, so a side-sticker sweeping at radius ~7.5
  // dips inside the solid box around 45° and is occluded — the "black layers on
  // rotate" bug. The fix: during a turn, carve the box into the two stationary
  // slabs on either side of the rotating band plus one band box that spins WITH
  // the slice (megaBandRef), so the swept tiles always stay in front of it.
  const megaChassis = useMemo(() => {
    if (size < 15) return null;
    const full = size - 0.08;      // outer extent (leaves a hairline gap at edges)
    const half = full / 2;
    if (!animState) return { rest: true, full };
    const axisI = animState.axis === 'col' ? 0 : animState.axis === 'row' ? 1 : 2;
    const k = (size - 1) / 2;
    const layers = animState.sliceIndices?.length ? animState.sliceIndices : [animState.sliceIndex];
    const dirs = animState.sliceDirs?.length ? animState.sliceDirs : layers.map(() => animState.dir);
    // Build an [x,y,z] size + centre pair for a box that is `full` on the two
    // perpendicular axes and [from..to] along the rotation axis.
    const boxAlong = (from, to) => {
      const args = [full, full, full];
      const pos = [0, 0, 0];
      args[axisI] = to - from;
      pos[axisI] = (from + to) / 2;
      return { args, pos };
    };
    // Each rotating plane gets a one-layer-thick band box that spins with it (in its
    // own direction). The stationary regions between/around the planes are filled by
    // static slabs so the resting silhouette stays a solid cube and the seams opening
    // mid-turn read as interior. Works for one plane or several non-adjacent ones.
    const sorted = layers
      .map((idx, i) => ({ idx, dir: dirs[i] }))
      .sort((a, b) => a.idx - b.idx);
    const bands = [];
    const slabs = [];
    let cursor = -half;
    for (const { idx, dir } of sorted) {
      const bandLo = idx - k - 0.5;
      const bandHi = idx - k + 0.5;
      if (bandLo > cursor) slabs.push(boxAlong(cursor, bandLo)); // stationary gap before this plane
      bands.push({ dir, ...boxAlong(bandLo, bandHi) });
      cursor = Math.max(cursor, bandHi);
    }
    if (cursor < half) slabs.push(boxAlong(cursor, half));
    return { rest: false, axisI, bands, slabs };
  }, [size, animState]);
  // Mirror into a ref so the priority -1 useFrame can read per-band directions.
  megaChassisRef.current = megaChassis;

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
          {megaChassis && megaChassis.rest && (
            /* Mega omits 1,178 individual rounded cubie bodies for performance,
               but still needs a continuous dark chassis beneath the sticker grid.
               One inset box restores the black seams, silhouette, and Rubik's-cube
               volume for a single draw call; this parent group hides it during
               tunnel transit just like the old per-cubie bodies. This is keyed
               to size—not the delayed Worm flag—so the Mobi intro and New Game
               wizard never build the expensive body shell first. */
            <mesh
              castShadow={false}
              receiveShadow={false}
              onPointerDown={onMegaChassisPointerDown}
            >
              {/* The sticker face begins 0.51 units from its cubie centre and its
                  footprint can sink 0.0285 units (tile + perimeter offset). Keep
                  the chassis face at 0.46 so depressed tiles remain in front of
                  its depth buffer instead of vanishing at the start of a run. */}
              <boxGeometry args={[megaChassis.full, megaChassis.full, megaChassis.full]} />
              {/* Unlit + opaque is intentional: this is the Rubik's-cube plastic
                  visible in the grid channels, not another shaded face. Ambient
                  light and background bleed made the previous transparent standard
                  material read gray and erased the black cubie perimeter. */}
              <meshBasicMaterial color="#000000" />
            </mesh>
          )}
          {megaChassis && !megaChassis.rest && (
            /* Rotation: static slabs fill the stationary regions between/around the
               turning planes, and each turning plane gets a band box that spins with
               it (megaBandRefs[i], in that plane's own direction). DoubleSide keeps
               every inner wall opaque black so the seams that open mid-turn read as
               cube interior, never a hole to the background. */
            <>
              {megaChassis.slabs.map((s, si) => (
                <mesh key={`slab-${si}`} castShadow={false} receiveShadow={false} position={s.pos}>
                  <boxGeometry args={s.args} />
                  <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
                </mesh>
              ))}
              {megaChassis.bands.map((b, bi) => (
                <group key={`band-${bi}`} ref={(el) => { megaBandRefs.current[bi] = el; }} position={b.pos}>
                  <mesh castShadow={false} receiveShadow={false}>
                    <boxGeometry args={b.args} />
                    <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
                  </mesh>
                </group>
              ))}
            </>
          )}
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
                  // Mega Mode's individual rounded bodies account for more than
                  // a thousand transparent draw calls and R3F geometry nodes. The
                  // stickers remain the complete surface; the chassis (and its
                  // spinning band box during a turn) supplies the black backing, so
                  // no cubie ever needs its own body. Keying this to size alone —
                  // rather than restoring bodies for the rotating slice every turn —
                  // stops ~170 RoundedBox mounts/unmounts per rotation, which was the
                  // main source of the mid-turn stutter.
                  omitBody={size >= 15}
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
            enabled={!wormHealerMode && (!handsMode || explosionFactor > 0) && !animState && !dragStart && controlsEnabledRef.current && !wormTunnelActive}
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
