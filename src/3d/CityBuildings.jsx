// CityBuildings.jsx — deterministic 3D building clusters for Biome mode tiles.
//
// Coordinate system (critical): StickerPlane mounts CityBuildings inside a group
// where local Z is the outward face normal. All buildings must extend in +Z.
//
// Geometry orientation — baked fixes applied once per geo type:
//   CylinderGeometry  → geo.rotateX(PI/2)   axis becomes +Z (outward)
//   ConeGeometry      → geo.rotateX(PI/2)   tip points in  +Z (outward)
//   ConeGeometry(vent)→ geo.rotateX(-PI/2)  opening faces  +Z (outward)
//   SphereGeometry    → geo.rotateX(PI/2)   dome bulges    +Z (outward)
//   BoxGeometry       — correct by default   depth = Z
//   TorusGeometry     — correct by default   face normal = +Z
//   RingGeometry      — correct by default   face normal = +Z
//   PlaneGeometry     — correct by default   in XY plane
//
// Performance:
//   • Module-level material singletons — never re-created or disposed.
//   • Module-level unit geometries (IG) for InstancedMesh clusters.
//   • InstancedMesh for repeated same-geometry: crystal shards, pipe clusters,
//     smokestacks, vent caps, antennas, spiral tower segments.
//   • Per-tile unique geometries are disposed on unmount (not IG or M singletons).

import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mulberry32, getBuildingCount } from '../modes/CityBiomeMode.js';

// ── random helper ─────────────────────────────────────────────────────────────
function rr(rng, min, max) {
  return min + rng() * (max - min);
}

// ── Module-level shared materials — singleton per city ────────────────────────
// Created once at module load. Never disposed — they live for the app lifetime.
const M = {
  frozen: {
    crystal: new THREE.MeshPhysicalMaterial({
      color: '#E8F4FF',
      metalness: 0.12,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color('#B8E4FF'),
      emissiveIntensity: 0.14,
      flatShading: true,
    }),
    glow: new THREE.MeshPhysicalMaterial({
      color: '#C8E8FF',
      metalness: 0.06,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.72,
      emissive: new THREE.Color('#B8E4FF'),
      emissiveIntensity: 0.30,
    }),
  },
  deep: {
    hull: new THREE.MeshStandardMaterial({
      color: '#002244',
      metalness: 0.82,
      roughness: 0.22,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: '#003355',
      metalness: 0.78,
      roughness: 0.22,
      emissive: new THREE.Color('#00CED1'),
      emissiveIntensity: 0.32,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#004466',
      metalness: 0.25,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.60,
      emissive: new THREE.Color('#00CED1'),
      emissiveIntensity: 0.10,
    }),
  },
  volcanic: {
    iron: new THREE.MeshStandardMaterial({
      color: '#1C1C1C',
      metalness: 0.88,
      roughness: 0.52,
    }),
    lava: new THREE.MeshStandardMaterial({
      color: '#3A0800',
      metalness: 0.40,
      roughness: 0.60,
      emissive: new THREE.Color('#FF4500'),
      emissiveIntensity: 0.55,
    }),
    hotGrate: new THREE.MeshStandardMaterial({
      color: '#2A0A00',
      metalness: 0.60,
      roughness: 0.50,
      emissive: new THREE.Color('#FF6600'),
      emissiveIntensity: 0.24,
    }),
  },
  solar: {
    bronze: new THREE.MeshStandardMaterial({
      color: '#CD7F32',
      metalness: 0.96,
      roughness: 0.12,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: '#B8860B',
      metalness: 0.96,
      roughness: 0.10,
      emissive: new THREE.Color('#FFD700'),
      emissiveIntensity: 0.38,
    }),
    panel: new THREE.MeshStandardMaterial({
      color: '#0A0A1A',
      metalness: 0.25,
      roughness: 0.38,
      emissive: new THREE.Color('#FFD700'),
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide,
    }),
    wire: new THREE.MeshBasicMaterial({ color: '#FFD700', wireframe: true }),
  },
  bio: {
    foliage: new THREE.MeshStandardMaterial({
      color: '#1A4D1A',
      metalness: 0.0,
      roughness: 0.92,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: '#003300',
      metalness: 0.0,
      roughness: 0.82,
      emissive: new THREE.Color('#39FF14'),
      emissiveIntensity: 0.30,
    }),
    bark: new THREE.MeshStandardMaterial({
      color: '#3D2010',
      metalness: 0.0,
      roughness: 0.98,
    }),
  },
  neural: {
    dark: new THREE.MeshStandardMaterial({
      color: '#0A0A1E',
      metalness: 0.68,
      roughness: 0.32,
    }),
    violet: new THREE.MeshStandardMaterial({
      color: '#0A0A1E',
      metalness: 0.62,
      roughness: 0.32,
      emissive: new THREE.Color('#8B00FF'),
      emissiveIntensity: 0.52,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: '#180800',
      metalness: 0.52,
      roughness: 0.38,
      emissive: new THREE.Color('#FF6B00'),
      emissiveIntensity: 0.30,
    }),
  },
};

// ── Module-level unit geometries for InstancedMesh ────────────────────────────
// Rotation is baked in so each geometry's primary axis is +Z (outward normal).
// These are shared across all tiles and never disposed.
const IG = {
  // Unit cylinder (r=1, h=1) with axis along +Z
  cyl: (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 8);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  // Unit cone (base r=1, h=1) with tip pointing in +Z
  cone: (() => {
    const g = new THREE.ConeGeometry(1, 1, 6);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  // Inverted vent cone — opening faces +Z, tip toward -Z
  ventCone: (() => {
    const g = new THREE.ConeGeometry(1, 1, 8);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
};

// ── Matrix4 builder helper ─────────────────────────────────────────────────────
// Scratch objects reused every call — safe in single-threaded JS.
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}

// ── InstancedCluster ──────────────────────────────────────────────────────────
// Renders a set of instances of a single (geo, mat) pair as one draw call.
function InstancedCluster({ geo, mat, matrices }) {
  const ref = useRef();
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || !matrices.length) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  if (!matrices.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} castShadow={false} receiveShadow={false} />;
}

// ── city builder functions ─────────────────────────────────────────────────────
// Each returns { meshes, instances, geos }:
//   meshes    — [{ geo, mat, pos:[x,y,z], rot:[rx,ry,rz] }]
//   instances — [{ geo, mat, matrices:[Matrix4...] }]
//   geos      — per-tile BufferGeometry[] to dispose on unmount
// Materials are NOT returned — they are module-level M singletons.

// ─── 1. Frozen Citadel ────────────────────────────────────────────────────────
// White & icy blue — ice-crystal tower with stepped cap, glow pinnacle, crystal shards.
function buildFrozenCitadel(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Primary tower — slim crystal box extending in +Z
  const tW = rr(rng, 0.14, 0.24) * sc;
  const tH = rr(rng, 0.36, 0.58) * sc;
  const towerGeo = new THREE.BoxGeometry(tW, tW, tH);
  geos.push(towerGeo);
  const towerX = rr(rng, -0.10, 0.10) * sc;
  const towerY = rr(rng, -0.10, 0.10) * sc;
  meshes.push({ geo: towerGeo, mat: M.frozen.crystal, pos: [towerX, towerY, tH / 2], rot: [0, 0, rr(rng, -0.06, 0.06)] });

  // Stepped cap on top — smaller crystal block
  const capW = tW * 0.52;
  const capH = tH * 0.18;
  const capGeo = new THREE.BoxGeometry(capW, capW, capH);
  geos.push(capGeo);
  meshes.push({ geo: capGeo, mat: M.frozen.crystal, pos: [towerX, towerY, tH + capH / 2], rot: [0, 0, 0] });

  // Glow pinnacle — small bright sphere at apex
  const pinGeo = new THREE.SphereGeometry(tW * 0.22, 8, 8);
  geos.push(pinGeo);
  meshes.push({ geo: pinGeo, mat: M.frozen.glow, pos: [towerX, towerY, tH + capH + tW * 0.22], rot: [0, 0, 0] });

  // Crystal shards — hexagonal cones as InstancedMesh (tip in +Z via IG.cone)
  const shardCount = 3 + Math.floor(rng() * 5);
  const shardMatrices = [];
  for (let i = 0; i < shardCount; i++) {
    const sH = rr(rng, 0.16, 0.36) * sc;
    const sR = rr(rng, 0.034, 0.058) * sc;
    const sx = rr(rng, -0.30, 0.30) * sc;
    const sy = rr(rng, -0.30, 0.30) * sc;
    const leanX = rr(rng, -0.18, 0.18);
    const leanY = rr(rng, -0.18, 0.18);
    // Base at Z=0, tip at Z=sH — center the mesh at sH/2
    shardMatrices.push(mat4(sx, sy, sH / 2, leanX, leanY, rng() * Math.PI, sR, sR, sH));
  }
  instances.push({ geo: IG.cone, mat: M.frozen.crystal, matrices: shardMatrices });

  // Base slab (optional) — wide flat platform
  if (rng() > 0.28) {
    const slabW = rr(rng, 0.28, 0.46) * sc;
    const slabD = slabW * rr(rng, 0.55, 0.85);
    const slabH = rr(rng, 0.03, 0.07) * sc;
    const slabGeo = new THREE.BoxGeometry(slabW, slabD, slabH);
    geos.push(slabGeo);
    meshes.push({
      geo: slabGeo,
      mat: M.frozen.crystal,
      pos: [rr(rng, -0.14, 0.14) * sc, rr(rng, -0.14, 0.14) * sc, slabH / 2],
      rot: [0, 0, 0],
    });
  }

  return { meshes, instances, geos };
}

// ─── 2. Deep Station ──────────────────────────────────────────────────────────
// Dark navy with teal glow — glass pressure dome, halo rings, pipe cluster.
function buildDeepStation(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Pressure dome — hemisphere with clearcoat glass, dome extends in +Z
  // SphereGeometry thetaStart=0, thetaLength=PI/2 gives top hemisphere (+Y pole to equator).
  // After rotateX(PI/2): flat base at Z=0, dome bulges toward +Z. ✓
  const domeR = rr(rng, 0.14, 0.20) * sc;
  const domeGeo = new THREE.SphereGeometry(domeR, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.rotateX(Math.PI / 2);
  geos.push(domeGeo);
  const domeX = rr(rng, -0.20, 0.20) * sc;
  const domeY = rr(rng, -0.20, 0.20) * sc;
  meshes.push({ geo: domeGeo, mat: M.deep.glass, pos: [domeX, domeY, 0], rot: [0, 0, 0] });

  // Airlock collar — torus ring around dome base (TorusGeometry default: flat in XY, normal=+Z ✓)
  const collarGeo = new THREE.TorusGeometry(domeR * 1.06, 0.018 * sc, 8, 20);
  geos.push(collarGeo);
  meshes.push({ geo: collarGeo, mat: M.deep.glow, pos: [domeX, domeY, 0.008 * sc], rot: [0, 0, 0] });

  // Hab-rings — glowing teal halos floating at various heights (flat, normal=+Z ✓)
  const ringCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < ringCount; i++) {
    const ringR = rr(rng, 0.09, 0.14) * sc;
    const ringGeo = new THREE.TorusGeometry(ringR, 0.019 * sc, 8, 20);
    geos.push(ringGeo);
    meshes.push({
      geo: ringGeo,
      mat: M.deep.glow,
      pos: [rr(rng, -0.24, 0.24) * sc, rr(rng, -0.24, 0.24) * sc, rr(rng, 0.05, 0.22) * sc],
      rot: [0, 0, rng() * Math.PI],
    });
  }

  // Pipe cluster — InstancedMesh cylinders extending outward in +Z (via IG.cyl)
  const pipeCount = 3 + Math.floor(rng() * 3);
  const pBX = rr(rng, -0.28, 0.28) * sc;
  const pBY = rr(rng, -0.28, 0.28) * sc;
  const pipeMatrices = [];
  for (let i = 0; i < pipeCount; i++) {
    const pH = rr(rng, 0.18, 0.46) * sc;
    const pR = 0.018 * sc;
    const px = pBX + rr(rng, -0.08, 0.08) * sc;
    const py = pBY + rr(rng, -0.08, 0.08) * sc;
    const leanX = rr(rng, -0.10, 0.10);
    const leanY = rr(rng, -0.10, 0.10);
    // IG.cyl: unit cylinder along +Z. Scale [pR, pR, pH] → radius pR, height pH.
    // Center at pH/2 so the base sits on the surface.
    pipeMatrices.push(mat4(px, py, pH / 2, leanX, leanY, 0, pR, pR, pH));
  }
  instances.push({ geo: IG.cyl, mat: M.deep.hull, matrices: pipeMatrices });

  return { meshes, instances, geos };
}

// ─── 3. Volcanic Foundry ──────────────────────────────────────────────────────
// Dark iron + lava-orange — brutalist block, glowing lava pool, smokestack bank with vent caps.
function buildVolcanicFoundry(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Brutalist block — wide, low, heavy (box extends in Z ✓)
  const bW = rr(rng, 0.28, 0.44) * sc;
  const bD = rr(rng, 0.20, 0.34) * sc;
  const bH = rr(rng, 0.12, 0.26) * sc;
  const blockGeo = new THREE.BoxGeometry(bW, bD, bH);
  geos.push(blockGeo);
  meshes.push({
    geo: blockGeo,
    mat: M.volcanic.iron,
    pos: [rr(rng, -0.24, 0.0) * sc, rr(rng, -0.10, 0.10) * sc, bH / 2],
    rot: [0, 0, 0],
  });

  // Lava pool disc — flat glowing disc at surface level
  // CylinderGeometry (very thin) rotated so flat face is in XY plane at Z≈0
  const poolR = rr(rng, 0.10, 0.18) * sc;
  const poolGeo = new THREE.CylinderGeometry(poolR, poolR, 0.008 * sc, 16);
  poolGeo.rotateX(Math.PI / 2); // disc face now in XY, disc at Z=0 ✓
  geos.push(poolGeo);
  meshes.push({
    geo: poolGeo,
    mat: M.volcanic.lava,
    pos: [rr(rng, 0.0, 0.20) * sc, rr(rng, -0.20, 0.20) * sc, 0.004 * sc],
    rot: [0, 0, 0],
  });

  // Smokestacks — InstancedMesh cylinders + inverted vent caps on each
  const stackCount = 3 + Math.floor(rng() * 3);
  const sBX = rr(rng, 0.0, 0.24) * sc;
  const sBY = rr(rng, -0.20, 0.20) * sc;
  const stackMatrices = [];
  const ventMatrices = [];
  const capH = 0.06 * sc;
  for (let i = 0; i < stackCount; i++) {
    const sH = rr(rng, 0.30, 0.58) * sc;
    const sR = rr(rng, 0.034, 0.054) * sc;
    const sx = sBX + rr(rng, -0.12, 0.12) * sc;
    const sy = sBY + rr(rng, -0.12, 0.12) * sc;
    // Stack cylinder: base on surface, top at sH
    stackMatrices.push(mat4(sx, sy, sH / 2, 0, 0, 0, sR, sR, sH));
    // Vent cap (IG.ventCone): opening faces +Z, tip toward -Z.
    // Center is at sH + capH/2 so tip is at sH and opening at sH+capH.
    ventMatrices.push(mat4(sx, sy, sH + capH / 2, 0, 0, 0, sR * 1.30, sR * 1.30, capH));
  }
  instances.push({ geo: IG.cyl, mat: M.volcanic.iron, matrices: stackMatrices });
  instances.push({ geo: IG.ventCone, mat: M.volcanic.lava, matrices: ventMatrices });

  // Structural pylons — thin rods extending outward
  const pylonCount = 1 + Math.floor(rng() * 2);
  const pylonMatrices = [];
  for (let i = 0; i < pylonCount; i++) {
    const pyH = rr(rng, 0.25, 0.42) * sc;
    const px = rr(rng, -0.35, 0.35) * sc;
    const py = rr(rng, -0.35, 0.35) * sc;
    pylonMatrices.push(mat4(px, py, pyH / 2, 0, 0, 0, 0.014 * sc, 0.014 * sc, pyH));
  }
  instances.push({ geo: IG.cyl, mat: M.volcanic.iron, matrices: pylonMatrices });

  return { meshes, instances, geos };
}

// ─── 4. Solar Arcology ────────────────────────────────────────────────────────
// Bronze & gold — lattice towers with wireframe cage, parabolic dish, light spires, solar panel.
function buildSolarArcology(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Lattice tower(s) — slim bronze core + gold wireframe cage, 1-2 towers
  const tCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < tCount; i++) {
    const tH = rr(rng, 0.40, 0.60) * sc;
    const tx = rr(rng, -0.28, 0.28) * sc;
    const ty = rr(rng, -0.28, 0.28) * sc;
    const tGeo = new THREE.BoxGeometry(0.022 * sc, 0.022 * sc, tH);
    geos.push(tGeo);
    meshes.push({ geo: tGeo, mat: M.solar.bronze, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });
    const wGeo = new THREE.BoxGeometry(0.068 * sc, 0.068 * sc, tH * 0.88);
    geos.push(wGeo);
    meshes.push({ geo: wGeo, mat: M.solar.wire, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });
  }

  // Parabolic dish on a stem — hemisphere facing viewer (+Z)
  // After rotateX(PI/2): flat base at Z=0 relative to mesh origin, dome at +Z.
  const dishR = rr(rng, 0.12, 0.18) * sc;
  const dishGeo = new THREE.SphereGeometry(dishR, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  dishGeo.rotateX(Math.PI / 2);
  geos.push(dishGeo);
  const stemH = rr(rng, 0.06, 0.12) * sc;
  const stemGeo = new THREE.CylinderGeometry(0.012 * sc, 0.012 * sc, stemH, 6);
  stemGeo.rotateX(Math.PI / 2); // axis → +Z
  geos.push(stemGeo);
  const dX = rr(rng, -0.26, 0.26) * sc;
  const dY = rr(rng, -0.26, 0.26) * sc;
  meshes.push({ geo: stemGeo, mat: M.solar.bronze, pos: [dX, dY, stemH / 2], rot: [0, 0, 0] });
  // Dish sits on top of the stem — its flat base at Z=stemH, dome at Z=stemH+dishR
  meshes.push({ geo: dishGeo, mat: M.solar.gold, pos: [dX, dY, stemH], rot: [0, 0, 0] });

  // Light spires — slim gold cones pointing outward, InstancedMesh (tip in +Z via IG.cone)
  const spireCount = 2 + Math.floor(rng() * 3);
  const spireMatrices = [];
  for (let i = 0; i < spireCount; i++) {
    const spH = rr(rng, 0.28, 0.52) * sc;
    const spR = 0.012 * sc;
    const spX = rr(rng, -0.34, 0.34) * sc;
    const spY = rr(rng, -0.34, 0.34) * sc;
    spireMatrices.push(mat4(spX, spY, spH / 2, 0, 0, 0, spR, spR, spH));
  }
  instances.push({ geo: IG.cone, mat: M.solar.gold, matrices: spireMatrices });

  // Solar panel — tilted PlaneGeometry (already in XY, no rotation override)
  const panGeo = new THREE.PlaneGeometry(0.20 * sc, 0.12 * sc);
  geos.push(panGeo);
  meshes.push({
    geo: panGeo,
    mat: M.solar.panel,
    pos: [rr(rng, -0.26, 0.26) * sc, rr(rng, -0.26, 0.26) * sc, 0.04 * sc],
    rot: [Math.PI / 6, 0, rng() * Math.PI],
  });

  return { meshes, instances, geos };
}

// ─── 5. Bio-Dome ──────────────────────────────────────────────────────────────
// Deep green + neon glow — spiral tower, canopy arch, root buttresses, dome cap.
function buildBioDome(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Spiral tower — stacked cylinder segments as InstancedMesh.
  // Each segment shrinks in radius going up; a rotZ twist is applied per segment.
  const segCount = 8 + Math.floor(rng() * 4);
  const segH = rr(rng, 0.05, 0.08) * sc;
  const towerX = rr(rng, -0.18, 0.18) * sc;
  const towerY = rr(rng, -0.18, 0.18) * sc;
  const spiralMatrices = [];
  for (let i = 0; i < segCount; i++) {
    const shrink = Math.max(1 - i * 0.045, 0.08);
    const botR = 0.05 * sc * shrink;
    const rotZ = (i * 18 * Math.PI) / 180;
    spiralMatrices.push(mat4(towerX, towerY, i * segH + segH / 2, 0, 0, rotZ, botR, botR, segH));
  }
  instances.push({ geo: IG.cyl, mat: M.bio.foliage, matrices: spiralMatrices });
  const towerTopZ = segCount * segH;

  // Canopy arch — half-torus arc crowning the spiral top (TorusGeometry: normal=+Z ✓)
  const archR = rr(rng, 0.11, 0.17) * sc;
  const archGeo = new THREE.TorusGeometry(archR, 0.018 * sc, 6, 14, Math.PI);
  geos.push(archGeo);
  meshes.push({
    geo: archGeo,
    mat: M.bio.glow,
    pos: [rr(rng, -0.10, 0.10) * sc, rr(rng, -0.10, 0.10) * sc, towerTopZ + archR * 0.65],
    rot: [0, 0, rng() * Math.PI * 2],
  });

  // Root buttresses — angled slim boxes spreading from tower base
  const bCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bCount; i++) {
    const bLen = rr(rng, 0.10, 0.15) * sc;
    const bGeo = new THREE.BoxGeometry(0.014 * sc, bLen, 0.012 * sc);
    geos.push(bGeo);
    const tiltAngle = rr(rng, 0.45, 0.72);
    meshes.push({
      geo: bGeo,
      mat: M.bio.bark,
      pos: [towerX + rr(rng, -0.13, 0.13) * sc, towerY + rr(rng, -0.13, 0.13) * sc, bLen * 0.28],
      rot: [tiltAngle, 0, rng() * Math.PI * 2],
    });
  }

  // Dome cap — glowing hemisphere at ground level, dome toward +Z
  const capR = rr(rng, 0.07, 0.10) * sc;
  const capGeo = new THREE.SphereGeometry(capR, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.rotateX(Math.PI / 2); // dome → +Z
  geos.push(capGeo);
  meshes.push({
    geo: capGeo,
    mat: M.bio.glow,
    pos: [rr(rng, -0.26, 0.26) * sc, rr(rng, -0.26, 0.26) * sc, 0],
    rot: [0, 0, 0],
  });

  return { meshes, instances, geos };
}

// ─── 6. Neural Hub ────────────────────────────────────────────────────────────
// Dark indigo + violet/orange — twin signal towers with apex rings, hub nodes,
// antenna cluster, and a violet data bridge always connecting the two towers.
function buildNeuralHub(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // Signal towers — pair of tapered cylinders extending in +Z
  const towerPositions = [];
  for (let i = 0; i < 2; i++) {
    const tH = rr(rng, 0.38, 0.58) * sc;
    const tGeo = new THREE.CylinderGeometry(0.014 * sc, 0.018 * sc, tH, 6);
    tGeo.rotateX(Math.PI / 2); // axis → +Z
    geos.push(tGeo);
    const tx = rr(rng, -0.30, 0.30) * sc;
    const ty = rr(rng, -0.30, 0.30) * sc;
    towerPositions.push([tx, ty, tH]);
    meshes.push({ geo: tGeo, mat: M.neural.dark, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });

    // Floating violet ring at tower apex (RingGeometry: normal=+Z ✓)
    const ringGeo = new THREE.RingGeometry(0.036 * sc, 0.052 * sc, 16);
    geos.push(ringGeo);
    meshes.push({ geo: ringGeo, mat: M.neural.violet, pos: [tx, ty, tH + 0.016 * sc], rot: [0, 0, 0] });
  }

  // Hub nodes — pulsing violet spheres scattered around
  const nodeCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nodeCount; i++) {
    const nR = rr(rng, 0.028, 0.048) * sc;
    const nGeo = new THREE.SphereGeometry(nR, 8, 8);
    geos.push(nGeo);
    meshes.push({
      geo: nGeo,
      mat: M.neural.violet,
      pos: [rr(rng, -0.34, 0.34) * sc, rr(rng, -0.34, 0.34) * sc, rr(rng, 0.04, 0.16) * sc],
      rot: [0, 0, 0],
    });
  }

  // Antenna cluster — InstancedMesh thin orange-glow rods (IG.cyl)
  const antCount = 6 + Math.floor(rng() * 5);
  const aBX = rr(rng, -0.26, 0.26) * sc;
  const aBY = rr(rng, -0.26, 0.26) * sc;
  const antMatrices = [];
  for (let i = 0; i < antCount; i++) {
    const aH = rr(rng, 0.20, 0.38) * sc;
    const aR = 0.005 * sc;
    const ax = aBX + rr(rng, -0.07, 0.07) * sc;
    const ay = aBY + rr(rng, -0.07, 0.07) * sc;
    const leanX = rr(rng, -0.28, 0.28);
    const leanY = rr(rng, -0.28, 0.28);
    antMatrices.push(mat4(ax, ay, aH / 2, leanX, leanY, 0, aR, aR, aH));
  }
  instances.push({ geo: IG.cyl, mat: M.neural.amber, matrices: antMatrices });

  // Data bridge — violet beam connecting the two towers (always rendered)
  if (towerPositions.length >= 2) {
    const [ax, ay, atH] = towerPositions[0];
    const [bx, by, btH] = towerPositions[1];
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.01) {
      const midH = (atH + btH) * 0.45;
      const bridgeGeo = new THREE.BoxGeometry(dist, 0.008 * sc, 0.008 * sc);
      geos.push(bridgeGeo);
      meshes.push({
        geo: bridgeGeo,
        mat: M.neural.violet,
        pos: [(ax + bx) / 2, (ay + by) / 2, midH],
        rot: [0, 0, Math.atan2(dy, dx)],
      });
    }
  }

  return { meshes, instances, geos };
}

// ── city dispatch table ───────────────────────────────────────────────────────
const CITY_BUILDERS = {
  frozenCitadel: buildFrozenCitadel,
  deepStation: buildDeepStation,
  volcanicFoundry: buildVolcanicFoundry,
  solarArcology: buildSolarArcology,
  bioDome: buildBioDome,
  neuralHub: buildNeuralHub,
};

// ── component ─────────────────────────────────────────────────────────────────
export function CityBuildings({ cityKey, tileIndex, faceId, gridDim, scale = 1 }) {
  const seed = faceId * 10000 + tileIndex;
  const count = getBuildingCount(gridDim);

  const { meshes, instances, geos } = useMemo(() => {
    const builder = CITY_BUILDERS[cityKey];
    if (!builder) return { meshes: [], instances: [], geos: [] };
    const rng = mulberry32(seed);
    return builder(rng, count, scale);
  }, [cityKey, scale, seed, count]);

  // Dispose only per-tile geometries on unmount / dep change.
  // Module-level M materials and IG geometries are intentionally NOT disposed here.
  useEffect(() => {
    return () => { geos.forEach(g => g?.dispose()); };
  }, [geos]);

  if (!meshes.length && !instances.length) return null;

  return (
    <group position={[0, 0, 0.015]}>
      {meshes.map((b, i) => (
        <mesh key={`m${i}`} position={b.pos} rotation={b.rot} castShadow={false} receiveShadow={false}>
          <primitive object={b.geo} attach="geometry" />
          <primitive object={b.mat} attach="material" />
        </mesh>
      ))}
      {instances.map((inst, i) => (
        <InstancedCluster key={`c${i}`} geo={inst.geo} mat={inst.mat} matrices={inst.matrices} />
      ))}
    </group>
  );
}

export default CityBuildings;
