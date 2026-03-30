import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import IntroCubie from '../intro/IntroCubie.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';

// All stickers black — same as the opening frames of the intro
const ZERO_REVEAL = { PZ: 0, NZ: 0, PX: 0, NX: 0, PY: 0, NY: 0 };

// ─── Antipodal face pulse rings ────────────────────────────────────────────────
// Cycle: B-G → R-O → W-Y → repeat
const PULSE_PAIRS = [
  { faces: ['PX', 'NX'] },  // Blue – Green
  { faces: ['PZ', 'NZ'] },  // Red  – Orange
  { faces: ['PY', 'NY'] },  // White – Yellow
];
const PAIR_INTERVAL = 1.3;   // seconds per step (pulse + gap)
const PULSE_DUR = 0.95;  // animation window within each step

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
// Same pattern as sharedTremorState in the game; no React re-renders on the hot path.
const _pulse = { idx: 0, rawP: 0 };

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

// DOM overlay — reads _pulse via rAF and updates div opacity directly (no React state)
const ScreenGlow = () => {
  const divRefs = useRef({});
  useEffect(() => {
    let raf;
    let prevIdx = -1;
    let prevRawP = -1;
    const tick = () => {
      const { idx, rawP } = _pulse;
      // Skip DOM writes when the pulse state hasn't changed (e.g. during the gap period)
      if (idx !== prevIdx || rawP !== prevRawP) {
        prevIdx = idx;
        prevRawP = rawP;
        const activeFaces = PULSE_PAIRS[idx]?.faces ?? [];
        const bell = rawP < 0.30 ? rawP / 0.30 : (1 - rawP) / 0.70;
        const alpha = Math.max(0, bell) * 0.28;
        FACE_KEYS.forEach(face => {
          const el = divRefs.current[face];
          if (!el) return;
          el.style.opacity = activeFaces.includes(face) ? String(alpha) : '0';
        });
      }
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
const RAY_STRANDS = 10;   // per face — distributed across the 4 tile gap lines
const RAY_PTS = 16;   // curve sample points per strand

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

      return { id: i, basePts, sparkOffset: rng() * Math.PI * 2 };
    });
  });
  return result;
})();

// Pre-computed Three.js color objects — no allocations in useFrame
const _faceColorObj = {};
FACE_KEYS.forEach(face => { _faceColorObj[face] = new THREE.Color(FACE_COLOR[face]); });

const FacePulses = () => {
  const lineRefs = useRef({});   // face → [line, ...]  (arrays)
  const lightRefs = useRef({});
  const pairState = useRef({ idx: 0, t0: -1 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const ps = pairState.current;
    if (ps.t0 < 0) ps.t0 = t;

    if (t - ps.t0 >= PAIR_INTERVAL) {
      ps.idx = (ps.idx + 1) % PULSE_PAIRS.length;
      ps.t0 += PAIR_INTERVAL;
    }

    const rawP = Math.min((t - ps.t0) / PULSE_DUR, 1.0);

    _pulse.idx = ps.idx;
    _pulse.rawP = rawP;

    // During the gap between pulses every face is invisible — skip geometry/light work
    if (rawP >= 1.0) return;

    const activeFaces = PULSE_PAIRS[ps.idx].faces;

    FACE_KEYS.forEach(face => {
      const lines = lineRefs.current[face];
      const light = lightRefs.current[face];
      const isActive = activeFaces.includes(face);

      if (!lines?.length) return;

      if (!isActive || rawP <= 0 || rawP >= 1) {
        lines.forEach(l => { if (l) l.visible = false; });
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

        // Growth: clip strand at current growth progress; collapsed points → tip of visible segment
        const pos = line.geometry.attributes.position.array;
        const base = cfg.basePts;
        const visibleEnd = growth * (RAY_PTS - 1);  // last visible point index (float)

        for (let j = 0; j < RAY_PTS; j++) {
          const clampedJ = Math.min(j, visibleEnd);
          const lo = Math.floor(clampedJ);
          const hi = Math.min(lo + 1, RAY_PTS - 1);
          const f = clampedJ - lo;
          pos[j * 3] = base[lo * 3] + (base[hi * 3] - base[lo * 3]) * f;
          pos[j * 3 + 1] = base[lo * 3 + 1] + (base[hi * 3 + 1] - base[lo * 3 + 1]) * f;
          pos[j * 3 + 2] = base[lo * 3 + 2] + (base[hi * 3 + 2] - base[lo * 3 + 2]) * f;
        }
        line.geometry.attributes.position.needsUpdate = true;

        // Vertex colors: bright face color at root → black at tip (Bloom makes it glow)
        const colors = line.geometry.attributes.color.array;
        for (let j = 0; j < RAY_PTS; j++) {
          const u = j / (RAY_PTS - 1);
          const glow = Math.pow(Math.max(0, 1 - u), 0.55);   // slower fade = longer bright core
          colors[j * 3] = col.r * glow;
          colors[j * 3 + 1] = col.g * glow;
          colors[j * 3 + 2] = col.b * glow;
        }
        line.geometry.attributes.color.needsUpdate = true;
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
            </group>
          </group>
        );
      })}
    </>
  );
};

const BlackCube = () => {
  const items = useMemo(() => {
    const result = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          result.push({ key: `${x}-${y}-${z}`, pos: [x - 1, y - 1, z - 1] });
    return result;
  }, []);
  return (
    <>
      {items.map(it => (
        <IntroCubie
          key={it.key}
          position={it.pos}
          size={3}
          explosionFactor={0}
          faceReveal={ZERO_REVEAL}
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
  });
  return (
    <group ref={groupRef}>
      <BlackCube />
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
        <span style={{
          fontSize: '9px',
          color: 'rgba(140,170,255,0.50)',
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.3s ease',
        }}>▼</span>
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

// ─── Locked store nav item ────────────────────────────────────────────────────
const StoreNavItem = () => {
  const [showTeaser, setShowTeaser] = useState(false);
  const parityPoints = useGameStore(s => s.parityPoints);
  const color = '#6366f1';
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => setShowTeaser(v => !v)}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', padding: '14px 12px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          position: 'relative', opacity: 0.55,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; }}
      >
        <span style={{
          lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: `drop-shadow(0 0 4px ${color}44)`,
          position: 'relative',
        }}>
          <StoreIcon />
          {/* Lock badge */}
          <span style={{
            position: 'absolute', top: '-4px', right: '-6px',
            fontSize: '9px', lineHeight: 1,
          }}>🔒</span>
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(150,170,220,0.55)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        }}>Store</span>
        {parityPoints > 0 && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            color: `${color}99`,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
            letterSpacing: '0.04em',
          }}>{parityPoints} PP</span>
        )}
      </button>

      {/* Teaser popup */}
      {showTeaser && (
        <>
          {/* Backdrop dismiss */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setShowTeaser(false)}
          />
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: '10px', width: '220px',
            background: 'rgba(8,12,32,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${color}40`,
            borderRadius: '14px', padding: '14px',
            boxShadow: `0 0 24px ${color}30, 0 8px 32px rgba(0,0,0,0.6)`,
            zIndex: 20,
            animation: 'fadeIn 0.18s ease',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: color, marginBottom: '8px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
            }}>Parity Store</div>
            <div style={{
              fontSize: '12px', lineHeight: 1.55, color: 'rgba(180,210,255,0.80)',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
            }}>
              Spend your Parity Points on worm skins, cube themes, and more. Earn points by collecting orbs in WORM mode and playing Disparity.
            </div>
            {/* Arrow */}
            <div style={{
              position: 'absolute', bottom: '-6px', left: '50%',
              width: '12px', height: '12px',
              background: 'rgba(8,12,32,0.96)', border: `1px solid ${color}40`,
              borderTop: 'none', borderLeft: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }} />
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
// onPlay / onHolonomy / onBiome / onMerge are kept as props for UILayer compatibility
// but are no longer wired to buttons — those modes live in the Coming Soon drawer.
const MainMenu = ({ onPlay: _onPlay, _onLevels, onFreeplay, _onCoop, onSettings, onBiome: _onBiome, onDisparity, onWormHealer, onHolonomy: _onHolonomy, onMerge: _onMerge }) => {
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

        {/* Settings gear */}
        <button onClick={onSettings} style={{
          position: 'absolute', bottom: 'max(14px, env(safe-area-inset-bottom,14px))', right: '16px',
          zIndex: 20, width: '36px', height: '36px', padding: 0,
          background: CLEAN.panelStrong, border: `1px solid ${CLEAN.border}`,
          borderRadius: '10px', cursor: 'pointer', color: CLEAN.textSubtle,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          pointerEvents: 'all',
          boxShadow: '0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.18)',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(120,160,255,0.5)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(59,130,246,0.35), 0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = CLEAN.textSubtle; e.currentTarget.style.borderColor = CLEAN.border; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.18)'; }}
        ><GearIcon /></button>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-18px)',
          transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
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
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to right, transparent, rgba(140,180,255,0.45))' }} />
            <p style={{
              margin: 0, fontSize: 'clamp(10px,1.7vw,13px)', letterSpacing: '0.26em',
              textTransform: 'uppercase', fontWeight: 600, color: 'rgba(200,220,255,0.80)',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
              textShadow: '0 0 20px rgba(100,160,255,0.5)',
            }}>A Cube That Remembers</p>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(to left, transparent, rgba(140,180,255,0.45))' }} />
          </div>
        </div>

        {/* ── Play WORM hero button ── */}
        <div style={{
          position: 'absolute', bottom: '130px', left: '50%', transform: 'translateX(-50%)',
          width: 'min(400px,85vw)', opacity: btnVisible ? 1 : 0, transition: 'opacity 0.55s ease',
          pointerEvents: 'all',
        }}>
          <div style={{
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
              style={{
                width: '100%', padding: '17px 32px',
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
        </div>

        {/* ── Coming Soon drawer ── */}
        <ComingSoonDrawer visible={btnVisible} />

        {/* ── Bottom nav pill: Disparity | Explore | Store ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom,20px))',
          display: 'flex', justifyContent: 'center', pointerEvents: 'all',
          opacity: btnVisible ? 1 : 0,
          transform: btnVisible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
        }}>
          <div style={{
            borderRadius: '100px', padding: '1.5px',
            background: 'linear-gradient(90deg,#ef444460,#f9731660,#eab30860,#22c55e60,#3b82f660,#a855f760,#ef444460)',
            boxShadow: '0 0 20px rgba(60,80,200,0.25), 0 8px 32px rgba(0,0,0,0.5)',
            width: 'min(360px,85vw)',
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
              <StoreNavItem />
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
