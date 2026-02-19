import React, { useMemo } from 'react';
import { mulberry32, getBuildingCount } from '../modes/CityBiomeMode.js';

// ─── Frozen Citadel (White / Ice) ────────────────────────────────────────────

function renderFrozenCitadel(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 1 primary tower
  const tw = (0.08 + rng() * 0.10) * scale;
  const th = (0.25 + rng() * 0.30) * scale;
  const tx = (rng() - 0.5) * 0.5 * scale;
  const ty = (rng() - 0.5) * 0.5 * scale;
  meshes.push(
    <group key={key++} position={[tx, ty, th / 2]}>
      {/* Main tower body */}
      <mesh castShadow={false} receiveShadow={false}>
        <boxGeometry args={[tw, tw, th]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.3} roughness={0.1} transparent opacity={0.92} emissive="#B8E4FF" emissiveIntensity={0.05} />
      </mesh>
      {/* Tapered top cap */}
      <mesh position={[0, 0, th / 2 + 0.04 * scale]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[tw * 0.6, tw * 0.6, 0.08 * scale]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.3} roughness={0.1} transparent opacity={0.88} emissive="#B8E4FF" emissiveIntensity={0.06} />
      </mesh>
    </group>
  );

  // 0-3 crystal shards near tower
  const shardCount = Math.floor(rng() * 3);
  for (let i = 0; i < shardCount; i++) {
    const sh = (0.15 + rng() * 0.15) * scale;
    const sr = 0.04 * scale;
    const sa = rng() * Math.PI * 2;
    const sd = (0.08 + rng() * 0.12) * scale;
    const sx = tx + Math.cos(sa) * sd;
    const sy = ty + Math.sin(sa) * sd;
    const tiltX = (rng() - 0.5) * 0.52; // ±15°
    const tiltZ = (rng() - 0.5) * 0.52;
    if (Math.abs(sx) < 0.4 * scale && Math.abs(sy) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[sx, sy, sh / 2]} rotation={[tiltX, 0, tiltZ]} castShadow={false} receiveShadow={false}>
          <coneGeometry args={[sr, sh, 6]} />
          <meshStandardMaterial color="#C0C0C0" metalness={0.4} roughness={0.1} transparent opacity={0.9} emissive="#B8E4FF" emissiveIntensity={0.04} />
        </mesh>
      );
    }
  }

  // 0-1 low ice slab base
  if (rng() > 0.4) {
    const slw = (0.25 + rng() * 0.25) * scale;
    const slh = (0.04 + rng() * 0.04) * scale;
    const slx = (rng() - 0.5) * 0.4 * scale;
    const sly = (rng() - 0.5) * 0.4 * scale;
    meshes.push(
      <mesh key={key++} position={[slx, sly, slh / 2]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[slw, slw * 0.7, slh]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.2} roughness={0.15} transparent opacity={0.85} emissive="#B8E4FF" emissiveIntensity={0.03} />
      </mesh>
    );
  }

  return meshes;
}

// ─── Deep Station (Blue / Water) ─────────────────────────────────────────────

function renderDeepStation(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 1 pressure dome — hemisphere as anchor
  const dr = (0.07 + rng() * 0.06) * scale;
  const dx = (rng() * 0.4 - 0.2) * scale;
  const dy = (rng() * 0.4 - 0.2) * scale;
  meshes.push(
    <mesh key={key++} position={[dx, dy, 0]} castShadow={false} receiveShadow={false}>
      <sphereGeometry args={[dr, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#003366" metalness={0.7} roughness={0.3} />
    </mesh>
  );

  // 1 hab-ring beside dome
  const rr = (0.08 + rng() * 0.06) * scale;
  const rt = 0.018 * scale;
  const rx = dx + (rng() * 0.2 + 0.1) * scale * (rng() > 0.5 ? 1 : -1);
  const ry = dy + (rng() - 0.5) * 0.15 * scale;
  const rh = (0.1 + rng() * 0.15) * scale;
  if (Math.abs(rx) < 0.4 * scale && Math.abs(ry) < 0.4 * scale) {
    meshes.push(
      <mesh key={key++} position={[rx, ry, rh]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
        <torusGeometry args={[rr, rt, 8, 16]} />
        <meshStandardMaterial color="#2C3E50" metalness={0.7} roughness={0.3} emissive="#00CED1" emissiveIntensity={0.08} />
      </mesh>
    );
    // Second ring at different height
    if (rng() > 0.4) {
      meshes.push(
        <mesh key={key++} position={[rx, ry, rh + 0.1 * scale]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
          <torusGeometry args={[rr * 0.8, rt, 8, 16]} />
          <meshStandardMaterial color="#2C3E50" metalness={0.7} roughness={0.3} emissive="#00CED1" emissiveIntensity={0.06} />
        </mesh>
      );
    }
  }

  // 1 pipe cluster (3-5 pipes)
  const pipeCount = 3 + Math.floor(rng() * 3);
  const pcx = (rng() - 0.5) * 0.5 * scale;
  const pcy = (rng() - 0.5) * 0.5 * scale;
  for (let i = 0; i < pipeCount; i++) {
    const ph = (0.1 + rng() * 0.3) * scale;
    const pr = 0.01 * scale;
    const pox = pcx + (rng() - 0.5) * 0.08 * scale;
    const poy = pcy + (rng() - 0.5) * 0.08 * scale;
    const leanX = (rng() - 0.5) * 0.1;
    const leanZ = (rng() - 0.5) * 0.1;
    if (Math.abs(pox) < 0.4 * scale && Math.abs(poy) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[pox, poy, ph / 2]} rotation={[leanX, 0, leanZ]} castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[pr, pr, ph, 6]} />
          <meshStandardMaterial color="#2C3E50" metalness={0.8} roughness={0.25} />
        </mesh>
      );
    }
  }

  return meshes;
}

// ─── Volcanic Foundry (Red / Lava) ───────────────────────────────────────────

function renderVolcanicFoundry(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 1 brutalist block — center-left
  const bw = (0.15 + rng() * 0.15) * scale;
  const bd = (0.12 + rng() * 0.10) * scale;
  const bh = (0.08 + rng() * 0.12) * scale;
  const bx = (-0.1 + (rng() - 0.5) * 0.1) * scale;
  const by = (rng() - 0.5) * 0.2 * scale;
  meshes.push(
    <mesh key={key++} position={[bx, by, bh / 2]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[bw, bd, bh]} />
      <meshStandardMaterial color="#1C1C1C" metalness={0.8} roughness={0.6} />
    </mesh>
  );

  // 2-3 smokestacks
  const stackCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < stackCount; i++) {
    const sh = (0.2 + rng() * 0.3) * scale;
    const sb = 0.03 * scale;
    const st = 0.02 * scale;
    const sx = (0.05 + rng() * 0.3) * scale;
    const sy = (rng() - 0.5) * 0.5 * scale;
    if (Math.abs(sx) < 0.4 * scale && Math.abs(sy) < 0.4 * scale) {
      // Stack body
      meshes.push(
        <mesh key={key++} position={[sx, sy, sh / 2]} castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[st, sb, sh, 8]} />
          <meshStandardMaterial color="#1C1C1C" metalness={0.8} roughness={0.6} />
        </mesh>
      );
      // Vent cap on top
      meshes.push(
        <mesh key={key++} position={[sx, sy, sh + 0.03 * scale]} rotation={[Math.PI, 0, 0]} castShadow={false} receiveShadow={false}>
          <coneGeometry args={[sb * 1.4, 0.06 * scale, 8]} />
          <meshStandardMaterial color="#FF4500" metalness={0.7} roughness={0.4} emissive="#FF4500" emissiveIntensity={0.15} />
        </mesh>
      );
    }
  }

  // Scattered pylons
  const pylonCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < pylonCount; i++) {
    const ph = 0.35 * scale;
    const pr = 0.01 * scale;
    const px = (rng() - 0.5) * 0.7 * scale;
    const py = (rng() - 0.5) * 0.7 * scale;
    if (Math.abs(px) < 0.4 * scale && Math.abs(py) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[px, py, ph / 2]} castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[pr, pr, ph, 4]} />
          <meshStandardMaterial color="#2A2A2A" metalness={0.85} roughness={0.5} />
        </mesh>
      );
    }
  }

  return meshes;
}

// ─── Solar Arcology (Yellow / Pulse) ─────────────────────────────────────────

function renderSolarArcology(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 1-2 lattice towers
  const towerCount = 1 + Math.floor(rng() * 2);
  const towerPositions = [];
  for (let i = 0; i < towerCount; i++) {
    const th = (0.3 + rng() * 0.3) * scale;
    const tw = 0.018 * scale;
    const tx = (rng() - 0.5) * 0.5 * scale;
    const ty = (rng() - 0.5) * 0.5 * scale;
    towerPositions.push({ x: tx, y: ty, h: th });
    if (Math.abs(tx) < 0.4 * scale && Math.abs(ty) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[tx, ty, th / 2]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={[tw, tw, th]} />
          <meshStandardMaterial color="#CD7F32" metalness={0.9} roughness={0.2} />
        </mesh>
      );
    }
  }

  // 1 parabolic dish on short stem
  const dishR = (0.06 + rng() * 0.08) * scale;
  const stemH = 0.08 * scale;
  const dishX = (rng() - 0.5) * 0.5 * scale;
  const dishY = (rng() - 0.5) * 0.5 * scale;
  if (Math.abs(dishX) < 0.4 * scale && Math.abs(dishY) < 0.4 * scale) {
    // Stem
    meshes.push(
      <mesh key={key++} position={[dishX, dishY, stemH / 2]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[0.01 * scale, 0.01 * scale, stemH, 6]} />
        <meshStandardMaterial color="#CD7F32" metalness={0.9} roughness={0.2} />
      </mesh>
    );
    // Dish (hemisphere open face up, flattened)
    meshes.push(
      <group key={key++} position={[dishX, dishY, stemH]} scale={[1, 1, 0.3]}>
        <mesh castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[dishR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#CD7F32" metalness={0.9} roughness={0.2} emissive="#FFD700" emissiveIntensity={0.1} side={2} />
        </mesh>
      </group>
    );
  }

  // 1-2 light spires
  const spireCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < spireCount; i++) {
    const spH = (0.25 + rng() * 0.15) * scale;
    const spR = 0.008 * scale;
    const spX = (rng() - 0.5) * 0.6 * scale;
    const spY = (rng() - 0.5) * 0.6 * scale;
    if (Math.abs(spX) < 0.4 * scale && Math.abs(spY) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[spX, spY, spH / 2]} castShadow={false} receiveShadow={false}>
          <coneGeometry args={[spR, spH, 4]} />
          <meshStandardMaterial color="#FFD700" metalness={0.9} roughness={0.1} emissive="#FFD700" emissiveIntensity={0.2} />
        </mesh>
      );
    }
  }

  // 1 solar panel array — angled flat
  const panX = (rng() - 0.5) * 0.4 * scale;
  const panY = (rng() - 0.5) * 0.4 * scale;
  meshes.push(
    <mesh key={key++} position={[panX, panY, 0.02 * scale]} rotation={[0.52, 0, rng() * Math.PI * 2]} castShadow={false} receiveShadow={false}>
      <planeGeometry args={[0.18 * scale, 0.1 * scale]} />
      <meshStandardMaterial color="#FFD700" metalness={0.3} roughness={0.4} side={2} />
    </mesh>
  );

  return meshes;
}

// ─── Bio-Dome (Green / Grass) ─────────────────────────────────────────────────

function renderBioDome(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 1 spiral tower (stacked segments rotated 15° each)
  const segCount = 6 + Math.floor(rng() * 3);
  const segH = 0.05 * scale;
  const segR = 0.025 * scale;
  const txB = (rng() - 0.5) * 0.3 * scale;
  const tyB = (rng() - 0.5) * 0.3 * scale;
  for (let i = 0; i < segCount; i++) {
    const angle = i * (Math.PI / 12); // 15° per segment
    meshes.push(
      <mesh key={key++} position={[txB, tyB, i * segH + segH / 2]} rotation={[0, 0, angle]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[segR * (1 - i * 0.03), segR, segH * 1.05, 6]} />
        <meshStandardMaterial color="#006400" metalness={0.0} roughness={0.8} />
      </mesh>
    );
  }

  // 1 canopy arch framing the tower
  const archR = (0.1 + rng() * 0.06) * scale;
  const archT = 0.015 * scale;
  const archX = txB + (rng() - 0.5) * 0.06 * scale;
  const archY = tyB + (rng() - 0.5) * 0.06 * scale;
  if (Math.abs(archX) < 0.38 * scale && Math.abs(archY) < 0.38 * scale) {
    meshes.push(
      <mesh key={key++} position={[archX, archY, archR * 0.6]} rotation={[0, rng() * Math.PI, 0]} castShadow={false} receiveShadow={false}>
        <torusGeometry args={[archR, archT, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#006400" metalness={0.0} roughness={0.7} emissive="#39FF14" emissiveIntensity={0.08} />
      </mesh>
    );
  }

  // 2-3 root buttresses at base of tower
  const buttressCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < buttressCount; i++) {
    const ba = rng() * Math.PI * 2;
    const bl = (0.1 + rng() * 0.04) * scale;
    const bw = 0.012 * scale;
    const bh = 0.025 * scale;
    const bDist = (0.06 + rng() * 0.04) * scale;
    const bx = txB + Math.cos(ba) * bDist;
    const by = tyB + Math.sin(ba) * bDist;
    if (Math.abs(bx) < 0.4 * scale && Math.abs(by) < 0.4 * scale) {
      const lean = (Math.PI / 6) + rng() * Math.PI / 12; // ~30-45°
      meshes.push(
        <mesh key={key++} position={[bx, by, bh / 2]} rotation={[lean, 0, ba]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={[bw, bl, bh]} />
          <meshStandardMaterial color="#4A2F1A" metalness={0.0} roughness={0.9} />
        </mesh>
      );
    }
  }

  // 1 dome cap over a low platform
  const domeR = (0.06 + rng() * 0.04) * scale;
  const dcx = (rng() - 0.5) * 0.45 * scale;
  const dcy = (rng() - 0.5) * 0.45 * scale;
  if (Math.abs(dcx) < 0.38 * scale && Math.abs(dcy) < 0.38 * scale) {
    // Base platform
    meshes.push(
      <mesh key={key++} position={[dcx, dcy, 0.015 * scale]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[domeR * 1.1, domeR * 1.2, 0.03 * scale, 8]} />
        <meshStandardMaterial color="#006400" metalness={0.0} roughness={0.85} />
      </mesh>
    );
    // Dome cap
    meshes.push(
      <mesh key={key++} position={[dcx, dcy, 0.03 * scale]} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[domeR, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#006400" metalness={0.0} roughness={0.75} emissive="#39FF14" emissiveIntensity={0.12} />
      </mesh>
    );
  }

  return meshes;
}

// ─── Neural Hub (Orange / Neural) ─────────────────────────────────────────────

function renderNeuralHub(rng, count, scale) {
  const meshes = [];
  let key = 0;

  // 2 signal towers with floating rings
  const towerData = [];
  for (let i = 0; i < 2; i++) {
    const th = (0.25 + rng() * 0.25) * scale;
    const tr = 0.013 * scale;
    const tx = (rng() - 0.5) * 0.55 * scale;
    const ty = (rng() - 0.5) * 0.55 * scale;
    if (Math.abs(tx) < 0.38 * scale && Math.abs(ty) < 0.38 * scale) {
      towerData.push({ x: tx, y: ty, h: th });
      // Tower body
      meshes.push(
        <mesh key={key++} position={[tx, ty, th / 2]} castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[tr * 0.75, tr, th, 6]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.6} roughness={0.4} />
        </mesh>
      );
      // Floating ring at top
      const ringR = 0.035 * scale;
      const ringT = 0.012 * scale;
      meshes.push(
        <mesh key={key++} position={[tx, ty, th + ringR * 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
          <ringGeometry args={[ringR, ringR + ringT, 16]} />
          <meshStandardMaterial color="#8B00FF" metalness={0.6} roughness={0.3} emissive="#8B00FF" emissiveIntensity={0.25} side={2} />
        </mesh>
      );
    }
  }

  // 1-2 antenna clusters
  const clusterCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < clusterCount; i++) {
    const cx = (rng() - 0.5) * 0.55 * scale;
    const cy = (rng() - 0.5) * 0.55 * scale;
    const antennaCount = 4 + Math.floor(rng() * 3);
    for (let j = 0; j < antennaCount; j++) {
      const ah = (0.1 + rng() * 0.2) * scale;
      const ar = 0.004 * scale;
      const aox = (rng() - 0.5) * 0.04 * scale;
      const aoy = (rng() - 0.5) * 0.04 * scale;
      const ax = cx + aox;
      const ay = cy + aoy;
      const tiltX = (rng() - 0.5) * 0.7; // ±20°
      const tiltZ = (rng() - 0.5) * 0.7;
      if (Math.abs(ax) < 0.4 * scale && Math.abs(ay) < 0.4 * scale) {
        meshes.push(
          <mesh key={key++} position={[ax, ay, ah / 2]} rotation={[tiltX, 0, tiltZ]} castShadow={false} receiveShadow={false}>
            <cylinderGeometry args={[ar, ar, ah, 4]} />
            <meshStandardMaterial color="#1A1A2E" metalness={0.6} roughness={0.4} emissive="#FF6B00" emissiveIntensity={0.1} />
          </mesh>
        );
      }
    }
  }

  // 1 data bridge connecting towers if close enough
  if (towerData.length === 2) {
    const [t1, t2] = towerData;
    const bridgeH = Math.min(t1.h, t2.h) * 0.75;
    const dx = t2.x - t1.x;
    const dy = t2.y - t1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.05 * scale && dist < 0.6 * scale) {
      const angle = Math.atan2(dy, dx);
      const mx = (t1.x + t2.x) / 2;
      const my = (t1.y + t2.y) / 2;
      meshes.push(
        <mesh key={key++} position={[mx, my, bridgeH]} rotation={[0, 0, angle]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={[dist, 0.007 * scale, 0.007 * scale]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.6} roughness={0.4} emissive="#8B00FF" emissiveIntensity={0.1} />
        </mesh>
      );
    }
  }

  // 2-3 hub nodes
  const hubCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < hubCount; i++) {
    const hr = 0.03 * scale;
    const hx = (rng() - 0.5) * 0.7 * scale;
    const hy = (rng() - 0.5) * 0.7 * scale;
    const hz = (0.05 + rng() * 0.15) * scale;
    if (Math.abs(hx) < 0.4 * scale && Math.abs(hy) < 0.4 * scale) {
      meshes.push(
        <mesh key={key++} position={[hx, hy, hz]} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[hr, 8, 8]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.6} roughness={0.4} emissive="#8B00FF" emissiveIntensity={0.25} />
        </mesh>
      );
    }
  }

  return meshes;
}

// ─── Dispatch map ─────────────────────────────────────────────────────────────

const CITY_RENDERERS = {
  frozenCitadel: renderFrozenCitadel,
  deepStation: renderDeepStation,
  volcanicFoundry: renderVolcanicFoundry,
  solarArcology: renderSolarArcology,
  bioDome: renderBioDome,
  neuralHub: renderNeuralHub,
};

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CityBuildings
 * Renders procedural 3D buildings for one tile of one city.
 * Mount as a sibling of StickerPlane at the same position/rotation.
 * Buildings extrude in local +Z starting at z=0.015.
 *
 * Props:
 *   cityKey   {string}  — key from CITY_CONFIG (e.g. 'frozenCitadel')
 *   tileIndex {number}  — 0-based tile position on face (row * dim + col)
 *   faceId    {number}  — 1–6, used in combined seed
 *   gridDim   {number}  — 2|3|4|5
 *   scale     {number}  — tile size normalization factor (tileWidth / 0.9)
 */
export function CityBuildings({ cityKey, tileIndex, faceId, gridDim, scale = 1 }) {
  const meshes = useMemo(() => {
    const renderer = CITY_RENDERERS[cityKey];
    if (!renderer) return [];
    const seed = faceId * 10000 + tileIndex;
    const rng = mulberry32(seed);
    const count = getBuildingCount(gridDim);
    return renderer(rng, count, scale);
  }, [cityKey, tileIndex, faceId, gridDim, scale]);

  return (
    <group position={[0, 0, 0.015]}>
      {meshes}
    </group>
  );
}

export default React.memo(CityBuildings);
