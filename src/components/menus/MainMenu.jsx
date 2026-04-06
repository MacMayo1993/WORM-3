import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import IntroCubie from '../intro/IntroCubie.jsx';
import ParityWallet from '../overlays/ParityWallet.jsx';
import { updateSharedTime } from '../../3d/styles/TileStyleMaterials.jsx';

// All available manifold element styles — one will be picked at random per face
const ALL_STYLES = [
  'circuit', 'holographic', 'pulse', 'neural',
  'lava', 'galaxy', 'ice', 'water', 'wood', 'grass', 'sand',
  'vortex', 'shockwave', 'moireRings', 'moireLines', 'infinityTunnel',
  'polkaDots', 'zigzag', 'checkerboard', 'diagStripes', 'hexGrid',
  'opConcentric', 'opRadialSpokes', 'opDiamondWave', 'opPinwheel',
  'opChevronBands', 'opBullseyeSteps', 'opTiltMosaic', 'opWarpGrid',
  'carbonFiber', 'metallic', 'glossy',
  'prismBloom', 'magnetFlux', 'liquidChrome', 'auroraWeave', 'plasmaCells',
  'quantumScanlines', 'emberstorm', 'fractalPulse', 'bioLattice', 'stellarLensing',
];

const FACE_DIRS = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];

// ─── Per-face independent pulse timing ────────────────────────────────────────
// Each of the 6 faces gets its own phase offset so all 6 colors are always
// visible — staggered evenly across one full cycle (PULSE_CYCLE seconds).
const PULSE_CYCLE = 3.6;   // full repeat period per face (seconds)
const PULSE_DUR   = 0.90;  // active window within each cycle

// Phase offsets: antipodal pairs fire together (0° apart), pairs 60° apart each.
const FACE_PHASE = {
  PZ:  0.0,                   // Red
  NZ:  0.0,                   // Orange  (antipodal to Red, same phase)
  PX:  PULSE_CYCLE / 3,       // Blue
  NX:  PULSE_CYCLE / 3,       // Green   (antipodal to Blue, same phase)
  PY:  (PULSE_CYCLE / 3) * 2, // White
  NY:  (PULSE_CYCLE / 3) * 2, // Yellow  (antipodal to White, same phase)
};

const FACE_COLOR = {
  PX: '#3b82f6', NX: '#22c55e',
  PZ: '#ef4444', NZ: '#f97316',
  PY: '#eeeeee', NY: '#eab308',
};
// Face centers of a 3×3 cube (cubies at –1,0,+1 → surface at ±1.5)
// Ring plane faces outward, so we rotate to match the outward normal
const FACE_CFG = {
  PX: { pos: [1.52, 0, 0], rot: [0, Math.PI / 2, 0] },
  NX: { pos: [-1.52, 0, 0], rot: [0, -Math.PI / 2, 0] },
  PY: { pos: [0, 1.52, 0], rot: [-Math.PI / 2, 0, 0] },
  NY: { pos: [0, -1.52, 0], rot: [Math.PI / 2, 0, 0] },
  PZ: { pos: [0, 0, 1.52], rot: [0, 0, 0] },
  NZ: { pos: [0, 0, -1.52], rot: [0, Math.PI, 0] },
};
const FACE_KEYS = Object.keys(FACE_CFG);

// ─── Shared pulse state — written by FacePulses (WebGL), read by ScreenGlow (DOM) ──
// Per-face rawP values (0→1) so all 6 colors are always independently visible.
const _pulsePerFace = { PX: 0, NX: 0, PY: 0, NY: 0, PZ: 0, NZ: 0 };

// Screen-edge gradient per face: each face maps to the screen region it faces.
// PZ/NZ (front/back) use left/right edges since they have no top-bottom screen axis.
const FACE_SCREEN_GRADIENT = {
  PY: c => `radial-gradient(ellipse 120% 55% at 50% 0%,   ${c} 0%, transparent 68%)`,
  NY: c => `radial-gradient(ellipse 120% 55% at 50% 100%, ${c} 0%, transparent 68%)`,
  PX: c => `radial-gradient(ellipse 55% 120% at 100% 50%, ${c} 0%, transparent 68%)`,
  NX: c => `radial-gradient(ellipse 55% 120% at 0%   50%, ${c} 0%, transparent 68%)`,
  PZ: c => `radial-gradient(ellipse 55% 120% at 12%  50%, ${c} 0%, transparent 68%)`,
  NZ: c => `radial-gradient(ellipse 55% 120% at 88%  50%, ${c} 0%, transparent 68%)`,
};

// DOM overlay — reads _pulsePerFace via rAF and updates div opacity directly (no React state)
const ScreenGlow = () => {
  const divRefs = useRef({});
  useEffect(() => {
    let raf;
    // Track previous per-face values to skip no-op DOM writes
    const prev = { PX: -1, NX: -1, PY: -1, NY: -1, PZ: -1, NZ: -1 };
    const tick = () => {
      FACE_KEYS.forEach(face => {
        const rawP = _pulsePerFace[face];
        if (rawP === prev[face]) return;
        prev[face] = rawP;
        const el = divRefs.current[face];
        if (!el) return;
        const bell = rawP < 0.30 ? rawP / 0.30 : (1 - rawP) / 0.70;
        el.style.opacity = String(Math.max(0, bell) * 0.22);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      {FACE_KEYS.map(face => (
        <div
          key={face}
          ref={el => { divRefs.current[face] = el; }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
            opacity: 0,
            background: FACE_SCREEN_GRADIENT[face](FACE_COLOR[face]),
          }}
        />
      ))}
    </>
  );
};

// ─── Ray strand system — shoots outward from tile gaps like antipodal tunnel effects ──
// In face-group local space: +Z is outward (face normal), XY is the face plane.
// Strands originate from the 4 tile gap lines (# positions at ±0.5) and curve outward.
const RAY_STRANDS = 14;   // per face — distributed across the 4 tile gap lines
const RAY_PTS = 24;   // curve sample points per strand (more segments = worm-like motion)
const WORM_BALLS = 7; // bead count per strand body

// Pre-computed per-face strand paths — originate from the # grid lines at ±0.5 and
// curve outward along the face normal (+Z), like light leaking through the tile seams.
const _faceRayConfigs = (() => {
  const rng = (() => { let s = 42; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  const result = {};
  FACE_KEYS.forEach(face => {
    result[face] = Array.from({ length: RAY_STRANDS }, (_, i) => {
      // Distribute evenly across the 4 # lines (tile gaps at sx=±0.5 and sy=±0.5)
      const line = i % 4;
      const slot = Math.floor(i / 4);
      const slotsPerLine = Math.ceil(RAY_STRANDS / 4);  // 3 for 10 strands
      const along = slotsPerLine > 1
        ? (slot / (slotsPerLine - 1) - 0.5) * 2.6       // –1.3 … +1.3 along the gap line
        : 0;

      let sx, sy;
      if (line === 0) { sx = along; sy = 0.5; }
      else if (line === 1) { sx = along; sy = -0.5; }
      else if (line === 2) { sx = 0.5; sy = along; }
      else { sx = -0.5; sy = along; }

      const len = 1.4 + rng() * 1.8;
      const cpXOff = (rng() - 0.5) * 0.7;
      const cpYOff = (rng() - 0.5) * 0.7;
      const tipXOff = (rng() - 0.5) * 0.5;
      const tipYOff = (rng() - 0.5) * 0.5;

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx, sy, 0.06),
        new THREE.Vector3(sx + cpXOff, sy + cpYOff, len * 0.45),
        new THREE.Vector3(sx + tipXOff, sy + tipYOff, len)
      );

      const pts = curve.getPoints(RAY_PTS - 1);
      const basePts = new Float32Array(RAY_PTS * 3);
      pts.forEach((p, j) => { basePts[j * 3] = p.x; basePts[j * 3 + 1] = p.y; basePts[j * 3 + 2] = p.z; });

      // Per-strand wobble profile used to sculpt a moving worm body along the sine rays.
      const wiggleDirAngle = rng() * Math.PI * 2;
      const wiggleDirX = Math.cos(wiggleDirAngle);
      const wiggleDirY = Math.sin(wiggleDirAngle);

      return {
        id: i,
        basePts,
        sparkOffset: rng() * Math.PI * 2,
        wiggleAmp: 0.035 + rng() * 0.045,
        wiggleFreq: 1.7 + rng() * 1.9,
        wiggleSpeed: 3.4 + rng() * 2.8,
        wiggleDirX,
        wiggleDirY,
      };
    });
  });
  return result;
})();

// Pre-computed Three.js color objects — no allocations in useFrame
const _faceColorObj = {};
FACE_KEYS.forEach(face => { _faceColorObj[face] = new THREE.Color(FACE_COLOR[face]); });

const FacePulses = () => {
  const lineRefs = useRef({});   // face → [line, ...]  (arrays)
  const ballRefs = useRef({});   // face → [instancedMesh, ...]
  const lightRefs = useRef({});
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    FACE_KEYS.forEach(face => {
      // Each face runs on its own clock offset by FACE_PHASE[face]
      const tFace = (t + FACE_PHASE[face]) % PULSE_CYCLE;
      const rawP = tFace < PULSE_DUR ? tFace / PULSE_DUR : 1.0;

      // Write per-face rawP for ScreenGlow to read
      _pulsePerFace[face] = rawP;

      const lines = lineRefs.current[face];
      const light = lightRefs.current[face];

      if (!lines?.length) return;

      if (rawP >= 1.0) {
        lines.forEach(l => { if (l) l.visible = false; });
        ballRefs.current[face]?.forEach(b => { if (b) b.visible = false; });
        if (light) light.intensity = 0;
        return;
      }

      const col = _faceColorObj[face];
      const configs = _faceRayConfigs[face];

      // Strands shoot outward in first half of pulse, then fade out in second half
      const growth = Math.min(rawP * 2.2, 1.0);   // 0→1 over ~45% of pulse
      const fade = rawP > 0.5 ? 1 - (rawP - 0.5) * 2 : 1.0;
      const overall = Math.max(0, fade) * 0.85;

      lines.forEach((line, i) => {
        if (!line) return;
        const cfg = configs[i];

        // Sparkle shimmer
        const spark = 0.8 + Math.sin(t * 5.5 + cfg.sparkOffset) * 0.2;
        line.material.opacity = overall * spark;
        line.visible = overall > 0.01;
        const balls = ballRefs.current[face]?.[i];
        if (balls) balls.visible = overall > 0.01;

        // Growth: clip strand at current growth progress; collapsed points → tip of visible segment.
        // Add a moving sinusoidal offset + segmented luminance for a worm-body look.
        const pos = line.geometry.attributes.position.array;
        const base = cfg.basePts;
        const visibleEnd = growth * (RAY_PTS - 1);  // last visible point index (float)

        for (let j = 0; j < RAY_PTS; j++) {
          const clampedJ = Math.min(j, visibleEnd);
          const lo = Math.floor(clampedJ);
          const hi = Math.min(lo + 1, RAY_PTS - 1);
          const f = clampedJ - lo;
          const baseX = base[lo * 3] + (base[hi * 3] - base[lo * 3]) * f;
          const baseY = base[lo * 3 + 1] + (base[hi * 3 + 1] - base[lo * 3 + 1]) * f;
          const baseZ = base[lo * 3 + 2] + (base[hi * 3 + 2] - base[lo * 3 + 2]) * f;

          const u = clampedJ / (RAY_PTS - 1);
          const bodyEnvelope = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.95;
          const crawlWave = Math.sin(u * cfg.wiggleFreq * Math.PI * 2 - t * cfg.wiggleSpeed + cfg.sparkOffset);
          const wormOffset = bodyEnvelope * crawlWave * cfg.wiggleAmp;

          pos[j * 3] = baseX + cfg.wiggleDirX * wormOffset;
          pos[j * 3 + 1] = baseY + cfg.wiggleDirY * wormOffset;
          pos[j * 3 + 2] = baseZ;
        }
        line.geometry.attributes.position.needsUpdate = true;

        const colors = line.geometry.attributes.color.array;
        const headU = growth;
        for (let j = 0; j < RAY_PTS; j++) {
          const u = j / (RAY_PTS - 1);
          const tail = Math.pow(Math.max(0, 1 - u), 0.4);
          const segmentBand = 0.72 + 0.28 * Math.sin(u * 26 - t * 12 + cfg.sparkOffset);
          const headGlow = Math.exp(-Math.pow((u - headU) / 0.12, 2)) * 0.65;
          const glow = tail * segmentBand + headGlow;
          colors[j * 3] = col.r * glow;
          colors[j * 3 + 1] = col.g * glow;
          colors[j * 3 + 2] = col.b * glow;
        }
        line.geometry.attributes.color.needsUpdate = true;

        // Worm body beads: instanced spheres distributed from head backward.
        if (balls) {
          for (let b = 0; b < WORM_BALLS; b++) {
            const behind = b / Math.max(1, WORM_BALLS - 1);
            const u = Math.max(0, growth - behind * 0.22);
            const pt = u * (RAY_PTS - 1);
            const lo = Math.floor(pt);
            const hi = Math.min(lo + 1, RAY_PTS - 1);
            const f = pt - lo;
            const x = pos[lo * 3] + (pos[hi * 3] - pos[lo * 3]) * f;
            const y = pos[lo * 3 + 1] + (pos[hi * 3 + 1] - pos[lo * 3 + 1]) * f;
            const z = pos[lo * 3 + 2] + (pos[hi * 3 + 2] - pos[lo * 3 + 2]) * f;

            const headT = 1 - behind;
            const scale = (0.018 + headT * 0.03) * (0.65 + overall * 0.7);
            tempObj.position.set(x, y, z);
            tempObj.scale.setScalar(scale);
            tempObj.updateMatrix();
            balls.setMatrixAt(b, tempObj.matrix);
          }
          balls.instanceMatrix.needsUpdate = true;
        }
      });

      if (light) {
        const lc = rawP < 0.25 ? rawP / 0.25 : Math.pow(1 - rawP, 0.6);
        light.intensity = Math.max(0, lc) * 2.0;
      }
    });
  });

  return (
    <>
      {FACE_KEYS.map(face => {
        const { pos, rot } = FACE_CFG[face];
        const col = FACE_COLOR[face];
        const lightPos = pos.map(v => v * 2.6);
        const configs = _faceRayConfigs[face];
        return (
          <group key={face}>
            <pointLight
              ref={el => { lightRefs.current[face] = el; }}
              position={lightPos} color={col} intensity={0} distance={10} decay={2}
            />
            <group position={pos} rotation={rot}>
              {configs.map((cfg, i) => (
                <line
                  key={cfg.id}
                  ref={el => {
                    if (!lineRefs.current[face]) lineRefs.current[face] = [];
                    lineRefs.current[face][i] = el;
                  }}
                  visible={false}
                >
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={RAY_PTS}
                      array={new Float32Array(RAY_PTS * 3)} itemSize={3} usage={THREE.DynamicDrawUsage} />
                    <bufferAttribute attach="attributes-color" count={RAY_PTS}
                      array={new Float32Array(RAY_PTS * 3)} itemSize={3} usage={THREE.DynamicDrawUsage} />
                  </bufferGeometry>
                  <lineBasicMaterial vertexColors transparent opacity={0} depthWrite={false} />
                </line>
              ))}
              {configs.map((cfg, i) => (
                <instancedMesh
                  key={`balls-${cfg.id}`}
                  ref={el => {
                    if (!ballRefs.current[face]) ballRefs.current[face] = [];
                    ballRefs.current[face][i] = el;
                  }}
                  args={[null, null, WORM_BALLS]}
                  visible={false}
                >
                  <sphereGeometry args={[1, 9, 9]} />
                  <meshStandardMaterial
                    color={col}
                    emissive={col}
                    emissiveIntensity={1.0}
                    transparent
                    opacity={0.88}
                    roughness={0.2}
                    metalness={0.0}
                    depthWrite={false}
                  />
                </instancedMesh>
              ))}
            </group>
          </group>
        );
      })}
    </>
  );
};

const SolvedCube = () => {
  const items = useMemo(() => {
    const result = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          result.push({ key: `${x}-${y}-${z}`, pos: [x - 1, y - 1, z - 1] });
    return result;
  }, []);

  // One random manifold style per face direction, chosen once on mount.
  // All 9 cubies on the same face share the same style → solved cube appearance.
  const faceStyles = useMemo(() => {
    const styles = {};
    // Shuffle ALL_STYLES so each face gets a unique style
    const pool = [...ALL_STYLES].sort(() => Math.random() - 0.5);
    FACE_DIRS.forEach((dir, i) => { styles[dir] = pool[i % pool.length]; });
    return styles;
  }, []);

  return (
    <>
      {items.map(it => (
        <IntroCubie
          key={it.key}
          position={it.pos}
          size={3}
          explosionFactor={0}
          faceStyles={faceStyles}
          cubieFlips={{}}
          antipodalSwaps={{}}
        />
      ))}
    </>
  );
};

// Exactly mirrors the intro rotation: y = t*0.28, x = sin(t*0.15)*0.12
// Exported so App.jsx can render it inside the single shared Canvas
export const RotatingBlackCube = () => {
  const groupRef = useRef();
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.28;
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.12;
    // Drive animated tile style shaders (lava, galaxy, circuit, etc.)
    updateSharedTime(t);
  });
  return (
    <group ref={groupRef} position={[0, 0.15, 0]}>
      <SolvedCube />
      <FacePulses />
    </group>
  );
};

// ─── Coming Soon data ─────────────────────────────────────────────────────────
const COMING_SOON = [
  {
    id: 'story',
    label: 'Story Mode',
    color: '#ef4444',
    icon: '📖',
    preview: 'linear-gradient(135deg,#ef444422 0%,#f9731622 100%)',
    description: 'Ten levels. A cube that remembers every move. A narrative written in rotations. The beginning of everything.',
  },
  {
    id: 'holonomy',
    label: '∮ Holonomy',
    color: '#00f5ff',
    icon: '∮',
    preview: 'linear-gradient(135deg,#00f5ff18 0%,#0080ff18 100%)',
    description: 'Move a loop around the cube and watch it come back changed. A mode built on the mathematics of curvature.',
  },
  {
    id: 'biome',
    label: 'Biome',
    color: '#60a5fa',
    icon: '⬡',
    preview: 'linear-gradient(135deg,#60a5fa18 0%,#22c55e18 100%)',
    description: 'A living world grows on the surface of RP². Each face a different ecosystem. Navigate a topology that breathes.',
  },
  {
    id: 'merge',
    label: 'Merge',
    color: '#a78bfa',
    icon: '✦',
    preview: 'linear-gradient(135deg,#a78bfa18 0%,#ec489918 100%)',
    description: 'Two cubes. One truth. Combine solved states across the manifold boundary into something that has never existed.',
  },
];

// ─── Coming Soon card ─────────────────────────────────────────────────────────
const ComingSoonCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(v => !v)}
      style={{
        flexShrink: 0,
        width: '140px',
        background: item.preview,
        border: `1px solid ${item.color}30`,
        borderRadius: '14px',
        padding: '14px 12px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.25s ease',
        boxShadow: expanded ? `0 0 18px ${item.color}30, 0 4px 16px rgba(0,0,0,0.5)` : '0 2px 10px rgba(0,0,0,0.35)',
        transform: expanded ? 'translateY(-2px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Silhouette icon */}
      <div style={{
        fontSize: '28px', lineHeight: 1, marginBottom: '8px',
        filter: 'grayscale(1) opacity(0.45)',
        display: 'flex', alignItems: 'center',
      }}>
        {item.icon}
      </div>
      {/* Mode name */}
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: `${item.color}99`,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        marginBottom: expanded ? '8px' : 0,
        transition: 'margin 0.2s ease',
      }}>{item.label}</div>
      {/* Coming soon badge */}
      {!expanded && (
        <div style={{
          fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: `${item.color}55`,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
          marginTop: '4px',
        }}>Coming Soon</div>
      )}
      {/* Description (expanded) */}
      {expanded && (
        <div style={{
          fontSize: '11px', lineHeight: 1.5,
          color: 'rgba(200,220,255,0.75)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
          animation: 'fadeIn 0.2s ease',
        }}>{item.description}</div>
      )}
      {/* Subtle color wash on expanded */}
      {expanded && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: `radial-gradient(ellipse 100% 80% at 50% 0%, ${item.color}14 0%, transparent 70%)`,
        }} />
      )}
    </button>
  );
};

// ─── Coming Soon drawer ───────────────────────────────────────────────────────
const ComingSoonDrawer = ({ visible }) => {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setPulse(true), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div style={{
      position: 'absolute', bottom: '84px', left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(10px)',
      transition: 'opacity 0.55s ease 0.3s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.3s',
      pointerEvents: visible ? 'all' : 'none',
    }}>
      {/* Drawer toggle label */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
          borderRadius: '20px',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,160,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
          color: pulse ? 'rgba(180,210,255,0.70)' : 'rgba(140,170,255,0.45)',
          transition: 'color 0.6s ease',
        }}>What&apos;s Coming</span>
      </button>

      {/* Cards panel */}
      <div style={{
        maxHeight: open ? '220px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.22,1,0.36,1)',
        width: '100%',
      }}>
        <div style={{
          display: 'flex', gap: '10px', overflowX: 'auto', padding: '12px 20px 4px',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          justifyContent: 'center',
          flexWrap: 'nowrap',
        }}>
          {COMING_SOON.map(item => (
            <ComingSoonCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Coming Soon button ───────────────────────────────────────────────────────
const ComingSoonButton = ({ onPress }) => {
  const [hovered, setHovered] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 1200);
    const interval = setInterval(() => setPulse(v => !v), 3000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  return (
    <div style={{
      borderRadius: '100px', padding: '1.5px',
      background: hovered
        ? 'linear-gradient(90deg,#a855f780,#3b82f680,#22c55e80,#a855f780)'
        : 'linear-gradient(90deg,#a855f740,#3b82f640,#22c55e40,#a855f740)',
      boxShadow: hovered
        ? '0 0 18px rgba(168,85,247,0.30), 0 4px 16px rgba(0,0,0,0.45)'
        : '0 0 8px rgba(168,85,247,0.12), 0 2px 10px rgba(0,0,0,0.35)',
      transition: 'all 0.22s ease',
    }}>
      <button
        onClick={onPress}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 20px',
          background: hovered ? 'rgba(14,10,32,0.92)' : 'rgba(6,10,24,0.82)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: 'none',
          borderRadius: '100px',
          cursor: 'pointer',
          transition: 'background 0.22s ease',
        }}
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: pulse ? 'rgba(168,85,247,0.9)' : 'rgba(168,85,247,0.5)',
          boxShadow: pulse ? '0 0 8px rgba(168,85,247,0.8)' : 'none',
          transition: 'all 0.6s ease',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: hovered ? 'rgba(200,225,255,0.95)' : 'rgba(170,200,255,0.82)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
          transition: 'color 0.2s ease',
        }}>What&apos;s Coming</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: hovered ? 0.8 : 0.55, transition: 'opacity 0.2s ease' }}>
          <path d="M4.5 2.5L8 6L4.5 9.5" stroke="rgba(180,210,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

// ─── Nav items ────────────────────────────────────────────────────────────────
const NavItem = ({ icon, label, color, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '8px', padding: '14px 12px 12px',
        background: hovered ? `${color}20` : 'transparent',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.2s ease',
        position: 'relative',
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: `radial-gradient(ellipse 80% 120% at 50% 0%, ${color}25 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}
      <span style={{
        lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: hovered ? `drop-shadow(0 0 8px ${color}cc)` : `drop-shadow(0 0 4px ${color}55)`,
        transition: 'filter 0.2s ease',
      }}>{icon}</span>
      <span style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: hovered ? color : 'rgba(200,220,255,0.75)',
        transition: 'color 0.2s ease',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}>{label}</span>
    </button>
  );
};

// ─── Store nav item ───────────────────────────────────────────────────────────
const StoreNavItem = ({ onStore }) => {
  const color = '#6366f1';
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={onStore}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', padding: '14px 12px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          position: 'relative', opacity: 0.85,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}
      >
        <span style={{
          lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: `drop-shadow(0 0 6px ${color}66)`,
        }}>
          <StoreIcon />
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#818cf8',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        }}>Store</span>
        <ParityWallet dark={true} />
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
// onPlay / onHolonomy / onBiome / onMerge are kept as props for UILayer compatibility
// but are no longer wired to buttons — those modes live in the Coming Soon screen.
const MainMenu = ({ onPlay: _onPlay, _onLevels, onFreeplay, _onCoop, onSettings: _onSettings, onBiome: _onBiome, onDisparity, onWormHealer, onHolonomy: _onHolonomy, onMerge: _onMerge, onStore, onComingSoon, onMobiusCubelet }) => {
  const CLEAN = {
    panel: 'rgba(8,12,28,0.68)',
    panelStrong: 'rgba(10,14,32,0.80)',
    text: 'rgba(230,240,255,0.95)',
    textSubtle: 'rgba(180,210,255,0.65)',
    border: 'rgba(120,160,255,0.22)',
  };
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const [hoverWorm, setHoverWorm] = useState(false);
  const [pressWorm, setPressWorm] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t2 = setTimeout(() => setSubtitleVisible(true), 500);
    const t3 = setTimeout(() => setBtnVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>

      <ScreenGlow />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-18px)',
          transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
          paddingLeft: '16px', paddingRight: '16px',
        }}>
          {/* Frosted glass card so the title and subtitle are readable over any background */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(6,10,24,0.72)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '24px',
            padding: '18px 28px 16px',
            border: '1px solid rgba(120,160,255,0.14)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.10)',
          }}>
            <h1 style={{
              margin: 0, fontSize: 'clamp(54px,13vw,96px)', fontWeight: 900,
              letterSpacing: '0.1em', lineHeight: 1, fontFamily: "'Courier New', monospace",
              background: 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              WORM<sup style={{ fontSize: '0.42em', verticalAlign: 'super', WebkitTextFillColor: 'transparent' }}>3</sup>
            </h1>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '14px',
              opacity: subtitleVisible ? 1 : 0,
              transform: subtitleVisible ? 'none' : 'translateY(6px)',
              transition: 'all 0.55s ease 0.1s',
            }}>
              <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to right, transparent, rgba(140,180,255,0.55))' }} />
              <p style={{
                margin: 0, fontSize: 'clamp(10px,1.7vw,13px)', letterSpacing: '0.26em',
                textTransform: 'uppercase', fontWeight: 600, color: 'rgba(200,220,255,0.92)',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
                textShadow: '0 0 20px rgba(100,160,255,0.6)',
              }}>A Cube That Remembers</p>
              <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to left, transparent, rgba(140,180,255,0.55))' }} />
            </div>
          </div>
        </div>

        {/* ── Bottom CTA stack: Play WORM → What's Coming → Nav pill ── */}
        {/* Single flex column so everything scales together on any screen size */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          paddingLeft: '16px', paddingRight: '16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '10px',
          pointerEvents: 'all',
          opacity: btnVisible ? 1 : 0,
          transform: btnVisible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
        }}>

          {/* Play WORM hero button */}
          <div style={{
            width: 'min(400px, 100%)',
            borderRadius: '100px', padding: '1.5px',
            background: hoverWorm
              ? 'linear-gradient(90deg,#a855f7,#ec4899,#f97316,#a855f7)'
              : 'linear-gradient(90deg,#a855f760,#ec489960,#f9731660,#a855f760)',
            boxShadow: hoverWorm
              ? '0 0 32px rgba(168,85,247,0.55), 0 0 60px rgba(168,85,247,0.20), 0 8px 32px rgba(0,0,0,0.5)'
              : '0 0 14px rgba(168,85,247,0.22), 0 4px 16px rgba(0,0,0,0.4)',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            transform: pressWorm ? 'scale(0.975)' : hoverWorm ? 'translateY(-2px)' : 'none',
          }}>
            <button onClick={onWormHealer}
              onMouseEnter={() => setHoverWorm(true)}
              onMouseLeave={() => { setHoverWorm(false); setPressWorm(false); }}
              onMouseDown={() => setPressWorm(true)} onMouseUp={() => setPressWorm(false)}
              onTouchStart={() => setPressWorm(true)} onTouchEnd={() => setPressWorm(false)}
              style={{
                width: '100%', padding: '16px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontSize: 'clamp(13px,2.4vw,15px)', fontWeight: 700, letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
                color: hoverWorm ? '#ffffff' : 'rgba(220,200,255,0.92)',
                background: hoverWorm ? 'rgba(28,12,48,0.90)' : 'rgba(14,8,28,0.75)',
                border: 'none', borderRadius: '100px', cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 1px 0 rgba(168,85,247,0.25)',
              }}>
              <WormIcon color={hoverWorm ? '#ffffff' : '#d8b4fe'} />
              Play WORM
            </button>
          </div>

          {/* What's Coming pill */}
          <ComingSoonButton onPress={onComingSoon} />

          {/* Möbius Cubelet visualizer link */}
          {onMobiusCubelet && (
            <div style={{
              borderRadius: '100px', padding: '1.5px',
              background: 'linear-gradient(90deg,rgba(99,102,241,0.45),rgba(139,92,246,0.45),rgba(99,102,241,0.45))',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
            }}>
              <button
                onClick={onMobiusCubelet}
                style={{
                  background: 'rgba(6,10,24,0.82)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '7px 18px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'rgba(180,200,255,0.85)',
                  fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
                  letterSpacing: '0.08em',
                  transition: 'color 0.2s ease, background 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'rgba(220,235,255,0.96)';
                  e.currentTarget.style.background = 'rgba(14,10,32,0.92)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(180,200,255,0.85)';
                  e.currentTarget.style.background = 'rgba(6,10,24,0.82)';
                }}
              >
                ∞ Möbius Cubelet
              </button>
            </div>
          )}

          {/* Bottom nav pill: Disparity | Explore | Store */}
          <div style={{
            borderRadius: '100px', padding: '1.5px',
            background: 'linear-gradient(90deg,#ef444460,#f9731660,#eab30860,#22c55e60,#3b82f660,#a855f760,#ef444460)',
            boxShadow: '0 0 20px rgba(60,80,200,0.25), 0 8px 32px rgba(0,0,0,0.5)',
            width: 'min(360px, 100%)',
          }}>
            <div style={{
              display: 'flex',
              background: 'rgba(6,10,24,0.80)',
              backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
              borderRadius: '100px',
              boxShadow: 'inset 0 1px 0 rgba(120,160,255,0.14)',
              overflow: 'visible',
            }}>
              <NavItem icon={<DisparityIcon />} label="Disparity" color="#f59e0b" onClick={onDisparity} />
              <div style={{ width: '1px', alignSelf: 'stretch', margin: '10px 0', background: 'rgba(120,160,255,0.15)' }} />
              <NavItem icon={<ExploreIcon />} label="Explore" color="#22c55e" onClick={onFreeplay} />
              <div style={{ width: '1px', alignSelf: 'stretch', margin: '10px 0', background: 'rgba(120,160,255,0.15)' }} />
              <StoreNavItem onStore={onStore} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlayIcon = ({ hovered }) => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
    <polygon points="2,1 11,6 2,11" fill={hovered ? '#ffffff' : 'rgba(200,220,255,0.9)'} style={{ transition: 'fill 0.2s' }} />
  </svg>
);
const DisparityIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="5" r="1.8" fill="#f59e0b" />
    <circle cx="19" cy="5" r="1.8" fill="#f59e0b" opacity="0.5" />
    <circle cx="12" cy="12" r="1.8" fill="#f59e0b" />
    <circle cx="5" cy="19" r="1.8" fill="#f59e0b" opacity="0.5" />
    <circle cx="19" cy="19" r="1.8" fill="#f59e0b" />
    <line x1="5" y1="5" x2="19" y2="19" stroke="#f59e0b" strokeWidth="1.2" opacity="0.4" />
    <line x1="19" y1="5" x2="5" y2="19" stroke="#f59e0b" strokeWidth="1.2" opacity="0.4" />
  </svg>
);
const WormIcon = ({ color = '#a855f7' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M4 12 Q8 4 12 12 T20 12" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="20" cy="12" r="2.5" fill={color} />
  </svg>
);
const StoreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="10" width="18" height="11" rx="2" stroke="#6366f1" strokeWidth="1.5" fill="none" />
    <path d="M3 10 L5 4 H19 L21 10" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    <line x1="12" y1="10" x2="12" y2="21" stroke="#6366f1" strokeWidth="1.2" opacity="0.5" />
    <circle cx="9" cy="15" r="1.2" fill="#6366f1" opacity="0.7" />
    <circle cx="15" cy="15" r="1.2" fill="#6366f1" opacity="0.7" />
  </svg>
);
const ExploreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <polygon points="12,2 20,10 12,22 4,10" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="12,2 20,10 12,14 4,10" fill="#22c55e" opacity="0.25" />
    <line x1="4" y1="10" x2="20" y2="10" stroke="#22c55e" strokeWidth="1.2" opacity="0.65" />
  </svg>
);
const WorldIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M3 18 Q3 10 12 10 Q21 10 21 18" stroke="#60a5fa" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <line x1="3" y1="18" x2="21" y2="18" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="6" y1="18" x2="6" y2="14" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="12" y1="18" x2="12" y2="10.5" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="18" y1="18" x2="18" y2="14" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const HolonomyIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="7" stroke="#00f5ff" strokeWidth="1.5" fill="none" />
    <path d="M12 5 A7 7 0 0 1 19 12" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" />
    <polygon points="19,9 22,12 19,15" fill="#00f5ff" opacity="0.8" />
    <circle cx="12" cy="12" r="1.8" fill="#00f5ff" />
  </svg>
);
const MergeIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    {/* Three circles converging → merge/evolve metaphor */}
    <circle cx="7" cy="17" r="3" stroke="#a78bfa" strokeWidth="1.5" fill="none" />
    <circle cx="17" cy="17" r="3" stroke="#a78bfa" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="8" r="3" stroke="#a78bfa" strokeWidth="1.5" fill="none" />
    {/* Lines connecting to center */}
    <line x1="9.5" y1="15.5" x2="12" y2="12" stroke="#a78bfa" strokeWidth="1.2" opacity="0.7" />
    <line x1="14.5" y1="15.5" x2="12" y2="12" stroke="#a78bfa" strokeWidth="1.2" opacity="0.7" />
    {/* Center star burst */}
    <circle cx="12" cy="12" r="1.5" fill="#a78bfa" opacity="0.9" />
  </svg>
);
const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default MainMenu;
