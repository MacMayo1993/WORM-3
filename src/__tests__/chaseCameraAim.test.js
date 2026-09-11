// The chase view used to roll by itself when the worm rounded an edge. Both
// causes were in how the orientation was derived: lookAt builds roll from
// cross(viewDir, up), which collapses as the view lines up with the up axis, and
// the world-Y up had to flip sign under the cube — smoothed by lerping +Y toward
// -Y, straight through the zero vector. aimCamera slerps a quaternion instead.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { aimCamera } from '../worm/WormChaseCamera.jsx';

const cam = () => new THREE.PerspectiveCamera(70, 1, 0.1, 100);
const finite = q => [q.x, q.y, q.z, q.w].every(Number.isFinite);
/** Where the camera is actually looking. */
const forwardOf = c => new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);

describe('chase camera aim', () => {
  it('converges on the target', () => {
    const c = cam();
    const eye = new THREE.Vector3(0, 2, 5);
    const look = new THREE.Vector3(0, 0, 0);
    c.position.copy(eye);
    for (let i = 0; i < 120; i++) aimCamera(c, eye, look, new THREE.Vector3(0, 1, 0), 0.2);
    const want = look.clone().sub(eye).normalize();
    expect(forwardOf(c).dot(want)).toBeGreaterThan(0.9999);
  });

  it('stays finite when the up hint is the view direction', () => {
    // Looking straight down with up = -Y: the degenerate case lookAt cannot solve.
    const c = cam();
    const eye = new THREE.Vector3(0, 5, 0);
    const look = new THREE.Vector3(0, 0, 0);
    c.position.copy(eye);
    for (let i = 0; i < 60; i++) aimCamera(c, eye, look, new THREE.Vector3(0, -1, 0), 0.3);
    expect(finite(c.quaternion)).toBe(true);
    expect(forwardOf(c).dot(new THREE.Vector3(0, -1, 0))).toBeGreaterThan(0.999);
  });

  it('survives an up hint of exactly zero', () => {
    // What lerping +Y toward -Y passes through on the way.
    const c = cam();
    const eye = new THREE.Vector3(0, 0, 4);
    const look = new THREE.Vector3(0, 0, 0);
    c.position.copy(eye);
    aimCamera(c, eye, look, new THREE.Vector3(0, 0, 0), 1);
    expect(finite(c.quaternion)).toBe(true);
    expect(Number.isFinite(c.up.x + c.up.y + c.up.z)).toBe(true);
  });

  it('rolls through a 180° up flip in bounded steps', () => {
    // Crossing onto the bottom face flips the world-up hint. As a slerp that is a
    // controlled roll: every frame turns a little, and none of them is a spin.
    const c = cam();
    const eye = new THREE.Vector3(0, 0, 4);
    const look = new THREE.Vector3(0, 0, 0);
    c.position.copy(eye);
    aimCamera(c, eye, look, new THREE.Vector3(0, 1, 0), 1);

    let prev = c.quaternion.clone();
    let worst = 0;
    for (let i = 0; i < 40; i++) {
      aimCamera(c, eye, look, new THREE.Vector3(0, -1, 0), 0.2);
      worst = Math.max(worst, prev.angleTo(c.quaternion));
      expect(finite(c.quaternion)).toBe(true);
      prev = prev.copy(c.quaternion);
    }
    expect(worst).toBeLessThan(Math.PI / 4);   // no single-frame snap
    expect(c.up.y).toBeLessThan(0);            // and it did get there
  });

  it('rolls with the face when handed a face normal', () => {
    // 'face' horizon: up is the surface normal, so the camera's own up ends up
    // on that normal rather than on world Y.
    const c = cam();
    const n = new THREE.Vector3(1, 0, 0);                 // standing on the +X face
    const eye = new THREE.Vector3(4, 0, 2);
    const look = new THREE.Vector3(3, 0, 0);
    c.position.copy(eye);
    for (let i = 0; i < 120; i++) aimCamera(c, eye, look, n, 0.25);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
    expect(up.dot(n)).toBeGreaterThan(0.7);
  });
});
