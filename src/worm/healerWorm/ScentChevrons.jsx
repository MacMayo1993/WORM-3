// The guide trail's chevrons (route and goal in scentTrail.js, published to
// wormBuffs.scent by useWormCrawler). A few chevrons on the tiles ahead of the
// head, in the target's colour with an ink rim so they read on any sticker,
// pointing along the shortest crawl to it. One InstancedMesh, one draw. Mounted
// for the mode's life (hidden) so the run's warm-up links its program, never the
// first frame it shows.
//
// Until the final heal it shows only when the target is out of view (off the frame or
// on a face turned away); in the final heal it always shows. The pulse runs on
// the sim's clock, so pause holds it, and reduced motion keeps it still.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { liveRotation } from '../liveRotation.js';
import { wormBuffs } from '../wormBuffs.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';
import { DIR_FORWARD, FACE_NORMALS } from './constants.js';
import { SCENT, scentTargetInView } from './scentTrail.js';

const CHEVRON_SIZE = 0.8;     // world units, on a 1-unit tile
const CHEVRON_LIFT = 0.04;    // over the sticker, under the worm
const FADE_RATE = 8;          // per second, toward shown or hidden

// The chevron as an RGBA map pointing up the texture (+v): white where the target
// colour shows, black for the ink rim, alpha for coverage.
let _texture = null;
function chevronTexture() {
  if (_texture) return _texture;
  const n = 96;
  const data = new Uint8Array(n * n * 4);
  const apex = [0, 0.4], arms = [[-0.62, -0.24], [0.62, -0.24]];
  const segment = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay;
    const h = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - dx * h, py - ay - dy * h);
  };
  const edge = 2.5 / n;
  const cover = (d, r) => Math.max(0, Math.min(1, (r - d) / edge + 0.5));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = ((x + 0.5) / n) * 2 - 1, py = ((y + 0.5) / n) * 2 - 1;
      const d = Math.min(segment(px, py, arms[0], apex), segment(px, py, arms[1], apex));
      const fill = cover(d, 0.17), rim = cover(d, 0.27);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(255 * (rim > 0 ? fill / rim : 0));
      data[i + 3] = Math.round(255 * rim);
    }
  }
  _texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  _texture.magFilter = THREE.LinearFilter;
  _texture.minFilter = THREE.LinearFilter;
  _texture.needsUpdate = true;
  return _texture;
}

function createChevrons(capacity) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const intensity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  intensity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aIntensity', intensity);
  const material = new THREE.MeshBasicMaterial({
    map: chevronTexture(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aIntensity;\nvarying float vScentIntensity;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vScentIntensity = aIntensity;');
    shader.fragmentShader = 'varying float vScentIntensity;\n' +
      shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vScentIntensity;');
  };
  material.customProgramCacheKey = () => 'scent-trail';
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'ScentChevrons';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.renderOrder = -0.5; // after the worm-mode cubie bodies (-1), like the orb beacons
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  return { mesh, geometry, material, intensity };
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _p = new THREE.Vector3();
const _target = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function ScentChevrons({ worm, size }) {
  const chevrons = useMemo(() => createChevrons(SCENT.cells), []);
  useEffect(() => () => { chevrons.geometry.dispose(); chevrons.material.dispose(); chevrons.mesh.dispose(); }, [chevrons]);
  const state = useRef({ fade: 0, color: null, count: 0 });

  useFrame(({ camera }, delta) => {
    const { mesh, material, intensity } = chevrons;
    const s = state.current;
    const goal = wormBuffs.scent;
    const live = !!goal && goal.steps > SCENT.near && worm.phase.current === 'crawling'
      && !liveRotation.active && !worm.restRead.current;
    let want = 0;
    if (live) {
      const t = goal.target;
      _target.fromArray(getWormStickerWorldPos(t.x, t.y, t.z, t.dirKey, size));
      want = goal.final || !scentTargetInView(camera, _target, FACE_NORMALS[t.dirKey]) ? 1 : 0;
    }
    s.fade += (want - s.fade) * Math.min(1, delta * FADE_RATE);
    if (!live || s.fade < 0.01) {
      if (!live) s.fade = 0;
      mesh.visible = false;
      return;
    }
    if (goal.color !== s.color) { s.color = goal.color; material.color.set(goal.color); }

    const motion = !prefersReducedMotion();
    const time = worm.timeAliveRef.current;
    let count = 0;
    // Stop short of the target: it has its own beacon or pad.
    const last = Math.min(SCENT.cells, goal.path.length - 1);
    for (let k = 0; k < last; k++) {
      const tile = goal.path[k];
      if (tile.raised) continue;
      const normal = FACE_NORMALS[tile.dirKey];
      _z.copy(normal);
      _y.fromArray(DIR_FORWARD[tile.dirKey][tile.dir]);
      _x.crossVectors(_y, _z);
      _p.fromArray(getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size)).addScaledVector(normal, CHEVRON_LIFT);
      _m.makeBasis(_x, _y, _z).scale(_scale.setScalar(CHEVRON_SIZE)).setPosition(_p);
      mesh.setMatrixAt(count, _m);
      // Fainter with distance; a wave runs out from the head along the route.
      const wave = motion ? 0.72 + 0.28 * Math.max(0, Math.sin(time * 4 - k * 0.9)) : 0.9;
      intensity.array[count] = s.fade * (1 - 0.16 * k) * wave;
      count++;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    uploadInstancePrefix(mesh.instanceMatrix, count);
    uploadInstancePrefix(intensity, count);
  });

  return <primitive object={chevrons.mesh} />;
}
