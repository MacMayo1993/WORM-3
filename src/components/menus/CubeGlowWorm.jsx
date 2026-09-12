import { finishWormEyes } from '../../worm/wormCharacterFinish.js';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import { createWormSkinMaterial, applyBioluminescence, updateWormSkinMaterialTime } from '../../worm/wormSkinMaterial.js';
import { makeWormHaloSprite, HALO_SCALE } from '../../worm/wormGlowHalo.js';
import { layoutWormFace, FACE_LAYOUT, MOUTH_ARC } from '../../worm/wormFaceLayout.js';
import { isCarouselActive } from './menuCarouselState.js';
import { sampleWigglingCubeWorm } from './cubeWormPath.js';

const CAROUSEL_WORM_SPEED = 1.1;

// Mounted INSIDE the cube's transform. No screen coordinates or independent
// world-space movement: carousel turns, wobble, scale and dive carry every part.
function GlowWorm({ distance, antipodal = false }) {
  const model = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 40;
    const skin = { ...getSkin('bubble'), body: antipodal ? '#45dccc' : '#db79f0', glow: antipodal ? '#91fff0' : '#ff9ddb' };
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = createWormSkinMaterial({ color: skin.body, roughness: 0.3, clearcoat: 0.7 });
    applyBioluminescence(material, skin.glow, true);
    material.emissiveIntensity = 0.32;
    material.userData.pulse = { base: 0.32, amp: 0.12, speed: 2.4 };
    const ringGeometry = new THREE.TorusGeometry(1, 0.055, 6, 20);
    const ringMaterial = createWormSkinMaterial({ color: new THREE.Color(skin.body).multiplyScalar(0.65), emissive: skin.body, emissiveIntensity: 0.1, roughness: 0.6 });
    const collarMaterial = createWormSkinMaterial({ color: new THREE.Color(skin.body).lerp(new THREE.Color('#ffe4cf'), 0.35), emissive: skin.body, emissiveIntensity: 0.12, roughness: 0.45 });
    const beads = [], halos = [], rings = [];
    for (let i = 0; i < 9; i++) {
      const bead = new THREE.Mesh(geometry, material);
      const radius = i === 0 ? 0.17 : i === 8 ? 0.13 : 0.15;
      bead.userData.radius = radius;
      bead.scale.setScalar(radius);
      // Fine annuli and a broad clitellum give the body an earthworm silhouette.
      if (i > 0) {
        const ring = new THREE.Mesh(ringGeometry, i === 3 ? collarMaterial : ringMaterial);
        group.add(ring); rings[i] = ring;
      }
      if (i === 3) bead.material = collarMaterial;
      const halo = makeWormHaloSprite();
      halo.visible = true;
      halo.material.color.set(skin.glow);
      halo.material.opacity *= 0.3;
      halo.scale.setScalar(0.12 * HALO_SCALE * 0.7);
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
    return { group, beads, halos, rings, material, face: { eyes, pupils, mouth, glasses: [null, null], hat: null },
      position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(), axis: new THREE.Vector3(0, 0, 1),
      dispose() { disposeEyes(); geometry.dispose(); ringGeometry.dispose(); ringMaterial.dispose(); collarMaterial.dispose(); material.dispose(); white.dispose(); black.dispose(); mouthGeo.dispose(); halos.forEach(h => h.material.dispose()); } };
  }, [antipodal]);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = isCarouselActive();
    if (!model.group.visible) return;
    const time = distance.current / CAROUSEL_WORM_SPEED;
    updateWormSkinMaterialTime(model.material, time);
    model.beads.forEach((bead, i) => {
      // Compression travels down the body; spacing stays positive and beads overlap.
      const contraction = Math.sin(time * 6 - i * 0.7);
      const lag = i * 0.14 + 0.045 * (contraction - Math.sin(time * 6));
      sampleWigglingCubeWorm(distance.current - lag, i, time, model.position, model.normal, model.forward, antipodal);
      bead.position.copy(model.position);
      bead.quaternion.setFromUnitVectors(model.axis, model.forward);
      const radius = bead.userData.radius;
      const bulge = i === 0 ? 1 : 1 + 0.07 * contraction;
      bead.scale.set(radius * bulge, radius * bulge, radius * (i === 0 ? 1 : 0.88 / bulge));
      if (model.rings[i]) {
        const ring = model.rings[i];
        ring.position.copy(model.position);
        ring.quaternion.copy(bead.quaternion);
        ring.scale.setScalar(radius * bulge);
      }
      model.halos[i].position.copy(model.position);
      if (i === 0) layoutWormFace(model.position, model.forward, model.normal, 0.17, model.face);
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
      distance.current += Math.min(delta, 0.05) * CAROUSEL_WORM_SPEED;
    }
  });
  return <>
    <GlowWorm distance={distance} />
    <GlowWorm distance={distance} antipodal />
  </>;
}
