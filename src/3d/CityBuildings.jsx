// CityBuildings.jsx — deterministic 3D building clusters for Biome mode tiles.
//
// Each face is mapped to a city (frozenCitadel, deepStation, volcanicFoundry,
// solarArcology, bioDome, neuralHub).  One <CityBuildings> component mounts per
// tile, positioned in the StickerPlane's local coordinate space at Z+0.015 so
// geometry sits just above the sticker surface.
//
// Design constraints:
//   • NO useFrame — all geometry is static (no per-frame animation).
//   • All Three.js objects created inside useMemo, keyed on
//     [cityKey, tileIndex, faceId, gridDim, scale].
//   • Disposal via useEffect cleanup — every geometry and material
//     created here is explicitly disposed on unmount / dep change.
//   • All randomness driven by mulberry32(seed), seed = faceId*10000+tileIndex.
//     No Math.random() calls anywhere in this file.
//   • castShadow={false} receiveShadow={false} on every mesh (performance).
//   • Max building height: 0.6 * scale.  XY footprint: ±0.40 * scale.

import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { mulberry32, getBuildingCount } from '../modes/CityBiomeMode.js';

// ── tiny helper: random float in [min, max) using the seeded rng ──────────────
function rr(rng, min, max) {
  return min + rng() * (max - min);
}

// ── city render functions ─────────────────────────────────────────────────────
// Each returns { meshes, geos, mats }:
//   meshes  — array of { geo, mat, pos:[x,y,z], rot:[x,y,z] }
//   geos    — all BufferGeometry instances to dispose later
//   mats    — all Material instances to dispose later (de-duped by caller)

// ─── 1. Frozen Citadel ────────────────────────────────────────────────────────
// White & icy blue — tapered towers, hexagonal crystal shards, flat slabs.
function buildFrozenCitadel(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const mainMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    metalness: 0.30,
    roughness: 0.10,
    transparent: true,
    opacity: 0.92,
    emissive: new THREE.Color('#B8E4FF'),
    emissiveIntensity: 0.05,
    flatShading: true,
    side: THREE.FrontSide,
  });
  mats.push(mainMat);

  // Primary tower — narrow box that evokes a spire
  const tW = rr(rng, 0.08, 0.18) * sc;
  const tH = rr(rng, 0.25, 0.55) * sc;
  const towerGeo = new THREE.BoxGeometry(tW, tW, tH);
  geos.push(towerGeo);
  meshes.push({
    geo: towerGeo,
    mat: mainMat,
    pos: [rr(rng, -0.10, 0.10) * sc, rr(rng, -0.10, 0.10) * sc, tH / 2],
    rot: [0, 0, rr(rng, -0.08, 0.08)],
  });

  // Tapered cap on tower — smaller box on top creates a stepped pyramid look
  const capW = tW * 0.55;
  const capH = tH * 0.20;
  const capGeo = new THREE.BoxGeometry(capW, capW, capH);
  geos.push(capGeo);
  meshes.push({
    geo: capGeo,
    mat: mainMat,
    pos: [rr(rng, -0.10, 0.10) * sc, rr(rng, -0.10, 0.10) * sc, tH + capH / 2],
    rot: [0, 0, 0],
  });

  // Crystal shards — hexagonal cones, 2-4 per tile
  const shardCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < shardCount; i++) {
    const sH = rr(rng, 0.12, 0.30) * sc;
    const shardGeo = new THREE.ConeGeometry(0.04 * sc, sH, 6);
    geos.push(shardGeo);
    meshes.push({
      geo: shardGeo,
      mat: mainMat,
      pos: [rr(rng, -0.35, 0.35) * sc, rr(rng, -0.35, 0.35) * sc, sH / 2],
      rot: [rr(rng, -0.20, 0.20), rr(rng, -0.20, 0.20), rng() * Math.PI],
    });
  }

  // Low wide slab (optional) — base platform
  if (rng() > 0.30) {
    const slabW = rr(rng, 0.28, 0.48) * sc;
    const slabD = slabW * rr(rng, 0.55, 0.85);
    const slabH = rr(rng, 0.04, 0.08) * sc;
    const slabGeo = new THREE.BoxGeometry(slabW, slabD, slabH);
    geos.push(slabGeo);
    meshes.push({
      geo: slabGeo,
      mat: mainMat,
      pos: [rr(rng, -0.15, 0.15) * sc, rr(rng, -0.15, 0.15) * sc, slabH / 2],
      rot: [0, 0, 0],
    });
  }

  return { meshes, geos, mats };
}

// ─── 2. Deep Station ──────────────────────────────────────────────────────────
// Dark navy with teal glow — pressure domes, hab-rings, pipe clusters.
function buildDeepStation(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const hullMat = new THREE.MeshStandardMaterial({
    color: '#003366',
    metalness: 0.70,
    roughness: 0.30,
    side: THREE.FrontSide,
  });
  mats.push(hullMat);

  const glowMat = new THREE.MeshStandardMaterial({
    color: '#003366',
    metalness: 0.70,
    roughness: 0.30,
    emissive: new THREE.Color('#00CED1'),
    emissiveIntensity: 0.15,
    side: THREE.FrontSide,
  });
  mats.push(glowMat);

  // Pressure dome — hemisphere anchored at Z=0
  const domeR = rr(rng, 0.08, 0.13) * sc;
  const domeGeo = new THREE.SphereGeometry(domeR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  geos.push(domeGeo);
  const domeX = rr(rng, -0.20, 0.20) * sc;
  const domeY = rr(rng, -0.20, 0.20) * sc;
  meshes.push({ geo: domeGeo, mat: hullMat, pos: [domeX, domeY, 0], rot: [0, 0, 0] });

  // Hab-rings — torii at varying heights, 1-2
  const ringCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < ringCount; i++) {
    const ringR = rr(rng, 0.10, 0.15) * sc;
    const ringGeo = new THREE.TorusGeometry(ringR, 0.022 * sc, 8, 16);
    geos.push(ringGeo);
    meshes.push({
      geo: ringGeo,
      mat: glowMat,
      pos: [rr(rng, -0.25, 0.25) * sc, rr(rng, -0.25, 0.25) * sc, rr(rng, 0.06, 0.22) * sc],
      rot: [Math.PI / 2, 0, rng() * Math.PI],
    });
  }

  // Pipe cluster — thin cylinders grouped near one corner, 3-5
  const pipeCount = 3 + Math.floor(rng() * 3);
  const pBX = rr(rng, -0.30, 0.30) * sc;
  const pBY = rr(rng, -0.30, 0.30) * sc;
  for (let i = 0; i < pipeCount; i++) {
    const pH = rr(rng, 0.10, 0.40) * sc;
    const pipeGeo = new THREE.CylinderGeometry(0.012 * sc, 0.012 * sc, pH, 6);
    geos.push(pipeGeo);
    meshes.push({
      geo: pipeGeo,
      mat: hullMat,
      pos: [pBX + rr(rng, -0.08, 0.08) * sc, pBY + rr(rng, -0.08, 0.08) * sc, pH / 2],
      rot: [rr(rng, -0.12, 0.12), rr(rng, -0.12, 0.12), 0],
    });
  }

  // Airlock collar — cylinder ring capping the dome
  const collarGeo = new THREE.CylinderGeometry(domeR * 1.08, domeR * 1.08, 0.02 * sc, 12, 1, true);
  geos.push(collarGeo);
  meshes.push({ geo: collarGeo, mat: glowMat, pos: [domeX, domeY, 0.01 * sc], rot: [0, 0, 0] });

  return { meshes, geos, mats };
}

// ─── 3. Volcanic Foundry ──────────────────────────────────────────────────────
// Dark iron with lava-orange glow — brutalist blocks, smokestacks, pylons.
function buildVolcanicFoundry(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const ironMat = new THREE.MeshStandardMaterial({
    color: '#1C1C1C',
    metalness: 0.80,
    roughness: 0.60,
    side: THREE.FrontSide,
  });
  mats.push(ironMat);

  const lavaMat = new THREE.MeshStandardMaterial({
    color: '#2A0A00',
    metalness: 0.50,
    roughness: 0.60,
    emissive: new THREE.Color('#FF4500'),
    emissiveIntensity: 0.20,
    side: THREE.FrontSide,
  });
  mats.push(lavaMat);

  // Brutalist block — wide, low, offset to one side
  const bW = rr(rng, 0.20, 0.35) * sc;
  const bD = rr(rng, 0.15, 0.28) * sc;
  const bH = rr(rng, 0.08, 0.20) * sc;
  const blockGeo = new THREE.BoxGeometry(bW, bD, bH);
  geos.push(blockGeo);
  meshes.push({
    geo: blockGeo,
    mat: ironMat,
    pos: [rr(rng, -0.25, 0.0) * sc, rr(rng, -0.10, 0.10) * sc, bH / 2],
    rot: [0, 0, 0],
  });

  // Smokestacks with vent caps — 2-4, grouped on opposite side from block
  const stackCount = 2 + Math.floor(rng() * 3);
  const sBX = rr(rng, 0.0, 0.25) * sc;
  const sBY = rr(rng, -0.20, 0.20) * sc;
  for (let i = 0; i < stackCount; i++) {
    const sH = rr(rng, 0.20, 0.50) * sc;
    const sR = rr(rng, 0.025, 0.045) * sc;
    const stackGeo = new THREE.CylinderGeometry(sR * 0.8, sR, sH, 8);
    geos.push(stackGeo);
    const sx = sBX + rr(rng, -0.12, 0.12) * sc;
    const sy = sBY + rr(rng, -0.12, 0.12) * sc;
    meshes.push({ geo: stackGeo, mat: ironMat, pos: [sx, sy, sH / 2], rot: [0, 0, 0] });

    // Lava-glow vent cap — inverted cone atop each stack
    const capGeo = new THREE.ConeGeometry(sR * 1.2, 0.06 * sc, 8);
    geos.push(capGeo);
    meshes.push({
      geo: capGeo,
      mat: lavaMat,
      pos: [sx, sy, sH + 0.03 * sc],
      rot: [Math.PI, 0, 0],
    });
  }

  // Structural pylons — thin vertical bars, 1-2
  const pylonCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < pylonCount; i++) {
    const pyH = rr(rng, 0.25, 0.40) * sc;
    const pyGeo = new THREE.CylinderGeometry(0.014 * sc, 0.014 * sc, pyH, 4);
    geos.push(pyGeo);
    meshes.push({
      geo: pyGeo,
      mat: ironMat,
      pos: [rr(rng, -0.35, 0.35) * sc, rr(rng, -0.35, 0.35) * sc, pyH / 2],
      rot: [0, 0, 0],
    });
  }

  return { meshes, geos, mats };
}

// ─── 4. Solar Arcology ────────────────────────────────────────────────────────
// Bronze & gold — lattice towers, parabolic dishes, light spires, solar panels.
function buildSolarArcology(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: '#CD7F32',
    metalness: 0.90,
    roughness: 0.20,
    side: THREE.FrontSide,
  });
  mats.push(bronzeMat);

  const goldGlowMat = new THREE.MeshStandardMaterial({
    color: '#CD7F32',
    metalness: 0.90,
    roughness: 0.20,
    emissive: new THREE.Color('#FFD700'),
    emissiveIntensity: 0.25,
    side: THREE.FrontSide,
  });
  mats.push(goldGlowMat);

  const panelMat = new THREE.MeshStandardMaterial({
    color: '#1A1A1A',
    metalness: 0.20,
    roughness: 0.40,
    emissive: new THREE.Color('#FFD700'),
    emissiveIntensity: 0.06,
    side: THREE.DoubleSide,
  });
  mats.push(panelMat);

  const wireMat = new THREE.MeshBasicMaterial({ color: '#FFD700', wireframe: true });
  mats.push(wireMat);

  // Lattice tower(s) — slim box + wireframe cage, 1-2
  const tCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < tCount; i++) {
    const tH = rr(rng, 0.30, 0.58) * sc;
    const tGeo = new THREE.BoxGeometry(0.022 * sc, 0.022 * sc, tH);
    geos.push(tGeo);
    const tx = rr(rng, -0.30, 0.30) * sc;
    const ty = rr(rng, -0.30, 0.30) * sc;
    meshes.push({ geo: tGeo, mat: bronzeMat, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });

    // Wireframe cage — open skeletal casing around tower
    const wGeo = new THREE.BoxGeometry(0.07 * sc, 0.07 * sc, tH * 0.88);
    geos.push(wGeo);
    meshes.push({ geo: wGeo, mat: wireMat, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });
  }

  // Parabolic dish on a stem
  const dishR = rr(rng, 0.08, 0.14) * sc;
  const dishGeo = new THREE.SphereGeometry(dishR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  geos.push(dishGeo);
  const stemH = rr(rng, 0.06, 0.12) * sc;
  const stemGeo = new THREE.CylinderGeometry(0.012 * sc, 0.012 * sc, stemH, 6);
  geos.push(stemGeo);
  const dX = rr(rng, -0.28, 0.28) * sc;
  const dY = rr(rng, -0.28, 0.28) * sc;
  meshes.push(
    { geo: stemGeo, mat: bronzeMat, pos: [dX, dY, stemH / 2], rot: [0, 0, 0] },
    { geo: dishGeo, mat: goldGlowMat, pos: [dX, dY, stemH], rot: [0, 0, 0] },
  );

  // Light spires — very slim cones, 1-2
  const spireCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < spireCount; i++) {
    const spH = rr(rng, 0.22, 0.40) * sc;
    const spGeo = new THREE.ConeGeometry(0.012 * sc, spH, 4);
    geos.push(spGeo);
    meshes.push({
      geo: spGeo,
      mat: goldGlowMat,
      pos: [rr(rng, -0.35, 0.35) * sc, rr(rng, -0.35, 0.35) * sc, spH / 2],
      rot: [0, 0, 0],
    });
  }

  // Solar panel — tilted plane
  const panGeo = new THREE.PlaneGeometry(0.20 * sc, 0.12 * sc);
  geos.push(panGeo);
  meshes.push({
    geo: panGeo,
    mat: panelMat,
    pos: [rr(rng, -0.28, 0.28) * sc, rr(rng, -0.28, 0.28) * sc, 0.04 * sc],
    rot: [Math.PI / 6, 0, rng() * Math.PI],
  });

  return { meshes, geos, mats };
}

// ─── 5. Bio-Dome ──────────────────────────────────────────────────────────────
// Deep green + neon chartreuse glow — spiral tower, canopy arch, root buttresses.
function buildBioDome(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const foliageMat = new THREE.MeshStandardMaterial({
    color: '#006400',
    metalness: 0.00,
    roughness: 0.85,
    side: THREE.FrontSide,
  });
  mats.push(foliageMat);

  const glowMat = new THREE.MeshStandardMaterial({
    color: '#004D00',
    metalness: 0.00,
    roughness: 0.80,
    emissive: new THREE.Color('#39FF14'),
    emissiveIntensity: 0.18,
    side: THREE.FrontSide,
  });
  mats.push(glowMat);

  const barkMat = new THREE.MeshStandardMaterial({
    color: '#4A2F1A',
    metalness: 0.00,
    roughness: 0.95,
    side: THREE.FrontSide,
  });
  mats.push(barkMat);

  // Spiral tower — stacked cylinder segments each slightly rotated
  const segCount = 6 + Math.floor(rng() * 3);
  const segH = rr(rng, 0.04, 0.07) * sc;
  const towerX = rr(rng, -0.18, 0.18) * sc;
  const towerY = rr(rng, -0.18, 0.18) * sc;
  for (let i = 0; i < segCount; i++) {
    const shrink = 1 - i * 0.045;
    const segGeo = new THREE.CylinderGeometry(
      0.04 * sc * Math.max(shrink - 0.04, 0.05),
      0.05 * sc * Math.max(shrink, 0.08),
      segH, 8
    );
    geos.push(segGeo);
    meshes.push({
      geo: segGeo,
      mat: foliageMat,
      pos: [towerX, towerY, i * segH + segH / 2],
      rot: [0, 0, (i * 18 * Math.PI) / 180],
    });
  }
  const towerTopZ = segCount * segH;

  // Canopy arch — half-torus crowning the top
  const archR = rr(rng, 0.12, 0.18) * sc;
  const archGeo = new THREE.TorusGeometry(archR, 0.020 * sc, 6, 14, Math.PI);
  geos.push(archGeo);
  meshes.push({
    geo: archGeo,
    mat: glowMat,
    pos: [rr(rng, -0.12, 0.12) * sc, rr(rng, -0.12, 0.12) * sc, towerTopZ + archR * 0.65],
    rot: [0, 0, rng() * Math.PI * 2],
  });

  // Root buttresses — angled slim boxes, 2-3
  const bCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bCount; i++) {
    const bLen = rr(rng, 0.10, 0.15) * sc;
    const bGeo = new THREE.BoxGeometry(0.014 * sc, bLen, 0.012 * sc);
    geos.push(bGeo);
    const tiltAngle = rr(rng, 0.45, 0.75); // ~26°–43°
    meshes.push({
      geo: bGeo,
      mat: barkMat,
      pos: [towerX + rr(rng, -0.14, 0.14) * sc, towerY + rr(rng, -0.14, 0.14) * sc, bLen * 0.28],
      rot: [tiltAngle, 0, rng() * Math.PI * 2],
    });
  }

  // Dome cap at ground — spherical cap accent
  const capR = rr(rng, 0.07, 0.10) * sc;
  const capGeo = new THREE.SphereGeometry(capR, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  geos.push(capGeo);
  meshes.push({
    geo: capGeo,
    mat: glowMat,
    pos: [rr(rng, -0.28, 0.28) * sc, rr(rng, -0.28, 0.28) * sc, 0],
    rot: [0, 0, 0],
  });

  return { meshes, geos, mats };
}

// ─── 6. Neural Hub ────────────────────────────────────────────────────────────
// Dark indigo + violet/orange glow — signal towers, hub nodes, antenna cluster,
// data bridge beam connecting twin towers.
function buildNeuralHub(rng, _count, sc) {
  const geos = [];
  const mats = [];
  const meshes = [];

  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1A1A2E',
    metalness: 0.60,
    roughness: 0.40,
    side: THREE.FrontSide,
  });
  mats.push(darkMat);

  const violetMat = new THREE.MeshStandardMaterial({
    color: '#1A1A2E',
    metalness: 0.60,
    roughness: 0.40,
    emissive: new THREE.Color('#8B00FF'),
    emissiveIntensity: 0.30,
    side: THREE.FrontSide,
  });
  mats.push(violetMat);

  const orangeMat = new THREE.MeshStandardMaterial({
    color: '#1A1A2E',
    metalness: 0.50,
    roughness: 0.40,
    emissive: new THREE.Color('#FF6B00'),
    emissiveIntensity: 0.15,
    side: THREE.FrontSide,
  });
  mats.push(orangeMat);

  // Signal towers — pair, each with a floating violet ring at top
  const towerPositions = [];
  for (let i = 0; i < 2; i++) {
    const tH = rr(rng, 0.30, 0.50) * sc;
    const tGeo = new THREE.CylinderGeometry(0.015 * sc, 0.020 * sc, tH, 6);
    geos.push(tGeo);
    const tx = rr(rng, -0.30, 0.30) * sc;
    const ty = rr(rng, -0.30, 0.30) * sc;
    towerPositions.push([tx, ty, tH]);
    meshes.push({ geo: tGeo, mat: darkMat, pos: [tx, ty, tH / 2], rot: [0, 0, 0] });

    // Floating ring at tower apex
    const ringGeo = new THREE.RingGeometry(0.038 * sc, 0.054 * sc, 16);
    geos.push(ringGeo);
    meshes.push({
      geo: ringGeo,
      mat: violetMat,
      pos: [tx, ty, tH + 0.018 * sc],
      rot: [0, 0, 0],
    });
  }

  // Hub nodes — pulsing spheres scattered around, 2-3
  const nodeCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nodeCount; i++) {
    const nGeo = new THREE.SphereGeometry(rr(rng, 0.030, 0.050) * sc, 8, 8);
    geos.push(nGeo);
    meshes.push({
      geo: nGeo,
      mat: violetMat,
      pos: [rr(rng, -0.35, 0.35) * sc, rr(rng, -0.35, 0.35) * sc, rr(rng, 0.04, 0.16) * sc],
      rot: [0, 0, 0],
    });
  }

  // Antenna cluster — thin orange-glow rods, 4-6
  const antCount = 4 + Math.floor(rng() * 3);
  const aBX = rr(rng, -0.28, 0.28) * sc;
  const aBY = rr(rng, -0.28, 0.28) * sc;
  for (let i = 0; i < antCount; i++) {
    const aH = rr(rng, 0.14, 0.30) * sc;
    const aGeo = new THREE.CylinderGeometry(0.005 * sc, 0.005 * sc, aH, 4);
    geos.push(aGeo);
    meshes.push({
      geo: aGeo,
      mat: orangeMat,
      pos: [aBX + rr(rng, -0.07, 0.07) * sc, aBY + rr(rng, -0.07, 0.07) * sc, aH / 2],
      rot: [rr(rng, -0.30, 0.30), rr(rng, -0.30, 0.30), 0],
    });
  }

  // Data bridge — thin box beam connecting the two signal towers if close enough
  if (towerPositions.length >= 2) {
    const [ax, ay, atH] = towerPositions[0];
    const [bx, by, btH] = towerPositions[1];
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.60 * sc && dist > 0.01) {
      const midH = (atH + btH) * 0.45;
      const bridgeGeo = new THREE.BoxGeometry(dist, 0.008 * sc, 0.008 * sc);
      geos.push(bridgeGeo);
      meshes.push({
        geo: bridgeGeo,
        mat: violetMat,
        pos: [(ax + bx) / 2, (ay + by) / 2, midH],
        rot: [0, 0, Math.atan2(dy, dx)],
      });
    }
  }

  return { meshes, geos, mats };
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

  const { meshes, geos, mats } = useMemo(() => {
    const builder = CITY_BUILDERS[cityKey];
    if (!builder) return { meshes: [], geos: [], mats: [] };
    const rng = mulberry32(seed);
    return builder(rng, count, scale);
  }, [cityKey, tileIndex, faceId, gridDim, scale, seed, count]);

  useEffect(() => {
    return () => {
      geos.forEach(g => g?.dispose());
      mats.forEach(m => m?.dispose());
    };
  }, [geos, mats]);

  if (!meshes.length) return null;

  return (
    <group position={[0, 0, 0.015]}>
      {meshes.map((b, i) => (
        <mesh
          key={i}
          position={b.pos}
          rotation={b.rot}
          castShadow={false}
          receiveShadow={false}
        >
          <primitive object={b.geo} attach="geometry" />
          <primitive object={b.mat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export default CityBuildings;
