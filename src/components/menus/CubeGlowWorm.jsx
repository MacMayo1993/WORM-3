import { finishWormEyes, wormBodyTaper } from '../../worm/wormCharacterFinish.js';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import { createWormSkinMaterial, applyBioluminescence, updateWormSkinMaterialTime } from '../../worm/wormSkinMaterial.js';
import { makeWormHaloSprite, HALO_SCALE } from '../../worm/wormGlowHalo.js';
import { layoutWormFace, FACE_LAYOUT, MOUTH_ARC } from '../../worm/wormFaceLayout.js';
import { isCarouselActive } from './menuCarouselState.js';
import { sampleCubeWorm } from './cubeWormPath.js';

// Mounted INSIDE the cube's transform. No screen coordinates or independent
// world-space movement: carousel turns, wobble, scale and dive carry every part.
function GlowWorm({ distance, antipodal = false }) {
  const model = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 40;
    const skin = { ...getSkin('bubble'), body: '#bd68d8', glow: '#ee8bd5' };
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = createWormSkinMaterial({ color: skin.body, roughness: 0.3, clearcoat: 0.7 });
    applyBioluminescence(material, skin.glow, true);
    const beads = [], halos = [];
    for (let i = 0; i < 9; i++) {
      const bead = new THREE.Mesh(geometry, material);
      bead.scale.setScalar((i === 0 ? 0.14 : 0.12) * wormBodyTaper(i, 9, 'glow'));
      const halo = makeWormHaloSprite();
      halo.visible = true;
      halo.material.color.set(skin.glow);
      halo.scale.setScalar(0.12 * HALO_SCALE);
      group.add(bead, halo); beads.push(bead); halos.push(halo);
    }
    const white = new THREE.MeshPhysicalMaterial({ color: '#f1f3e9', roughness: 0.22, clearcoat: 1 });
    const black = new THREE.MeshBasicMaterial({ color: '#12131a' });
    const eyes = [0, 1].map(() => new THREE.Mesh(geometry, white));
    const pupils = [0, 1].map(() => new THREE.Mesh(geometry, black));
    const disposeEyes = finishWormEyes(eyes, pupils);
    const mouthGeo = new THREE.TorusGeometry(1, FACE_LAYOUT.mouthTube / FACE_LAYOUT.mouthRadius, 8, 22, MOUTH_ARC);
    const mouth = new THREE.Mesh(mouthGeo, black);
    group.add(...eyes, ...pupils, mouth);
    return { group, beads, halos, material, face: { eyes, pupils, mouth, glasses: [null, null], hat: null },
      position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(),
      dispose() { disposeEyes(); geometry.dispose(); material.dispose(); white.dispose(); black.dispose(); mouthGeo.dispose(); halos.forEach(h => h.material.dispose()); } };
  }, []);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = isCarouselActive();
    if (!model.group.visible) return;
    updateWormSkinMaterialTime(model.material, distance.current / 0.65);
    model.beads.forEach((bead, i) => {
      sampleCubeWorm(distance.current - i * 0.18, model.position, model.normal, model.forward, antipodal);
      bead.position.copy(model.position);
      model.halos[i].position.copy(model.position);
      if (i === 0) layoutWormFace(model.position, model.forward, model.normal, 0.14, model.face);
    });
  });
  return <primitive object={model.group} dispose={null} />;
}

// One clock drives both models: each corresponding body segment is antipodal,
// even at rounded edges and while reduced motion holds the pair still.
export default function CubeGlowWorm() {
  const distance = useRef(1.8);
  const reduced = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media.matches; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useFrame((_state, delta) => {
    if (isCarouselActive() && !reduced.current && !document.hidden) {
      distance.current += Math.min(delta, 0.05) * 0.65;
    }
  });
  return <>
    <GlowWorm distance={distance} />
    <GlowWorm distance={distance} antipodal />
  </>;
}
