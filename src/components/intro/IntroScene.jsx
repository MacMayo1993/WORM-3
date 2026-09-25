import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { INTRO_STICKERS } from './introStickers.js';
import { INTRO_SCALE, fitIntroFrame } from './introFraming.js';
import IntroTunnels from './IntroTunnels.jsx';
import { INTRO_END, sampleIntro, introCameraDistance } from './introChoreography.js';
import IntroEnergy from './IntroEnergy.jsx';
import { introEnergy } from './introEnergy.js';
import { WORM_START } from './introTiming.js';
import { CELLS, TILES, PAIRS, pairPoint } from './introTopology.js';
import {
  introColor, introDrop, introSquash, introLayerTurn, TWIST_LAYER, stickerFlip, tunnelGrowth, introFloorY, DROP_HEIGHT
} from './introMotion.js';
import { introOutro } from './introOutro.js';
import { addIntroDissolve } from './introDissolve.js';

const WORM_SEGMENTS = 10;
const LANDSCAPE_SHIFT = 0.2; // of the width, matching the copy column in intro.css
const [ORIGINAL, FLIPPED] = INTRO_STICKERS;
// Each pair's two stickers, as indices into TILES: the near end and its antipode.
const PAIR_ENDS = PAIRS.map(pair => [TILES.indexOf(pair), TILES.findIndex(t => t.face.axis === pair.face.axis &&
  t.face.sign === -pair.face.sign && t.position.every((v, axis) => v === -pair.position[axis]))]);

// A glossy, slightly domed sticker: a rounded square with a bevelled edge that
// catches the key light as it turns.
function stickerGeometry() {
  const size = 0.84, r = 0.14, h = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 5
  });
  geometry.translate(0, 0, -0.01);
  return geometry;
}

// A soft round contact shadow for the paper.
function shadowTexture() {
  const n = 64, pixels = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot((x - n / 2 + 0.5) / (n / 2), (y - n / 2 + 0.5) / (n / 2));
    const i = (y * n + x) * 4;
    pixels[i] = 38; pixels[i + 1] = 55; pixels[i + 2] = 45; // ARCADE_INK
    pixels[i + 3] = Math.round(Math.max(0, 1 - r) ** 1.8 * 255);
  }
  const texture = new THREE.DataTexture(pixels, n, n);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// A real Rubik's cube: black plastic cubies with a thin border round each glossy
// sticker, and (seen only when it bursts open) the core its centres turn on.
// The plastic and stickers dissolve together at the end (introDissolve.js).
function introMaterials(performanceMode, dissolve) {
  const Material = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const gloss = coat => performanceMode ? {} : coat;
  return {
    plastic: addIntroDissolve(new Material({ color: '#141416', roughness: 0.34, metalness: 0,
      ...gloss({ clearcoat: 0.4, clearcoatRoughness: 0.35 }) }), dissolve),
    sticker: addIntroDissolve(new Material({ roughness: 0.24, metalness: 0,
      ...gloss({ clearcoat: 1, clearcoatRoughness: 0.12 }) }), dissolve)
  };
}
const inTwistLayer = position => position[TWIST_LAYER.axis] === TWIST_LAYER.index;

// All 54 stickers and 27 antipodal tunnels; bodies, stickers and worms are instanced.
export default function IntroScene({ time, onComplete, reducedMotion = false, performanceMode = false }) {
  const root = useRef();
  const body = useRef();
  const bodies = useRef();
  const core = useRef();
  const stickers = useRef();
  const worms = useRef();
  const whites = useRef();
  const pupils = useRef();
  const gates = useRef();
  const shadow = useRef();
  const finished = useRef(false);
  const cameraRef = useRef(null);
  const assets = useMemo(() => {
    const colors = {};
    for (let id = 1; id <= 6; id++) colors[id] = new THREE.Color(introColor(id));
    return {
      body: new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.08),
      coreArm: new THREE.CylinderGeometry(0.1, 0.1, 1, 14),
      coreHub: new THREE.SphereGeometry(0.34, 20, 14),
      sticker: stickerGeometry(),
      shadow: shadowTexture(),
      dissolve: { value: 0 },
      layerQuat: new THREE.Quaternion(), yAxis: new THREE.Vector3(0, 1, 0),
      dummy: new THREE.Object3D(), color: new THREE.Color(), euler: new THREE.Euler(),
      faceQuat: new THREE.Quaternion(), flipQuat: new THREE.Quaternion(), xAxis: new THREE.Vector3(1, 0, 0),
      normal: new THREE.Vector3(), head: new THREE.Vector3(), ahead: new THREE.Vector3(), dir: new THREE.Vector3(),
      side: new THREE.Vector3(), up: new THREE.Vector3(), eye: new THREE.Vector3(),
      colors
    };
  }, []);
  useEffect(() => () => {
    for (const key of ['body', 'coreArm', 'coreHub', 'sticker', 'shadow']) assets[key].dispose();
  }, [assets]);
  const materials = useMemo(() => introMaterials(performanceMode, assets.dissolve), [performanceMode, assets]);
  useEffect(() => () => { materials.plastic.dispose(); materials.sticker.dispose(); }, [materials]);
  useEffect(() => {
    if (time >= INTRO_END && !finished.current) { finished.current = true; onComplete?.(); }
  }, [time, onComplete]);

  useFrame((state) => {
    const { camera } = state;
    cameraRef.current = camera;
    const pose = sampleIntro(time, reducedMotion);
    const energy = introEnergy(time, reducedMotion);
    const outro = introOutro(time, reducedMotion);
    const { dummy, color, euler, faceQuat, flipQuat, xAxis, normal, layerQuat } = assets;
    const spacing = 1 + 1.5 * pose.open;
    const lift = 0.51;
    root.current.rotation.set(0.12 + 0.1 * pose.open, pose.turn, 0);
    root.current.position.y = 0.25;

    // Drop, bounce and squash, pivoting on the cube's base so it presses into
    // the paper rather than shrinking in the air.
    const drop = introDrop(time, reducedMotion);
    const squash = introSquash(time, reducedMotion);
    const base = spacing + 0.5;
    body.current.position.y = drop - squash * base;
    body.current.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    assets.dissolve.value = outro.cube;
    body.current.visible = outro.cube < 1;
    // The top layer finishes a quarter turn as the cube falls and clacks home on landing.
    layerQuat.setFromAxisAngle(assets.yAxis, introLayerTurn(time, reducedMotion));

    const floor = introFloorY(spacing);
    const airborne = Math.min(1, drop / DROP_HEIGHT);
    shadow.current.position.y = floor + 0.01;
    shadow.current.scale.setScalar(base * 2.4 * (1 + squash * 0.35) * (1 - airborne * 0.45));
    shadow.current.material.opacity = 0.34 * (1 - airborne * 0.85) * (1 - 0.45 * pose.open) * (1 - outro.cube);

    CELLS.forEach((p, i) => {
      dummy.position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
      dummy.quaternion.identity();
      if (inTwistLayer(p)) { dummy.position.applyQuaternion(layerQuat); dummy.quaternion.copy(layerQuat); }
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    // The core's three axles reach out to the six centre pieces however far apart they fly.
    for (let axis = 0; axis < 3; axis++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(axis === 2 ? Math.PI / 2 : 0, 0, axis === 0 ? Math.PI / 2 : 0);
      dummy.scale.set(1, 2 * spacing, 1);
      dummy.updateMatrix();
      core.current.setMatrixAt(axis, dummy.matrix);
    }
    core.current.instanceMatrix.needsUpdate = true;

    TILES.forEach((tile, i) => {
      const flip = stickerFlip(tile, time, reducedMotion);
      normal.set(0, 0, 0).setComponent(tile.face.axis, tile.face.sign);
      dummy.position.set(tile.position[0] * spacing, tile.position[1] * spacing, tile.position[2] * spacing)
        .addScaledVector(normal, 0.5 + 0.012 + flip.lift);
      faceQuat.setFromEuler(euler.set(...tile.face.rotation));
      flipQuat.setFromAxisAngle(xAxis, flip.angle);
      dummy.quaternion.copy(faceQuat).multiply(flipQuat);
      if (inTwistLayer(tile.position)) { dummy.position.applyQuaternion(layerQuat); dummy.quaternion.premultiply(layerQuat); }
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      stickers.current.setMatrixAt(i, dummy.matrix);
      stickers.current.setColorAt(i, assets.colors[(flip.flipped ? FLIPPED : ORIGINAL)[i].curr]);
    });
    stickers.current.instanceMatrix.needsUpdate = true;
    stickers.current.instanceColor.needsUpdate = true;

    gates.current.visible = pose.passage > 0.001;
    const wormsOn = pose.wormVisible;
    worms.current.visible = whites.current.visible = pupils.current.visible = wormsOn;
    gates.current.material.opacity = pose.passage;
    if (gates.current.visible) {
      const { head, ahead, dir, side, up, eye } = assets;
      PAIRS.forEach((pair, pairIndex) => {
        const grow = tunnelGrowth(pairIndex, time, reducedMotion);
        // Each end shows its own sticker's colour, which the flip wave reaches at its own time.
        const [near, far] = PAIR_ENDS[pairIndex];
        const first = assets.colors[(stickerFlip(TILES[near], time, reducedMotion).flipped ? FLIPPED : ORIGINAL)[near].curr];
        const second = assets.colors[(stickerFlip(TILES[far], time, reducedMotion).flipped ? FLIPPED : ORIGINAL)[far].curr];
        for (let s = 0; s < 2; s++) {
          // Each portal pops open as its tunnel launches from it (and lands in the other).
          const open = s === 0 ? grow : Math.max(0, grow * 1.4 - 0.4);
          pairPoint(pair, s, spacing, dummy.position, lift + 0.02, time);
          dummy.quaternion.setFromEuler(euler.set(...pair.face.rotation));
          dummy.scale.setScalar(open < 1 ? open * (1.25 - 0.25 * open) : 1);
          dummy.updateMatrix();
          gates.current.setMatrixAt(pairIndex * 2 + s, dummy.matrix);
          gates.current.setColorAt(pairIndex * 2 + s, s ? second : first);
        }
        if (!wormsOn) return;
        const progress = (time - WORM_START - pairIndex * 0.012) / 2.2;
        // Chunky beads, fat at the head and tapering to the tail, shading from
        // the entry colour to the exit colour as the worm crosses.
        for (let j = 0; j < WORM_SEGMENTS; j++) {
          const u = progress - j * 0.016;
          pairPoint(pair, u, spacing, dummy.position, lift, time);
          dummy.quaternion.identity();
          dummy.scale.setScalar(u < 0 || u > 1 ? 0 : 0.066 + 0.058 * (1 - j / WORM_SEGMENTS));
          dummy.updateMatrix();
          const index = pairIndex * WORM_SEGMENTS + j;
          worms.current.setMatrixAt(index, dummy.matrix);
          worms.current.setColorAt(index, color.copy(first).lerp(second, Math.max(0, Math.min(1, u))));
        }
        // Two eyes on the head, set either side of its heading.
        const alive = progress >= 0 && progress <= 1;
        pairPoint(pair, progress, spacing, head, lift, time);
        pairPoint(pair, Math.min(1, progress + 0.02), spacing, ahead, lift, time);
        dir.subVectors(ahead, head);
        if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
        dir.normalize();
        up.set(0, 1, 0);
        side.crossVectors(dir, up);
        if (side.lengthSq() < 1e-4) side.crossVectors(dir, up.set(1, 0, 0));
        side.normalize(); up.crossVectors(side, dir).normalize();
        for (let s = 0; s < 2; s++) {
          eye.copy(head).addScaledVector(side, s ? 0.045 : -0.045).addScaledVector(up, 0.05).addScaledVector(dir, 0.04);
          dummy.position.copy(eye); dummy.quaternion.identity();
          dummy.scale.setScalar(alive ? 0.036 : 0);
          dummy.updateMatrix();
          whites.current.setMatrixAt(pairIndex * 2 + s, dummy.matrix);
          dummy.position.copy(eye).addScaledVector(dir, 0.02).addScaledVector(up, 0.004);
          dummy.scale.setScalar(alive ? 0.019 : 0);
          dummy.updateMatrix();
          pupils.current.setMatrixAt(pairIndex * 2 + s, dummy.matrix);
        }
      });
      for (const mesh of [gates.current, worms.current, whites.current, pupils.current]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    const distance = introCameraDistance(pose.distance - energy.push * 1.0, camera.aspect, camera.fov);
    camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, -0.55, 0);
    // Fit on the plain frame, then (short landscape only) slide the picture right
    // so the cube stands clear of the copy column intro.css puts on the left.
    if (camera.view?.enabled) camera.clearViewOffset();
    fitIntroFrame(camera, root.current, spacing + 0.56);
    const { width, height } = state.size;
    if (width / height > 1.25 && height <= 500) {
      camera.setViewOffset(width, height, -width * LANDSCAPE_SHIFT, 0, width, height);
    }
  });
  // The camera is shared with the menu that follows: never hand it over shifted.
  useEffect(() => () => {
    if (cameraRef.current?.view?.enabled) cameraRef.current.clearViewOffset();
  }, []);

  return (
    <group ref={root} scale={INTRO_SCALE}>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={-10}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={assets.shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <IntroEnergy time={time} reducedMotion={reducedMotion} performanceMode={performanceMode} />
      <group ref={body}>
        <instancedMesh ref={bodies} args={[assets.body, null, CELLS.length]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh ref={core} args={[assets.coreArm, null, 3]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh args={[assets.coreHub, null, 1]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh ref={stickers} args={[assets.sticker, null, TILES.length]} material={materials.sticker} frustumCulled={false} />
        <IntroTunnels time={time} reducedMotion={reducedMotion} />
        <instancedMesh ref={gates} args={[null, null, PAIRS.length * 2]} frustumCulled={false} renderOrder={3}>
          <torusGeometry args={[0.3, 0.04, 8, 28]} />
          <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={worms} args={[null, null, PAIRS.length * WORM_SEGMENTS]} frustumCulled={false} renderOrder={4}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial depthWrite={false} depthTest={false} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={whites} args={[null, null, PAIRS.length * 2]} frustumCulled={false} renderOrder={5}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#fffdf2" depthWrite={false} depthTest={false} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={pupils} args={[null, null, PAIRS.length * 2]} frustumCulled={false} renderOrder={6}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#1a1410" depthWrite={false} depthTest={false} toneMapped={false} />
        </instancedMesh>
      </group>
    </group>
  );
}

