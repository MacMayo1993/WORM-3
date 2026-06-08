import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_COUNT = 7;
const SPHERE_R   = 82;   // inside the background sphere (radius 100)
const SPEED      = 30;   // world units per second

// Module-level scratch to avoid per-frame allocations
const _dir  = new THREE.Vector3();
const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

function spawnStar(star, t) {
  // Random point on sphere surface
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  star.ox = SPHERE_R * Math.sin(phi) * Math.cos(theta);
  star.oy = SPHERE_R * Math.sin(phi) * Math.sin(theta);
  star.oz = SPHERE_R * Math.cos(phi);

  // Compute two orthogonal tangents at this sphere point (no allocations beyond spawn)
  const nx = star.ox / SPHERE_R, ny = star.oy / SPHERE_R, nz = star.oz / SPHERE_R;
  // First tangent — avoid parallel to normal
  let tx, ty, tz;
  if (Math.abs(ny) < 0.9) { tx = nz; ty = 0; tz = -nx; }
  else                     { tx = 0; ty = nz; tz = -ny; }
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
  tx /= tl; ty /= tl; tz /= tl;
  // Second tangent via cross product (normal × t1)
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  // Random direction around the tangent plane
  const a = Math.random() * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  star.dx = ca * tx + sa * bx;
  star.dy = ca * ty + sa * by;
  star.dz = ca * tz + sa * bz;

  star.spawnAt   = t;
  star.duration  = 0.50 + Math.random() * 0.80;
  star.streakLen = 3.0 + Math.random() * 5.0;
  star.active    = true;
}

/**
 * ShootingStars — a pool of STAR_COUNT streaking meteors rendered inside the
 * background sphere. Each star spawns at a random sky position, travels along
 * a tangent arc, then sleeps for a random interval before re-spawning.
 */
const ShootingStars = () => {
  // Plain-object star state — lives outside React state for zero re-renders
  const stars = useRef(
    Array.from({ length: STAR_COUNT }, (_, i) => ({
      active: false,
      nextSpawn: 0.8 + i * 1.6 + Math.random() * 2.0,
      ox: 0, oy: 0, oz: 0,
      dx: 0, dy: 0, dz: 0,
      spawnAt: 0, duration: 0, streakLen: 4,
    }))
  ).current;

  const meshRefs = useRef([]);

  // Tapered cylinder: top = head (bright), bottom = tail (thin, fades)
  // Pivoted to top so mesh.position tracks the streak head
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.045, 0.008, 1, 5);
    g.translate(0, -0.5, 0); // pivot at tip — tail hangs below in local Y
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    stars.forEach((star, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      // ── Idle: wait for next spawn time ──────────────────────────────────
      if (!star.active) {
        if (t >= star.nextSpawn) spawnStar(star, t);
        return;
      }

      // ── Active: animate ──────────────────────────────────────────────────
      const elapsed  = t - star.spawnAt;
      if (elapsed >= star.duration) {
        star.active   = false;
        star.nextSpawn = t + 3.5 + Math.random() * 6.5;
        mesh.visible  = false;
        return;
      }

      const progress = elapsed / star.duration;
      const travel   = elapsed * SPEED;

      // Head position (leading edge of streak)
      _pos.set(
        star.ox + star.dx * travel,
        star.oy + star.dy * travel,
        star.oz + star.dz * travel,
      );
      mesh.position.copy(_pos);

      // Orient the Y-axis of the cylinder along travel direction
      _dir.set(star.dx, star.dy, star.dz);
      _quat.setFromUnitVectors(_yAxis, _dir);
      mesh.quaternion.copy(_quat);

      // Scale Y to stretch the cylinder to streakLen
      mesh.scale.set(1, star.streakLen, 1);

      // Opacity: fast fade-in, hold, then fade-out
      const fadeIn  = Math.min(1, progress / 0.12);
      const fadeOut = 1 - Math.pow(Math.max(0, (progress - 0.45) / 0.55), 1.6);
      mesh.material.opacity = Math.min(fadeIn, fadeOut) * 0.92;
      mesh.visible = true;
    });
  });

  return (
    <>
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={el => (meshRefs.current[i] = el)}
          visible={false}
          geometry={geo}
          renderOrder={2}
        >
          <meshBasicMaterial
            color="#d8eeff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
};

export default ShootingStars;
