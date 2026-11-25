import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STICKER_OFFSET, createCubieGeometry, createStickerGeometry, rubiksFinish } from '../../3d/rubiksPiece.js';
import { createFlipPortalMaterial, getFlipPortalGeometry } from '../../3d/flipPortal.js';
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
import { introOutro, introDive } from './introOutro.js';
import { createDivePortal } from './introDivePortal.js';
import { createTaps, tapTile, tapFlip } from './introTouch.js';
import { feel } from '../../utils/feel.js';
import { addIntroDissolve } from './introDissolve.js';

const [ORIGINAL, FLIPPED] = INTRO_STICKERS;

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
  const { Material, plastic, sticker } = rubiksFinish(performanceMode);
  return {
    plastic: addIntroDissolve(new Material(plastic), dissolve),
    sticker: addIntroDissolve(new Material(sticker), dissolve)
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
  const portals = useRef();
  const shadow = useRef();
  const finished = useRef(false);
  const cameraRef = useRef(null);
  // The intro clock, for a tap's timestamp (introTouch.js); the taps themselves.
  const timeRef = useRef(time);
  timeRef.current = time;
  const taps = useRef(null);
  if (!taps.current) taps.current = createTaps();
  const assets = useMemo(() => {
    const colors = {};
    for (let id = 1; id <= 6; id++) colors[id] = new THREE.Color(introColor(id));
    // Own only the instance attributes: the portal's vertex buffers are shared
    // with gameplay and must survive skipping/replaying the opening.
    const portal = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(getFlipPortalGeometry().attributes)) portal.setAttribute(name, attribute);
    portal.setAttribute('aInstanceSeed', new THREE.InstancedBufferAttribute(new Float32Array(TILES.length), 1));
    portal.setAttribute('aInstanceData', new THREE.InstancedBufferAttribute(new Float32Array(TILES.length * 4), 4));
    return {
      portal, portalTime: { value: 0 }, portalMotion: { value: 1 },
      body: createCubieGeometry(),
      coreArm: new THREE.CylinderGeometry(0.1, 0.1, 1, 14),
      coreHub: new THREE.SphereGeometry(0.34, 20, 14),
      sticker: createStickerGeometry(),
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
    for (const name of Object.keys(assets.portal.attributes)) if (!['aInstanceSeed', 'aInstanceData'].includes(name)) assets.portal.deleteAttribute(name);
    assets.portal.dispose();
    // Keep the view reusable through React effect cleanup/re-setup. Only its
    // own instance buffers were present when Three handled the dispose event.
    for (const [name, attribute] of Object.entries(getFlipPortalGeometry().attributes)) assets.portal.setAttribute(name, attribute);
    for (const key of ['body', 'coreArm', 'coreHub', 'sticker', 'shadow']) assets[key].dispose();
  }, [assets]);
  const portalMaterial = useMemo(() => createFlipPortalMaterial(assets.portalTime, assets.portalMotion), [assets]);
  const dive = useMemo(() => createDivePortal(), []);
  useEffect(() => () => dive.dispose(), [dive]);
  // A tapped sticker flips to its antipode and its twin through the core follows.
  const onStickerDown = (event) => {
    if (event.instanceId == null) return;
    event.stopPropagation();
    const flipped = tapTile(taps.current, event.instanceId, timeRef.current);
    if (flipped.length) feel('cubeFlip');
  };
  useEffect(() => () => portalMaterial.dispose(), [portalMaterial]);
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
    // The ending: the cube dives through a portal in the paper (introDive);
    // reduced motion keeps the dissolve.
    const plunge = introDive(time, reducedMotion);
    body.current.position.y = drop - squash * base + plunge.lift;
    body.current.rotation.y = plunge.spin;
    body.current.scale.set((1 + squash * 0.5) * plunge.narrow, 1 - squash, (1 + squash * 0.5) * plunge.narrow);
    assets.dissolve.value = reducedMotion ? outro.cube : 0;
    body.current.visible = reducedMotion ? outro.cube < 1 : !plunge.gone;
    // The top layer finishes a quarter turn as the cube falls and clacks home on landing.
    layerQuat.setFromAxisAngle(assets.yAxis, introLayerTurn(time, reducedMotion));

    const floor = introFloorY(spacing);
    const airborne = Math.min(1, drop / DROP_HEIGHT);
    shadow.current.position.y = floor + 0.01;
    shadow.current.scale.setScalar(base * 2.4 * (1 + squash * 0.35) * (1 - airborne * 0.45));
    shadow.current.material.opacity = 0.34 * (1 - airborne * 0.85) * (1 - 0.45 * pose.open) * (1 - outro.cube) * (1 - plunge.portal);
    dive.update(plunge, floor, base, time);

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

    assets.portalTime.value = time;
    assets.portalMotion.value = reducedMotion ? 0 : 1;
    let portalCount = 0;
    TILES.forEach((tile, i) => {
      const flip = stickerFlip(tile, time, reducedMotion);
      const tap = tapFlip(taps.current[i], time, reducedMotion);
      const angle = flip.angle + tap.angle;
      // The colour follows every flip past its midpoint; the lens follows the
      // slab, which shows its back after an odd number of half turns.
      const flipped = flip.flipped !== (tap.halves % 2 === 1);
      const showsBack = Math.floor(angle / Math.PI + 0.5) % 2 === 1;
      normal.set(0, 0, 0).setComponent(tile.face.axis, tile.face.sign);
      dummy.position.set(tile.position[0] * spacing, tile.position[1] * spacing, tile.position[2] * spacing)
        .addScaledVector(normal, STICKER_OFFSET + flip.lift + tap.lift);
      faceQuat.setFromEuler(euler.set(...tile.face.rotation));
      flipQuat.setFromAxisAngle(xAxis, angle);
      dummy.quaternion.copy(faceQuat).multiply(flipQuat);
      if (inTwistLayer(tile.position)) { dummy.position.applyQuaternion(layerQuat); dummy.quaternion.premultiply(layerQuat); }
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      stickers.current.setMatrixAt(i, dummy.matrix);
      stickers.current.setColorAt(i, assets.colors[(flipped ? FLIPPED : ORIGINAL)[i].curr]);
      if (flipped) {
        // The new face is on the BACK of the turning slab. Seat the lens above
        // that face's dome and keep its normal pointing out of the cube.
        if (showsBack) dummy.rotateX(Math.PI);
        dummy.translateZ(0.026);
        dummy.updateMatrix();
        portals.current.setMatrixAt(portalCount, dummy.matrix);
        portals.current.setColorAt(portalCount, assets.colors[FLIPPED[i].curr]);
        const home = assets.colors[ORIGINAL[i].curr];
        assets.portal.attributes.aInstanceSeed.setX(portalCount, Math.max(flip.portalStart, tap.last + 0.21));
        assets.portal.attributes.aInstanceData.setXYZW(portalCount, home.r, home.g, home.b, 0);
        portalCount++;
      }
    });
    portals.current.count = portalCount;
    portals.current.instanceMatrix.needsUpdate = true;
    if (portals.current.instanceColor) portals.current.instanceColor.needsUpdate = true;
    assets.portal.attributes.aInstanceSeed.needsUpdate = true;
    assets.portal.attributes.aInstanceData.needsUpdate = true;
    stickers.current.instanceMatrix.needsUpdate = true;
    stickers.current.instanceColor.needsUpdate = true;
    // InstancedMesh caches its bounds for raycasting; the cube bursts open, so
    // let a tap recompute them rather than miss the outer stickers.
    stickers.current.boundingSphere = null;

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
      <primitive object={dive.mask} />
      <primitive object={dive.disc} />
      <group ref={body}>
        <instancedMesh ref={bodies} args={[assets.body, null, CELLS.length]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh ref={core} args={[assets.coreArm, null, 3]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh args={[assets.coreHub, null, 1]} material={materials.plastic} frustumCulled={false} />
        <instancedMesh ref={stickers} args={[assets.sticker, null, TILES.length]} material={materials.sticker} frustumCulled={false}
          onPointerDown={onStickerDown} />
        <instancedMesh name="IntroFlipPortals" ref={portals} args={[assets.portal, portalMaterial, TILES.length]} frustumCulled={false} />
        <IntroTunnels time={time} reducedMotion={reducedMotion} />
      </group>
    </group>
  );
}

