import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { SpecialOrbs } from '../worm/healerWorm/orbSystems.jsx';
import { VIEW_POWER_TYPES } from '../worm/healerWorm/viewPowerups.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { getViewPickupGeometry } from '../worm/healerWorm/viewPickupGeometry.js';
import { liveCubies } from '../worm/liveCubies.js';

vi.mock('../worm/healerWorm/ElementalOrb.jsx', () => ({
  default: ({ special }) => <group name={`elemental-${special.type}`} />,
  ElementalClaimBurst: () => null,
}));
extend(THREE);

it('renders every view as its own cube, reserves elemental rendering for elements, and preserves expiry and hiding', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const previous = useGameStore.getState().wormSpecials;
  const previousLive = { ...liveCubies };
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const specials = [...VIEW_POWER_TYPES, 'orb-shower', 'fire'].map((type, id) => ({
    id, type, x: 1, y: 1, z: 2, dirKey: 'PZ', ttl: 20, maxTtl: 20,
  }));
  useGameStore.setState({ wormSpecials: specials });
  let store;
  let time = 0;
  const advance = count => { for (let i = 0; i < count; i++) store.advance(time += 1 / 60); };
  const render = async hidden => {
    await act(async () => { store = root.render(<SpecialOrbs size={3} hidden={hidden} />).getState(); });
  };
  try {
    await render(false);
    advance(60);
    for (const type of VIEW_POWER_TYPES) {
      const model = store.scene.getObjectByName(`view-pickup-${type.slice(5)}`);
      expect(model, type).toBeDefined();
      const pickup = model.parent.parent;
      const meshes = [];
      pickup.traverse(o => { if (o.isMesh) meshes.push(o); });
      expect(meshes.length).toBeLessThanOrEqual(6);
      expect(meshes.every(o => o.geometry.type !== 'SphereGeometry')).toBe(true);
      expect(pickup.visible).toBe(true);
      expect(pickup.position.z).toBeGreaterThan(1.5);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(pickup.quaternion).z).toBeCloseTo(1);
    }
    const shower = store.scene.getObjectByName('orb-shower-pickup');
    expect(shower).toBeDefined();
    const clouds = shower.children.filter(mesh => mesh.geometry.type === 'SphereGeometry');
    const drops = shower.children.filter(mesh => mesh.geometry.type === 'OctahedronGeometry');
    expect(drops).toHaveLength(3);
    // Look straight down every face normal through each drop. The cloud must
    // never cover it, including as the pickup spins in the tile's plane.
    const ray = new THREE.Raycaster(), dropPosition = new THREE.Vector3();
    for (const normal of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      shower.parent.parent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        shower.parent.rotation.y = angle;
        store.scene.updateMatrixWorld(true);
        for (const drop of drops) {
          drop.getWorldPosition(dropPosition);
          ray.set(dropPosition.clone().addScaledVector(normal, 3), normal.clone().negate());
          expect(ray.intersectObjects([drop]).length).toBeGreaterThan(0);
          expect(ray.intersectObjects(clouds)).toHaveLength(0);
        }
      }
    }
    expect(store.scene.getObjectByName('elemental-fire')).toBeDefined();
    expect(store.scene.getObjectByName('elemental-view-lego')).toBeUndefined();
    expect(store.scene.getObjectByName('elemental-orb-shower')).toBeUndefined();
    const lego = store.scene.getObjectByName('view-pickup-lego');
    const glass = store.scene.getObjectByName('view-pickup-glass');
    const timer = lego.parent.parent.children.find(o => o.geometry?.type === 'RingGeometry');
    expect(timer.scale.x).toBeCloseTo(1);
    specials.find(s => s.type === 'view-lego').ttl = 0.5;
    advance(1);
    expect(timer.scale.x).toBeLessThan(0.3);
    expect(lego.children[0].material.opacity).toBeLessThan(1);
    expect(glass.children[0].material.opacity).toBeCloseTo(0.14);
    // Halfway through a slice turn, the model must follow the physical tile.
    const cubie = new THREE.Group();
    cubie.position.set(2, 3, 4);
    cubie.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    liveCubies.size = 3;
    liveCubies.refs = [];
    liveCubies.refs[14] = cubie; // (1, 1, 2)
    advance(1);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(cubie.quaternion);
    const offset = lego.parent.parent.position.clone().sub(cubie.position).normalize();
    expect(offset.distanceTo(normal)).toBeLessThan(1e-8);
    await render(true);
    expect(store.scene.children[0].visible).toBe(false);
    await render(false);
    expect(store.scene.getObjectByName('view-pickup-lego')).toBe(lego);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState({ wormSpecials: previous });
    Object.assign(liveCubies, previousLive);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('uses raised LEGO studs, open gap spacing and reusable geometry', () => {
  const lego = getViewPickupGeometry('lego'), classic = getViewPickupGeometry('classic');
  const gap = getViewPickupGeometry('gap');
  lego.panels.computeBoundingBox(); classic.panels.computeBoundingBox(); gap.body.computeBoundingBox();
  expect(lego.panels.boundingBox.max.z).toBeGreaterThan(classic.panels.boundingBox.max.z + 0.02);
  expect(lego.panels.attributes.position.count).toBeGreaterThan(classic.panels.attributes.position.count);
  expect(gap.body.boundingBox.max.x).toBeGreaterThan(classic.panels.boundingBox.max.x);
  expect(getViewPickupGeometry('lego')).toBe(lego);
});
