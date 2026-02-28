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
import { updateSharedTime, updateSharedTremor, warmUpDefaultStyles } from './styles/TileStyleMaterials.jsx';
import { StickerInstanceProvider } from './StickerInstances.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';

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

// Mobile detection
const isTouchDevice = typeof window !== 'undefined' && (
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia('(pointer: coarse)').matches
);

// Drag threshold - small for immediate response
const DRAG_THRESHOLD = isTouchDevice ? 8 : 5;

// Pixels of drag to complete a 90° rotation
const PIXELS_PER_90DEG = 100;

// Long-press disabled - was too sensitive on mobile
// const LONG_PRESS_DURATION = 500;

const CubeAssembly = React.memo(({
  size, cubies, onMove, onTapFlip, animState, onAnimComplete,
  onCascadeComplete, manifoldMap,
  onSelectTile, onClearTileSelection, onFlipWaveComplete,
  solveHighlights,
  onFaceRotationMode,
}) => {
  // ── State from store ────────────────────────────────────────────────────────
  const explosionFactor = useGameStore(s => s.explosionT);
  const cascades = useGameStore(s => s.cascades);
  const cursor = useGameStore(s => s.cursor);
  const showCursor = useGameStore(s => s.showCursor);
  const flipMode = useGameStore(s => s.flipMode);
  const flipWaveOrigins = useGameStore(s => s.flipWaveOrigins);
  const handsMode = useGameStore(s => s.handsMode);
  const isBiomeMode = useGameStore(s => s.settings?.biomeMode?.enabled);
  const settings = useGameStore(s => s.settings); // for warmUpDefaultStyles on mount
  const cubieRefs = useRef([]);
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
  const [, setLiveDragAngle] = useState(0); // Triggers re-render for useFrame
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const skipNextAnimRef = useRef(false); // Skip animState animation after live drag
  const frozenDragRef = useRef(null); // bridges the gap between GSAP complete and useLayoutEffect reset

  // Pre-computed set of ref indices that belong to the current animation slice.
  // Computed ONCE when animation starts from the canonical grid positions,
  // so it's immune to floating-point drift from incremental rotations.
  const sliceIndicesRef = useRef(null);

  const getBasis = () => {
    camera.getWorldDirection(_basisF).normalize();
    _basisR.crossVectors(camera.up, _basisF).normalize();
    _basisU.crossVectors(_basisF, _basisR).normalize();
    return { right: _basisR, upScreen: _basisU };
  };

  const normalFromEvent = e => {
    const n = (e?.face?.normal || new THREE.Vector3(0, 0, 1)).clone();
    const nm = new THREE.Matrix3().getNormalMatrix(e?.object?.matrixWorld ?? new THREE.Matrix4());
    n.applyNormalMatrix(nm).normalize();
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

    // Immediately disable controls using ref AND direct property
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
          const basePositions = new Map();
          const baseRotations = new Map();
          sliceIndices.forEach(idx => {
            const g = cubieRefs.current[idx];
            if (g) {
              basePositions.set(idx, g.position.clone());
              baseRotations.set(idx, g.quaternion.clone());
            }
          });
          // mappingDir encodes camera/face correction only (not drag direction).
          // dir from mapSwipe flips sign with the drag direction, so multiplying
          // it by the drag displacement would make both directions snap the same way.
          // Normalise it out: mappingDir = dir * sign(initial_drag_in_dominant_axis).
          const isDomHoriz = Math.abs(dx) >= Math.abs(dy);
          const mappingDir = isDomHoriz ? m.dir * Math.sign(dx) : m.dir * Math.sign(-dy);
          liveDragRef.current = {
            axis: m.axis, sliceIndex, sliceIndices, basePositions, baseRotations,
            startDx: dx, startDy: dy, dir: m.dir, mappingDir
          };
          sliceIndicesRef.current = sliceIndices;
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
        setLiveDragAngle(ld.angle);
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
            onUpdate: () => setLiveDragAngle(ld.angle),
            onComplete: () => {
              gsapAnimRef.current = null;
              // Freeze the final position BEFORE clearing liveDragRef so useFrame
              // keeps rendering the slice at the correct final angle during the gap
              // between this GSAP callback and the useLayoutEffect that commits
              // new cubie positions.
              const ld = liveDragRef.current;
              if (ld) {
                frozenDragRef.current = {
                  axis: ld.axis,
                  sliceIndices: ld.sliceIndices,
                  basePositions: ld.basePositions,
                  baseRotations: ld.baseRotations,
                  angle: ld.angle,
                };
              }
              liveDragRef.current = null;
              sliceIndicesRef.current = null;
              setLiveDragAngle(0);
              vibrate(14);
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
            onUpdate: () => setLiveDragAngle(ld.angle),
            onComplete: () => {
              gsapAnimRef.current = null;
              liveDragRef.current = null;
              sliceIndicesRef.current = null;
              setLiveDragAngle(0);
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
          onTapFlipRef.current(ds.pos, dirFromNormal(ds.n));
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
    warmUpDefaultStyles(gl, camera, colors);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional one-shot on mount

  // Camera auto-zoom: push camera out while explosion animates so the cube stays in view.
  // Once ef settles (animation complete) we stop overriding the camera so the user
  // can freely scroll/pinch to zoom. The auto-push also runs in reverse during collapse
  // so the camera smoothly returns to the pre-explosion distance.
  const preExplodeDist = useRef(0);
  const wasExploding = useRef(false);
  const prevEfRef2 = useRef(0);

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
      // Immediately complete without animation
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
    // Hands mode uses faster, crisper animations (speedcuber feel)
    const isHands = handsModeRef.current;
    gsapAnimRef.current = gsap.to(animProgressRef.current, {
      value: 1,
      duration: isHands ? 0.12 : 0.35,
      ease: isHands ? "power2.out" : "back.out(1.4)",
      onComplete: () => {
        gsapAnimRef.current = null;
        sliceIndicesRef.current = null;
        vibrate(isHands ? 8 : 14);
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

  // Priority -2: earliest possible hook — detects the animState → null transition
  // and snaps all cubies to their grid positions before any other useFrame runs.
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
    prevAnimStateRef.current = animStateRef.current;

    if (wasAnimating && !nowAnimating) {
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
      return; // Skip animState processing during live drag
    }

    // Bridge the commit gap: liveDrag cleared but new cubies not yet committed.
    if (frozenDragRef.current) {
      const fd = frozenDragRef.current;
      const worldAxis = fd.axis === 'col' ? _axisCol : fd.axis === 'row' ? _axisRow : _axisDepth;
      fd.sliceIndices.forEach(idx => {
        const g = cubieRefs.current[idx];
        if (g && fd.basePositions.has(idx)) {
          g.position.copy(fd.basePositions.get(idx)).applyAxisAngle(worldAxis, fd.angle);
          g.quaternion.copy(fd.baseRotations.get(idx));
          _rotQuat.setFromAxisAngle(worldAxis, fd.angle);
          g.quaternion.premultiply(_rotQuat);
        }
      });
      return;
    }

    // Handle GSAP snap animation (completing rotation after release)
    if (!animState) return;

    const { axis, dir, sliceIndex } = animState;
    const worldAxis = axis === 'col' ? _axisCol : axis === 'row' ? _axisRow : _axisDepth;

    // On animation start, pre-compute which ref indices are in the slice
    if (!sliceIndicesRef.current) {
      const indices = new Set();
      const n = size * size * size;
      for (let idx = 0; idx < n; idx++) {
        const z = idx % size;
        const y = Math.floor(idx / size) % size;
        const x = Math.floor(idx / (size * size));
        const inSlice = (axis === 'col' && x === sliceIndex) ||
          (axis === 'row' && y === sliceIndex) ||
          (axis === 'depth' && z === sliceIndex);
        if (inSlice) indices.add(idx);
      }
      sliceIndicesRef.current = indices;
    }

    // Calculate incremental rotation from GSAP progress
    const currentProgress = animProgressRef.current.value;
    const deltaProgress = currentProgress - prevProgressRef.current;
    prevProgressRef.current = currentProgress;

    const dRot = deltaProgress * (Math.PI / 2);

    // Apply rotation only to cubies in the slice (avoid iterating all 125 to skip 88%)
    const sliceSet = sliceIndicesRef.current;
    if (sliceSet && Math.abs(dRot) > 0.0001) {
      sliceSet.forEach(idx => {
        const g = cubieRefs.current[idx];
        if (!g) return;
        g.position.applyAxisAngle(worldAxis, dRot * dir);
        g.rotateOnWorldAxis(worldAxis, dRot * dir);
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
      frozenDragRef.current = null; // new cubies have landed — stop frozen rendering
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

  return (
    <StickerInstanceProvider>
    <group ref={cubeGroupRef}>
      <WormholeNetwork
        manifoldMap={manifoldMap}
        cubieRefs={cubieRefs.current}
      />
      {!isBiomeMode && cascades.map(c => (
        <ChaosWave
          key={c.id}
          from={c.from}
          to={c.to}
          crossFace={c.crossFace}
          onComplete={() => onCascadeComplete(c.id)}
        />
      ))}
      {flipWaveOrigins && flipWaveOrigins.length > 0 && (
        <FlipPropagationWave
          origins={flipWaveOrigins}
          onComplete={onFlipWaveComplete}
        />
      )}
      {/* VoidCore: swirling wormhole-color rings at the cube's hollow center */}
      <VoidCore />
      {items.map((it, idx) => {
        // Skip the center cubie on odd-sized cubes — VoidCore occupies that space
        const isCenterVoid = size % 2 !== 0 &&
          it.pos[0] === 0 && it.pos[1] === 0 && it.pos[2] === 0;
        if (isCenterVoid) return null;
        return (
          <Cubie
            key={it.key}
            ref={cubieRefCallbacks[idx]}
            position={it.pos}
            cubie={it.cubie}
            size={size}
            onPointerDown={onPointerDown}
          />
        );
      })}
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
        maxDistance={{ 2: 28, 3: 28, 4: 38, 5: 52 }[size] || 28}
        enabled={(!handsMode || explosionFactor > 0) && !animState && !dragStart && controlsEnabledRef.current}
        staticMoving={false}
        dynamicDampingFactor={isTouchDevice ? 0.15 : 0.08}
        rotateSpeed={isTouchDevice ? 0.8 : 1.2}
      />
    </group>
    </StickerInstanceProvider>
  );
});

export default CubeAssembly;
