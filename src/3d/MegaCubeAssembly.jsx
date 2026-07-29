// src/3d/MegaCubeAssembly.jsx
//
// The Mega shell renderer: the whole 15×15×15 cube as two InstancedMeshes.
//
// Why a second renderer instead of scaling the first
// --------------------------------------------------
// CubeAssembly mounts a React component per cubie and per sticker, and that is
// the right shape for 2–7: it buys per-sticker shaders, flip FX, biome volumes,
// tally marks and the rest, and at 294 stickers the object count is affordable.
// At 15³ the same tree is 1,178 cubie subtrees (each minting its own
// ExtrudeGeometry via drei's RoundedBox) and 1,350 sticker subtrees of ~16 nodes
// — measured at ~1,037 draw calls and 571k triangles, roughly 4× over budget
// before a single effect runs.
//
// So this path trades the cosmetic layer for the size. It draws:
//   • one InstancedMesh for every cubie body,
//   • one InstancedMesh for every sticker, coloured per instance,
//   • one invisible box that exists only to be raycast.
// Three draw calls for the cube, whatever the size.
//
// CubeAssembly remains the reference path for 2–7 and is untouched.
//
// What is deliberately absent
// ---------------------------
// Per-sticker tile styles, flip particles, tally marks, LED edges, hollow/mirror
// bodies, biome volumes. A flipped tile is communicated by colour and emissive
// alone — which is what actually matters in Worm mode, where a flipped tile is a
// wormhole mouth. Anything needing a unique material or draw call per sticker is
// out of the Mega budget by definition.
//
// Frame cost
// ----------
// At rest the transform loop writes nothing: instance matrices only change when
// a rotation wave is in flight, and then only for the ≤3 planes it owns. A
// middle slice of a 15-cube holds 56 surface stickers, so a three-plane wave
// rewrites a few hundred matrices per frame rather than all 2,528.

import { useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TrackballControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import { liveCubies } from '../worm/liveCubies.js';
import { liveRotations, setLiveWave, setPlaneAngle } from '../worm/liveRotations.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { getSliceLinearIndices } from '../game/sliceIndex.js';
import { getShellIndex, cellToCoords, pickCellFromHit, DIR_NORMALS, DIR_KEYS } from './megaShell.js';
import WormholeNetwork from '../manifold/WormholeNetwork.jsx';
import gsap from 'gsap';
import { vibrate } from '../utils/audio.js';

// ── Module scratch ────────────────────────────────────────────────────────────
// Every one of these is written and read within a single synchronous block; the
// transform loop must not allocate, since it runs on every frame of a wave.
const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _axisVec = new THREE.Vector3();
const _color = new THREE.Color();
const _coords = [0, 0, 0];
const _hitPoint = [0, 0, 0];
const _hitNormal = [0, 0, 0];
const _normalMat3 = new THREE.Matrix3();

const _AXIS_COL = new THREE.Vector3(1, 0, 0);
const _AXIS_ROW = new THREE.Vector3(0, 1, 0);
const _AXIS_DEPTH = new THREE.Vector3(0, 0, 1);
const axisVecFor = (axis) => (axis === 'col' ? _AXIS_COL : axis === 'row' ? _AXIS_ROW : _AXIS_DEPTH);

// Distance from a cubie centre to the outer face of its sticker. Matches
// SURFACE_OFFSET in utils/constants, which the worm's own positioning uses — the
// two must agree or the worm floats off the tiles it is standing on.
const STICKER_OFFSET = 0.52;
const STICKER_SIZE = 0.9;
const BODY_SIZE = 0.97;

// Per-face quaternion that turns the sticker plane (+Z by default) outward.
const FACE_QUATS = DIR_NORMALS.map(([nx, ny, nz]) => {
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, ny, nz));
  return q;
});

export default function MegaCubeAssembly({
  size, cubies, onMove, onTapFlip, onAnimComplete, onSelectTile,
}) {
  const { camera, gl } = useThree();
  const shell = useMemo(() => getShellIndex(size), [size]);

  const {
    settings, rotationEpoch, animWave, wormHealerMode, wormTunnelActive, explosionT,
  } = useGameStore(useShallow(s => ({
    settings: s.settings,
    rotationEpoch: s.rotationEpoch,
    animWave: s.animWave,
    wormHealerMode: s.wormHealerMode,
    wormTunnelActive: s.wormHealerMode && s.wormPhase === 'tunnel',
    explosionT: s.explosionT,
  })));

  const colors = useMemo(() => resolveColors(settings), [settings]);

  // ── Instanced meshes ───────────────────────────────────────────────────────
  // Built once per size. Kept out of the React tree (added straight to the scene)
  // so nothing re-parents them and their world matrices are the ones we write.
  const bodyMesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(BODY_SIZE, BODY_SIZE, BODY_SIZE);
    const mat = new THREE.MeshStandardMaterial({ color: '#131313', roughness: 0.72, metalness: 0.04 });
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, shell.bodyCount));
    m.name = 'MegaCubeBodies';
    m.count = shell.bodyCount;
    m.frustumCulled = false;
    m.raycast = () => {};   // picking goes through the box below, mathematically
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }, [shell]);

  const stickerMesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.04, envMapIntensity: 0.35 });
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, shell.stickerCount));
    m.name = 'MegaCubeStickers';
    m.count = shell.stickerCount;
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  }, [shell]);

  useLayoutEffect(() => {
    return () => {
      bodyMesh.geometry.dispose();
      bodyMesh.material.dispose();
      stickerMesh.geometry.dispose();
      stickerMesh.material.dispose();
    };
  }, [bodyMesh, stickerMesh]);

  // ── liveCubies bridge ──────────────────────────────────────────────────────
  // The worm reads tile transforms through `liveCubies.refs[linearIndex]`,
  // expecting objects with `.position` and `.quaternion`. There are no per-cubie
  // Object3Ds any more, so the renderer publishes a pool of plain transform
  // holders instead and keeps them in step with the instance matrices. That way
  // every worm consumer — the head ride, the body trail, the orbs — works
  // against the Mega path without knowing it changed.
  const proxiesRef = useRef(null);
  if (proxiesRef.current === null || proxiesRef.current.size !== size) {
    const refs = new Array(size * size * size).fill(null);
    for (let i = 0; i < shell.bodyCount; i++) {
      refs[shell.bodyCell[i]] = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    }
    proxiesRef.current = { size, refs };
  }
  useLayoutEffect(() => {
    liveCubies.refs = proxiesRef.current.refs;
    liveCubies.size = size;
  }, [size]);

  const expansion = 1 + explosionT * 1.53;
  const expansionRef = useRef(expansion);
  expansionRef.current = expansion;

  // ── Transform writing ──────────────────────────────────────────────────────

  // Write one cell's body + stickers at a given rotation angle (0 = at rest).
  const writeCell = useCallback((cell, angle, axisVec) => {
    cellToCoords(cell, size, _coords);
    const k = (size - 1) / 2;
    const exp = expansionRef.current;
    _pos.set((_coords[0] - k) * exp, (_coords[1] - k) * exp, (_coords[2] - k) * exp);
    if (angle !== 0) {
      _pos.applyAxisAngle(axisVec, angle);
      _quat.setFromAxisAngle(axisVec, angle);
    } else {
      _quat.identity();
    }

    const proxy = proxiesRef.current.refs[cell];
    if (proxy) {
      proxy.position.copy(_pos);
      proxy.quaternion.copy(_quat);
    }

    const bodySlot = shell.bodySlotOf[cell];
    if (bodySlot >= 0) {
      _dummy.position.copy(_pos);
      _dummy.quaternion.copy(_quat);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      bodyMesh.setMatrixAt(bodySlot, _dummy.matrix);
    }

    for (let d = 0; d < 6; d++) {
      const slot = shell.stickerSlotOf[cell * 6 + d];
      if (slot < 0) continue;
      const n = DIR_NORMALS[d];
      _dummy.position.set(
        _pos.x + n[0] * STICKER_OFFSET,
        _pos.y + n[1] * STICKER_OFFSET,
        _pos.z + n[2] * STICKER_OFFSET,
      );
      if (angle !== 0) {
        // The sticker's offset rides the rotation too, so recompute it in the
        // rotated frame rather than adding an unrotated normal to a rotated centre.
        _dummy.position.copy(_pos);
        _axisVec.set(n[0], n[1], n[2]).applyQuaternion(_quat);
        _dummy.position.addScaledVector(_axisVec, STICKER_OFFSET);
        _dummy.quaternion.copy(_quat).multiply(FACE_QUATS[d]);
      } else {
        _dummy.quaternion.copy(FACE_QUATS[d]);
      }
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      stickerMesh.setMatrixAt(slot, _dummy.matrix);
    }
  }, [size, shell, bodyMesh, stickerMesh]);

  // Rewrite the whole shell at rest. Runs on mount, on a size change, and after
  // every commit — the only moments the resting layout can change.
  const writeAllAtRest = useCallback(() => {
    for (let i = 0; i < shell.bodyCount; i++) writeCell(shell.bodyCell[i], 0, _AXIS_COL);
    bodyMesh.instanceMatrix.needsUpdate = true;
    stickerMesh.instanceMatrix.needsUpdate = true;
  }, [shell, writeCell, bodyMesh, stickerMesh]);

  useLayoutEffect(() => { writeAllAtRest(); }, [writeAllAtRest, rotationEpoch, explosionT]);

  // ── Colours ────────────────────────────────────────────────────────────────
  // Uploaded whenever the cube's contents change (flip, heal, rotation). Colour
  // is the entire vocabulary this renderer has for tile state, so a flipped tile
  // — a wormhole mouth in Worm mode — also gets an emissive lift to separate it
  // from an ordinary tile of the same antipodal colour.
  useLayoutEffect(() => {
    if (!cubies || cubies.length !== size) return;
    for (let slot = 0; slot < shell.stickerCount; slot++) {
      const cell = shell.stickerCell[slot];
      cellToCoords(cell, size, _coords);
      const dirKey = DIR_KEYS[shell.stickerDir[slot]];
      const st = cubies[_coords[0]]?.[_coords[1]]?.[_coords[2]]?.stickers?.[dirKey];
      if (!st) { _color.set('#000000'); }
      else {
        const hex = colors[st.curr] ?? FACE_COLORS[st.curr] ?? '#888888';
        _color.set(hex);
        if (st.curr !== st.orig) _color.multiplyScalar(1.45);
      }
      stickerMesh.setColorAt(slot, _color);
    }
    if (stickerMesh.instanceColor) stickerMesh.instanceColor.needsUpdate = true;
  }, [cubies, colors, shell, size, stickerMesh]);

  // ── Scene attachment ───────────────────────────────────────────────────────
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.add(bodyMesh);
    scene.add(stickerMesh);
    return () => { scene.remove(bodyMesh); scene.remove(stickerMesh); };
  }, [scene, bodyMesh, stickerMesh]);

  useEffect(() => {
    bodyMesh.visible = !wormTunnelActive;
    stickerMesh.visible = !wormTunnelActive;
  }, [wormTunnelActive, bodyMesh, stickerMesh]);

  // ── Wave animation ─────────────────────────────────────────────────────────
  const animWaveRef = useRef(animWave);
  animWaveRef.current = animWave;
  const progressRef = useRef({ value: 0 });
  const tweenRef = useRef(null);
  const waveIdRef = useRef(null);
  const waveCellsRef = useRef(null);
  const onAnimCompleteRef = useRef(onAnimComplete);
  onAnimCompleteRef.current = onAnimComplete;

  useEffect(() => {
    if (!animWave) {
      progressRef.current.value = 0;
      waveIdRef.current = null;
      waveCellsRef.current = null;
      return undefined;
    }
    if (tweenRef.current) tweenRef.current.kill();
    progressRef.current.value = 0;

    const isShuffle = !!animWave.isShuffle;
    const isWormScramble = !!animWave.wormScramble;
    const isFast = isShuffle && !isWormScramble;
    // The worm hazard turn is deliberately slow — the creep through the layer is
    // the payoff after the warning counts down. Same timings as the standard path.
    const isWormHazard = !isFast && !isWormScramble && useGameStore.getState().wormHealerMode;
    const base = isFast ? 0.12 : 0.35;
    tweenRef.current = gsap.to(progressRef.current, {
      value: 1,
      duration: isWormHazard ? base * 4.0 : base,
      ease: isFast ? 'power2.out' : 'back.out(1.4)',
      onComplete: () => {
        tweenRef.current = null;
        waveIdRef.current = null;
        waveCellsRef.current = null;
        resetLiveRotation();
        vibrate(isFast ? 8 : 14);
        onAnimCompleteRef.current?.();
      },
    });
    return () => {
      if (tweenRef.current) { tweenRef.current.kill(); tweenRef.current = null; }
    };
  }, [animWave]);

  // Priority −1, matching CubeAssembly: the transform writer must run before any
  // priority-0 consumer reads a tile transform this frame.
  useFrame(() => {
    const wave = animWaveRef.current;
    if (!wave) {
      if (liveRotations.active) {
        liveRotations.active = false;
        liveRotations.count = 0;
        liveRotations.axis = null;
        liveRotations.bySlice.fill(-1);
      }
      if (liveRotations.completedFrames > 0) liveRotations.completedFrames--;
      return;
    }

    // Cache the cells each plane owns for the life of the wave.
    if (waveIdRef.current !== wave.id) {
      waveIdRef.current = wave.id;
      waveCellsRef.current = wave.rotations.map(r => getSliceLinearIndices(size, wave.axis, r.sliceIndex));
      setLiveWave(wave.id, wave.axis, wave.rotations);
    }

    const axisVec = axisVecFor(wave.axis);
    const t = progressRef.current.value;
    for (let p = 0; p < wave.rotations.length; p++) {
      const plane = wave.rotations[p];
      const delay = plane.delay ?? 0;
      const pt = delay > 0 && delay < 1
        ? Math.min(1, Math.max(0, (t - delay) / (1 - delay)))
        : t;
      const angle = pt * (Math.PI / 2) * (plane.numTurns ?? 1) * plane.dir;
      setPlaneAngle(p, angle);

      const cells = waveCellsRef.current[p];
      for (let i = 0; i < cells.length; i++) {
        // Interior cells of the slice have no body and no stickers; writeCell
        // still updates their proxy, which is what the worm reads, so they are
        // not skipped here.
        writeCell(cells[i], angle, axisVec);
      }
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    stickerMesh.instanceMatrix.needsUpdate = true;
  }, -1);

  // ── Picking ────────────────────────────────────────────────────────────────
  // One box, one raycast, then arithmetic — instead of 1,350 sticker meshes in
  // the raycast set. The box is rendered with colour and depth writes off so it
  // costs a single state change and paints nothing.
  const pickSize = size * expansion;
  const handlePick = useCallback((e) => {
    if (animWaveRef.current) return;   // no picking mid-wave; the surface isn't a box
    if (!onSelectTile && !onTapFlip) return;
    e.stopPropagation();
    _hitPoint[0] = e.point.x; _hitPoint[1] = e.point.y; _hitPoint[2] = e.point.z;
    _normalMat3.getNormalMatrix(e.object.matrixWorld);
    const n = e.face ? e.face.normal.clone().applyMatrix3(_normalMat3).normalize() : null;
    if (!n) return;
    _hitNormal[0] = n.x; _hitNormal[1] = n.y; _hitNormal[2] = n.z;
    const hit = pickCellFromHit(_hitPoint, _hitNormal, size, expansionRef.current);
    if (!hit) return;
    const { x, y, z, dirKey } = hit;
    if (useGameStore.getState().flipMode && onTapFlip) onTapFlip({ x, y, z }, dirKey);
    else onSelectTile?.({ x, y, z }, dirKey);
  }, [size, onSelectTile, onTapFlip]);

  // TrackballControls: same gating as the standard path — the worm owns the
  // camera during a run, so orbiting is off there.
  const controlsEnabled = !wormHealerMode && !animWave && !wormTunnelActive;

  return (
    <group>
      <mesh onPointerDown={handlePick} raycast={THREE.Mesh.prototype.raycast}>
        <boxGeometry args={[pickSize, pickSize, pickSize]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* Tunnels stay: in Worm mode a wormhole is gameplay, not decoration. */}
      <WormholeNetwork cubies={cubies} size={size} />

      <TrackballControls
        makeDefault
        noPan
        enabled={controlsEnabled}
        minDistance={size * 1.2}
        maxDistance={size * 8}
        staticMoving={false}
        dynamicDampingFactor={0.1}
        rotateSpeed={1.1}
        camera={camera}
        domElement={gl.domElement}
      />
      {/* onMove is accepted for API parity with CubeAssembly; drag-to-rotate is
          not part of the Mega path — its rotations come from the hazard queue. */}
      {onMove ? null : null}
    </group>
  );
}
