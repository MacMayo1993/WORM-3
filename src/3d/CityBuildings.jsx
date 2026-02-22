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

import React, { useMemo, useEffect, useLayoutEffect, useRef } from 'react';
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
    // Primary crystal — apple-product glass quality: ultra-low roughness, clearcoat,
    // faint emissive so it glows from within rather than just reflecting.
    // flatShading gives it the faceted crystal-face character.
    crystal: new THREE.MeshPhysicalMaterial({
      color: '#C8E8FF',
      metalness: 0.04,
      roughness: 0.03,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      emissive: new THREE.Color('#B8E4FF'),
      emissiveIntensity: 0.16,
      flatShading: true,
    }),
    // Glow tip — saturated ice-blue, high emissive, used only on pinnacle tips
    glow: new THREE.MeshPhysicalMaterial({
      color: '#70BFFF',
      metalness: 0.0,
      roughness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      emissive: new THREE.Color('#70BFFF'),
      emissiveIntensity: 0.50,
    }),
    // Frost plate — opaque snow-white for ground slabs and ice shelves
    frost: new THREE.MeshStandardMaterial({
      color: '#C8E8FF',
      metalness: 0.10,
      roughness: 0.55,
      emissive: new THREE.Color('#B8E4FF'),
      emissiveIntensity: 0.04,
    }),
    // Dark hull — near-black navy for plinths, hab-blocks, conduit lines, transit beams.
    // The heavy dark mass the crystal city grows out of — mass contrast vs the crystal above.
    darkHull: new THREE.MeshStandardMaterial({
      color: '#0A1428',
      metalness: 0.62,
      roughness: 0.52,
    }),
    // Amber heat — warm orange-gold emissive: window strips, antenna beacons, transit nodes.
    // The single warm accent in an all-cold palette — reads instantly as "inhabited".
    amber: new THREE.MeshStandardMaterial({
      color: '#180800',
      metalness: 0.35,
      roughness: 0.55,
      emissive: new THREE.Color('#FF9040'),
      emissiveIntensity: 0.60,
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
    // Muted warm bronze — structural scaffold, zero showboating
    bronze: new THREE.MeshStandardMaterial({
      color: '#7A5C14',
      metalness: 0.95,
      roughness: 0.18,
    }),
    // Polished gold — single accent, used sparingly on rings / focal points / spires
    gold: new THREE.MeshStandardMaterial({
      color: '#A07820',
      metalness: 0.92,
      roughness: 0.10,
      emissive: new THREE.Color('#FFD700'),
      emissiveIntensity: 0.50,
    }),
    // Solar panel — near-black absorption surface, faint amber glow from edge.
    // FrontSide only: DoubleSide caused the back face to render through the cube
    // during layer rotations, creating visible panel flashes on adjacent tiles.
    panel: new THREE.MeshStandardMaterial({
      color: '#06060F',
      metalness: 0.18,
      roughness: 0.50,
      emissive: new THREE.Color('#B8860B'),
      emissiveIntensity: 0.08,
    }),
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
    // Dark chassis — the structural body of every tower, node, and bridge
    dark: new THREE.MeshStandardMaterial({
      color: '#080818',
      metalness: 0.72,
      roughness: 0.28,
    }),
    // Violet signal — used only on emissive accent pieces (rings, nodes, bridge)
    violet: new THREE.MeshStandardMaterial({
      color: '#0C0020',
      metalness: 0.55,
      roughness: 0.30,
      emissive: new THREE.Color('#8B00FF'),
      emissiveIntensity: 0.65,
    }),
    // Amber pulse — antenna tips, sparse hot-orange counterpoint to violet
    amber: new THREE.MeshStandardMaterial({
      color: '#120400',
      metalness: 0.48,
      roughness: 0.42,
      emissive: new THREE.Color('#FF6B00'),
      emissiveIntensity: 0.45,
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
  // Hexagonal prism (r=1, h=1) — 6 flat faces, reads as crystal column with flatShading
  hex: (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 6);
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
  useLayoutEffect(() => {
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
// Design language: Arctic monolith — crystalline precision, negative space, single
// dominant obelisk. Apple/Google read: one hero element, supporting cast, nothing gratuitous.
//
// Anatomy:
//   Obelisk     — tapered hexagonal prism — the identity element
//   [3] Double cap — two prisms with a deliberate gap above the obelisk apex;
//                    each cap rotated 15° further for a stacked crystal-twist read
//   [1] Needle  — glow spire 2.5× taller than original, with layered inner core cone
//                 so the tip feels like trapped bioluminescence, not just geometry
//   [2] Shards  — Fibonacci height sequence (40/28/18/12% of tH) on an elliptical
//                 orbit; evenly spaced, aggressively leaning inward — a royal court,
//                 not a scatter
//   Ice shelf   — wide frost slab at ground, the anchor
//   Frost ring  — thin torus at obelisk base, "frozen ground crack" detail
function buildFrozenCitadel(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];
  const mats = []; // per-tile disposable material clones (opacity variants, reflection)

  // ── [7+10] Obelisk — 3-segment opacity gradient ────────────────────────────
  // Split into 3 stacked hex prisms with decreasing opacity base→apex:
  //   Segment 0 (bottom): 0.93 — dense, compressed, heavy ice
  //   Segment 1 (mid):    0.82 — transitional
  //   Segment 2 (top):    0.68 — near-evaporating, almost vapour
  // Each segment clones M.frozen.crystal and sets its own opacity so the singleton
  // is never mutated. Taper is preserved: r_top of segment i = r_bot of segment i+1.
  const tH = rr(rng, 0.38, 0.56) * sc;
  const tRb = rr(rng, 0.055, 0.080) * sc;
  const tRt = tRb * 0.38;
  const tx = rr(rng, -0.08, 0.08) * sc;
  const ty = rr(rng, -0.08, 0.08) * sc;
  const obeliskRot = rr(rng, 0, Math.PI / 6);
  const segCount = 3;
  const segH = tH / segCount;
  const opacities = [0.93, 0.82, 0.68];
  for (let i = 0; i < segCount; i++) {
    const rBot = tRb + (tRt - tRb) * (i / segCount);
    const rTop = tRb + (tRt - tRb) * ((i + 1) / segCount);
    const segGeo = new THREE.CylinderGeometry(rTop, rBot, segH, 6);
    segGeo.rotateX(Math.PI / 2);
    geos.push(segGeo);
    const segMat = M.frozen.crystal.clone();
    segMat.transparent = true; // opacity gradient requires transparent=true; singleton is opaque
    segMat.depthWrite = false;  // don't write depth — prevents semi-transparent segments from occluding other transparent geometry during rotation
    segMat.opacity = opacities[i];
    mats.push(segMat);
    meshes.push({ geo: segGeo, mat: segMat, pos: [tx, ty, i * segH + segH / 2], rot: [0, 0, obeliskRot] });
  }

  // ── Dark structural plinth — the heavy base the obelisk grows from ──────────
  // Low, wide, dark-hull hexagonal cylinder at ground level. The value contrast
  // (near-black plinth vs crystal spire directly above) reads as engineered
  // foundation — architecture, not geology. Slightly flared at base for solidity.
  const plinthH = tH * 0.06;
  const plinthGeo = new THREE.CylinderGeometry(tRb * 2.0, tRb * 2.35, plinthH, 6);
  plinthGeo.rotateX(Math.PI / 2);
  geos.push(plinthGeo);
  meshes.push({ geo: plinthGeo, mat: M.frozen.darkHull, pos: [tx, ty, plinthH / 2], rot: [0, 0, obeliskRot] });

  // ── [3] Double-step cap — two prisms with deliberate gap above obelisk ─────
  // A gap of empty space between obelisk apex and the first cap lets both elements
  // read cleanly — neither bleeding into the other (Zaha Hadid negative space).
  // Each cap is rotated 15° further than the previous for a stacked crystal-twist.
  const capGap = 0.015 * sc;

  // Cap 1 — wider base, 30° rotation
  const cap1H = tH * 0.10;
  const cap1Rb = tRt * 1.10;
  const cap1Rt = tRt * 0.65;
  const cap1Geo = new THREE.CylinderGeometry(cap1Rt, cap1Rb, cap1H, 6);
  cap1Geo.rotateX(Math.PI / 2);
  geos.push(cap1Geo);
  meshes.push({ geo: cap1Geo, mat: M.frozen.crystal, pos: [tx, ty, tH + capGap + cap1H / 2], rot: [0, 0, Math.PI / 6] });

  // Cap 2 — narrower, additional 15° twist; base flares slightly beyond cap1 top
  // creating a deliberate step ledge that reads as a precision-cut crystal facet
  const cap2H = tH * 0.07;
  const cap2Rb = cap1Rt * 1.05;
  const cap2Rt = cap1Rt * 0.45;
  const cap2Geo = new THREE.CylinderGeometry(cap2Rt, cap2Rb, cap2H, 6);
  cap2Geo.rotateX(Math.PI / 2);
  geos.push(cap2Geo);
  const cap2BaseZ = tH + capGap + cap1H;
  meshes.push({ geo: cap2Geo, mat: M.frozen.crystal, pos: [tx, ty, cap2BaseZ + cap2H / 2], rot: [0, 0, Math.PI / 6 + Math.PI / 12] });

  // ── [1] Glow pinnacle — NEEDLE 2.5× taller + layered inner core ───────────
  // Original: pinH = capH * 1.4 where capH = tH * 0.16 → tH * 0.224.
  // New:      pinH = tH * 0.56 (2.5× original).
  // The needle now exceeds the obelisk section visually, transforming the
  // silhouette from "tower" to "spire citadel" — unmistakable at 50px on screen.
  //
  // Two nested cones: outer crystal (semi-transparent, wider) + inner glow core
  // (40% narrower, high emissive). The outer layer tints the inner light — like
  // bioluminescence trapped in glacier ice.
  const pinBaseZ = cap2BaseZ + cap2H;
  const pinH = tH * 0.56;

  // Outer cone — crystal blue, full width
  const pinOuterGeo = new THREE.ConeGeometry(cap2Rt * 0.75, pinH, 6);
  pinOuterGeo.rotateX(Math.PI / 2);
  geos.push(pinOuterGeo);
  meshes.push({ geo: pinOuterGeo, mat: M.frozen.crystal, pos: [tx, ty, pinBaseZ + pinH / 2], rot: [0, 0, 0] });

  // Inner core — 40% narrower, same height, pure saturated glow shines through outer
  const pinCoreGeo = new THREE.ConeGeometry(cap2Rt * 0.40, pinH, 6);
  pinCoreGeo.rotateX(Math.PI / 2);
  geos.push(pinCoreGeo);
  meshes.push({ geo: pinCoreGeo, mat: M.frozen.glow, pos: [tx, ty, pinBaseZ + pinH / 2], rot: [0, 0, 0] });

  // ── [2] Satellite shards — Fibonacci heights + elliptical orbit ───────────
  // Heights follow descending Fibonacci-ish ratios (40/28/18/12% of tH) — reads
  // as a natural growth sequence, not random variation.
  // Positions on an elliptical orbit (not circular, not scattered) — evenly
  // spaced so the eye reads a deliberate royal court around the monolith.
  // Lean is normalized to orbit radius so every shard tilts ~16–24° inward
  // regardless of how near or far it sits.
  const fibHeights = [0.40, 0.28, 0.18, 0.12];
  const shardCount = 4 + Math.floor(rng() * 3);

  // Ellipse: slight asymmetry (B = 58–78% of A) keeps it feeling organic.
  // [10] Proportional lock: orbit max = tRb * 3.5 — shards never stray beyond
  // 3.5× the obelisk base radius, keeping the formation tight and legible.
  const orbitA = Math.min(rr(rng, 0.11, 0.17) * sc, tRb * 3.5);
  const orbitB = orbitA * rr(rng, 0.58, 0.78);
  const orbitRot = rng() * Math.PI;
  const cosOR = Math.cos(orbitRot);
  const sinOR = Math.sin(orbitRot);

  const shardMatrices = [];
  const amberTipMatrices = []; // beacon tips on the two tallest shards only
  for (let i = 0; i < shardCount; i++) {
    // Even angular spacing — formation, not scatter
    const angle = (i / shardCount) * Math.PI * 2;
    const ex = Math.cos(angle) * orbitA;
    const ey = Math.sin(angle) * orbitB;
    const sx = tx + ex * cosOR - ey * sinOR;
    const sy = ty + ex * sinOR + ey * cosOR;

    // Fibonacci height — cycle through sequence for shardCount > 4
    const sH = tH * fibHeights[i % fibHeights.length];
    const sR = rr(rng, 0.016, 0.030) * sc;

    // Aggressive lean toward obelisk — normalized direction × fixed magnitude
    // so shards on a tight orbit lean just as decisively as outer ones
    const dx = sx - tx;
    const dy = sy - ty;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const leanMag = rr(rng, 0.30, 0.48);
    const leanX = -(dx / dist) * leanMag;
    const leanY = -(dy / dist) * leanMag;

    shardMatrices.push(mat4(sx, sy, sH / 2, leanX, leanY, angle, sR, sR, sH));

    // Amber beacon tip on the two tallest shards (Fibonacci indices 0 and 1).
    // A tiny warm cone at the crystal tip — reads as a navigation beacon.
    // Breaks the monochrome with a single hot spot per formation.
    if (i < 2) {
      const tipR = sR * 1.6;
      const tipH = sH * 0.13;
      amberTipMatrices.push(mat4(sx, sy, sH - tipH / 2, leanX, leanY, angle, tipR, tipR, tipH));
    }
  }
  instances.push({ geo: IG.cone, mat: M.frozen.crystal, matrices: shardMatrices });
  if (amberTipMatrices.length) {
    instances.push({ geo: IG.cone, mat: M.frozen.amber, matrices: amberTipMatrices });
  }

  // ── [4] Ice shelf — ultra-thin hexagonal glass-frost ──────────────────────
  // CylinderGeometry with 6 sides reads as a cracked-off slab of natural ice
  // rather than an engineered rectangle. The extreme thinness (0.009 * sc) vs
  // extreme width (0.60 × tH radius) makes every vertical element feel taller
  // by contrast — the same proportion trick as a temple stylobate.
  // Glass-frost = M.frozen.crystal (clearcoat, opacity 0.86) instead of opaque
  // frost; the shelf is faintly see-through like a polished ice floor.
  const shelfR = tH * 0.60;
  const shelfThick = 0.009 * sc;
  const shelfGeo = new THREE.CylinderGeometry(shelfR, shelfR, shelfThick, 6);
  shelfGeo.rotateX(Math.PI / 2);
  geos.push(shelfGeo);
  meshes.push({
    geo: shelfGeo,
    mat: M.frozen.crystal,
    pos: [tx + rr(rng, -0.04, 0.04) * sc, ty + rr(rng, -0.04, 0.04) * sc, shelfThick / 2],
    rot: [0, 0, rr(rng, 0, Math.PI / 3)],
  });

  // ── [8] Ground reflection disc — obelisk ghost in the ice floor ───────────
  // Ultra-thin semi-transparent hex disc at Z≈0, centered on the obelisk.
  // Opacity 0.15 — barely there, but enough that the eye reads "polished ice
  // floor reflection" without competing with the structure above it.
  // Uses a cloned crystal material at reduced opacity + reduced emissive.
  const reflectGeo = new THREE.CylinderGeometry(tRb * 2.8, tRb * 2.8, 0.001 * sc, 6);
  reflectGeo.rotateX(Math.PI / 2);
  geos.push(reflectGeo);
  const reflectMat = M.frozen.crystal.clone();
  reflectMat.transparent = true; // at opacity 0.15 this must be transparent or it z-fights the sticker
  reflectMat.depthWrite = false;  // ghost disc — never occlude other geometry
  reflectMat.opacity = 0.15;
  reflectMat.emissiveIntensity = 0.06;
  mats.push(reflectMat);
  meshes.push({ geo: reflectGeo, mat: reflectMat, pos: [tx, ty, 0.0005 * sc], rot: [0, 0, 0] });

  // ── Hab-blocks — low dark buildings with amber window strips ─────────────
  // 2-3 squat near-black structures placed in separate tile quadrants. Each has one
  // amber emissive band at mid-height simulating lit windows. This is the single
  // highest-impact contrast addition: cold blue spires above warm amber windows =
  // instantly "city at night". Dark mass below makes the crystal seem to rise FROM
  // something rather than floating in a void.
  const habCount = 2 + Math.floor(rng() * 2);
  const habData = [];
  for (let i = 0; i < habCount; i++) {
    const qAngle = (i / habCount) * Math.PI * 2 + Math.PI / 4;
    const qR = rr(rng, 0.14, 0.24) * sc;
    const hx = qR * Math.cos(qAngle);
    const hy = qR * Math.sin(qAngle);
    const hw = rr(rng, 0.07, 0.12) * sc;
    const hd = hw * rr(rng, 0.65, 0.90);
    const hh = rr(rng, 0.05, 0.09) * sc;
    const hRz = rng() * Math.PI / 3;

    // Dark body
    const bodyGeo = new THREE.BoxGeometry(hw, hd, hh);
    geos.push(bodyGeo);
    meshes.push({ geo: bodyGeo, mat: M.frozen.darkHull, pos: [hx, hy, hh / 2], rot: [0, 0, hRz] });

    // Amber window strip — thin emissive band at 55% height, slightly proud of walls
    const winGeo = new THREE.BoxGeometry(hw + 0.005 * sc, hd + 0.005 * sc, 0.012 * sc);
    geos.push(winGeo);
    meshes.push({ geo: winGeo, mat: M.frozen.amber, pos: [hx, hy, hh * 0.55], rot: [0, 0, hRz] });

    habData.push({ x: hx, y: hy, h: hh });
  }

  // ── Elevated transit line — dark beam + amber node stops ─────────────────
  // Connects first two hab-blocks with a thin elevated beam. Support pillars at
  // 20% and 80% of the span. Amber sphere nodes along the route read as
  // stations or relay points — immediate infrastructure signal.
  if (habData.length >= 2) {
    const h0 = habData[0];
    const h1 = habData[1];
    const tdx = h1.x - h0.x;
    const tdy = h1.y - h0.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    const tAngle = Math.atan2(tdy, tdx);
    const tZ = Math.max(h0.h, h1.h) + rr(rng, 0.04, 0.08) * sc;

    // Main beam — BoxGeometry along X rotated to span angle
    const beamGeo = new THREE.BoxGeometry(tdist, 0.006 * sc, 0.006 * sc);
    geos.push(beamGeo);
    meshes.push({ geo: beamGeo, mat: M.frozen.darkHull, pos: [(h0.x + h1.x) / 2, (h0.y + h1.y) / 2, tZ], rot: [0, 0, tAngle] });

    // Support pillars
    [0.22, 0.78].forEach(t => {
      const px = h0.x + tdx * t;
      const py = h0.y + tdy * t;
      const pGeo = new THREE.CylinderGeometry(0.005 * sc, 0.005 * sc, tZ, 4);
      pGeo.rotateX(Math.PI / 2);
      geos.push(pGeo);
      meshes.push({ geo: pGeo, mat: M.frozen.darkHull, pos: [px, py, tZ / 2], rot: [0, 0, 0] });
    });

    // Amber node stops
    const nodeCount = 1 + Math.floor(rng() * 2);
    for (let i = 1; i <= nodeCount; i++) {
      const t = i / (nodeCount + 1);
      const nGeo = new THREE.SphereGeometry(0.011 * sc, 6, 6);
      geos.push(nGeo);
      meshes.push({ geo: nGeo, mat: M.frozen.amber, pos: [h0.x + tdx * t, h0.y + tdy * t, tZ + 0.006 * sc], rot: [0, 0, 0] });
    }
  }

  // ── Ground conduit grid — dark power lines on the ice surface ────────────
  // 2-3 ultra-thin dark boxes radiating outward from the obelisk base, like
  // buried utility conduits marked on the surface. No height — pure dark lines
  // on the ice floor. Creates density at ground level without adding mass.
  const conduitCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < conduitCount; i++) {
    const cAngle = (i / conduitCount) * Math.PI * 2 + rng() * 0.5;
    const cLen = rr(rng, 0.12, 0.22) * sc;
    const cOff = tRb * 2.6 + cLen / 2;
    const cmx = tx + Math.cos(cAngle) * cOff;
    const cmy = ty + Math.sin(cAngle) * cOff;
    const cGeo = new THREE.BoxGeometry(cLen, 0.009 * sc, 0.003 * sc);
    geos.push(cGeo);
    meshes.push({ geo: cGeo, mat: M.frozen.darkHull, pos: [cmx, cmy, 0.002 * sc], rot: [0, 0, cAngle] });
  }

  // ── [5+10] Concentric frost ring trio — ripples frozen mid-propagation ────
  // Radii are dual-clamped: primary sizing from tRb (tower-relative), hard cap
  // from shelfR (outer ring never exceeds 58% of shelf radius — stays within
  // the stage, never bleeds to the edge). Proportional lock #10.
  const tubeR = 0.006 * sc;
  const r1 = Math.min(tRb * 1.3, shelfR * 0.30);
  const r2 = Math.min(tRb * 2.0, shelfR * 0.44);
  const r3 = Math.min(tRb * 3.2, shelfR * 0.58);
  const ringDefs = [
    { r: r1, mat: M.frozen.glow, z: 0.003 * sc, rz: 0 },
    { r: r2, mat: M.frozen.crystal, z: 0.002 * sc, rz: Math.PI / 6 },
    { r: r3, mat: M.frozen.frost, z: 0.001 * sc, rz: Math.PI / 3 },
  ];
  ringDefs.forEach(({ r, mat, z, rz }) => {
    const rGeo = new THREE.TorusGeometry(r, tubeR, 6, 20);
    geos.push(rGeo);
    meshes.push({ geo: rGeo, mat, pos: [tx, ty, z], rot: [0, 0, rz] });
  });

  return { meshes, instances, geos, mats };
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
    // Rotate PI/2 around X so the torus stands upright as a vertical orbital ring
    // rather than lying flat like a horizontal disc
    meshes.push({
      geo: ringGeo,
      mat: M.deep.glow,
      pos: [rr(rng, -0.24, 0.24) * sc, rr(rng, -0.24, 0.24) * sc, rr(rng, 0.08, 0.28) * sc],
      rot: [Math.PI / 2, 0, rng() * Math.PI],
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
// Design language: Swiss Modernism precision engineering × desert brutalism.
// One dominant lattice tower (structural cage, not wireframe), one parabolic dish,
// 2-3 needle spires as accent, one angled solar panel as ground plane.
// Gold emissive is the single accent — used only on rings, focal point, spires.
// All structure is muted bronze — zero decoration, every element earns its place.
function buildSolarArcology(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // ── Lattice Tower ──────────────────────────────────────────────────────────
  // Anatomy: tapered central shaft + 4 corner columns (square cage profile) +
  // 2 flat structural rings at 1/3 and 2/3 height + polished gold apex cap.
  // This reads immediately as a transmission/solar tower — no wireframe ambiguity.
  const tH = rr(rng, 0.42, 0.56) * sc;
  const tx = rr(rng, -0.10, 0.10) * sc;
  const ty = rr(rng, -0.10, 0.10) * sc;

  // Central shaft — tapered, 6-sided, bronze
  const shaftGeo = new THREE.CylinderGeometry(0.012 * sc, 0.018 * sc, tH, 6);
  shaftGeo.rotateX(Math.PI / 2);
  geos.push(shaftGeo);
  meshes.push({ geo: shaftGeo, mat: M.solar.bronze, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });

  // 4 corner columns — square cage, InstancedMesh (one draw call)
  const cageOff = 0.046 * sc;
  const colR = 0.008 * sc;
  const colMatrices = [
    [cageOff, cageOff],
    [-cageOff, cageOff],
    [-cageOff, -cageOff],
    [cageOff, -cageOff],
  ].map(([ox, oy]) => mat4(tx + ox, ty + oy, tH / 2, 0, 0, 0, colR, colR, tH));
  instances.push({ geo: IG.cyl, mat: M.solar.bronze, matrices: colMatrices });

  // Structural rings — gold accent, flat torus at 1/3 and 2/3 height
  [1 / 3, 2 / 3].forEach(frac => {
    const rGeo = new THREE.TorusGeometry(cageOff * 1.6, 0.007 * sc, 6, 18);
    geos.push(rGeo);
    meshes.push({ geo: rGeo, mat: M.solar.gold, pos: [tx, ty, tH * frac], rot: [0, 0, 0] });
  });

  // Apex cap — polished gold sphere, the visual terminus
  const apexGeo = new THREE.SphereGeometry(0.016 * sc, 8, 8);
  geos.push(apexGeo);
  meshes.push({ geo: apexGeo, mat: M.solar.gold, pos: [tx, ty, tH + 0.018 * sc], rot: [0, 0, 0] });

  // ── Parabolic Dish ─────────────────────────────────────────────────────────
  // Always positioned on the opposite side of the tile from the tower
  // so the composition never crowds itself — two poles of a single composition.
  const dishR = rr(rng, 0.10, 0.15) * sc;
  const stemH = rr(rng, 0.08, 0.13) * sc;
  const dX = tx > 0 ? rr(rng, -0.28, -0.14) * sc : rr(rng, 0.14, 0.28) * sc;
  const dY = rr(rng, -0.18, 0.18) * sc;

  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.009 * sc, 0.011 * sc, stemH, 6);
  stemGeo.rotateX(Math.PI / 2);
  geos.push(stemGeo);
  meshes.push({ geo: stemGeo, mat: M.solar.bronze, pos: [dX, dY, stemH / 2], rot: [0, 0, 0] });

  // Bowl — hemisphere open toward viewer (+Z), higher segment count for smooth curve
  const dishGeo = new THREE.SphereGeometry(dishR, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  dishGeo.rotateX(Math.PI / 2);
  geos.push(dishGeo);
  meshes.push({ geo: dishGeo, mat: M.solar.gold, pos: [dX, dY, stemH], rot: [0, 0, 0] });

  // Precision rim — tight bronze ring, tolerance-detail at the dish edge
  const rimGeo = new THREE.TorusGeometry(dishR * 0.98, 0.007 * sc, 6, 22);
  geos.push(rimGeo);
  meshes.push({ geo: rimGeo, mat: M.solar.bronze, pos: [dX, dY, stemH], rot: [0, 0, 0] });

  // Focal point marker — emissive gold sphere at focal distance above dish center
  const focusGeo = new THREE.SphereGeometry(0.011 * sc, 6, 6);
  geos.push(focusGeo);
  meshes.push({ geo: focusGeo, mat: M.solar.gold, pos: [dX, dY, stemH + dishR * 0.50], rot: [0, 0, 0] });

  // ── Light Spires ───────────────────────────────────────────────────────────
  // Needle-thin gold cones — accent only, height variation creates skyline rhythm.
  const spireCount = 2 + Math.floor(rng() * 2);
  const spireMatrices = [];
  for (let i = 0; i < spireCount; i++) {
    const spH = rr(rng, 0.26, 0.50) * sc;
    const spR = 0.007 * sc;  // deliberately slim — needle not pillar
    spireMatrices.push(mat4(
      rr(rng, -0.32, 0.32) * sc,
      rr(rng, -0.32, 0.32) * sc,
      spH / 2, 0, 0, 0, spR, spR, spH
    ));
  }
  instances.push({ geo: IG.cone, mat: M.solar.gold, matrices: spireMatrices });

  // ── Solar Panel Array ──────────────────────────────────────────────────────
  // Flat near-black plane angled ~30° toward imaginary sun — the ground anchor.
  // Near-black with faint amber glow edge = absorbed light bleeding back out.
  const panW = rr(rng, 0.16, 0.22) * sc;
  const panGeo = new THREE.PlaneGeometry(panW, panW * rr(rng, 0.50, 0.65));
  geos.push(panGeo);
  meshes.push({
    geo: panGeo,
    mat: M.solar.panel,
    pos: [rr(rng, -0.22, 0.22) * sc, rr(rng, -0.22, 0.22) * sc, 0.018 * sc],
    rot: [Math.PI / 6, 0, rng() * Math.PI * 2],
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

  // Canopy arch — half-torus standing upright over the spiral tower.
  // rotateX(PI/2) bakes vertical orientation into the geometry: feet at z=0 (local),
  // apex at z=archR. Rotating around Z (face normal) in the mesh spins the span
  // direction so arches face different ways per tile. Positioned with feet exactly
  // at tower top so the arch reads as growing from the structure, not floating.
  const archR = rr(rng, 0.13, 0.20) * sc;
  const archGeo = new THREE.TorusGeometry(archR, 0.016 * sc, 8, 20, Math.PI);
  archGeo.rotateX(Math.PI / 2); // stand upright: flat XY → vertical XZ plane
  geos.push(archGeo);
  meshes.push({
    geo: archGeo,
    mat: M.bio.glow,
    pos: [towerX + rr(rng, -0.05, 0.05) * sc, towerY + rr(rng, -0.05, 0.05) * sc, towerTopZ],
    rot: [0, 0, rng() * Math.PI],
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
// Design language: server-farm brutalism × Tokyo street tech.
// Two towers guaranteed to be on opposite quadrants so the bridge always spans
// real distance. Each tower: dark shaft + 2-ring cage collar at mid-height +
// floating apex ring. Antenna cluster between towers. Hub nodes along bridge path.
//
// Violet is the ONLY emissive accent (rings, nodes, bridge).
// Amber appears only at antenna tips — hot-spot counterpoint, never dominant.
function buildNeuralHub(rng, _count, sc) {
  const geos = [];
  const meshes = [];
  const instances = [];

  // ── Two signal towers — placed in opposite quadrants for guaranteed span ───
  // Quadrant assignment: tower 0 in +X/+Y half, tower 1 in -X/-Y half.
  const towerPositions = [];
  const quadrants = [
    [rr(rng, 0.06, 0.26) * sc, rr(rng, -0.26, 0.26) * sc],
    [-rr(rng, 0.06, 0.26) * sc, rr(rng, -0.26, 0.26) * sc],
  ];

  quadrants.forEach(([tx, ty]) => {
    const tH = rr(rng, 0.36, 0.54) * sc;
    const tRb = 0.018 * sc;
    const tRt = 0.011 * sc;

    // Main shaft — tapered dark cylinder
    const shaftGeo = new THREE.CylinderGeometry(tRt, tRb, tH, 6);
    shaftGeo.rotateX(Math.PI / 2);
    geos.push(shaftGeo);
    meshes.push({ geo: shaftGeo, mat: M.neural.dark, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });

    // Collar rings at 40% and 70% height — structural detail
    [0.40, 0.72].forEach(frac => {
      const collarGeo = new THREE.TorusGeometry(tRb * 2.0, 0.006 * sc, 6, 14);
      geos.push(collarGeo);
      meshes.push({ geo: collarGeo, mat: M.neural.dark, pos: [tx, ty, tH * frac], rot: [0, 0, 0] });
    });

    // Apex ring — violet, floats just above tower top
    const apexRingGeo = new THREE.TorusGeometry(tRb * 2.8, 0.007 * sc, 6, 18);
    geos.push(apexRingGeo);
    meshes.push({ geo: apexRingGeo, mat: M.neural.violet, pos: [tx, ty, tH + 0.014 * sc], rot: [0, 0, 0] });

    towerPositions.push([tx, ty, tH]);
  });

  // ── Data bridge — violet beam connecting the two towers ───────────────────
  {
    const [ax, ay, atH] = towerPositions[0];
    const [bx, by, btH] = towerPositions[1];
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midH = (atH + btH) * 0.48;

    const bridgeGeo = new THREE.BoxGeometry(dist, 0.007 * sc, 0.007 * sc);
    geos.push(bridgeGeo);
    meshes.push({
      geo: bridgeGeo,
      mat: M.neural.violet,
      pos: [(ax + bx) / 2, (ay + by) / 2, midH],
      rot: [0, 0, Math.atan2(dy, dx)],
    });

    // Hub nodes — violet spheres placed along the bridge path at even intervals
    const nodeCount = 2 + Math.floor(rng() * 2);
    for (let i = 1; i <= nodeCount; i++) {
      const t = i / (nodeCount + 1);
      const nX = ax + dx * t;
      const nY = ay + dy * t;
      const nZ = atH + (btH - atH) * t * 0.48 + rr(rng, -0.04, 0.04) * sc;
      const nR = rr(rng, 0.022, 0.036) * sc;
      const nGeo = new THREE.SphereGeometry(nR, 8, 8);
      geos.push(nGeo);
      meshes.push({ geo: nGeo, mat: M.neural.violet, pos: [nX, nY, nZ], rot: [0, 0, 0] });
    }
  }

  // ── Antenna cluster — amber-tip rods grouped between the towers ───────────
  const antCount = 5 + Math.floor(rng() * 5);
  const aBX = (towerPositions[0][0] + towerPositions[1][0]) / 2;
  const aBY = (towerPositions[0][1] + towerPositions[1][1]) / 2;
  const antShaft = [];
  const antTip = [];
  for (let i = 0; i < antCount; i++) {
    const aH = rr(rng, 0.18, 0.36) * sc;
    const tipH = aH * 0.18;
    const aR = 0.005 * sc;
    const ax = aBX + rr(rng, -0.10, 0.10) * sc;
    const ay = aBY + rr(rng, -0.10, 0.10) * sc;
    const leanX = rr(rng, -0.22, 0.22);
    const leanY = rr(rng, -0.22, 0.22);
    // Dark shaft
    antShaft.push(mat4(ax, ay, (aH - tipH) / 2, leanX, leanY, 0, aR, aR, aH - tipH));
    // Amber glowing tip cone
    antTip.push(mat4(ax, ay, aH - tipH / 2, leanX, leanY, 0, aR * 1.6, aR * 1.6, tipH));
  }
  instances.push({ geo: IG.cyl, mat: M.neural.dark, matrices: antShaft });
  instances.push({ geo: IG.cone, mat: M.neural.amber, matrices: antTip });

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

  const { meshes, instances, geos, mats = [] } = useMemo(() => {
    const builder = CITY_BUILDERS[cityKey];
    if (!builder) return { meshes: [], instances: [], geos: [] };
    const rng = mulberry32(seed);
    return builder(rng, count, scale);
  }, [cityKey, scale, seed, count]);

  // Dispose per-tile geometries and per-tile material clones on unmount / dep change.
  // Module-level M singletons and IG geometries are intentionally NOT disposed here.
  useEffect(() => {
    return () => {
      geos.forEach(g => g?.dispose());
      mats.forEach(m => m?.dispose());
    };
  }, [geos, mats]);

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
