import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { INTRO_END, sampleIntro, introCameraDistance } from './introChoreography.js';
import { WORM_START } from './introTiming.js';
import { FACES, CELLS, TILES, PAIRS, flippedColor, pairPoint } from './introTopology.js';

const LINE_SEGMENTS = 24;
const WORM_SEGMENTS = 10;

// All 54 stickers and 27 connections, with one instanced draw per visual layer.
// Connections use an x-ray presentation so back-face pairs remain visible.
export default function IntroScene({ time, onComplete, reducedMotion = false }) {
  const root = useRef();
  const bodies = useRef();
  const tiles = useRef();
  const worms = useRef();
  const eyes = useRef();
  const lines = useRef();
  const gates = useRef();
  const finished = useRef(false);
  const assets = useMemo(() => ({
    body: new RoundedBoxGeometry(0.96, 0.96, 0.96, 2, 0.065),
    tile: new RoundedBoxGeometry(0.84, 0.84, 0.055, 2, 0.025),
    dummy: new THREE.Object3D(), color: new THREE.Color(),
    a: new THREE.Vector3(), b: new THREE.Vector3(), direction: new THREE.Vector3(),
    faceRotation: new THREE.Quaternion(), flipRotation: new THREE.Quaternion(),
    xAxis: new THREE.Vector3(1, 0, 0), yAxis: new THREE.Vector3(0, 1, 0), euler: new THREE.Euler(),
    dark: new THREE.Color('#293329'), colors: Object.fromEntries(FACES.map(f => [f.color, new THREE.Color(FACE_COLORS[f.color])]))
  }), []);
  useEffect(() => () => { assets.body.dispose(); assets.tile.dispose(); }, [assets]);
  useEffect(() => {
    if (time >= INTRO_END && !finished.current) { finished.current = true; onComplete?.(); }
  }, [time, onComplete]);

  useFrame(({ camera }) => {
    const pose = sampleIntro(time, reducedMotion);
    const { dummy, color, faceRotation, flipRotation, xAxis, yAxis, euler, a, b, direction } = assets;
    const spacing = 1 + 1.5 * pose.open;
    const lift = 0.51 + 0.48 * Math.sin(pose.flip);
    root.current.rotation.set(0.12 + 0.1 * pose.open, pose.turn, 0);
    root.current.position.y = 0.25;
    bodies.current.material.opacity = 1 - 0.82 * pose.open;
    CELLS.forEach((p, i) => {
      dummy.position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    });
    TILES.forEach(({ position: p, face: f, faceIndex }, i) => {
      // Lift the rotating tile enough to clear its cubie, then settle it back.
      dummy.position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
      dummy.position.setComponent(f.axis, dummy.position.getComponent(f.axis) + lift * f.sign);
      faceRotation.setFromEuler(euler.set(...f.rotation));
      flipRotation.setFromAxisAngle(xAxis, pose.flip);
      dummy.quaternion.copy(faceRotation).multiply(flipRotation);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tiles.current.setMatrixAt(i, dummy.matrix);
      // Swap at the edge-on midpoint, not before the player sees the flip.
      color.copy(assets.dark).lerp(assets.colors[flippedColor(faceIndex, pose.flip)], pose.reveal);
      tiles.current.setColorAt(i, color);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceColor.needsUpdate = true;

    lines.current.visible = gates.current.visible = pose.passage > 0.001;
    worms.current.visible = eyes.current.visible = pose.wormVisible;
    lines.current.material.opacity = pose.passage * 0.52;
    gates.current.material.opacity = pose.passage * 0.9;
    if (lines.current.visible) {
      PAIRS.forEach((pair, pairIndex) => {
        const first = assets.colors[flippedColor(pair.faceIndex, pose.flip)];
        const second = assets.colors[flippedColor(pair.faceIndex ^ 1, pose.flip)];
        for (let j = 0; j < LINE_SEGMENTS; j++) {
          pairPoint(pair, j / LINE_SEGMENTS, spacing, a, lift);
          pairPoint(pair, (j + 1) / LINE_SEGMENTS, spacing, b, lift);
          direction.subVectors(b, a);
          const length = direction.length();
          dummy.position.copy(a).add(b).multiplyScalar(0.5);
          dummy.quaternion.setFromUnitVectors(yAxis, direction.multiplyScalar(1 / length));
          dummy.scale.set(0.022, length, 0.022);
          dummy.updateMatrix();
          const index = pairIndex * LINE_SEGMENTS + j;
          lines.current.setMatrixAt(index, dummy.matrix);
          lines.current.setColorAt(index, color.copy(first).lerp(second, j / (LINE_SEGMENTS - 1)));
        }
        for (let side = 0; side < 2; side++) {
          pairPoint(pair, side, spacing, dummy.position, lift);
          dummy.quaternion.setFromEuler(euler.set(...pair.face.rotation));
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          gates.current.setMatrixAt(pairIndex * 2 + side, dummy.matrix);
          gates.current.setColorAt(pairIndex * 2 + side, side ? second : first);
        }
        if (!pose.wormVisible) return;
        // Small deterministic stagger, with every worm completing before collapse.
        const progress = (time - WORM_START - pairIndex * 0.012) / 2.2;
        for (let j = 0; j < WORM_SEGMENTS; j++) {
          const u = progress - j * 0.016;
          pairPoint(pair, u, spacing, dummy.position, lift);
          dummy.quaternion.identity();
          dummy.scale.setScalar(u < 0 || u > 1 ? 0 : 0.065 + 0.055 * (1 - j / WORM_SEGMENTS));
          dummy.updateMatrix();
          const index = pairIndex * WORM_SEGMENTS + j;
          worms.current.setMatrixAt(index, dummy.matrix);
          worms.current.setColorAt(index, color.copy(first).lerp(second, Math.max(0, Math.min(1, u))).lerp(assets.colors[3], 0.4));
        }
        for (let side = 0; side < 2; side++) {
          pairPoint(pair, progress, spacing, dummy.position, lift);
          dummy.position.x += 0.07;
          dummy.position.y += 0.07;
          dummy.position.z += side ? 0.04 : -0.04;
          dummy.scale.setScalar(progress < 0 || progress > 1 ? 0 : 0.025);
          dummy.updateMatrix();
          eyes.current.setMatrixAt(pairIndex * 2 + side, dummy.matrix);
        }
      });
      for (const mesh of [lines.current, gates.current, worms.current, eyes.current]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    const distance = introCameraDistance(pose.distance, camera.aspect, camera.fov);
    camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, -0.55, 0);
  });

  return (
    <group ref={root}>
      <instancedMesh ref={bodies} args={[assets.body, null, CELLS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#293329" roughness={0.32} metalness={0.2} transparent depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={tiles} args={[assets.tile, null, TILES.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.32} metalness={0.08} />
      </instancedMesh>
      <instancedMesh ref={lines} args={[null, null, PAIRS.length * LINE_SEGMENTS]} frustumCulled={false} renderOrder={2}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={gates} args={[null, null, PAIRS.length * 2]} frustumCulled={false} renderOrder={3}>
        <torusGeometry args={[0.29, 0.025, 6, 24]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={worms} args={[null, null, PAIRS.length * WORM_SEGMENTS]} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[null, null, PAIRS.length * 2]} frustumCulled={false} renderOrder={5}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#1e1612" transparent depthWrite={false} depthTest={false} />
      </instancedMesh>
    </group>
  );
}
