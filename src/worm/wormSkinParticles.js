// src/worm/wormSkinParticles.js
// Ambient per-skin particle FX (embers, bubbles, sparkle motes, snow, orbiting
// stars) that hover around the worm's head. Framework-agnostic (plain
// three.js) so it drives all three worm renderers identically — the R3F
// wrapper (WormSkinParticles.jsx) for gameplay and the vanilla-three store
// preview (WormPreviewRenderer.js) both just parent `.mesh` under the head
// and call `.update(elapsed)` every frame; no duplicated particle logic.
import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// Deterministic per-instance pseudo-random seeds (no Math.random() churn per
// frame) — one Float32Array reused across configure() calls.
function seededRandom(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const MAX_PARTICLES = 24;

export class WormParticleSystem {
  constructor() {
    const geo = new THREE.CircleGeometry(1, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this._style = 'none';
    this._count = 0;
    this._speed = 0.5;
    this._size = 0.03;
    this._spread = 0.3;
    this._orbit = false;
    this._baseColor = new THREE.Color(0xffffff);
    this._seeds = new Float32Array(MAX_PARTICLES * 3); // phase, radiusRand, speedRand
  }

  /** Reconfigure for a (possibly new) skin's particle profile. */
  configure(profile, colorHex) {
    const p = profile || { style: 'none' };
    this._style = p.style || 'none';
    this._count = Math.min(MAX_PARTICLES, p.count ?? 10);
    this._speed = p.speed ?? 0.5;
    this._size = p.size ?? 0.03;
    this._spread = p.spread ?? 0.3;
    this._orbit = !!p.orbit;
    this._baseColor.set(colorHex || '#ffffff');
    for (let i = 0; i < this._count; i++) {
      this._seeds[i * 3] = seededRandom(i, 1.0) * Math.PI * 2;
      this._seeds[i * 3 + 1] = 0.4 + seededRandom(i, 2.0) * 0.6;
      this._seeds[i * 3 + 2] = 0.7 + seededRandom(i, 3.0) * 0.6;
    }
    this.mesh.count = this._style === 'none' ? 0 : this._count;
  }

  /** Advance the animation. Positions are local — parent .mesh under the head. */
  update(elapsed) {
    const mesh = this.mesh;
    if (this._style === 'none' || this._count === 0) { mesh.count = 0; return; }

    for (let i = 0; i < this._count; i++) {
      const phase = this._seeds[i * 3];
      const rRand = this._seeds[i * 3 + 1];
      const sRand = this._seeds[i * 3 + 2];
      const t = elapsed * this._speed * sRand + phase;
      let x = 0, y = 0, z = 0, scale = this._size, opacity = 1;

      switch (this._style) {
        case 'ember': {
          // Rises and drifts, fading as it climbs; wraps back to the base.
          const cycle = (t * 0.5) % 1;
          x = Math.sin(phase + cycle * 6.0) * this._spread * 0.4 * rRand;
          z = Math.cos(phase + cycle * 6.0) * this._spread * 0.4 * rRand;
          y = cycle * this._spread * 1.6;
          opacity = 1 - cycle;
          scale = this._size * (1 - cycle * 0.4);
          break;
        }
        case 'bubble': {
          // Rises slowly with a gentle side-to-side wobble.
          const cycle = (t * 0.35) % 1;
          x = Math.sin(t * 1.4) * this._spread * 0.5 * rRand;
          z = Math.cos(t * 1.1) * this._spread * 0.5 * rRand;
          y = cycle * this._spread * 1.4 - this._spread * 0.3;
          opacity = 0.55 + Math.sin(t * 3.0) * 0.25;
          scale = this._size * (0.7 + rRand * 0.6);
          break;
        }
        case 'sparkle': {
          // Twinkling motes held near the body surface, tiny orbit.
          x = Math.sin(phase + t * 0.6) * this._spread * rRand;
          y = Math.cos(phase * 1.3 + t * 0.5) * this._spread * 0.6 * rRand;
          z = Math.sin(phase * 0.7 + t * 0.8) * this._spread * rRand;
          opacity = 0.4 + Math.max(0, Math.sin(t * 4.0 + phase)) * 0.6;
          scale = this._size * (0.6 + 0.5 * Math.max(0, Math.sin(t * 4.0 + phase)));
          break;
        }
        case 'snow': {
          // Gentle falling drift with wraparound.
          const cycle = (t * 0.3) % 1;
          x = Math.sin(phase + cycle * 4.0) * this._spread * 0.6 * rRand;
          z = Math.cos(phase + cycle * 3.0) * this._spread * 0.6 * rRand;
          y = this._spread * 0.7 - cycle * this._spread * 1.4;
          opacity = 0.5 + Math.sin(t * 2.0 + phase) * 0.2;
          scale = this._size * (0.6 + rRand * 0.5);
          break;
        }
        case 'star': {
          // Slow orbit ring around the head, twinkling.
          const angle = phase + (this._orbit ? t * 0.6 : 0);
          const r = this._spread * (0.7 + 0.3 * rRand);
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
          y = Math.sin(phase * 2.0 + t * 0.4) * this._spread * 0.3;
          opacity = 0.4 + Math.max(0, Math.sin(t * 2.5 + phase)) * 0.6;
          scale = this._size * (0.5 + 0.5 * Math.max(0, Math.sin(t * 2.5 + phase)));
          break;
        }
        default:
          opacity = 0;
      }

      _dummy.position.set(x, y, z);
      _dummy.scale.setScalar(Math.max(0.0001, scale));
      _dummy.rotation.set(0, 0, phase);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      // InstancedMesh has no per-instance alpha, so fade is encoded as color
      // brightness — with additive blending, a dimmer instance color reads as
      // more transparent, same trick WormTrail.jsx uses for its fading daubs.
      _color.copy(this._baseColor).multiplyScalar(Math.max(0, opacity));
      mesh.setColorAt(i, _color);
    }
    mesh.count = this._count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
