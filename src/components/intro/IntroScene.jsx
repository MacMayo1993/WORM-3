import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { INTRO_STICKERS } from './introStickers.js';
import { INTRO_SCALE, placeIntroFrame } from './introFraming.js';
import IntroTunnels from './IntroTunnels.jsx';
import { INTRO_END, sampleIntro, introCameraDistance } from './introChoreography.js';
import IntroEnergy from './IntroEnergy.jsx';
import { introEnergy } from './introEnergy.js';
import { CELLS, TILES } from './introTopology.js';
import {
  introColor, introDrop, introSquash, introLayerTurn, TWIST_LAYER, stickerFlip, introFloorY, DROP_HEIGHT
} from './introMotion.js';
import { introOutro } from './introOutro.js';
import { addIntroDissolve } from './introDissolve.js';

const [ORIGINAL, FLIPPED] = INTRO_STICKERS;

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

// All 54 stickers with six hero passages; bodies, stickers and worms are instanced.
export default function IntroScene({ time, onComplete, reducedMotion = false, performanceMode = false }) {
  const root = useRef();
  const body = useRef();
  const bodies = useRef();
  const core = useRef();
  const stickers = useRef();
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
      dummy: new THREE.Object3D(), euler: new THREE.Euler(),
      faceQuat: new THREE.Quaternion(), flipQuat: new THREE.Quaternion(), xAxis: new THREE.Vector3(1, 0, 0),
      normal: new THREE.Vector3(),
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
    const { dummy, euler, faceQuat, flipQuat, xAxis, normal, layerQuat } = assets;
    const spacing = 1 + 1.5 * pose.open;
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

    const distance = introCameraDistance(pose.distance - energy.push * 1.0, camera.aspect, camera.fov);
    camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, -0.55, 0);
    if (camera.view?.enabled) camera.clearViewOffset();
    const { width, height } = state.size;
    placeIntroFrame(camera, root.current, spacing + 0.56, width, height);
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
      </group>
    </group>
  );
}

