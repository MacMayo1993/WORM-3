import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import StickerPlane from '../../3d/StickerPlane.jsx';
import { runActiveStickers, wispyTime } from '../../3d/StickerAnimationManager.js';
import { INTRO_STICKERS, INTRO_PRESENTATION, introStickerStage } from './introStickers.js';
import { INTRO_SCALE, fitIntroFrame } from './introFraming.js';
import IntroTunnels from './IntroTunnels.jsx';
import { INTRO_END, sampleIntro, introCameraDistance } from './introChoreography.js';
import IntroEnergy from './IntroEnergy.jsx';
import { introEnergy } from './introEnergy.js';
import { WORM_START } from './introTiming.js';
import { FACES, CELLS, TILES, PAIRS, flippedColor, pairPoint } from './introTopology.js';

const WORM_SEGMENTS = 10;
const TILE_OFFSETS = TILES.map(tile => {
  const p = [0, 0, 0]; p[tile.face.axis] = 0.51 * tile.face.sign; return p;
});

// All 54 gameplay-style stickers and 27 connections; bodies and worms are instanced.
// Connections use an x-ray presentation so back-face pairs remain visible.
export default function IntroScene({ time, onComplete, reducedMotion = false, performanceMode = false }) {
  const root = useRef();
  const bodies = useRef();
  const tiles = useRef([]);
  const worms = useRef();
  const eyes = useRef();
  const gates = useRef();
  const finished = useRef(false);
  const previousTime = useRef(time);
  const stickerStage = introStickerStage(time, reducedMotion);
  const assets = useMemo(() => ({
    body: new RoundedBoxGeometry(0.96, 0.96, 0.96, 2, 0.065),
    dummy: new THREE.Object3D(), color: new THREE.Color(),
    euler: new THREE.Euler(),
    colors: Object.fromEntries(FACES.map(f => [f.color, new THREE.Color(COLOR_SCHEMES.standard[f.color])]))
  }), []);
  useEffect(() => () => { assets.body.dispose(); }, [assets]);
  useEffect(() => {
    if (time >= INTRO_END && !finished.current) { finished.current = true; onComplete?.(); }
  }, [time, onComplete]);

  useFrame((state) => {
    const { camera } = state;
    const delta = Math.min(0.1, Math.max(0, time - previousTime.current));
    previousTime.current = time;
    wispyTime.value = reducedMotion ? 0 : time;
    runActiveStickers({ ...state, clock: { elapsedTime: reducedMotion ? 0 : time } }, reducedMotion ? 0 : delta, 'intro:');
    const pose = sampleIntro(time, reducedMotion);
    const energy = introEnergy(time, reducedMotion);
    const { dummy, color, euler } = assets;
    const spacing = 1 + 1.5 * pose.open;
    const lift = 0.51;
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
    TILES.forEach(({ position: p }, i) => {
      tiles.current[i].position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    gates.current.visible = pose.passage > 0.001;
    worms.current.visible = eyes.current.visible = pose.wormVisible;
    gates.current.material.opacity = pose.passage * 0.9;
    if (gates.current.visible) {
      PAIRS.forEach((pair, pairIndex) => {
        const progress = (time - WORM_START - pairIndex * 0.012) / 2.2;
        const first = assets.colors[flippedColor(pair.faceIndex, pose.flip)];
        const second = assets.colors[flippedColor(pair.faceIndex ^ 1, pose.flip)];
        for (let side = 0; side < 2; side++) {
          pairPoint(pair, side, spacing, dummy.position, lift, time);
          dummy.quaternion.setFromEuler(euler.set(...pair.face.rotation));
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          gates.current.setMatrixAt(pairIndex * 2 + side, dummy.matrix);
          gates.current.setColorAt(pairIndex * 2 + side, side ? second : first);
        }
        if (!pose.wormVisible) return;
        // Small deterministic stagger, with every worm completing before collapse.
        for (let j = 0; j < WORM_SEGMENTS; j++) {
          const u = progress - j * 0.016;
          pairPoint(pair, u, spacing, dummy.position, lift, time);
          dummy.quaternion.identity();
          dummy.scale.setScalar(u < 0 || u > 1 ? 0 : 0.065 + 0.055 * (1 - j / WORM_SEGMENTS));
          dummy.updateMatrix();
          const index = pairIndex * WORM_SEGMENTS + j;
          worms.current.setMatrixAt(index, dummy.matrix);
          worms.current.setColorAt(index, color.copy(first).lerp(second, Math.max(0, Math.min(1, u))).lerp(assets.colors[3], 0.4));
        }
        for (let side = 0; side < 2; side++) {
          pairPoint(pair, progress, spacing, dummy.position, lift, time);
          dummy.position.x += 0.07;
          dummy.position.y += 0.07;
          dummy.position.z += side ? 0.04 : -0.04;
          dummy.scale.setScalar(progress < 0 || progress > 1 ? 0 : 0.025);
          dummy.updateMatrix();
          eyes.current.setMatrixAt(pairIndex * 2 + side, dummy.matrix);
        }
      });
      for (const mesh of [gates.current, worms.current, eyes.current]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    const distance = introCameraDistance(pose.distance - energy.push * 1.0, camera.aspect, camera.fov);
    camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, -0.55, 0);
    fitIntroFrame(camera, root.current, spacing + 0.56);
  });

  return (
    <group ref={root} scale={INTRO_SCALE}>
      <IntroEnergy time={time} reducedMotion={reducedMotion} performanceMode={performanceMode} />
      <instancedMesh ref={bodies} args={[assets.body, null, CELLS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#293329" roughness={0.32} metalness={0.2} transparent depthWrite={false} />
      </instancedMesh>
      {TILES.map((tile, i) => <group key={i} ref={node => { tiles.current[i] = node; }}>
        <StickerPlane meta={INTRO_STICKERS[stickerStage][i]} pos={TILE_OFFSETS[i]} rot={tile.face.rotation}
          mode="classic" faceSize={3} presentation={INTRO_PRESENTATION} />
      </group>)}
      <IntroTunnels time={time} reducedMotion={reducedMotion} />
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
