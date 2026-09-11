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
export default function CubeGlowWorm() {
  const distance = useRef(1.8);
  const reduced = useRef(false);
  const model = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 40;
    const skin = getSkin('slime');
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = createWormSkinMaterial({ color: skin.body, roughness: 0.3, clearcoat: 0.7 });
    applyBioluminescence(material, skin.glow, true);
    const beads = [], halos = [];
    for (let i = 0; i < 9; i++) {
      const bead = new THREE.Mesh(geometry, material);
      bead.scale.setScalar(i === 0 ? 0.14 : 0.12);
      const halo = makeWormHaloSprite();
      halo.visible = true;
      halo.material.color.set(skin.glow);
      halo.scale.setScalar(0.12 * HALO_SCALE);
      group.add(bead, halo); beads.push(bead); halos.push(halo);
    }
    const white = new THREE.MeshBasicMaterial({ color: 'white' });
    const black = new THREE.MeshBasicMaterial({ color: '#12131a' });
    const eyes = [0, 1].map(() => new THREE.Mesh(geometry, white));
    const pupils = [0, 1].map(() => new THREE.Mesh(geometry, black));
    const mouthGeo = new THREE.TorusGeometry(1, FACE_LAYOUT.mouthTube / FACE_LAYOUT.mouthRadius, 8, 22, MOUTH_ARC);
    const mouth = new THREE.Mesh(mouthGeo, black);
    group.add(...eyes, ...pupils, mouth);
    return { group, beads, halos, material, face: { eyes, pupils, mouth, glasses: [null, null], hat: null },
      position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(),
      dispose() { geometry.dispose(); material.dispose(); white.dispose(); black.dispose(); mouthGeo.dispose(); halos.forEach(h => h.material.dispose()); } };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media.matches; };
    update(); media.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); model.dispose(); };
  }, [model]);
  useFrame((_state, delta) => {
    model.group.visible = isCarouselActive();
    if (!model.group.visible) return;
    if (!reduced.current && !document.hidden) distance.current += Math.min(delta, 0.05) * 0.65;
    updateWormSkinMaterialTime(model.material, distance.current / 0.65);
    model.beads.forEach((bead, i) => {
      sampleCubeWorm(distance.current - i * 0.18, model.position, model.normal, model.forward);
      bead.position.copy(model.position);
      model.halos[i].position.copy(model.position);
      if (i === 0) layoutWormFace(model.position, model.forward, model.normal, 0.14, model.face);
    });
  });
  return <primitive object={model.group} dispose={null} />;
}
